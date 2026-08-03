// Pure, framework-free shared types for the skill-purchase optimizer.
// This module (and everything else under optimizer/) MUST NOT import preact, DOM, or any UI code
// -- see design decision #6 (isolation = one-folder rollback + future unit-testability).

import type { MetaAssumptions, MetaCommunityGuidance, MetaMode, MetaProfileReference, MetaProvenance } from './profiles/types';

/** Distance categories the game itself uses (see uma-skill-tools/CourseData.ts DistanceType). */
export type DistanceBucket = 'Short' | 'Mile' | 'Mid' | 'Long';

/**
 * Optional target-race context. Every field is optional: the optimizer runs in "generic mode"
 * whenever this is entirely absent (spec: "No target race set").
 */
export interface RaceContext {
	/** course_data.json key, e.g. 10101. When set (and distanceType/surface are not), distanceType
	 *  and surface are looked up from course_data.json directly. */
	trackId?: number;
	/** 1=Short, 2=Mile, 3=Mid, 4=Long. Overrides the trackId lookup when provided directly. */
	distanceType?: 1 | 2 | 3 | 4;
	/** 1=Turf, 2=Dirt. */
	surface?: 1 | 2;
	/** Strategy enum from uma-skill-tools/HorseTypes.ts (1=Nige,2=Senkou,3=Sasi,4=Oikomi,5=Oonige). */
	style?: 1 | 2 | 3 | 4 | 5;
	/** Race phase 0-3, used only for soft condition-fit matching, never for hard exclusion (a
	 *  phase-scoped skill is never structurally impossible for a given race -- every race has all
	 *  four phases). */
	phase?: 0 | 1 | 2 | 3;
}

/** A single static fact about the race, used for structural hard-exclusion (spec: "Target-Race Hard
 *  Exclusion"). `condition` matches the mockConditions proxy's `.name` (see conditions.ts). */
export interface RaceFact {
	condition: string;
	value: number;
}

export interface RaceProbes {
	/** Probe trees used for soft, presence-based condition-fit matching (SkillPicker.tsx pattern). */
	matchProbes: unknown[];
	/** Known race facts used for structural conflict / hard-exclusion checks (conditions.ts). */
	conflictFacts: RaceFact[];
	distanceBucket: DistanceBucket;
	/** Real course distance in meters, always populated (exact when derivable, otherwise the
	 *  per-bucket representative fallback -- see probes.ts BUCKET_DISTANCES). Feeds the
	 *  duration-and-distance-aware magnitude formula in score.ts. */
	raceDistance: number;
}

/** Manual hint level (0-5) per candidate skill-tier id, keyed by the tier's skill id string. */
export type HintInput = Record<string, number>;

/**
 * Optional build stats for the uma being optimized, used to project a pre-purchase HP deficit for
 * Recovery (type 9) scoring (spec domain: "Recovery Effect Magnitude via Projected HP Deficit").
 * Every field is optional -- `speed`/`guts`/`distanceAptitude` fall back to documented defaults
 * (design decision #7) when omitted, while `stamina`/`strategy` (plus a resolvable race distance) are
 * required to enable HP-projection mode at all; scoringContext() falls back to the flat Recovery
 * weight otherwise (spec: "Graceful Degradation When Build Inputs Are Incomplete").
 */
export interface UmaBuild {
	speed?: number;
	stamina?: number;
	power?: number;
	guts?: number;
	wisdom?: number;
	/** Strategy enum from uma-skill-tools/HorseTypes.ts (1=Nige,2=Senkou,3=Sasi,4=Oikomi,5=Oonige). */
	strategy?: 1 | 2 | 3 | 4 | 5;
	/** 0=S,1=A,2=B,3=C,4=D,5=E,6=F,7=G -- matches uma-skill-tools/HorseTypes.ts's Aptitude enum. */
	distanceAptitude?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** A single unpurchased tier step inside a groupId chain, with its own per-step hint discount. */
export interface ChainStep {
	skillId: string;
	baseCost: number;
	hint: number;
	/** Discounted cost for this one step: floor(baseCost * (1 - hintDiscount(hint))). */
	cost: number;
}

/**
 * One selectable option for a groupId in the grouped knapsack: "buy up to this tier". `targetIdx`
 * equal to the uma's currently-owned tier index represents the free "no-op" option (cost 0, score 0)
 * that every group must include -- see knapsack.ts / design decision #1.
 */
export interface GroupOption {
	groupId: string;
	targetIdx: number;
	skillId: string;
	cost: number;
	score: number;
	steps: ChainStep[];
}

/** A Positioning-type (SkillType.ChangeLane, id 35) skill excluded from the blended score and
 *  ranked picks, surfaced separately instead of hidden or given a default weight (spec:
 *  "Positioning Skills Excluded From Blended Score, Shown Separately"). */
export interface SituationalSkill {
	groupId: string;
	skillId: string;
	cost: number;
	reason: string;
}

export interface Plan {
	totalCost: number;
	totalScore: number;
	picks: GroupOption[];
	/** Positioning-type candidates that were excluded from scoring/ranking -- see SituationalSkill. */
	situational: SituationalSkill[];
}

export interface OptimizeInput {
	/** Uma's currently owned skills, same shape as rosterDecoder's DecodedUma.skills. */
	ownedSkills: Array<{ id: number; level: number }>;
	/** Total SP budget available to spend. */
	budget: number;
	/** Manual hint level (0-5) per candidate tier skill id. Missing entries default to hint 0. */
	hints: HintInput;
	raceContext?: RaceContext;
	/** 0-1 blend weight between condition-fit (1.0) and cost-per-effect-magnitude (0.0). Defaults to 0.5. */
	blendWeight?: number;
	/** Uma's own build stats, enabling HP-projection Recovery scoring when complete enough (see
	 *  UmaBuild). Also improves condition-fit matching: optimize() falls back to build.strategy for
	 *  raceContext.style when raceContext.style itself is unset. */
	build?: UmaBuild;
}

export type EvaluationMode = 'Score' | 'TeamTrials' | 'ChampionsMeeting' | 'LeagueOfHeroes';

export type EvaluationRequest = OptimizeInput & (
	| { readonly mode: 'Score' | 'TeamTrials' }
	| { readonly mode: MetaMode; readonly profile: MetaProfileReference }
	| { readonly mode: string; readonly profile?: MetaProfileReference }
);

export interface CandidateBreakdown {
	readonly skillId: string;
	readonly cost: number;
	readonly score: number;
	readonly picked: boolean;
	readonly excluded: boolean;
	readonly exclusionReason: string | null;
}

export interface GroupBreakdown {
	readonly groupId: string;
	readonly ownedSkillId: string | null;
	readonly candidates: readonly CandidateBreakdown[];
}

export type MetaEvaluationResult = {
	readonly status: 'ready'; readonly mode: MetaMode; readonly purchase: Readonly<Plan>; readonly breakdown: readonly GroupBreakdown[];
	readonly profile: { readonly reference: MetaProfileReference; readonly provenance: MetaProvenance; readonly assumptions: MetaAssumptions; readonly communityGuidance: readonly MetaCommunityGuidance[] };
};

export type EvaluationResult =
	| { readonly status: 'ready'; readonly mode: 'Score'; readonly purchase: Readonly<Plan>; readonly breakdown: readonly GroupBreakdown[] }
	| MetaEvaluationResult
	| { readonly status: 'unavailable'; readonly mode: 'TeamTrials'; readonly reason: string; readonly purchase: Readonly<Plan>; readonly breakdown: readonly GroupBreakdown[] }
	| { readonly status: 'invalid'; readonly mode: string; readonly reason: string };
