// Combo output + dev-only per-group breakdown (design "Testing Strategy": "Dev-only breakdown panel
// printing per-group options (cost, score, exclusion reason)"). `optimize.ts` (PR1, frozen) only
// returns the final `Plan` -- it does not expose the full candidate pool it evaluated internally. The
// breakdown below re-derives that pool for display purposes ONLY, using optimize.ts's own EXPORTED
// pure building blocks (`chainCost`, `buildProbes`, `isSkillImpossibleForRace`, `rawFit`,
// `effectMagnitude`, `skillGroups`/`skillMeta`) in the same sequence `optimize()` itself uses --
// nothing in `optimizer/*.ts` is modified or forked. This mirrors the UI-layer duplication precedent
// already documented in `UmaSelect.tsx`'s `ownedTiersFromSkills` (design decision #7's "re-derive
// locally" pattern, necessary because optimize.ts's own candidate-enumeration is a private, unexported
// implementation detail).
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';

import { chainCost } from '../optimizer/cost';
import { isSkillImpossibleForRace } from '../optimizer/conditions';
import { candidateGroupIds } from '../optimizer/optimize';
import { buildProbes } from '../optimizer/probes';
import { effectMagnitude, isSituationalSkill, rawFit, scoringContext } from '../optimizer/score';
import { skillGroups } from '../optimizer/skillGroups';
import { OptimizeInput, Plan, RaceProbes } from '../optimizer/types';
import { ownedTiersFromSkills } from './UmaSelect';

import skillnames from '../../uma-skill-tools/data/skillnames.json';

function getSkillName(skillId: string): string {
	return (skillnames as Record<string, string[]>)[skillId]?.[0] || `Skill ${skillId}`;
}

// Mirrors optimize.ts's own defaults exactly so displayed scores match `plan` for any picked
// candidate -- see file header.
const DEFAULT_BLEND_WEIGHT = 0.5;

interface CandidateBreakdown {
	skillId: string;
	name: string;
	cost: number;
	score: number;
	picked: boolean;
	excluded: boolean;
	exclusionReason: string | null;
}

interface GroupBreakdown {
	groupId: string;
	ownedSkillId: string | null;
	candidates: CandidateBreakdown[];
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
	return Math.max(0, Math.min(1, (v - range.min) / (range.max - range.min)));
}

/** Re-derives optimize()'s full per-group candidate pool (including excluded/unpicked tiers), for
 *  display only -- see file header. */
function buildBreakdown(input: OptimizeInput, plan: Plan): GroupBreakdown[] {
	const { ownedSkills, hints, raceContext, blendWeight = DEFAULT_BLEND_WEIGHT } = input;
	const probes: RaceProbes | null = buildProbes(raceContext);
	const ctx = scoringContext(probes);
	const ownedIdxByGroup = ownedTiersFromSkills(ownedSkills);
	const groupIds = candidateGroupIds(hints);

	interface Raw {
		groupId: string; targetIdx: number; skillId: string;
		cost: number; fit: number; magnitude: number; excluded: boolean;
	}

	const rawByGroup: Raw[][] = groupIds.map(groupId => {
		const tiers = skillGroups.get(groupId)!;
		const ownedIdx = ownedIdxByGroup.get(groupId) ?? -1;
		const rows: Raw[] = [];
		for (let targetIdx = ownedIdx + 1; targetIdx < tiers.length; targetIdx++) {
			const skillId = tiers[targetIdx];
			// Positioning skills never enter scoring/ranking -- skip the row entirely, they're shown in
			// the separate "Situational (not scored)" table below instead (mirrors optimize.ts).
			if (isSituationalSkill(skillId)) continue;
			const excluded = probes != null && isSkillImpossibleForRace(skillId, probes.conflictFacts);
			const { cost } = chainCost(groupId, ownedIdx, targetIdx, hints);
			const fit = excluded ? 0 : rawFit(skillId, probes);
			const magnitude = excluded ? 0 : effectMagnitude(skillId, ctx);
			rows.push({ groupId, targetIdx, skillId, cost, fit, magnitude, excluded });
		}
		return rows;
	});

	const allValues: number[] = [];
	for (const group of rawByGroup) {
		for (const c of group) if (!c.excluded) allValues.push(c.cost > 0 ? c.magnitude / c.cost : c.magnitude);
	}
	const valueRange = minMax(allValues);

	function combinedScore(fit: number, magnitude: number, cost: number): number {
		const value = cost > 0 ? magnitude / cost : magnitude;
		return blendWeight * fit + (1 - blendWeight) * normalize(value, valueRange);
	}

	return groupIds.map((groupId, gi) => {
		const tiers = skillGroups.get(groupId)!;
		const ownedIdx = ownedIdxByGroup.get(groupId) ?? -1;
		const ownedSkillId = ownedIdx >= 0 ? tiers[ownedIdx] : null;
		const baselineScore = ownedIdx >= 0
			? combinedScore(rawFit(tiers[ownedIdx], probes), effectMagnitude(tiers[ownedIdx], ctx), 0)
			: 0;

		const candidates: CandidateBreakdown[] = rawByGroup[gi].map(c => {
			const picked = plan.picks.some(p => p.groupId === groupId && p.targetIdx === c.targetIdx);
			const score = c.excluded ? 0 : Math.max(0, combinedScore(c.fit, c.magnitude, c.cost) - baselineScore);
			return {
				skillId: c.skillId,
				name: getSkillName(c.skillId),
				cost: c.cost,
				score,
				picked,
				excluded: c.excluded,
				exclusionReason: c.excluded ? 'Structurally conflicts with target race (hard exclusion)' : null,
			};
		});

		return { groupId, ownedSkillId, candidates };
	});
}

