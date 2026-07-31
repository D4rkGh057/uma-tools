import test from 'node:test';
import assert from 'node:assert/strict';
import { isEvaluationMode, modeAdapters } from './modeAdapters';
import { Plan } from './types';

const plan: Plan = { totalCost: 0, totalScore: 0, picks: [], situational: [] };
test('mode adapters route every declared mode and retain the shared purchase plan', () => {
	const profiles = {
		ChampionsMeeting: { id: 'cm-mile', version: '2026.1' },
		LeagueOfHeroes: { id: 'loh-mile', version: '2026.1' },
	};
	for (const mode of ['Score', 'TeamTrials', 'ChampionsMeeting', 'LeagueOfHeroes'] as const) {
		const result = modeAdapters[mode](plan, [], profiles[mode as keyof typeof profiles]);
		assert.equal(result.mode, mode); assert.equal(result.purchase, plan);
	}
	assert.equal(isEvaluationMode('Unknown'), false);
});
