// Grouped / multiple-choice knapsack: each groupId contributes exactly ONE option to the solution.
// `options[g][0]` is always expected to be the free "no-op" choice (cost 0, score 0, targetIdx =
// currently owned tier) -- this is what keeps a group's tiers mutually exclusive: picking white AND
// gold of the same groupId as separate 0/1 items would double-count the chain's cost (design decision #1).
//
// NB: design's interface sketch suggested Int16Array dp/choice buffers for memory efficiency. This
// implementation deliberately uses plain number[] instead -- scores here are fractional (0-1 blended,
// then marginal-differenced), which does not fit cleanly into an integer typed array without an extra
// fixed-point scaling step, and there is no test harness yet to validate that optimization is
// correct under scaling. Correctness is prioritized over the memory micro-optimization for this PR;
// see apply-progress "Deviations from Design".
import { GroupOption } from './types';

export interface SolveResult {
	totalCost: number;
	totalScore: number;
	picks: GroupOption[];
}

export function solve(options: GroupOption[][], budget: number): SolveResult {
	const B = Math.max(0, Math.floor(budget));
	const groups = options.length;

	// dp[j] = best total score achievable with SP budget exactly j, after considering groups [0..g).
	let dp: number[] = new Array(B + 1).fill(0);
	const choice: number[][] = new Array(groups);

	for (let g = 0; g < groups; g++) {
		const groupOptions = options[g];
		const next: number[] = dp.slice();
		const chosen: number[] = new Array(B + 1).fill(0);

		for (let j = 0; j <= B; j++) {
			let best = dp[j];
			let bestIdx = 0;
			for (let o = 0; o < groupOptions.length; o++) {
				const opt = groupOptions[o];
				if (opt.cost > j) continue;
				const candidate = dp[j - opt.cost] + opt.score;
				if (candidate > best) {
					best = candidate;
					bestIdx = o;
				}
			}
			next[j] = best;
			chosen[j] = bestIdx;
		}

		dp = next;
		choice[g] = chosen;
	}

	const picks: GroupOption[] = [];
	let j = B;
	for (let g = groups - 1; g >= 0; g--) {
		const idx = choice[g][j];
		const opt = options[g][idx];
		if (idx !== 0) picks.push(opt);
		j -= opt.cost;
	}
	picks.reverse();

	const totalCost = picks.reduce((sum, p) => sum + p.cost, 0);
	const totalScore = picks.reduce((sum, p) => sum + p.score, 0);
	return { totalCost, totalScore, picks };
}
