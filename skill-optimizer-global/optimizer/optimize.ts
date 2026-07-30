// Orchestration entrypoint: owned skills + budget + hints + optional race context -> single optimal
// purchase combo (spec domain: skill-purchase-optimizer).
import { chainCost } from './cost';
import { isSkillImpossibleForRace } from './conditions';
import { buildProbes } from './probes';
import { effectMagnitude, rawFit } from './score';
import { skillGroups, skillMeta } from './skillGroups';
import { solve } from './knapsack';
import { DistanceBucket, GroupOption, HintInput, OptimizeInput, Plan, RaceProbes } from './types';

const DEFAULT_BLEND_WEIGHT = 0.5;
const DEFAULT_BUCKET: DistanceBucket = 'Short';

function ownedIndexByGroup(ownedSkills: Array<{ id: number; level: number }>): Map<string, number> {
	const owned = new Map<string, number>();
	for (const s of ownedSkills) {
		const idStr = String(s.id);
		const groupId = skillMeta[idStr]?.groupId;
		if (!groupId) continue;
		const tiers = skillGroups.get(groupId);
		const idx = tiers ? tiers.indexOf(idStr) : -1;
		// idx < 0 covers owned rarity-6 (evolved) tiers, which are excluded from the purchasable
		// chain entirely (skillGroups.ts) -- they simply don't participate in the optimizer.
		if (idx < 0) continue;
		const best = owned.get(groupId) ?? -1;
		if (idx > best) owned.set(groupId, idx);
	}
	return owned;
}

function minMax(values: number[]): { min: number; max: number } {
	if (values.length === 0) return { min: 0, max: 0 };
	let min = Infinity;
	let max = -Infinity;
	for (const v of values) {
		if (v < min) min = v;
		if (v > max) max = v;
	}
	return { min, max };
}

function normalize(v: number, range: { min: number; max: number }): number {
	if (range.max - range.min < 1e-9) return 0;
	// Clamp to [0,1]: `v` may be computed for a value outside the population that built `range` (e.g.
	// the owned-tier marginal baseline in `optimize()`), and the plain linear scale is otherwise
	// unbounded outside that population. Spec requires normalize() to reliably produce 0-1 output.
	return Math.max(0, Math.min(1, (v - range.min) / (range.max - range.min)));
}

interface TierScoring {
	cost: number;
	fit: number;
	magnitude: number;
}

function scoreTier(
	groupId: string,
	fromIdx: number,
	targetIdx: number,
	hints: HintInput,
	probes: RaceProbes | null
): TierScoring {
	const tiers = skillGroups.get(groupId)!;
	const skillId = tiers[targetIdx];
	const { cost } = chainCost(groupId, fromIdx, targetIdx, hints);
	const fit = rawFit(skillId, probes);
	const bucket = probes ? probes.distanceBucket : DEFAULT_BUCKET;
	const magnitude = effectMagnitude(skillId, bucket, probes == null);
	return { cost, fit, magnitude };
}

function valueOf(t: TierScoring): number {
	return t.cost > 0 ? t.magnitude / t.cost : t.magnitude;
}

/**
 * Solves for the single optimal purchase combo within `budget` SP.
 *
 * Marginal scoring (design decision #3): each candidate tier's combined score (fit + normalized
 * cost-per-magnitude, blended by `blendWeight`) is compared against the SAME uma's *currently owned*
 * tier in that group, scored via the identical pipeline. Both sides of the subtraction MUST share the
 * same cost basis: `chainCost()`'s contract is "cumulative cost to reach a tier from the uma's
 * currently-owned tier" (`chainCost(groupId, ownedIdx, targetIdx, hints)`), so the baseline prices the
 * owned tier via `chainCost(groupId, ownedIdx, ownedIdx, hints)` -- i.e. the owned tier priced against
 * itself, which the function's own `targetIdx <= ownedIdx` guard guarantees is 0 (matching "the owned
 * tier costs nothing further", not a from-scratch full-chain re-charge). This keeps "buy nothing" at 0
 * cost/0 score and lets upgrades compete fairly against brand-new purchases: an upgrade only scores as
 * much as the INCREMENTAL fit/value it adds beyond what the uma already has, priced on the exact same
 * marginal basis as every candidate.
 */
export function optimize(input: OptimizeInput): Plan {
	const { ownedSkills, budget, hints, raceContext, blendWeight = DEFAULT_BLEND_WEIGHT } = input;
	const probes = buildProbes(raceContext);
	const ownedIdxByGroup = ownedIndexByGroup(ownedSkills);
	const groupIds = Array.from(skillGroups.keys());

	interface RawCandidate {
		groupId: string;
		targetIdx: number;
		skillId: string;
		cost: number;
		scoring: TierScoring;
	}

	const rawByGroup: RawCandidate[][] = groupIds.map(groupId => {
		const tiers = skillGroups.get(groupId)!;
		const ownedIdx = ownedIdxByGroup.get(groupId) ?? -1;
		const candidates: RawCandidate[] = [];
		for (let targetIdx = ownedIdx + 1; targetIdx < tiers.length; targetIdx++) {
			const skillId = tiers[targetIdx];
			if (probes && isSkillImpossibleForRace(skillId, probes.conflictFacts)) continue;
			const scoring = scoreTier(groupId, ownedIdx, targetIdx, hints, probes);
			candidates.push({ groupId, targetIdx, skillId, cost: scoring.cost, scoring });
		}
		return candidates;
	});

	const allValues: number[] = [];
	for (const group of rawByGroup) {
		for (const c of group) allValues.push(valueOf(c.scoring));
	}
	const valueRange = minMax(allValues);

	function combinedScore(t: TierScoring): number {
		const valueNorm = normalize(valueOf(t), valueRange);
		return blendWeight * t.fit + (1 - blendWeight) * valueNorm;
	}

	const options: GroupOption[][] = groupIds.map((groupId, gi) => {
		const tiers = skillGroups.get(groupId)!;
		const ownedIdx = ownedIdxByGroup.get(groupId) ?? -1;
		const ownedSkillId = ownedIdx >= 0 ? tiers[ownedIdx] : '';

		const baselineScore =
			ownedIdx >= 0 ? combinedScore(scoreTier(groupId, ownedIdx, ownedIdx, hints, probes)) : 0;

		const noop: GroupOption = { groupId, targetIdx: ownedIdx, skillId: ownedSkillId, cost: 0, score: 0, steps: [] };
		const groupOptions: GroupOption[] = [noop];

		for (const c of rawByGroup[gi]) {
			const { steps } = chainCost(groupId, ownedIdx, c.targetIdx, hints);
			const score = Math.max(0, combinedScore(c.scoring) - baselineScore);
			groupOptions.push({ groupId, targetIdx: c.targetIdx, skillId: c.skillId, cost: c.cost, score, steps });
		}
		return groupOptions;
	});

	const result = solve(options, budget);
	return { totalCost: result.totalCost, totalScore: result.totalScore, picks: result.picks };
}
