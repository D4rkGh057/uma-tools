import test from 'node:test';
import assert from 'node:assert/strict';

import { skillData, skillGroups, skillMeta } from './skillGroups';

const grandLiveIds = ['202391', '202392', '210071', '210072'];

test('Grand Live SP skills are present in their purchasable skill groups', () => {
	for (const id of grandLiveIds) {
		assert.ok(skillData[id], `missing skill data for ${id}`);
		assert.ok(skillMeta[id], `missing skill metadata for ${id}`);
		assert.ok(skillData[id].rarity < 3, `${id} must be SP-purchasable`);
		assert.ok(skillGroups.get(skillMeta[id].groupId)?.includes(id), `${id} is absent from skillGroups`);
	}

	assert.deepEqual(skillGroups.get('20239'), ['202392', '202391']);
	assert.deepEqual(skillGroups.get('21007'), ['210072', '210071']);
});
