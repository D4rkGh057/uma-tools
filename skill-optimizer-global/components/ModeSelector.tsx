import { h } from 'preact';
import type { EvaluationMode } from '../optimizer/types';

const modes: readonly EvaluationMode[] = ['Score', 'TeamTrials', 'ChampionsMeeting', 'LeagueOfHeroes'];

export function modeLabel(mode: EvaluationMode): string {
	return mode === 'TeamTrials' ? 'Team Trials (rankings unavailable)' : mode;
}

export function ModeSelector({ mode, onChange }: { mode: EvaluationMode; onChange(mode: EvaluationMode): void }) {
	return <label class="mode-selector">Evaluation mode
		<select value={mode} onChange={event => onChange(event.currentTarget.value as EvaluationMode)}>
			{modes.map(value => <option value={value}>{modeLabel(value)}</option>)}
		</select>
	</label>;
}
