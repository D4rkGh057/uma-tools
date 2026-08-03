import test from 'node:test';
import assert from 'node:assert/strict';

import { addCommunityGuidance, COMMUNITY_GUIDANCE_STORAGE_KEY, loadCommunityGuidance } from './communityGuidanceStorage';
import { isCommunityGuidanceList, isValidCommunityGuidance } from './optimizer/profiles/guidanceValidation';

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => { values.set(key, value); },
		value: (key: string) => values.get(key) ?? null,
	};
}

const cmMile = { id: 'cm-mile', version: '2026.1' };
const lohMile = { id: 'loh-mile', version: '2026.1' };

const wellFormedEntry = {
	source: 'moomoocow',
	byStyle: { 1: { idealStats: { speed: 1200 }, skillTiers: { core: ['Straightaway Recovery'] } } },
};

test('community guidance storage starts empty for a profile with no persisted notes', () => {
	assert.deepEqual(loadCommunityGuidance(cmMile, memoryStorage()), []);
});

test('community guidance storage appends and persists a note scoped to its exact profile reference', () => {
	const storage = memoryStorage();
	const updated = addCommunityGuidance(cmMile, wellFormedEntry, storage);

	assert.deepEqual(updated, [wellFormedEntry]);
	assert.deepEqual(loadCommunityGuidance(cmMile, storage), updated);
	assert.deepEqual(loadCommunityGuidance(lohMile, storage), []);
});

test('community guidance storage keeps entries for different profile versions and modes separate', () => {
	const storage = memoryStorage();
	const cmEntry = { source: 'a', byStyle: { 1: { idealStats: { speed: 1000 } } } };
	const lohEntry = { source: 'b', byStyle: { 2: { skillTiers: { good: ['Pace Strategy'] } } } };
	const newerCmEntry = { source: 'c', byStyle: { 3: { idealStats: { stamina: 900 } } } };
	addCommunityGuidance(cmMile, cmEntry, storage);
	addCommunityGuidance(lohMile, lohEntry, storage);
	addCommunityGuidance({ id: 'cm-mile', version: '2027.1' }, newerCmEntry, storage);

	assert.deepEqual(loadCommunityGuidance(cmMile, storage), [cmEntry]);
	assert.deepEqual(loadCommunityGuidance(lohMile, storage), [lohEntry]);
	assert.deepEqual(loadCommunityGuidance({ id: 'cm-mile', version: '2027.1' }, storage), [newerCmEntry]);
});

test('community guidance storage ignores malformed persisted data instead of throwing', () => {
	for (const raw of ['{not json', JSON.stringify([1, 2, 3]), JSON.stringify({ 'cm-mile@2026.1': [{ source: '' }] })]) {
		const storage = memoryStorage({ [COMMUNITY_GUIDANCE_STORAGE_KEY]: raw });
		assert.deepEqual(loadCommunityGuidance(cmMile, storage), []);
	}
});

test('community guidance storage drops a legacy note-shaped entry on read (no byStyle field)', () => {
	const raw = JSON.stringify({ 'cm-mile@2026.1': [{ source: 'old', note: 'legacy free-text note' }] });
	const storage = memoryStorage({ [COMMUNITY_GUIDANCE_STORAGE_KEY]: raw });
	assert.deepEqual(loadCommunityGuidance(cmMile, storage), []);
});

test('shared validator accepts a well-formed byStyle entry', () => {
	assert.equal(isValidCommunityGuidance(wellFormedEntry), true);
});

test('shared validator accepts a style entry with only idealStats', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 2: { idealStats: { power: 800 } } } }), true);
});

test('shared validator accepts a style entry with only skillTiers', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 4: { skillTiers: { situational: ['Uma Stan'] } } } }), true);
});

test('shared validator rejects the legacy {source, note} shape (no byStyle field)', () => {
	assert.equal(isValidCommunityGuidance({ source: 'old', note: 'text' }), false);
});

test('shared validator rejects non-numeric stat values', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 3: { idealStats: { speed: 'fast' } } } }), false);
});

test('shared validator rejects unknown stat keys', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 1: { idealStats: { luck: 5 } } } }), false);
});

test('shared validator rejects unknown skill tier keys', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 1: { skillTiers: { legendary: ['x'] } } } }), false);
});

test('shared validator rejects a non-string skill entry', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 1: { skillTiers: { core: [1, 2] } } } }), false);
});

test('shared validator rejects byStyle that is an array or null', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: [] }), false);
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: null }), false);
});

test('shared validator rejects an out-of-range style key', () => {
	assert.equal(isValidCommunityGuidance({ source: 'x', byStyle: { 6: { idealStats: { speed: 1 } } } }), false);
});

test('shared validator never throws on arbitrary garbage input', () => {
	for (const garbage of [undefined, null, 42, 'string', [], () => {}, Symbol('x')]) {
		assert.doesNotThrow(() => isValidCommunityGuidance(garbage));
	}
});

test('isCommunityGuidanceList accepts an array of well-formed entries and rejects a non-array', () => {
	assert.equal(isCommunityGuidanceList([wellFormedEntry]), true);
	assert.equal(isCommunityGuidanceList('not-an-array'), false);
	assert.equal(isCommunityGuidanceList([wellFormedEntry, { source: 'old', note: 'x' }]), false);
});
