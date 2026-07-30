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

export interface ManualUmaEntryProps {
	onChange: (input: UmaInput) => void;
}

interface LocalState {
	speed?: number;
	stamina?: number;
	power?: number;
	guts?: number;
	wisdom?: number;
	strategy: ManualForm['strategy'];
	distanceAptitude: string;
	// Collected for field parity with roster import (spec: "Field Parity With Roster Data" lists all
	// three aptitudes) but NOT part of UmaBuild/ManualForm -- only distanceAptitude feeds the HP
	// projection / condition-fit matching (design's "Optional build fields").
	surfaceAptitude: string;
	strategyAptitude: string;
	ownedSkills: Array<{ id: number; level: number }>;
}

function initialState(): LocalState {
	return {
		speed: undefined,
		stamina: undefined,
		power: undefined,
		guts: undefined,
		wisdom: undefined,
		strategy: 'Senkou',
		distanceAptitude: 'A',
		surfaceAptitude: 'A',
		strategyAptitude: 'A',
		ownedSkills: [],
	};
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

export function ManualUmaEntry({ onChange }: ManualUmaEntryProps) {
	const [state, setState] = useState<LocalState>(initialState);
	const [pickerOpen, setPickerOpen] = useState(false);

	const candidateSkillIds = useMemo(() => Array.from(skillGroups.values()).flat(), []);

	function commit(patch: Partial<LocalState>) {
		const next = { ...state, ...patch };
		setState(next);
		onChange(fromManualForm(toManualForm(next)));
	}

	// Notify the parent once on mount too, so selecting "Enter manually" immediately produces a
	// (mostly-empty) UmaInput rather than leaving app.tsx's selection stuck at the previous value.
	useEffect(() => {
		onChange(fromManualForm(toManualForm(state)));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function statField(field: 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom') {
		return (raw: number) => commit({ [field]: clampStat(raw) } as Partial<LocalState>);
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
			<div class="manual-uma-stats">
				<Stat label="Speed" statIdx={0} value={state.speed ?? ''} change={statField('speed')} />
				<Stat label="Stamina" statIdx={1} value={state.stamina ?? ''} change={statField('stamina')} />
				<Stat label="Power" statIdx={2} value={state.power ?? ''} change={statField('power')} />
				<Stat label="Guts" statIdx={3} value={state.guts ?? ''} change={statField('guts')} />
				<Stat label="Wit" statIdx={4} value={state.wisdom ?? ''} change={statField('wisdom')} />
			</div>
			<div class="manual-uma-apts">
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
			</div>
			<div class="manual-uma-skills">
				{state.ownedSkills.length === 0 && <div class="manual-uma-skills-empty">No owned skills added yet.</div>}
				{state.ownedSkills.length > 0 && (
					<ul class="manual-uma-skills-list">
						{state.ownedSkills.map(s => (
							<li key={s.id}>
								Skill {s.id}
								<button type="button" class="manual-uma-skill-remove" onClick={() => removeSkill(s.id)}>×</button>
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
