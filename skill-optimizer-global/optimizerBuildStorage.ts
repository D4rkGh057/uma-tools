import { HintInput, RaceContext } from './optimizer/types';

export const OPTIMIZER_BUILD_STORAGE_KEY = 'skill_optimizer_build';
const STORAGE_VERSION = 1;

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

interface StoredOptimizerBuild extends OptimizerBuildState {
	version: number;
}

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

function isValidBuild(value: unknown): value is StoredOptimizerBuild {
	if (!isRecord(value) || value.version !== STORAGE_VERSION || (value.entryMode !== 'roster' && value.entryMode !== 'manual')) return false;
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

export function loadOptimizerBuild(storage: StorageLike | null = browserStorage()): OptimizerBuildState {
	if (!storage) return defaultOptimizerBuildState();
	try {
		const raw = storage.getItem(OPTIMIZER_BUILD_STORAGE_KEY);
		if (!raw) return defaultOptimizerBuildState();
		const stored: unknown = JSON.parse(raw);
		if (!isValidBuild(stored)) return defaultOptimizerBuildState();
		return {
			entryMode: stored.entryMode,
			manualUma: { ...stored.manualUma, ownedSkills: stored.manualUma.ownedSkills.map(skill => ({ ...skill })) },
			budget: stored.budget,
			raceContext: stored.raceContext ? { ...stored.raceContext } : undefined,
			hints: { ...stored.hints },
		};
	} catch {
		return defaultOptimizerBuildState();
	}
}

export function saveOptimizerBuild(state: OptimizerBuildState, storage: StorageLike | null = browserStorage()) {
	if (!storage) return;
	try {
		storage.setItem(OPTIMIZER_BUILD_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, ...state }));
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
