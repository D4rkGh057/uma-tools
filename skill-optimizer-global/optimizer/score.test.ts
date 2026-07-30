// Unit tests for the skill-condition-scoring corrections (spec domain: skill-condition-scoring).
// Run via `node test.mjs` at the skill-optimizer-global root (esbuild-bundles this file, then hands
// the bundle to `node --test` -- see test.mjs / esbuild-plugins.mjs). Uses 'node:assert/strict'
// (NOT the bare 'node:assert' specifier) so this file's own assertions bypass test.mjs's mockAssert
// plugin, which intercepts only the bare 'node:assert' specifier used internally by
// uma-skill-tools/tools/ConditionMatcher.ts (a transitive import of ./conditions).
import test from 'node:test';
import assert from 'node:assert/strict';

import { effectMagnitude, isSituationalSkill, scoringContext, ScoringContext } from './score';
import { buildProbes } from './probes';
import { optimize } from './optimize';
import { DistanceBucket, RaceContext, UmaBuild } from './types';

function closeTo(actual: number, expected: number, epsilon = 1e-9): void {
	assert.ok(
		Math.abs(actual - expected) < epsilon,
		`expected ${actual} to be close to ${expected} (diff ${Math.abs(actual - expected)})`
	);
}

function ctxOf(bucket: DistanceBucket, distance: number): ScoringContext {
	return { bucket, distance, isGenericMode: false, recovery: null };
}

/** Builds a real ScoringContext (via buildProbes + scoringContext, not the hand-rolled ctxOf above)
 *  so RecoveryContext is derived exactly the way optimize() derives it. `distanceType` 1=Short..4=Long
 *  resolves to BUCKET_DISTANCES' representative meters (probes.ts) when no trackId is given. */
function ctxWithBuild(distanceType: 1 | 2 | 3 | 4, build: UmaBuild): ScoringContext {
	const probes = buildProbes({ distanceType });
	return scoringContext(probes, build);
}

// --- Duration/distance group (spec: "Duration-and-Distance-Aware Effect Magnitude") ---

test('duration/distance: 3000m scores strictly higher than 1200m for a fixed Speed/Accel modifier', () => {
	// Skill 10071: single alternative, type 27 (Target Speed), modifier 1500, baseDuration 60000
	// (=> durSec 6). Formula: mod(0.15) * durSec(6) * (distance/1000).
	const at3000 = effectMagnitude('10071', ctxOf('Mid', 3000));
	const at1200 = effectMagnitude('10071', ctxOf('Mid', 1200));
	closeTo(at3000, 2.7);
	closeTo(at1200, 1.08);
	assert.ok(at3000 > at1200);
});

test('duration/distance: baseDuration <= 0 does not collapse magnitude to zero (uses the duration floor)', () => {
	// Skill 200011: single alternative, type 1 (Speed, also a STAT_POINT_TYPE), modifier 600000,
	// baseDuration -1 (permanent/instant) -- floor(1.0s) is substituted for durSec.
	// Formula: mod(60) * floor(1.0) * (distance/1000) * STAT_POINT_SCALE(0.01).
	const magnitude = effectMagnitude('200011', ctxOf('Mid', 2000));
	assert.ok(magnitude > 0);
	closeTo(magnitude, 1.2);
});

test('duration/distance: Stamina (non-scaled type) scores identically for Long and Mid buckets', () => {
	// Skill 200031: single alternative, type 2 (Stamina, a STAT_POINT_TYPE), modifier 600000. Long's
	// BUCKET_ADJUSTMENTS entry is now {} (identical to Mid) -- the old Long-specific override that
	// boosted Stamina is removed, not replaced.
	const long = effectMagnitude('200031', ctxOf('Long', 2000));
	const mid = effectMagnitude('200031', ctxOf('Mid', 2000));
	closeTo(long, mid);
	closeTo(long, 0.36); // mod(60) * weight(0.6) * STAT_POINT_SCALE(0.01)
});

