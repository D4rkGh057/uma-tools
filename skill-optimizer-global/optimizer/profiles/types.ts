import type { EvaluationMode } from '../types';

export type MetaMode = Extract<EvaluationMode, 'ChampionsMeeting' | 'LeagueOfHeroes'>;
export type EvidenceScope = 'pairwise' | 'pacer';
export type Observation = 'supported' | 'mixed' | 'unsupported';

export interface MetaProfileReference { readonly id: string; readonly version: string; }
export interface MetaProvenance { readonly source: string; readonly reviewedAt: string; }
export interface MetaAssumptions { readonly course: string; readonly lobby: string; }
export interface MetaArchetype { readonly id: string; readonly label: string; }
export interface MetaEvidence {
	readonly archetypeId: string; readonly scope: EvidenceScope; readonly observation: Observation;
	readonly coverage: string; readonly reproduction: string; readonly simulatorVersion: string; readonly numericDelta?: number;
}
export interface MetaProfile extends MetaProfileReference {
	readonly mode: MetaMode; readonly provenance: MetaProvenance; readonly assumptions: MetaAssumptions;
	readonly archetypes: readonly MetaArchetype[]; readonly rules: readonly string[]; readonly evidence: readonly MetaEvidence[];
}
