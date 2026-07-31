import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluate } from './evaluation';

const purchaseInput = {
	ownedSkills: [],
	budget: 500,
	hints: { '10071': 0, '10451': 0 },
};

test('evaluation returns a ready Score result with a concrete purchase plan', () => {
	const result = evaluate({ ...purchaseInput, mode: 'Score' });

	assert.equal(result.status, 'ready');
	assert.equal(result.mode, 'Score');
	assert.deepEqual(result.purchase, {
		totalCost: 0,
		totalScore: 0,
		picks: [],
		situational: [],
	});
	assert.deepEqual(result.breakdown, []);
});

test('evaluation rejects an unrecognized mode without returning a purchase plan', () => {
	const result = evaluate({ ...purchaseInput, mode: 'UnsupportedMode' });

	assert.deepEqual(result, { status: 'invalid', mode: 'UnsupportedMode', reason: 'Unsupported evaluation mode' });
});

test('evaluation marks TeamTrials rankings unavailable while preserving the purchase plan', () => {
	const score = evaluate({ ...purchaseInput, mode: 'Score' });
	const teamTrials = evaluate({ ...purchaseInput, mode: 'TeamTrials' });

	assert.equal(teamTrials.status, 'unavailable');
	assert.equal(teamTrials.mode, 'TeamTrials');
	assert.equal(teamTrials.reason, 'Team Trials rankings require source-backed ranking semantics');
	assert.deepEqual(teamTrials.purchase, score.purchase);
});

test('evaluation preserves purchase outputs across declared modes', () => {
	const score = evaluate({ ...purchaseInput, mode: 'Score' });
	assert.equal(score.status, 'ready');

	for (const [mode, profile] of [
		['ChampionsMeeting', { id: 'cm-mile', version: '2026.1' }],
		['LeagueOfHeroes', { id: 'loh-mile', version: '2026.1' }],
	] as const) {
		const result = evaluate({ ...purchaseInput, mode, profile });
		assert.equal(result.status, 'ready');
		assert.equal(result.mode, mode);
		assert.deepEqual(result.purchase, score.purchase);
	}
});

test('evaluation resolves an exact Champions Meeting profile into qualitative archetype evidence', () => {
	const result = evaluate({
		...purchaseInput,
		mode: 'ChampionsMeeting',
		profile: { id: 'cm-mile', version: '2026.1' },
	});

	assert.equal(result.status, 'ready');
	assert.equal(result.mode, 'ChampionsMeeting');
	assert.deepEqual(result.profile, {
		reference: { id: 'cm-mile', version: '2026.1' },
		provenance: { source: 'curated CM matchup notes', reviewedAt: '2026-07-30' },
		assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' },
		archetypes: [{ id: 'runner', label: 'Front runner' }, { id: 'pacer', label: 'Pace leader' }],
		rules: ['Use pairwise or pacer evidence only'],
	});
	assert.deepEqual(result.matchups, [
		{ archetype: { id: 'runner', label: 'Front runner' }, status: 'ready', observation: 'supported', evidence: { scope: 'pairwise', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1' } },
		{ archetype: { id: 'pacer', label: 'Pace leader' }, status: 'ready', observation: 'mixed', evidence: { scope: 'pacer', coverage: '1 pacer fixture', reproduction: 'seeded pacer fixture', simulatorVersion: 'umalator-1' } },
	]);
});

test('evaluation fails closed for absent, unresolved, and mode-mismatched meta profiles', () => {
	for (const request of [
		{ ...purchaseInput, mode: 'LeagueOfHeroes' },
		{ ...purchaseInput, mode: 'ChampionsMeeting', profile: { id: 'cm-mile', version: 'missing' } },
		{ ...purchaseInput, mode: 'LeagueOfHeroes', profile: { id: 'cm-mile', version: '2026.1' } },
	]) {
		assert.deepEqual(evaluate(request), {
			status: 'invalid',
			mode: request.mode,
			reason: 'A matching meta profile is required',
		});
	}
});
