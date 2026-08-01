import test from 'node:test';
import assert from 'node:assert/strict';

import { clearOptimizerBuild, defaultOptimizerBuildState, loadOptimizerBuild, loadOptimizerBuildOutcome, OPTIMIZER_BUILD_STORAGE_KEY, saveOptimizerBuild } from './optimizerBuildStorage';

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => { values.set(key, value); },
		removeItem: (key: string) => { values.delete(key); },
		value: (key: string) => values.get(key) ?? null,
	};
}

test('optimizer build storage saves and hydrates a V2 Score build', () => {
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
	assert.deepEqual(loadOptimizerBuildOutcome(storage), { status: 'loaded', state: build, selection: { mode: 'Score' } });
	assert.equal(JSON.parse(storage.value(OPTIMIZER_BUILD_STORAGE_KEY)!).version, 2);
});

test('optimizer build storage migrates valid V1 state to explicit Score', () => {
	const build = { ...defaultOptimizerBuildState(), budget: 500 };
	const storage = memoryStorage({ [OPTIMIZER_BUILD_STORAGE_KEY]: JSON.stringify({ version: 1, ...build }) });
	assert.deepEqual(loadOptimizerBuildOutcome(storage), { status: 'migrated', state: build, selection: { mode: 'Score' } });
});

test('optimizer build storage rejects malformed, incompatible, and invalid mode/profile data', () => {
	for (const raw of [
		'{not json',
		JSON.stringify({ version: 99, ...defaultOptimizerBuildState() }),
		JSON.stringify({ version: 2, ...defaultOptimizerBuildState(), mode: 'Unknown' }),
		JSON.stringify({ version: 2, ...defaultOptimizerBuildState(), mode: 'ChampionsMeeting', profile: { id: 'unknown', version: '1' } }),
	]) {
		const outcome = loadOptimizerBuildOutcome(memoryStorage({ [OPTIMIZER_BUILD_STORAGE_KEY]: raw }));
		assert.equal(outcome.status, 'rejected');
		assert.deepEqual(outcome.state, defaultOptimizerBuildState());
	}
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
