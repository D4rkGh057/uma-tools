// Pure, framework-free shared types for the skill-purchase optimizer.
// This module (and everything else under optimizer/) MUST NOT import preact, DOM, or any UI code
// -- see design decision #6 (isolation = one-folder rollback + future unit-testability).

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
}

/** Manual hint level (0-5) per candidate skill-tier id, keyed by the tier's skill id string. */
export type HintInput = Record<string, number>;

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

export interface Plan {
	totalCost: number;
	totalScore: number;
	picks: GroupOption[];
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
}
