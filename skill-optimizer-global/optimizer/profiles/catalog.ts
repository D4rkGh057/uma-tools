import { MetaProfile, MetaProfileReference } from './types';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const freeze = <T>(value: T): T => {
	if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value as object)) freeze(item); }
	return value;
};

export function isValidMetaProfile(value: unknown): value is MetaProfile {
	const profile = value as MetaProfile;
	return !!profile && text(profile.id) && text(profile.version) && (profile.mode === 'ChampionsMeeting' || profile.mode === 'LeagueOfHeroes')
		&& text(profile.provenance?.source) && text(profile.provenance?.reviewedAt) && text(profile.assumptions?.course) && text(profile.assumptions?.lobby)
		&& Array.isArray(profile.archetypes) && profile.archetypes.length > 0 && profile.archetypes.every(item => text(item.id) && text(item.label))
		&& Array.isArray(profile.rules) && profile.rules.length > 0 && profile.rules.every(text) && Array.isArray(profile.evidence)
		&& profile.evidence.every(item => profile.archetypes.some(archetype => archetype.id === item.archetypeId) && (item.scope === 'pairwise' || item.scope === 'pacer') && text(item.coverage) && text(item.reproduction) && text(item.simulatorVersion) && ['supported', 'mixed', 'unsupported'].includes(item.observation) && (item.numericDelta === undefined || Number.isFinite(item.numericDelta)));
}

export const profileCatalog: readonly MetaProfile[] = freeze([
	{ id: 'cm-mile', version: '2026.1', mode: 'ChampionsMeeting', provenance: { source: 'curated CM matchup notes', reviewedAt: '2026-07-30' }, assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' }, archetypes: [{ id: 'runner', label: 'Front runner' }, { id: 'pacer', label: 'Pace leader' }], rules: ['Use pairwise or pacer evidence only'], evidence: [{ archetypeId: 'runner', scope: 'pairwise', observation: 'supported', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1', numericDelta: 0.12 }, { archetypeId: 'pacer', scope: 'pacer', observation: 'mixed', coverage: '1 pacer fixture', reproduction: 'seeded pacer fixture', simulatorVersion: 'umalator-1', numericDelta: -0.04 }] },
	{ id: 'loh-mile', version: '2026.1', mode: 'LeagueOfHeroes', provenance: { source: 'curated LoH matchup notes', reviewedAt: '2026-07-30' }, assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' }, archetypes: [{ id: 'runner', label: 'Front runner' }], rules: ['No full-lobby forecasting'], evidence: [{ archetypeId: 'runner', scope: 'pairwise', observation: 'unsupported', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1' }] },
]);

export function findProfile(reference: MetaProfileReference, mode: MetaProfile['mode']): MetaProfile | null {
	return profileCatalog.find(profile => profile.id === reference.id && profile.version === reference.version && profile.mode === mode) ?? null;
}
