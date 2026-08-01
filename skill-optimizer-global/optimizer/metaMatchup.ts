import { isValidMetaProfile } from './profiles/catalog';
import { MetaEvidence, MetaProfile } from './profiles/types';

export type MetaClaim = 'observation' | 'pairwiseDelta' | 'pacerDelta' | 'fullLobbyWinProbability' | 'placement' | 'generalizedTraffic';
type Ready = { readonly status: 'ready'; readonly observation: MetaEvidence['observation']; readonly scope: MetaEvidence['scope']; readonly coverage: string; readonly reproduction: string; readonly simulatorVersion: string };
type Numeric = { readonly status: 'numeric'; readonly value: number; readonly label: string };
export type MetaMatchupResult = Ready | Numeric | { readonly status: 'unavailable' | 'blocked'; readonly reason: string };

const numericScope = (claim: MetaClaim): MetaEvidence['scope'] | null => claim === 'pairwiseDelta' ? 'pairwise' : claim === 'pacerDelta' ? 'pacer' : null;
export function analyzeMatchup(profile: MetaProfile, archetypeId: string, claim: MetaClaim = 'observation'): MetaMatchupResult {
	if (!isValidMetaProfile(profile)) return { status: 'unavailable', reason: 'Profile metadata is incomplete' };
	const evidence = profile.evidence.find(item => item.archetypeId === archetypeId);
	if (!evidence) return { status: 'unavailable', reason: 'No profile-scoped evidence covers this archetype' };
	if (claim === 'observation') return { status: 'ready', observation: evidence.observation, scope: evidence.scope, coverage: evidence.coverage, reproduction: evidence.reproduction, simulatorVersion: evidence.simulatorVersion };
	const scope = numericScope(claim);
	if (!scope) return { status: 'blocked', reason: 'Full-lobby, placement, and generalized traffic claims are unsupported' };
	if (evidence.scope !== scope || evidence.numericDelta === undefined) return { status: 'unavailable', reason: 'No validated numeric evidence covers this claim' };
	return { status: 'numeric', value: evidence.numericDelta, label: `${scope}-scoped; profile ${profile.id}@${profile.version}; simulator ${evidence.simulatorVersion}` };
}
