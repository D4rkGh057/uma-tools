import { EvaluationMode, EvaluationResult, GroupBreakdown, MetaEvaluationResult, Plan } from './types';
import { analyzeMatchup } from './metaMatchup';
import { findProfile } from './profiles/catalog';
import { MetaMode, MetaProfileReference } from './profiles/types';

type ModeAdapter = (purchase: Plan, breakdown: readonly GroupBreakdown[], profile?: MetaProfileReference) => EvaluationResult;

const TEAM_TRIALS_UNAVAILABLE = 'Team Trials rankings require source-backed ranking semantics';

const metaAdapter = (mode: MetaMode): ModeAdapter => (purchase, breakdown, reference) => {
	if (!reference) return { status: 'invalid', mode, reason: 'A matching meta profile is required' };
	const profile = findProfile(reference, mode);
	if (!profile) return { status: 'invalid', mode, reason: 'A matching meta profile is required' };
	const matchups: MetaEvaluationResult['matchups'] = profile.archetypes.map(archetype => {
		const result = analyzeMatchup(profile, archetype.id, 'observation');
		return result.status === 'ready'
			? { archetype, status: 'ready', observation: result.observation, evidence: { scope: result.scope, coverage: result.coverage, reproduction: result.reproduction, simulatorVersion: result.simulatorVersion } }
			: { archetype, status: 'unavailable', reason: result.reason };
	});
	return { status: 'ready', mode, purchase, breakdown, profile: { reference: { id: profile.id, version: profile.version }, provenance: profile.provenance, assumptions: profile.assumptions, archetypes: profile.archetypes, rules: profile.rules }, matchups };
};

export const modeAdapters: Record<EvaluationMode, ModeAdapter> = {
	Score: (purchase, breakdown) => ({ status: 'ready', mode: 'Score', purchase, breakdown }),
	TeamTrials: (purchase, breakdown) => ({
		status: 'unavailable',
		mode: 'TeamTrials',
		reason: TEAM_TRIALS_UNAVAILABLE,
		purchase,
		breakdown,
	}),
	ChampionsMeeting: metaAdapter('ChampionsMeeting'),
	LeagueOfHeroes: metaAdapter('LeagueOfHeroes'),
};

export function isEvaluationMode(mode: string): mode is EvaluationMode {
	return mode in modeAdapters;
}