test('duration/distance: a mixed Speed+Guts(+Power) alternative sums both scoring paths', () => {
	// Skill 202441: single alternative shape (2 duplicate condition-branches, same numbers), type 1
	// (Speed, duration-scaled + stat-point), type 3 (Power, weight path + stat-point), type 4 (Guts,
	// weight path + stat-point), all modifier 800000, baseDuration -1 (floor applies to type 1).
	// duration path (type 1): mod(80) * floor(1.0) * (distance/1000) * STAT_POINT_SCALE(0.01)
	// weight path (type 3):   mod(80) * weight(0.8) * STAT_POINT_SCALE(0.01) = 0.64
	// weight path (type 4):   mod(80) * weight(0.5) * STAT_POINT_SCALE(0.01) = 0.40
	const ctx = ctxOf('Mid', 2000);
	const magnitude = effectMagnitude('202441', ctx);
	const expectedDurationContribution = 80 * 1.0 * (2000 / 1000) * 0.01;
	closeTo(magnitude, expectedDurationContribution + 0.64 + 0.4);
	closeTo(magnitude, 2.64);
});

// --- Distance resolution group (spec: "Distance Fallback When Exact Race Distance Is Unavailable") ---

test('distance resolution: generic mode (no target race) uses the documented generic distance', () => {
	const ctx = scoringContext(null);
	assert.equal(ctx.isGenericMode, true);
	assert.equal(ctx.bucket, 'Short');
	assert.equal(ctx.distance, 2000);
});

test('distance resolution: bucket known but no trackId falls back to BUCKET_DISTANCES', () => {
	const ctx: RaceContext = { distanceType: 4 }; // Long, no trackId => no exact meters available
	const probes = buildProbes(ctx);
	assert.ok(probes != null);
	assert.equal(probes!.distanceBucket, 'Long');
	assert.equal(probes!.raceDistance, 3000); // BUCKET_DISTANCES.Long fallback
});

test('distance resolution: trackId set resolves the exact course distance, not the bucket fallback', () => {
	// course_data.json key '10105': raceTrackId 10001, distance 2600, distanceType 4 (Long).
	const ctx: RaceContext = { trackId: 10105 };
	const probes = buildProbes(ctx);
	assert.ok(probes != null);
	assert.equal(probes!.distanceBucket, 'Long');
	assert.equal(probes!.raceDistance, 2600); // exact, not the 3000 Long fallback
});

// --- Rushed-reduction / stat-point unit group ---
// (spec: "Rushed-Reduction Multiplier"; design Addendum: "Stat-Point Unit Correction")

test('Rushed: 202161 (anti-Rushed) scores measurably higher than an equal-modifier non-Rushed peer', () => {
	// 202161: type 5 (Wisdom, stat-point) modifier 600000 + type 29 (Rushed rate) modifier -30000,
	// baseDuration -1. 200251: single type-5 effect, same modifier 600000 -- the "equal-modifier,
	// non-Rushed peer" from the spec scenario.
	const ctx = ctxOf('Mid', 2000); // distance irrelevant here: neither effect type is duration-scaled
	const rushedSkill = effectMagnitude('202161', ctx);
	const peer = effectMagnitude('200251', ctx);
	closeTo(peer, 0.3); // Wit component alone: mod(60) * weight(0.5) * STAT_POINT_SCALE(0.01)
	closeTo(rushedSkill, 2.55); // Wit 0.30 + Rushed (mod 3.0 * weight 0.5 * MULTIPLIER 1.5 = 2.25)
	assert.ok(rushedSkill > peer);
});

test('stat-point unit correction: a green stat skill is within ~1 order of magnitude of a strong in-race skill', () => {
	// 200251 (stat-point, Wit +60) vs 10071 (in-race Target Speed) at the same distance -- prior to the
	// unit correction these differed by ~2 orders of magnitude (raw stat points vs raw m/s).
	const ctx = ctxOf('Mid', 2000);
	const statPoint = effectMagnitude('200251', ctx);
	const inRace = effectMagnitude('10071', ctx);
	const ratio = inRace / statPoint;
	assert.ok(ratio > 0.1 && ratio < 10, `expected ratio ${ratio} to be within one order of magnitude`);
});

// --- Positioning exclusion (spec: "Positioning Skills Excluded From Blended Score, Shown Separately") ---

test('isSituationalSkill: identifies real Positioning (ChangeLane) skills', () => {
	// 201261/201262 pair a type-28 (Lane Speed) effect with a type-35 (ChangeLane/Positioning) effect
	// in the same alternative -- the only two Positioning skills in the dataset.
	assert.equal(isSituationalSkill('201261'), true);
	assert.equal(isSituationalSkill('201262'), true);
	// A duration-scaled Speed skill is not situational.
	assert.equal(isSituationalSkill('10071'), false);
});

