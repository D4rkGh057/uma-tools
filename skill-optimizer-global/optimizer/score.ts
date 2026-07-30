// Condition-fit and cost-per-effect-magnitude scoring (spec domain: skill-condition-scoring).
import * as Matcher from '../../uma-skill-tools/tools/ConditionMatcher';
import { Node } from '../../uma-skill-tools/ConditionParser';
import { countAtoms, getParsedAlternatives } from './conditions';
import { skillData } from './skillGroups';
import { DistanceBucket, RaceProbes, UmaBuild } from './types';
import { maxHp as computeMaxHp, requiredHp as computeRequiredHp } from './hp';
import { calculateEquivalentStamina } from '../../uma-skill-tools/SpurtCalculator';

/**
 * Condition-fit in [0, 1].
 * - Target-race mode: fraction of the race's derived probes that structurally match ANY of the
 *   skill's alternatives (treeMatch/condMatcher, same soft "does this ever apply" pattern
 *   components/SkillPicker.tsx already uses for its condition filters). Already naturally 0-1, so no
 *   further min-max normalization is needed for this dimension (spec: "normalize ... to 0-1").
 * - Generic mode (no target race): breadth heuristic -- skills with fewer/simpler required
 *   conditions are usable in more races, so they score higher. There is no ground-truth oracle for
 *   this (design's Open Questions), so this is deliberately simple and documented rather than tuned.
 */
export function rawFit(skillId: string, probes: RaceProbes | null): number {
	const alts = getParsedAlternatives(skillId);
	if (alts.length === 0) return 0;

	if (probes && probes.matchProbes.length > 0) {
		let matched = 0;
		for (const probe of probes.matchProbes) {
			if (alts.some(alt => Matcher.treeMatch(probe as Node, alt.tree))) matched++;
		}
		return matched / probes.matchProbes.length;
	}

	const avgAtomCount = alts.reduce((sum, alt) => sum + countAtoms(alt.tree), 0) / alts.length;
	return 1 / (1 + avgAtomCount);
}

// Effect-type ids mirror components/SkillPicker.tsx's ExpandedSkillView EFFECT_TYPE_NAMES mapping.
// Baseline weights favor acceleration/speed -- the default profile used whenever no target race is
// set (obs #66: "defaults favor acceleration when no target race is set").
const BASE_WEIGHTS: Record<number, number> = {
	1: 1.0,   // Speed
	2: 0.6,   // Stamina
	3: 0.8,   // Power
	4: 0.5,   // Guts
	5: 0.5,   // Wit
	9: 0.7,   // Recovery
	21: 1.0,  // Current Speed
	22: 1.0,  // Current Speed (w/ decel)
	27: 1.1,  // Target Speed
	28: 0.9,  // Lane Speed
	31: 1.3,  // Acceleration
	37: 0.4,  // Random Gold Skill
	42: 0.6,  // Duration Increase
};
const DEFAULT_WEIGHT = 0.5;

// Per-bucket adjustments layered on BASE_WEIGHTS, applied only to the type-weight path (types
// outside DURATION_SCALED_TYPES). Long is intentionally identical to Mid ({}): the prior
// Long-specific override (boosted Stamina, cut Acceleration) is removed per spec ("Non-Speed/Accel
// Effect Types Retain Type-Weight Scoring, Long Bucket at Baseline"), not replaced with a new value.
// Short/Mile lean further into the acceleration-favoring baseline; Mid/Long stay at baseline (obs #66).
const BUCKET_ADJUSTMENTS: Record<DistanceBucket, Record<number, number>> = {
	Short: { 31: 1.4, 2: 0.4 },
	Mile: { 31: 1.3, 2: 0.5 },
	Mid: {},
	Long: {},
};

function weightsFor(bucket: DistanceBucket): Record<number, number> {
	return { ...BASE_WEIGHTS, ...BUCKET_ADJUSTMENTS[bucket] };
}

