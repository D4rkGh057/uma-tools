// Manual hand-entry form for one uma's stats/aptitudes/strategy/owned skills (spec domain:
// manual-uma-entry, "Field Parity With Roster Data"). Plain-object local state -- no immutable
// `Record`, no `CC_GLOBAL`-dependent `HorseState` (design's "UI Shape"). Reuses the leaf widgets from
// `../../components/HorseStatInputs` (NOT `HorseDef.tsx` -- see that file's header comment for why)
// and `SkillPickerModal` from `../../components/SkillPicker` (identical usage to HintTable.tsx).
import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

import { Stat, AptitudeSelect, StrategySelect } from '../../components/HorseStatInputs';
import { SkillPickerModal } from '../../components/SkillPicker';
import { skillGroups } from '../optimizer/skillGroups';
import { clampStat, fromManualForm, ManualForm, UmaInput } from './umaInput';
import { ManualUmaState, defaultOptimizerBuildState } from '../optimizerBuildStorage';

export interface ManualUmaEntryProps {
	initialState: ManualUmaState;
	onChange: (state: ManualUmaState, input: UmaInput) => void;
}

interface LocalState extends ManualUmaState {
	// Collected for field parity with roster import (spec: "Field Parity With Roster Data" lists all
	// three aptitudes) but NOT part of UmaBuild/ManualForm -- only distanceAptitude feeds the HP
	// projection / condition-fit matching (design's "Optional build fields").
}

function initialState(): LocalState {
	return defaultOptimizerBuildState().manualUma;
}

function toManualForm(state: LocalState): ManualForm {
	return {
		speed: state.speed,
		stamina: state.stamina,
		power: state.power,
		guts: state.guts,
		wisdom: state.wisdom,
		strategy: state.strategy,
		distanceAptitude: state.distanceAptitude,
		ownedSkills: state.ownedSkills,
		label: 'Manual entry',
	};
}

type StatField = 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom';

export function ManualUmaEntry({ initialState: savedState, onChange }: ManualUmaEntryProps) {
	const [state, setState] = useState<LocalState>(() => ({ ...initialState(), ...savedState, ownedSkills: [...savedState.ownedSkills] }));
	const [pickerOpen, setPickerOpen] = useState(false);
	// Empty/non-finite/out-of-range raw input alerts (`role="alert"`) and clears once the same field
	// later receives valid raw input, without changing the existing clamped numeric value below (spec:
	// "Complete Control Presentation" -- "Invalid manual entry recovery").
	const [invalidStats, setInvalidStats] = useState<ReadonlySet<StatField>>(new Set());

	const candidateSkillIds = useMemo(() => Array.from(skillGroups.values()).flat(), []);

	function commit(patch: Partial<LocalState>) {
		const next = { ...state, ...patch };
		setState(next);
		onChange(next, fromManualForm(toManualForm(next)));
	}

	// Notify the parent once on mount too, so selecting "Enter manually" immediately produces a
	// (mostly-empty) UmaInput rather than leaving app.tsx's selection stuck at the previous value.
	useEffect(() => {
		onChange(state, fromManualForm(toManualForm(state)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function statField(field: StatField) {
		return (raw: number) => commit({ [field]: clampStat(raw) } as Partial<LocalState>);
	}

	function statValidity(field: StatField) {
		return (_raw: string, valid: boolean) => setInvalidStats(prev => {
			if (valid === !prev.has(field)) return prev;
			const next = new Set(prev);
			if (valid) next.delete(field); else next.add(field);
			return next;
		});
	}


	function addSkill(skillId: string) {
		const id = Number(skillId);
		if (state.ownedSkills.some(s => s.id === id)) {
			setPickerOpen(false);
			return;
		}
		commit({ ownedSkills: [...state.ownedSkills, { id, level: 1 }] });
		setPickerOpen(false);
	}

	function removeSkill(id: number) {
		commit({ ownedSkills: state.ownedSkills.filter(s => s.id !== id) });
	}

	return (
		<div class="manual-uma-entry">
			<fieldset class="manual-uma-stats">
				<legend>Build stats</legend>
				<Stat label="Speed" statIdx={0} value={state.speed ?? ''} change={statField('speed')} onRawValidityChange={statValidity('speed')} />
				{invalidStats.has('speed') && <span role="alert" class="manual-uma-stat-alert">Speed must be a number between 1 and 2000.</span>}
				<Stat label="Stamina" statIdx={1} value={state.stamina ?? ''} change={statField('stamina')} onRawValidityChange={statValidity('stamina')} />
				{invalidStats.has('stamina') && <span role="alert" class="manual-uma-stat-alert">Stamina must be a number between 1 and 2000.</span>}
				<Stat label="Power" statIdx={2} value={state.power ?? ''} change={statField('power')} onRawValidityChange={statValidity('power')} />
				{invalidStats.has('power') && <span role="alert" class="manual-uma-stat-alert">Power must be a number between 1 and 2000.</span>}
				<Stat label="Guts" statIdx={3} value={state.guts ?? ''} change={statField('guts')} onRawValidityChange={statValidity('guts')} />
				{invalidStats.has('guts') && <span role="alert" class="manual-uma-stat-alert">Guts must be a number between 1 and 2000.</span>}
				<Stat label="Wit" statIdx={4} value={state.wisdom ?? ''} change={statField('wisdom')} onRawValidityChange={statValidity('wisdom')} />
				{invalidStats.has('wisdom') && <span role="alert" class="manual-uma-stat-alert">Wit must be a number between 1 and 2000.</span>}
			</fieldset>
			<fieldset class="manual-uma-apts">
				<legend>Aptitudes</legend>
				<label class="manual-uma-apt-cell">
					<span>Strategy</span>
					<StrategySelect s={state.strategy} setS={(s: ManualForm['strategy']) => commit({ strategy: s })} />
				</label>
				<label class="manual-uma-apt-cell">
					<span>Dist</span>
					<AptitudeSelect a={state.distanceAptitude} setA={(a: string) => commit({ distanceAptitude: a })} />
				</label>
				<label class="manual-uma-apt-cell">
					<span>Surf</span>
					<AptitudeSelect a={state.surfaceAptitude} setA={(a: string) => commit({ surfaceAptitude: a })} />
				</label>
				<label class="manual-uma-apt-cell">
					<span>Style</span>
					<AptitudeSelect a={state.strategyAptitude} setA={(a: string) => commit({ strategyAptitude: a })} />
				</label>
			</fieldset>
			<div class="manual-uma-skills">
				{state.ownedSkills.length === 0 && <div class="manual-uma-skills-empty">No owned skills added yet.</div>}
				{state.ownedSkills.length > 0 && (
					<ul class="manual-uma-skills-list">
						{state.ownedSkills.map(s => (
							<li key={s.id}>
								Skill {s.id}
									<button type="button" class="manual-uma-skill-remove" aria-label={`Remove skill ${s.id}`} onClick={() => removeSkill(s.id)}>×</button>
							</li>
						))}
					</ul>
				)}
				<button type="button" onClick={() => setPickerOpen(true)}>+ Add owned skill</button>
				<SkillPickerModal
					isOpen={pickerOpen}
					onClose={() => setPickerOpen(false)}
					onSelect={addSkill}
					selectedSkills={state.ownedSkills.map(s => String(s.id))}
					availableSkillIds={candidateSkillIds}
				/>
			</div>
		</div>
	);
}
