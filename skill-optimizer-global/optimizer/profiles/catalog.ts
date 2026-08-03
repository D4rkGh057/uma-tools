import { MetaProfile, MetaProfileReference } from './types';
import { isCommunityGuidanceList } from './guidanceValidation';

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const freeze = <T>(value: T): T => {
	if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value as object)) freeze(item); }
	return value;
};

export function isValidMetaProfile(value: unknown): value is MetaProfile {
	const profile = value as MetaProfile;
	return !!profile && text(profile.id) && text(profile.version) && (profile.mode === 'ChampionsMeeting' || profile.mode === 'LeagueOfHeroes')
		&& text(profile.provenance?.source) && text(profile.provenance?.reviewedAt) && text(profile.assumptions?.course) && text(profile.assumptions?.lobby)
		&& isCommunityGuidanceList(profile.communityGuidance);
}

export const profileCatalog: readonly MetaProfile[] = freeze([
	{ id: 'cm-mile', version: '2026.1', mode: 'ChampionsMeeting', provenance: { source: 'gametora.com/umamusume/events/champions-meeting (CM 17 - Virgo Cup)', reviewedAt: '2026-08-02' }, assumptions: { course: '2000m dirt, Ooi, right-handed, good, autumn, sunny', lobby: 'profile-scoped opponents' }, communityGuidance: [] },
	{ id: 'loh-mile', version: '2026.1', mode: 'LeagueOfHeroes', provenance: { source: 'curated LoH matchup notes', reviewedAt: '2026-07-30' }, assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' }, communityGuidance: [] },
]);

export function findProfile(reference: MetaProfileReference, mode: MetaProfile['mode']): MetaProfile | null {
	return profileCatalog.find(profile => profile.id === reference.id && profile.version === reference.version && profile.mode === mode) ?? null;
}