test('optimize(): a Positioning group is absent from picks and present in situational', () => {
	const input = {
		ownedSkills: [],
		budget: 0,
		hints: {},
	};
	const plan = optimize(input);
	assert.ok(!plan.picks.some(p => p.groupId === '20126'));
	const situationalIds = plan.situational.filter(s => s.groupId === '20126').map(s => s.skillId);
	assert.ok(situationalIds.includes('201261'));
	assert.ok(situationalIds.includes('201262'));
});

// --- Recovery HP-projection scoring (spec: "Recovery Effect Magnitude via Projected HP Deficit",
// "Graceful Degradation When Build Inputs Are Incomplete"; design decision #6 signed type-9) ---

// Skill 100451: single alternative, single type-9 (Recovery) effect, modifier 750 (gold heal, the
// design's own worked example). Skill 100711: type-27 (Target Speed, modifier 4500, baseDuration
// 40000) paired with type-9 modifier -100 -- a real HP-DRAIN Recovery effect (design decision #6).
// Skill 10451: single alternative, single type-9 effect, modifier 550 -- used for the flat-fallback
// regression pin (no other effect types to interfere).

test('Recovery: low-stamina Long build scores strictly higher than a high-stamina Short build', () => {
	// 600 stamina / Sasi / Long (BUCKET_DISTANCES.Long=3000): maxHp 3480, deficit ~814.68 -- heal
	// (750bp) is well within the deficit, so scores its full converted value (~1.9575).
	const lowStamLong = ctxWithBuild(4, { stamina: 600, strategy: 3 });
	// 1200 stamina / Nige / Short (BUCKET_DISTANCES.Short=1200): maxHp 2112, deficit 0 (break-even
	// build) -- heal converts to 0, never negative.
	const highStamShort = ctxWithBuild(1, { stamina: 1200, strategy: 1 });

	const lowStamLongScore = effectMagnitude('100451', lowStamLong);
	const highStamShortScore = effectMagnitude('100451', highStamShort);

	closeTo(lowStamLongScore, 1.9575, 1e-6);
	assert.equal(highStamShortScore, 0);
	assert.ok(lowStamLongScore > highStamShortScore);
});

test('Recovery: a heal exceeding the projected deficit is capped at the deficit, not its raw converted value', () => {
	// 1260 stamina / Sasi / Long (3000m): maxHp 4008, deficit ~286.68 -> capBp ~715.27, strictly below
	// the skill's raw 750bp -- the heal must price at the capped bp, not the raw 750.
	const ctx = ctxWithBuild(4, { stamina: 1260, strategy: 3 });
	const capped = effectMagnitude('100451', ctx);
	closeTo(capped, 2.150110050714911, 1e-6);
	assert.ok(capped < 2.2544999999999997, 'capped score must be strictly below the uncapped raw-750bp value');
});

test('Recovery: deficit <= 0 scores near 0, never negative', () => {
	// 1200 stamina / Sasi / Mid (2400m, break-even -- see hp.test.ts) -> deficit exactly 0.
	const ctx = ctxWithBuild(3, { stamina: 1200, strategy: 3 });
	// distanceType 3 (Mid) resolves to BUCKET_DISTANCES.Mid=2000, not 2400, but deficit is still 0 at
	// this shorter distance (a break-even build at 2400m has HP to spare at a shorter 2000m race).
	const score = effectMagnitude('100451', ctx);
	assert.ok(score >= 0);
});

test('Recovery: signed HP-drain (type 9, modifier -100) reduces the score, never boosts it', () => {
	// Reuses the low-stamina-Long build (deficit ~814.68, well above the drain's magnitude, so the
	// drain passes through uncapped per the signed Math.min contract).
	const ctx = ctxWithBuild(4, { stamina: 600, strategy: 3 });
	const withDrain = effectMagnitude('100711', ctx);
	// Type-27 contribution alone (mod 0.45 * durSec 4 * distance/1000 3 = 5.4) -- if the drain were
	// incorrectly Math.abs()'d instead of signed, the total would be ABOVE 5.4, not below it.
	closeTo(withDrain, 5.139, 1e-6);
	assert.ok(withDrain < 5.4, 'a real HP-drain must reduce the score below the non-Recovery contribution alone');
});

