// Fresh cost/discount implementation -- deliberately NOT reusing UmasTab.tsx's `costForId`, whose
// owned-tier-skip branch only skips the single tier that exactly equals the owned skill id and is
// otherwise dead/untested for chain math. See design decision #2.
import { skillGroups, skillMeta } from './skillGroups';
import { ChainStep } from './types';

/** hint 0-3 => 10% per level; hint 4-5 => 30% + 5% per level beyond 3 (spec: "Per-Step Hint Discount"). */
export const hintDiscount = (hint: number): number => (hint <= 3 ? 0.1 * hint : 0.3 + 0.05 * (hint - 3));

export const stepCost = (baseCost: number, hint: number): number => Math.floor(baseCost * (1 - hintDiscount(hint)));

function clampHint(hint: number | undefined): number {
	if (hint == null || Number.isNaN(hint)) return 0;
	return Math.max(0, Math.min(5, hint));
}

/**
 * Cumulative SP cost for a groupId chain from `ownedIdx` (exclusive; -1 = nothing owned) to
 * `targetIdx` (inclusive), applying the hint discount PER unpurchased step and summing the
 * discounted results (spec: "Per-Step Hint Discount" -- discount MUST NOT be applied once to a
 * combined/summed base cost).
 */
export function chainCost(
	groupId: string,
	ownedIdx: number,
	targetIdx: number,
	hints: Record<string, number>
): { cost: number; steps: ChainStep[] } {
	const tiers = skillGroups.get(groupId);
	if (!tiers || targetIdx < 0 || targetIdx >= tiers.length || targetIdx <= ownedIdx) {
		return { cost: 0, steps: [] };
	}

	const steps: ChainStep[] = [];
	let total = 0;
	for (let i = ownedIdx + 1; i <= targetIdx; i++) {
		const skillId = tiers[i];
		const baseCost = skillMeta[skillId]?.baseCost ?? 0;
		const hint = clampHint(hints[skillId]);
		const cost = stepCost(baseCost, hint);
		steps.push({ skillId, baseCost, hint, cost });
		total += cost;
	}
	return { cost: total, steps };
}
