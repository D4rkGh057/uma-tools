import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMatchup } from './metaMatchup';
import { findProfile, isValidMetaProfile, profileCatalog } from './profiles/catalog';

const profile = findProfile({ id: 'cm-mile', version: '2026.1' }, 'ChampionsMeeting')!;
test('profiles are immutable, exact-reference validated, and reject missing provenance', () => {
	assert.equal(Object.isFrozen(profile), true); assert.equal(findProfile({ id: 'cm-mile', version: 'latest' }, 'ChampionsMeeting'), null);
	assert.equal(isValidMetaProfile({ ...profile, provenance: { source: '', reviewedAt: '' } }), false); assert.equal(profileCatalog.length, 2);
});
test('analyzer reports covered and uncovered qualitative observations', () => {
	assert.deepEqual(analyzeMatchup(profile, 'runner'), { status: 'ready', observation: 'supported', scope: 'pairwise', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1' });
	assert.deepEqual(analyzeMatchup(profile, 'closer'), { status: 'unavailable', reason: 'No profile-scoped evidence covers this archetype' });
});
test('analyzer blocks aggregate claims and labels only scoped numeric evidence', () => {
	assert.equal(analyzeMatchup(profile, 'runner', 'fullLobbyWinProbability').status, 'blocked');
	assert.deepEqual(analyzeMatchup(profile, 'runner', 'pairwiseDelta'), { status: 'numeric', value: 0.12, label: 'pairwise-scoped; profile cm-mile@2026.1; simulator umalator-1' });
	assert.match((analyzeMatchup(profile, 'pacer', 'pacerDelta') as { label: string }).label, /^pacer-scoped; profile cm-mile@2026.1; simulator umalator-1$/);
});
