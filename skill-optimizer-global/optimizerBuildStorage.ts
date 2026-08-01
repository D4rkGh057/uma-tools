import { findProfile } from './optimizer/profiles/catalog';
import type { MetaProfileReference } from './optimizer/profiles/types';
import type { EvaluationMode, HintInput, RaceContext } from './optimizer/types';

export const OPTIMIZER_BUILD_STORAGE_KEY = 'skill_optimizer_build';
const STORAGE_VERSION = 2;

export type EntryMode = 'roster' | 'manual';

export interface ManualUmaState {
	speed?: number;
	stamina?: number;
	power?: number;
	guts?: number;
	wisdom?: number;
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige';
	distanceAptitude: string;
	surfaceAptitude: string;
	strategyAptitude: string;
	ownedSkills: Array<{ id: number; level: number }>;
}

export interface OptimizerBuildState {
	entryMode: EntryMode;
	manualUma: ManualUmaState;
	budget: number;
	raceContext?: RaceContext;
	hints: HintInput;
}

interface StoredOptimizerBuildV1 extends OptimizerBuildState {
	version: number;
}

interface StoredOptimizerBuildV2 extends StoredOptimizerBuildV1 {
	mode: EvaluationMode;
	profile?: MetaProfileReference;
}

export interface OptimizerBuildSelection {
	readonly mode: EvaluationMode;
	readonly profile?: MetaProfileReference;
}

export type OptimizerBuildLoadOutcome =
	| { readonly status: 'empty'; readonly state: OptimizerBuildState; readonly selection: OptimizerBuildSelection }
	| { readonly status: 'loaded'; readonly state: OptimizerBuildState; readonly selection: OptimizerBuildSelection }
	| { readonly status: 'migrated'; readonly state: OptimizerBuildState; readonly selection: OptimizerBuildSelection }
	| { readonly status: 'rejected'; readonly state: OptimizerBuildState; readonly reason: string };

interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

const STAT_FIELDS = ['speed', 'stamina', 'power', 'guts', 'wisdom'] as const;
const STRATEGIES = new Set(['Nige', 'Senkou', 'Sasi', 'Oikomi', 'Oonige']);
const APTITUDES = new Set(['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']);

export function defaultOptimizerBuildState(): OptimizerBuildState {
	return {
		entryMode: 'roster',
		manualUma: {
			strategy: 'Senkou',
			distanceAptitude: 'A',
			surfaceAptitude: 'A',
			strategyAptitude: 'A',
			ownedSkills: [],
		},
		budget: 0,
		hints: {},
	};
}

function browserStorage(): StorageLike | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isStat(value: unknown): value is number | undefined {
	return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 2000);
}

function isRaceContext(value: unknown): value is RaceContext | undefined {
	if (value === undefined) return true;
	if (!isRecord(value)) return false;
	return (value.trackId === undefined || (typeof value.trackId === 'number' && Number.isFinite(value.trackId) && value.trackId > 0))
		&& (value.distanceType === undefined || [1, 2, 3, 4].includes(value.distanceType as number))
		&& (value.surface === undefined || [1, 2].includes(value.surface as number))
		&& (value.style === undefined || [1, 2, 3, 4, 5].includes(value.style as number))
		&& (value.phase === undefined || [0, 1, 2, 3].includes(value.phase as number));
}

function isValidBuild(value: unknown): value is StoredOptimizerBuildV1 {
	if (!isRecord(value) || (value.entryMode !== 'roster' && value.entryMode !== 'manual')) return false;
	if (!isRecord(value.manualUma) || !STRATEGIES.has(value.manualUma.strategy as string)
		|| !APTITUDES.has(value.manualUma.distanceAptitude as string)
		|| !APTITUDES.has(value.manualUma.surfaceAptitude as string)
		|| !APTITUDES.has(value.manualUma.strategyAptitude as string)
		|| !Array.isArray(value.manualUma.ownedSkills)
		|| !value.manualUma.ownedSkills.every(skill => isRecord(skill) && Number.isInteger(skill.id) && skill.id > 0 && Number.isInteger(skill.level) && skill.level > 0)
		|| !STAT_FIELDS.every(field => isStat(value.manualUma[field]))) return false;
	if (typeof value.budget !== 'number' || !Number.isFinite(value.budget) || value.budget < 0 || !isRaceContext(value.raceContext) || !isRecord(value.hints)) return false;
	return Object.values(value.hints).every(hint => Number.isInteger(hint) && (hint as number) >= 0 && (hint as number) <= 5);
}

function isSelection(value: unknown): value is OptimizerBuildSelection {
	if (!isRecord(value) || !['Score', 'TeamTrials', 'ChampionsMeeting', 'LeagueOfHeroes'].includes(value.mode as string)) return false;
	if (value.mode === 'ChampionsMeeting' || value.mode === 'LeagueOfHeroes') {
		return isRecord(value.profile) && typeof value.profile.id === 'string' && typeof value.profile.version === 'string'
			&& findProfile(value.profile as MetaProfileReference, value.mode) !== null;
	}
	return value.profile === undefined;
}

function copyBuild(stored: StoredOptimizerBuildV1): OptimizerBuildState {
	return {
		entryMode: stored.entryMode,
		manualUma: { ...stored.manualUma, ownedSkills: stored.manualUma.ownedSkills.map(skill => ({ ...skill })) },
		budget: stored.budget,
		...(stored.raceContext ? { raceContext: { ...stored.raceContext } } : {}),
		hints: { ...stored.hints },
	};
}

const defaultSelection: OptimizerBuildSelection = { mode: 'Score' };

export function loadOptimizerBuildOutcome(storage: StorageLike | null = browserStorage()): OptimizerBuildLoadOutcome {
	const fallback = defaultOptimizerBuildState();
	if (!storage) return { status: 'empty', state: fallback, selection: defaultSelection };
	try {
		const raw = storage.getItem(OPTIMIZER_BUILD_STORAGE_KEY);
		if (!raw) return { status: 'empty', state: fallback, selection: defaultSelection };
		const stored: unknown = JSON.parse(raw);
		if (!isValidBuild(stored)) return { status: 'rejected', state: fallback, reason: 'Invalid persisted build' };
		if (stored.version === 1) return { status: 'migrated', state: copyBuild(stored), selection: defaultSelection };
		if (stored.version !== STORAGE_VERSION || !isSelection(stored)) return { status: 'rejected', state: fallback, reason: 'Unsupported persistence version or selection' };
		return { status: 'loaded', state: copyBuild(stored), selection: { mode: stored.mode, ...(stored.profile ? { profile: { ...stored.profile } } : {}) } };
	} catch {
		return { status: 'rejected', state: fallback, reason: 'Invalid persisted build' };
	}
}

export function loadOptimizerBuild(storage: StorageLike | null = browserStorage()): OptimizerBuildState {
	return loadOptimizerBuildOutcome(storage).state;
}

export function saveOptimizerBuild(state: OptimizerBuildState, storage: StorageLike | null = browserStorage(), selection: OptimizerBuildSelection = defaultSelection) {
	if (!storage) return;
	try {
		const safeSelection = isSelection(selection) ? selection : defaultSelection;
		storage.setItem(OPTIMIZER_BUILD_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...state, ...safeSelection }));
	} catch {
		// Persistence is optional: private browsing and quota errors must not affect optimization.
	}
}

export function clearOptimizerBuild(storage: StorageLike | null = browserStorage()) {
	if (!storage) return;
	try {
		storage.removeItem(OPTIMIZER_BUILD_STORAGE_KEY);
	} catch {
		// See saveOptimizerBuild: local storage availability is not guaranteed.
	}
}