test('Recovery: falls back to the flat 0.7 weight when build is absent (generic mode)', () => {
	const ctx = scoringContext(null);
	assert.equal(ctx.recovery, null);
	// mod(0.055) * weight(0.7) -- the exact pre-existing flat formula, no STAT_POINT_SCALE (type 9 is
	// not a STAT_POINT_TYPE).
	closeTo(effectMagnitude('10451', ctx), 0.0385, 1e-9);
});

test('Recovery: falls back to the flat 0.7 weight when a target race is set but no build is given', () => {
	const ctx = scoringContext(buildProbes({ distanceType: 3 }));
	assert.equal(ctx.recovery, null);
	closeTo(effectMagnitude('10451', ctx), 0.0385, 1e-9);
});

test('Recovery: falls back to the flat 0.7 weight when build is missing stamina or strategy', () => {
	const missingStamina = ctxWithBuild(3, { strategy: 3 });
	const missingStrategy = ctxWithBuild(3, { stamina: 600 });
	assert.equal(missingStamina.recovery, null);
	assert.equal(missingStrategy.recovery, null);
	closeTo(effectMagnitude('10451', missingStamina), 0.0385, 1e-9);
	closeTo(effectMagnitude('10451', missingStrategy), 0.0385, 1e-9);
});

// --- effectiveRaceContext / generic-mode regression (verify-report obs #106, CRITICAL finding #5) ---
// build.strategy is populated by DEFAULT on both the manual-entry and roster-import paths (manual
// defaults to 'Senkou', roster always derives a bestStrat) -- so it must NEVER, by itself, promote a
// "no race context at all" input into target-race mode. It's only allowed to fill in `style` for
// condition-fit matching once the user has ALREADY set some raceContext.

test('optimize(): build.strategy alone (no raceContext at all) does not exit generic mode', () => {
	const noBuild = optimize({ ownedSkills: [], budget: 0, hints: {} });
	const withBuildStrategyOnly = optimize({
		ownedSkills: [],
		budget: 0,
		hints: {},
		build: { strategy: 3, stamina: 600 },
	});
	// Same total plan value -- proves the candidate pool (and thus which skills got hard-excluded via
	// running_style conflict facts) is identical, i.e. generic mode was preserved in both calls.
	assert.equal(withBuildStrategyOnly.totalScore, noBuild.totalScore);
	assert.equal(withBuildStrategyOnly.totalCost, noBuild.totalCost);
	assert.deepEqual(
		withBuildStrategyOnly.picks.map(p => p.skillId),
		noBuild.picks.map(p => p.skillId)
	);
	assert.deepEqual(
		withBuildStrategyOnly.situational.map(s => s.skillId).sort(),
		noBuild.situational.map(s => s.skillId).sort()
	);
});

test('optimize(): build.strategy DOES fill in style for fit-matching once raceContext is already set', () => {
	// raceContext sets only trackId (no style) -- build.strategy should be used as the style fallback
	// here, changing the plan vs. leaving style unset entirely (proves the fallback still functions,
	// just gated on raceContext being present at all).
	const raceContext = { trackId: 10105 }; // Long course, per score.test.ts's own fixture above
	const withoutBuildStrategy = optimize({ ownedSkills: [], budget: 0, hints: {}, raceContext });
	const withBuildStrategy = optimize({
		ownedSkills: [],
		budget: 0,
		hints: {},
		raceContext,
		build: { strategy: 3 },
	});
	// At least one of totalScore/picks/situational must differ, proving build.strategy's style
	// fallback was actually applied (fed into conflictFacts / fit-scoring) once a race context exists.
	const picksDiffer =
		JSON.stringify(withBuildStrategy.picks.map(p => p.skillId)) !==
		JSON.stringify(withoutBuildStrategy.picks.map(p => p.skillId));
	const situationalDiffers =
		JSON.stringify(withBuildStrategy.situational.map(s => s.skillId).sort()) !==
		JSON.stringify(withoutBuildStrategy.situational.map(s => s.skillId).sort());
	assert.ok(
		withBuildStrategy.totalScore !== withoutBuildStrategy.totalScore || picksDiffer || situationalDiffers,
		'expected build.strategy to change the plan once raceContext is already set'
	);
});
