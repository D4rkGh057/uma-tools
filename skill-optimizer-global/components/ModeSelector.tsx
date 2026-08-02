import { h } from 'preact';
import type { EvaluationMode } from '../optimizer/types';

const modes: readonly EvaluationMode[] = ['Score', 'TeamTrials', 'ChampionsMeeting', 'LeagueOfHeroes'];

// Team Trials rankings are unavailable; the option must render disabled and any change event
// selecting it (real or forged/synthetic) MUST NOT reach `onChange` (spec: "Complete Control
// Presentation" -- "Selected and unavailable choices").
const unavailableModes: ReadonlySet<EvaluationMode> = new Set(['TeamTrials']);

export function modeLabel(mode: EvaluationMode): string {
	return mode === 'TeamTrials' ? 'Team Trials (rankings unavailable)' : mode;
}

export function isModeAvailable(mode: EvaluationMode): boolean {
	return !unavailableModes.has(mode);
}

export function ModeSelector({ mode, onChange }: { mode: EvaluationMode; onChange(mode: EvaluationMode): void }) {
	function handleChange(event: { currentTarget: { value: string } }) {
		const next = event.currentTarget.value as EvaluationMode;
		if (!isModeAvailable(next)) return;
		onChange(next);
	}
	return <label class="mode-selector">Evaluation mode
		<select value={mode} aria-describedby="mode-help" onChange={handleChange}>
			{modes.map(value => <option value={value} disabled={!isModeAvailable(value)}>{modeLabel(value)}</option>)}
		</select>
		<span id="mode-help">Changes apply when you explicitly optimize the build.</span>
	</label>;
}