/** Effect types scored via the duration-and-distance-aware formula instead of a fixed type-weight
 *  (spec: "Duration-and-Distance-Aware Effect Magnitude for Speed/Acceleration Effects"):
 *  Speed(1), Current Speed(21), Current Speed w/ decel(22), Target Speed(27), Acceleration(31). */
const DURATION_SCALED_TYPES = new Set([1, 21, 22, 27, 31]);

// Real data uses baseDuration <= 0 (e.g. -1) for permanent/instant effects (green stat skills,
// 202161). Using this as an in-race effect duration would collapse the duration-scaled magnitude to
// zero or negative, so a documented nonzero floor is substituted instead (spec: "Instant effect does
// not vanish"). 1 second is a modelling choice (see design's Open Questions), not a derived value.
const DURATION_FLOOR_SECONDS = 1.0;

// Stat-boost effects (SpeedUp/StaminaUp/PowerUp/GutsUp/WisdomUp) store magnitude in STAT POINTS
// (e.g. +60 Wit), while in-race effects store m/s -- after the shared /10000 both land in the same
// raw magnitude, so stat-point skills would otherwise outrank in-race skills by ~2 orders of
// magnitude. This is a deliberate round 1/100 unit correction, NOT a tuned weight -- rebalancing the
// weight table itself is out of scope. Recovery (type 9, HP%) is a third unit and is priced through
// its own equivalent-stamina conversion instead (see recoveryMagnitude below), reusing this exact
// STAT_POINT_SCALE constant rather than inventing a fourth scale (design decision #3).
const STAT_POINT_TYPES = new Set([1, 2, 3, 4, 5]);
const STAT_POINT_SCALE = 0.01;

// Recovery (type 9, HP%) is scored via projected-HP-deficit magnitude instead of the flat type-weight
// formula whenever build/race context is complete enough (spec: "Recovery Effect Magnitude via
// Projected HP Deficit"). Kept as a named constant, not a magic 9, since it's referenced from both
// effectMagnitude's dispatch and buildRecoveryContext's gate.
const RECOVERY_EFFECT_TYPE = 9;

// Documented defaults for UmaBuild's optional refinement fields (design decision #7), mirrored from
// components/HorseDefTypes.ts:30-38's CC_GLOBAL Record -- the project's own default uma, not invented
// magic constants. Only used to fill in build.speed/guts/distanceAptitude when the caller omits them;
// build.stamina and build.strategy are NOT defaulted -- their absence disables HP-projection mode
// entirely (see buildRecoveryContext).
const DEFAULT_BUILD_SPEED = 1200;
const DEFAULT_BUILD_GUTS = 400;
const DEFAULT_BUILD_DISTANCE_APTITUDE = 0; // 'S'

// The engine itself only recognizes this one skill id for Rushed-rate reduction (RaceSolver.ts:601,
// `hasSelfControl`), so we key off the exact id rather than detecting type 29 generically -- the JP
// dataset has other type-29 skills with *positive* modifiers the solver never reads, which a generic
// Math.abs() over type 29 would incorrectly boost.
const RUSHED_REDUCTION_SKILL_IDS = new Set(['202161']);
const RUSHED_RATE_EFFECT_TYPE = 29;
// Explicit, named, documented multiplier reflecting HP-drain savings from reduced Rushed-triggering
// that the raw effect data itself doesn't capture (HpPolicy.ts:79 applies a 1.6x HP drain multiplier
// while Rushed). 1.5 is a hand-picked guess (needs empirical tuning against sim results, see design's
// Open Questions) chosen so an anti-Rushed skill clearly outranks an equal-modifier non-Rushed peer
// without dominating the whole pool post stat-point-unit-correction.
const RUSHED_REDUCTION_MULTIPLIER = 1.5;

// Positioning-type skills (SkillType.ChangeLane) are excluded from effectMagnitude/blended scoring
// entirely and surfaced separately instead (spec: "Positioning Skills Excluded From Blended Score,
// Shown Separately").
const SITUATIONAL_EFFECT_TYPES = new Set([35]);

