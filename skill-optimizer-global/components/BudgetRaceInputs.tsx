// SP budget + optional target-race context. Field shape mirrors `optimizer/types.ts`'s `RaceContext`
// exactly (read-only import, PR1 frozen) so PR4 can pass `value.raceContext` straight into
// `OptimizeInput.raceContext` / `probes.ts`'s `buildProbes()` without any reshaping.
import { h } from 'preact';

import { RaceContext } from '../optimizer/types';
import { TrackSelect } from '../../components/RaceTrack';

// Matches skill-visualizer-global's own default course pick, for consistency.
const DEFAULT_COURSE_ID = 10903;

export interface BudgetRaceInputsValue {
	budget: number;
	raceContext?: RaceContext;
}

export interface BudgetRaceInputsProps {
	value: BudgetRaceInputsValue;
	onChange: (value: BudgetRaceInputsValue) => void;
}

const DISTANCE_OPTIONS: Array<{ value: 1 | 2 | 3 | 4; label: string }> = [
	{ value: 1, label: 'Short' },
	{ value: 2, label: 'Mile' },
	{ value: 3, label: 'Mid' },
	{ value: 4, label: 'Long' },
];

const SURFACE_OPTIONS: Array<{ value: 1 | 2; label: string }> = [
	{ value: 1, label: 'Turf' },
	{ value: 2, label: 'Dirt' },
];

const STYLE_OPTIONS: Array<{ value: 1 | 2 | 3 | 4 | 5; label: string }> = [
	{ value: 1, label: 'Front Runner' },
	{ value: 2, label: 'Pace Chaser' },
	{ value: 3, label: 'Late Surger' },
	{ value: 4, label: 'End Closer' },
	{ value: 5, label: 'Great Escape' },
];

const PHASE_OPTIONS: Array<{ value: 0 | 1 | 2 | 3; label: string }> = [
	{ value: 0, label: 'Opening' },
	{ value: 1, label: 'Middle' },
	{ value: 2, label: 'Final' },
	{ value: 3, label: 'Spurt' },
];

function numOrUndefined(raw: string): number | undefined {
	if (raw === '') return undefined;
	const n = +raw;
	return Number.isNaN(n) ? undefined : n;
}

export function BudgetRaceInputs({ value, onChange }: BudgetRaceInputsProps) {
	const hasRaceContext = value.raceContext != null;

	function setBudget(raw: string) {
		const n = +raw;
		onChange({ ...value, budget: Number.isNaN(n) ? 0 : Math.max(0, n) });
	}

	function toggleRaceContext(enabled: boolean) {
		onChange({ ...value, raceContext: enabled ? {} : undefined });
	}

	function patchRaceContext(patch: Partial<RaceContext>) {
		onChange({ ...value, raceContext: { ...(value.raceContext ?? {}), ...patch } });
	}

	return (
		<div class="budget-race-inputs">
			<label class="budget-input">
				<span>SP budget</span>
				<input
					type="number"
					min="0"
					step="1"
					value={value.budget}
					onInput={e => setBudget((e.target as HTMLInputElement).value)}
				/>
			</label>

			<label class="race-context-toggle">
				<input
					type="checkbox"
					checked={hasRaceContext}
					onChange={e => toggleRaceContext((e.target as HTMLInputElement).checked)}
				/>
				<span>Set target race (spec: "No target race set" runs in generic mode)</span>
			</label>

			{hasRaceContext && (
				<div class="race-context-fields">
					<label>
						<span>Track</span>
						<TrackSelect
							courseid={value.raceContext?.trackId ?? DEFAULT_COURSE_ID}
							setCourseid={(courseId: number) => patchRaceContext({ trackId: courseId })}
						/>
					</label>
					<label>
						<span>Distance</span>
						<select
							value={value.raceContext?.distanceType ?? ''}
							onChange={e => patchRaceContext({ distanceType: numOrUndefined((e.target as HTMLSelectElement).value) as 1 | 2 | 3 | 4 | undefined })}
						>
							<option value="">(from track)</option>
							{DISTANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</label>
					<label>
						<span>Surface</span>
						<select
							value={value.raceContext?.surface ?? ''}
							onChange={e => patchRaceContext({ surface: numOrUndefined((e.target as HTMLSelectElement).value) as 1 | 2 | undefined })}
						>
							<option value="">(from track)</option>
							{SURFACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</label>
					<label>
						<span>Style</span>
						<select
							value={value.raceContext?.style ?? ''}
							onChange={e => patchRaceContext({ style: numOrUndefined((e.target as HTMLSelectElement).value) as 1 | 2 | 3 | 4 | 5 | undefined })}
						>
							<option value="">(any)</option>
							{STYLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</label>
					<label>
						<span>Phase</span>
						<select
							value={value.raceContext?.phase ?? ''}
							onChange={e => patchRaceContext({ phase: numOrUndefined((e.target as HTMLSelectElement).value) as 0 | 1 | 2 | 3 | undefined })}
						>
							<option value="">(any)</option>
							{PHASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
						</select>
					</label>
				</div>
			)}
		</div>
	);
}
