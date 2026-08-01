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
import { useState } from 'preact/hooks';

import { EvaluationResult, OptimizeInput, Plan } from '../optimizer/types';
import { readyResultContent } from './resultPanelReady';
import { ResultPanelState, resultPanelStateContent } from './resultPanelState';

import skillnames from '../../uma-skill-tools/data/skillnames.json';

function getSkillName(skillId: string): string {
	return (skillnames as Record<string, string[]>)[skillId]?.[0] || `Skill ${skillId}`;
}

export interface ResultPanelProps {
	input: OptimizeInput | null;
	plan: Plan | null;
	result?: EvaluationResult | null;
	state?: ResultPanelState | null;
}

export function ResultPanel({ input, plan, result, state }: ResultPanelProps) {
	const [showBreakdown, setShowBreakdown] = useState(false);
	const readyContent = result?.status === 'ready' ? readyResultContent(result) : null;
	const stateContent = state ?? (result?.status !== undefined && result.status !== 'ready' ? result : null);
	const displayedPlan = readyContent?.plan ?? plan;
	const breakdown = showBreakdown ? readyContent?.breakdown : null;

	if (stateContent) {
		return <div class="result-panel-empty">{resultPanelStateContent(stateContent).message}</div>;
	}

	if (!displayedPlan) {
		return <div class="result-panel-empty">Select an uma to see a recommended purchase combo.</div>;
	}

	return (
		<div class="result-panel">
			<div class="result-summary">
				<span>Total cost: {displayedPlan.totalCost} SP</span>
				<span>Total score: {displayedPlan.totalScore.toFixed(3)}</span>
			</div>

			{displayedPlan.picks.length === 0 && (
				<div class="result-empty">No purchase improves the score within budget.</div>
			)}
			{displayedPlan.picks.length > 0 && (
				<table class="result-picks">
					<thead><tr><th>Skill</th><th>Cost</th><th>Score</th><th>Steps</th></tr></thead>
					<tbody>
						{displayedPlan.picks.map(p => (
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

			{displayedPlan.situational.length > 0 && (
				<div class="result-situational">
					<div class="result-situational-header">Situational (not scored)</div>
					<table class="result-situational-table">
						<thead><tr><th>Skill</th><th>Cost</th><th>Reason</th></tr></thead>
						<tbody>
						{displayedPlan.situational.map(s => (
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