export interface ResultPanelProps {
	input: OptimizeInput | null;
	plan: Plan | null;
}

export function ResultPanel({ input, plan }: ResultPanelProps) {
	const [showBreakdown, setShowBreakdown] = useState(false);

	const breakdown = useMemo(
		() => (showBreakdown && input && plan ? buildBreakdown(input, plan) : null),
		[showBreakdown, input, plan]
	);

	if (!input || !plan) {
		return <div class="result-panel-empty">Select an uma to see a recommended purchase combo.</div>;
	}

	return (
		<div class="result-panel">
			<div class="result-summary">
				<span>Total cost: {plan.totalCost} SP</span>
				<span>Total score: {plan.totalScore.toFixed(3)}</span>
			</div>

			{plan.picks.length === 0 && (
				<div class="result-empty">No purchase improves the score within budget.</div>
			)}
			{plan.picks.length > 0 && (
				<table class="result-picks">
					<thead><tr><th>Skill</th><th>Cost</th><th>Score</th><th>Steps</th></tr></thead>
					<tbody>
						{plan.picks.map(p => (
							<tr key={`${p.groupId}-${p.targetIdx}`}>
								<td>{getSkillName(p.skillId)}</td>
								<td>{p.cost}</td>
								<td>{p.score.toFixed(3)}</td>
								<td>{p.steps.map(s => `${getSkillName(s.skillId)} (hint ${s.hint}, ${s.cost} SP)`).join(', ')}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{plan.situational.length > 0 && (
				<div class="result-situational">
					<div class="result-situational-header">Situational (not scored)</div>
					<table class="result-situational-table">
						<thead><tr><th>Skill</th><th>Cost</th><th>Reason</th></tr></thead>
						<tbody>
							{plan.situational.map(s => (
								<tr key={`${s.groupId}-${s.skillId}`}>
									<td>{getSkillName(s.skillId)}</td>
									<td>{s.cost}</td>
									<td>{s.reason}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<button type="button" class="result-breakdown-toggle" onClick={() => setShowBreakdown(v => !v)}>
				{showBreakdown ? 'Hide' : 'Show'} dev breakdown
			</button>
			{breakdown && (
				<div class="result-breakdown">
					{breakdown.filter(g => g.candidates.length > 0).map(g => (
						<div class="result-breakdown-group" key={g.groupId}>
							<div class="result-breakdown-group-header">
								Group {g.groupId} (owned: {g.ownedSkillId ? getSkillName(g.ownedSkillId) : 'none'})
							</div>
							<table>
								<thead><tr><th>Skill</th><th>Cost</th><th>Score</th><th>Picked</th><th>Excluded</th></tr></thead>
								<tbody>
									{g.candidates.map(c => (
										<tr key={c.skillId} class={c.excluded ? 'result-breakdown-excluded' : ''}>
											<td>{c.name}</td>
											<td>{c.cost}</td>
											<td>{c.score.toFixed(3)}</td>
											<td>{c.picked ? 'yes' : ''}</td>
											<td>{c.exclusionReason ?? ''}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
