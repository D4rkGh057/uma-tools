// Condition-fit and cost-per-effect-magnitude scoring (spec domain: skill-condition-scoring).
import * as Matcher from '../../uma-skill-tools/tools/ConditionMatcher';
import { Node } from '../../uma-skill-tools/ConditionParser';
import { countAtoms, getParsedAlternatives } from './conditions';
import { skillData } from './skillGroups';
import { DistanceBucket, RaceProbes } from './types';

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

// Per-bucket adjustments layered on BASE_WEIGHTS. Long increases stamina's weight and eases off
// acceleration; Short/Mile lean further into the acceleration-favoring baseline; Mid stays at
// baseline (obs #66).
const BUCKET_ADJUSTMENTS: Record<DistanceBucket, Record<number, number>> = {
	Short: { 31: 1.4, 2: 0.4 },
	Mile: { 31: 1.3, 2: 0.5 },
	Mid: {},
	Long: { 2: 1.3, 31: 1.0 },
};

function weightsFor(bucket: DistanceBucket): Record<number, number> {
	return { ...BASE_WEIGHTS, ...BUCKET_ADJUSTMENTS[bucket] };
}

/**
 * Raw (unbounded) effect magnitude for a skill's strongest alternative, distance-bucket weighted.
 * `isGenericMode` forces the acceleration-favoring baseline regardless of `bucket` (used when no
 * target race is set at all -- obs #66).
 */
export function effectMagnitude(skillId: string, bucket: DistanceBucket, isGenericMode: boolean): number {
	const skill = skillData[skillId];
	if (!skill) return 0;
	const weights = isGenericMode ? BASE_WEIGHTS : weightsFor(bucket);

	let best = 0;
	for (const alt of skill.alternatives) {
		let total = 0;
		for (const ef of alt.effects) {
			const w = weights[ef.type] ?? DEFAULT_WEIGHT;
			total += (Math.abs(ef.modifier) / 10000) * w;
		}
		if (total > best) best = total;
	}
	return best;
}
