import { EvaluationMode, EvaluationResult, GroupBreakdown, Plan } from './types';
import { findProfile } from './profiles/catalog';
import { MetaMode, MetaProfileReference } from './profiles/types';

type ModeAdapter = (purchase: Plan, breakdown: readonly GroupBreakdown[], profile?: MetaProfileReference) => EvaluationResult;

const TEAM_TRIALS_UNAVAILABLE = 'Team Trials rankings require source-backed ranking semantics';

const metaAdapter = (mode: MetaMode): ModeAdapter => (purchase, breakdown, reference) => {
	if (!reference) return { status: 'invalid', mode, reason: 'A matching meta profile is required' };
	const profile = findProfile(reference, mode);
	if (!profile) return { status: 'invalid', mode, reason: 'A matching meta profile is required' };
	return { status: 'ready', mode, purchase, breakdown, profile: { reference: { id: profile.id, version: profile.version }, provenance: profile.provenance, assumptions: profile.assumptions, communityGuidance: profile.communityGuidance } };
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
	return Object.prototype.hasOwnProperty.call(modeAdapters, mode);
}