/** True when any alternative of this skill carries a situational (Positioning) effect. Real
 *  Positioning skills (e.g. 201261/201262) pair a type-35 ChangeLane effect with a secondary type-28
 *  Lane Speed effect in the same alternative -- never a type-35-only alternative -- so this checks
 *  "contains" rather than "every effect is", matching the actual dataset shape. Callers use this to
 *  exclude the whole skill from scoring/ranking and surface it separately instead. */
export function isSituationalSkill(skillId: string): boolean {
	const skill = skillData[skillId];
	if (!skill) return false;
	return skill.alternatives.some(alt => alt.effects.some(ef => SITUATIONAL_EFFECT_TYPES.has(ef.type)));
}

/** Projected HP inputs for Recovery (type 9) scoring, derived once per optimize() call when build
 *  inputs are complete enough (see buildRecoveryContext's gate). `strategy` is carried alongside
 *  maxHp/requiredHp/deficitHp since calculateEquivalentStamina also needs it (SpurtCalculator.ts:314). */
export interface RecoveryContext {
	maxHp: number;
	requiredHp: number;
	deficitHp: number;
	strategy: 1 | 2 | 3 | 4 | 5;
}

/** Distance/generic-mode context effectMagnitude needs, derived once per optimize() call from
 *  RaceProbes (or its generic-mode defaults) -- see probes.ts / types.ts RaceProbes.raceDistance.
 *  `recovery` is null whenever HP-projection mode's gate isn't satisfied (missing stamina/strategy,
 *  generic mode, or no resolvable distance) -- effectMagnitude falls back to the flat Recovery weight
 *  in that case (spec: "Graceful Degradation When Build Inputs Are Incomplete"). */
export interface ScoringContext {
	bucket: DistanceBucket;
	distance: number;
	isGenericMode: boolean;
	recovery: RecoveryContext | null;
}

/** Representative distance for generic mode (no target race at all). Equal to BUCKET_DISTANCES.Mid
 *  (probes.ts) since Mid is the only bucket with no type-weight adjustment, so generic mode neither
 *  inflates nor deflates duration-scaled effects. */
const GENERIC_DISTANCE = 2000;
const GENERIC_BUCKET: DistanceBucket = 'Short';

/**
 * Gate for HP-projection mode (design "Gate for HP mode"): all of distance/stamina/strategy must be
 * present and valid, and we must not be in generic mode -- otherwise returns null and effectMagnitude
 * uses the pre-existing flat Recovery weight instead of crashing or silently scoring 0 (spec:
 * "Graceful Degradation When Build Inputs Are Incomplete").
 */
function buildRecoveryContext(distance: number, build: UmaBuild | undefined): RecoveryContext | null {
	if (!build) return null;
	const { stamina, strategy } = build;
	if (!(distance > 0)) return null;
	if (!(typeof stamina === 'number' && Number.isFinite(stamina) && stamina > 0)) return null;
	if (!(strategy === 1 || strategy === 2 || strategy === 3 || strategy === 4 || strategy === 5)) return null;

	const speed = build.speed ?? DEFAULT_BUILD_SPEED;
	const guts = build.guts ?? DEFAULT_BUILD_GUTS;
	const distanceAptitude = build.distanceAptitude ?? DEFAULT_BUILD_DISTANCE_APTITUDE;

	const maxHpValue = computeMaxHp(stamina, strategy, distance);
	const requiredHpValue = computeRequiredHp(speed, guts, strategy, distanceAptitude, distance);
	const deficitHp = Math.max(0, requiredHpValue - maxHpValue);
	return { maxHp: maxHpValue, requiredHp: requiredHpValue, deficitHp, strategy };
}

export function scoringContext(probes: RaceProbes | null, build?: UmaBuild): ScoringContext {
	if (probes == null) {
		return { bucket: GENERIC_BUCKET, distance: GENERIC_DISTANCE, isGenericMode: true, recovery: null };
	}
	const recovery = buildRecoveryContext(probes.raceDistance, build);
	return { bucket: probes.distanceBucket, distance: probes.raceDistance, isGenericMode: false, recovery };
}

