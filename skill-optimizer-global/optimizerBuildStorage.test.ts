import test from 'node:test';
import assert from 'node:assert/strict';

import { clearOptimizerBuild, defaultOptimizerBuildState, loadOptimizerBuild, OPTIMIZER_BUILD_STORAGE_KEY, saveOptimizerBuild } from './optimizerBuildStorage';

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => { values.set(key, value); },
		removeItem: (key: string) => { values.delete(key); },
		value: (key: string) => values.get(key) ?? null,
	};
}

test('optimizer build storage hydrates a valid versioned manual build', () => {
	const storage = memoryStorage();
	const build = {
		...defaultOptimizerBuildState(),
		entryMode: 'manual' as const,
		manualUma: { ...defaultOptimizerBuildState().manualUma, speed: 1200, ownedSkills: [{ id: 1001, level: 1 }] },
		budget: 500,
		raceContext: { trackId: 10903, style: 2 as const },
		hints: { '1001': 3 },
	};
	saveOptimizerBuild(build, storage);
	assert.deepEqual(loadOptimizerBuild(storage), build);
});

test('optimizer build storage falls back for malformed and version-mismatched data', () => {
	const malformed = memoryStorage({ [OPTIMIZER_BUILD_STORAGE_KEY]: '{not json' });
	assert.deepEqual(loadOptimizerBuild(malformed), defaultOptimizerBuildState());
	const stale = memoryStorage({ [OPTIMIZER_BUILD_STORAGE_KEY]: JSON.stringify({ version: 99, ...defaultOptimizerBuildState() }) });
	assert.deepEqual(loadOptimizerBuild(stale), defaultOptimizerBuildState());
});

test('optimizer build reset removes only the optimizer storage entry', () => {
	const roster = 'shared roster payload';
	const storage = memoryStorage({
		[OPTIMIZER_BUILD_STORAGE_KEY]: JSON.stringify({ version: 1, ...defaultOptimizerBuildState() }),
		umas_tab_roster: roster,
	});
	clearOptimizerBuild(storage);
	assert.equal(storage.value(OPTIMIZER_BUILD_STORAGE_KEY), null);
	assert.equal(storage.value('umas_tab_roster'), roster);
	assert.equal(OPTIMIZER_BUILD_STORAGE_KEY, 'skill_optimizer_build');
});
