import { h } from 'preact';
import type { MetaEvaluationResult } from '../optimizer/types';
import type { MetaProfile } from '../optimizer/profiles/types';

export function profileProvenance(profile: MetaProfile | null): string | null {
	return profile && `${profile.id} v${profile.version} — ${profile.provenance.source}; reviewed ${profile.provenance.reviewedAt}; ${profile.assumptions.course}, ${profile.assumptions.lobby}`;
}

export function metaMatchupPanelContent(result: MetaEvaluationResult | null) {
	if (!result) return null;
	const { profile } = result;
	return {
		heading: result.mode === 'ChampionsMeeting' ? 'CM profile' : 'LoH profile',
		provenance: `${profile.reference.id} v${profile.reference.version} — ${profile.provenance.source}; reviewed ${profile.provenance.reviewedAt}`,
		assumptions: `Course: ${profile.assumptions.course}; lobby: ${profile.assumptions.lobby}`,
		rules: profile.rules,
		matchups: profile.archetypes.map(archetype => {
			const matchup = result.matchups.find(item => item.archetype.id === archetype.id);
			if (!matchup) return `${archetype.label}: unavailable — No matchup entry recorded for this archetype`;
			return matchup.status === 'ready'
				? `${matchup.archetype.label}: ${matchup.observation}; ${matchup.evidence.scope}-scoped; coverage ${matchup.evidence.coverage}; reproduction ${matchup.evidence.reproduction}; simulator ${matchup.evidence.simulatorVersion}`
				: `${matchup.archetype.label}: unavailable — ${matchup.reason}`;
		}),
	};
}

export function MetaMatchupPanel({ result }: { result: MetaEvaluationResult | null }) {
	const content = metaMatchupPanelContent(result);
	return content && <div class="meta-matchup-panel">
		<strong>{content.heading}:</strong> {content.provenance}
		<div>{content.assumptions}</div>
		<ul>{content.rules.map(rule => <li>{rule}</li>)}</ul>
		<ul>{content.matchups.map(matchup => <li>{matchup}</li>)}</ul>
	</div>;
}