/**
 * Recovery (type 9) magnitude via projected HP deficit (spec: "Recovery Effect Magnitude via
 * Projected HP Deficit"). `modifier` is passed RAW (signed basis points, e.g. 750 or -100 for a
 * drain) -- calculateEquivalentStamina does its own /10000 (SpurtCalculator.ts:314), so it must NOT be
 * pre-divided/pre-Math.abs'd here the way the generic type-weight path does above.
 *
 * The heal is capped at the uma's pre-purchase projected HP deficit (never valued beyond what the
 * build can actually use), but the cap is applied via signed Math.min, NOT Math.abs -- a real HP-DRAIN
 * type-9 effect (negative modifier, design decision #6) must reduce the score, never be boosted into
 * a positive contribution the way an unsigned Math.abs would incorrectly do.
 */
function recoveryMagnitude(modifier: number, recovery: RecoveryContext, weights: Record<number, number>): number {
	const capBp = (recovery.deficitHp / recovery.maxHp) * 10000;
	const bp = Math.min(modifier, capBp); // SIGNED: drains (negative modifier) pass through uncapped
	const equivStamina = calculateEquivalentStamina(bp, recovery.maxHp, recovery.strategy);
	// weights[2] is the bucket-adjusted Stamina weight (Short .4 / Mile .5 / Mid+Long .6) -- Recovery
	// is priced as "the heal is worth the stamina that would have supplied it" (design decision #3),
	// reusing the exact STAT_POINT_TYPES pricing shape (statPoints * weight * STAT_POINT_SCALE) inline
	// since the multiplication order differs from the generic path (type 9 is deliberately NOT added
	// to STAT_POINT_TYPES above).
	return equivStamina * (weights[2] ?? 0.6) * STAT_POINT_SCALE;
}

/**
 * Raw (unbounded) effect magnitude for a skill's strongest alternative. Speed/Acceleration-family
 * effect types (DURATION_SCALED_TYPES) are scored via a duration-and-distance-aware formula; all
 * other types keep the fixed type-weight scoring, distance-bucket adjusted (weightsFor). `ctx`'s
 * `isGenericMode` forces the acceleration-favoring baseline for the type-weight path regardless of
 * `ctx.bucket` (used when no target race is set at all -- obs #66); `ctx.distance` (always populated)
 * drives the duration-scaled path in both modes.
 */
export function effectMagnitude(skillId: string, ctx: ScoringContext): number {
	const skill = skillData[skillId];
	if (!skill) return 0;
	const weights = ctx.isGenericMode ? BASE_WEIGHTS : weightsFor(ctx.bucket);
	const isRushedSkill = RUSHED_REDUCTION_SKILL_IDS.has(skillId);

	let best = 0;
	for (const alt of skill.alternatives) {
		const durSec = alt.baseDuration / 10000; // mirrors RaceSolverBuilder.ts:287
		let total = 0;
		for (const ef of alt.effects) {
			if (ef.type === RECOVERY_EFFECT_TYPE && ctx.recovery != null) {
				total += recoveryMagnitude(ef.modifier, ctx.recovery, weights);
				continue;
			}
			const mod = Math.abs(ef.modifier) / 10000;
			let c = DURATION_SCALED_TYPES.has(ef.type)
				? mod * (durSec > 0 ? durSec : DURATION_FLOOR_SECONDS) * (ctx.distance / 1000)
				: mod * (weights[ef.type] ?? DEFAULT_WEIGHT);
			if (STAT_POINT_TYPES.has(ef.type)) c *= STAT_POINT_SCALE;
			if (isRushedSkill && ef.type === RUSHED_RATE_EFFECT_TYPE) c *= RUSHED_REDUCTION_MULTIPLIER;
			total += c;
		}
		if (total > best) best = total;
	}
	return best;
}
