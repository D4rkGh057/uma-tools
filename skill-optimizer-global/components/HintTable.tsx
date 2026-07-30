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

function getSkillName(skillId: string): string {
	return (skillnames as Record<string, string[]>)[skillId]?.[0] || `Skill ${skillId}`;
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
			{rows.length === 0 && <div class="hint-table-empty">No hint levels set -- all candidates default to hint 0.</div>}
			{rows.length > 0 && (
				<table class="hint-table-rows">
					<thead>
						<tr><th>Skill</th><th>Hint (0-5)</th><th /></tr>
					</thead>
					<tbody>
						{rows.map(skillId => (
							<tr key={skillId}>
								<td>{getSkillName(skillId)}</td>
								<td>
									<input
										type="number"
										min="0"
										max="5"
										step="1"
										value={hints[skillId]}
										onInput={e => setHint(skillId, (e.target as HTMLInputElement).value)}
									/>
								</td>
								<td>
									<button type="button" class="hint-table-remove" onClick={() => removeRow(skillId)}>×</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
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
