// Per-tier hint level (0-5) input. `SkillPickerModal` is imported read-only from
// `components/SkillPicker.tsx` (design decision #7) for candidate browsing -- not forked, not
// duplicated; only its existing public props (`isOpen`/`onClose`/`onSelect`/`selectedSkills`/
// `availableSkillIds`) are used.
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';

import { SkillPickerModal } from '../../components/SkillPicker';
import { skillGroups } from '../optimizer/skillGroups';
import { HintInput } from '../optimizer/types';

import skillnames from '../../uma-skill-tools/data/skillnames.json';
import skilldata from '../../uma-skill-tools/data/skill_data.json';
import skillmeta from '../../skill_meta.json';

function getSkillName(skillId: string): string {
	return (skillnames as Record<string, string[]>)[skillId]?.[0] || `Skill ${skillId}`;
}

function getSkillIcon(skillId: string): string {
	const meta = (skillmeta as Record<string, {iconId: string}>)[skillId];
	return meta ? `/uma-tools/icons/${meta.iconId}.png` : '/uma-tools/icons/10011.png';
}

// Same rarity->card mapping as components/SkillList.tsx's `classnames` table (1=white, 2=gold,
// 3-5=unique, 6=pink), reimplemented under `hint-card-*` names instead of reusing `.skill-*` --
// SkillList.css's `.skill-*` classes are unscoped globals and already collide across bundled
// sources (HorseDef.css vs SkillList.css both define `.skillIcon`/`.skill-white`), so hint cards
// get their own class names to stay independent of that cascade.
function getHintCardRarityClass(skillId: string): string {
	const rarity = (skilldata as Record<string, {rarity: number}>)[skillId]?.rarity;
	if (rarity === 2) return 'hint-card-gold';
	if (rarity >= 3 && rarity <= 5) return 'hint-card-unique';
	if (rarity === 6) return 'hint-card-pink';
	return 'hint-card-white';
}

export interface HintTableProps {
	hints: HintInput;
	onChange: (hints: HintInput) => void;
}

export function HintTable({ hints, onChange }: HintTableProps) {
	const [pickerOpen, setPickerOpen] = useState(false);

	// All SP-purchasable tier ids across every group -- matches optimize.ts's own candidate pool
	// (skillGroups.ts is read-only imported here too, not touched).
	const candidateSkillIds = useMemo(() => Array.from(skillGroups.values()).flat(), []);

	const rows = Object.keys(hints);

	function setHint(skillId: string, raw: string) {
		const n = Math.max(0, Math.min(5, +raw || 0));
		onChange({ ...hints, [skillId]: n });
	}

	function removeRow(skillId: string) {
		const next = { ...hints };
		delete next[skillId];
		onChange(next);
	}

	function addRow(skillId: string) {
		onChange({ ...hints, [skillId]: 0 });
		setPickerOpen(false);
	}

	return (
		<div class="hint-table">
			<h3 class="hint-table-caption">Skill hint levels</h3>
			{rows.length === 0 && <div class="hint-table-empty" role="status">No hint levels set -- add a skill hint to include it as a candidate.</div>}
			{rows.length > 0 && (
				<div class="hint-card-list-overflow" aria-label="Skill hint cards" tabIndex={0}>
					<ul class="hint-card-list">
						{rows.map(skillId => (
							<li key={skillId} class={`hint-card ${getHintCardRarityClass(skillId)}`}>
								<img class="hint-card-icon" src={getSkillIcon(skillId)} />
								<span class="hint-card-name">{getSkillName(skillId)}</span>
								<span class="hint-card-input-group">
									<input
										class="hint-card-input"
										type="number"
										min="0"
										max="5"
										step="1"
										title="Hint level, 0 to 5"
										aria-label={`Hint level for ${getSkillName(skillId)}`}
										value={hints[skillId]}
										onInput={e => setHint(skillId, (e.target as HTMLInputElement).value)}
									/>
								</span>
								<button type="button" class="hint-card-remove" aria-label={`Remove hint for ${getSkillName(skillId)}`} onClick={() => removeRow(skillId)}>×</button>
							</li>
						))}
					</ul>
				</div>
			)}
			<button type="button" onClick={() => setPickerOpen(true)}>+ Add skill hint</button>
			<SkillPickerModal
				isOpen={pickerOpen}
				onClose={() => setPickerOpen(false)}
				onSelect={addRow}
				selectedSkills={rows}
				availableSkillIds={candidateSkillIds}
			/>
		</div>
	);
}
