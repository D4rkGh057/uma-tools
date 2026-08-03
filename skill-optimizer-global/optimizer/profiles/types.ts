import type { EvaluationMode } from '../types';

export type MetaMode = Extract<EvaluationMode, 'ChampionsMeeting' | 'LeagueOfHeroes'>;

export interface MetaProfileReference { readonly id: string; readonly version: string; }
export interface MetaProvenance { readonly source: string; readonly reviewedAt: string; }
export interface MetaAssumptions { readonly course: string; readonly lobby: string; }

/** The five running strategies the game itself defines. */
export type RunningStyle = 1 | 2 | 3 | 4 | 5;
export type StatKey = 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom';
export type SkillTier = 'core' | 'good' | 'situational';

/** Per-style guidance content: target stats and tiered skill picks for one running style. Both
 *  fields are independently optional -- a style entry may define only stats, only skills, or both. */
export interface StyleGuidance {
	readonly idealStats?: Partial<Record<StatKey, number>>;
	readonly skillTiers?: Partial<Record<SkillTier, readonly string[]>>;
}

/** Community-sourced guidance (tier lists, veteran write-ups) on which stats/skills to bring, keyed
 *  by running style. Not simulator-verified -- always labeled as unverified wherever it is surfaced
 *  in the UI. */
export interface MetaCommunityGuidance {
	readonly source: string;
	readonly byStyle: Partial<Record<RunningStyle, StyleGuidance>>;
}
export interface MetaProfile extends MetaProfileReference {
	readonly mode: MetaMode; readonly provenance: MetaProvenance; readonly assumptions: MetaAssumptions;
	readonly communityGuidance: readonly MetaCommunityGuidance[];
}
