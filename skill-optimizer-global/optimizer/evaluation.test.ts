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

test('evaluation resolves an exact Champions Meeting profile into its curated provenance, assumptions, and community guidance', () => {
	const result = evaluate({
		...purchaseInput,
		mode: 'ChampionsMeeting',
		profile: { id: 'cm-mile', version: '2026.1' },
	});

	assert.equal(result.status, 'ready');
	assert.equal(result.mode, 'ChampionsMeeting');
	assert.deepEqual(result.profile, {
		reference: { id: 'cm-mile', version: '2026.1' },
		provenance: { source: 'gametora.com/umamusume/events/champions-meeting (CM 17 - Virgo Cup)', reviewedAt: '2026-08-02' },
		assumptions: { course: '2000m dirt, Ooi, right-handed, good, autumn, sunny', lobby: 'profile-scoped opponents' },
		communityGuidance: [],
	});
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
