import test from 'node:test';
import assert from 'node:assert/strict';

import { ownedTiersFromSkills } from '../components/umaInput';
import { candidateGroupIds } from './optimize';
import { isSpPurchasableRarity, skillData, skillGroups, skillMeta } from './skillGroups';

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

test('skillGroups projects purchasable tiers while excluding evolved skills', () => {
	assert.equal(isSpPurchasableRarity(1), true);
	assert.equal(isSpPurchasableRarity(2), true);
	assert.equal(isSpPurchasableRarity(3), false);
	assert.equal(isSpPurchasableRarity(5), false);
	assert.equal(isSpPurchasableRarity(6), false);
	assert.ok(Array.from(skillGroups.values()).flat().every(id => skillData[id].rarity < 3));
});

test('skillGroups excludes non-shop unique tiers', () => {
	const uniqueId = Object.keys(skillData).find(id => {
		const rarity = skillData[id].rarity;
		return rarity >= 3 && rarity <= 5;
	});

	assert.ok(uniqueId, 'fixture must contain a non-shop unique tier');
	assert.ok(!skillGroups.get(skillMeta[uniqueId].groupId)?.includes(uniqueId));
});

test('projected group consumers agree on owned tiers and candidate hints', () => {
	const groupId = '20239';
	const tiers = skillGroups.get(groupId)!;
	const excludedId = Object.keys(skillData).find(id => {
		const rarity = skillData[id].rarity;
		return rarity >= 3 && rarity <= 5;
	})!;
	const [whiteId, goldId] = tiers;

	assert.deepEqual(ownedTiersFromSkills([{ id: Number(excludedId), level: 1 }]), new Map());
	assert.deepEqual(
		ownedTiersFromSkills([
			{ id: Number(whiteId), level: 1 },
			{ id: Number(goldId), level: 1 },
			{ id: Number(excludedId), level: 1 },
		]),
		new Map([[groupId, 1]])
	);

	assert.deepEqual(candidateGroupIds({ [goldId]: 0, [excludedId]: 0 }), [groupId]);
	assert.deepEqual(candidateGroupIds({ [excludedId]: 0 }), []);
});
