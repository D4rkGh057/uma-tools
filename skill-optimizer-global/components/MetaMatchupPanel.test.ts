import test from 'node:test';
import assert from 'node:assert/strict';

import { metaMatchupPanelContent } from './MetaMatchupPanel';
import type { MetaEvaluationResult } from '../optimizer/types';

const championsMeetingResult: MetaEvaluationResult = {
	status: 'ready',
	mode: 'ChampionsMeeting',
	purchase: { totalCost: 0, totalScore: 0, picks: [], situational: [] },
	breakdown: [],
	profile: {
		reference: { id: 'cm-mile', version: '2026.1' },
		provenance: { source: 'curated CM matchup notes', reviewedAt: '2026-07-30' },
		assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' },
		archetypes: [{ id: 'runner', label: 'Front runner' }, { id: 'pacer', label: 'Pace leader' }],
		rules: ['Use pairwise or pacer evidence only'],
	},
	matchups: [
		{ archetype: { id: 'runner', label: 'Front runner' }, status: 'ready', observation: 'supported', evidence: { scope: 'pairwise', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1' } },
		{ archetype: { id: 'pacer', label: 'Pace leader' }, status: 'unavailable', reason: 'No profile-scoped evidence covers this archetype' },
	],
};

test('MetaMatchupPanel exposes result-owned CM provenance, assumptions, rules, and covered or unavailable observations', () => {
	assert.deepEqual(metaMatchupPanelContent(championsMeetingResult), {
		heading: 'CM profile',
		provenance: 'cm-mile v2026.1 — curated CM matchup notes; reviewed 2026-07-30',
		assumptions: 'Course: 1600m turf; lobby: profile-scoped opponents',
		rules: ['Use pairwise or pacer evidence only'],
		matchups: [
			'Front runner: supported; pairwise-scoped; coverage 1 pair; reproduction seeded pairwise fixture; simulator umalator-1',
			'Pace leader: unavailable — No profile-scoped evidence covers this archetype',
		],
	});
});

test('MetaMatchupPanel exposes exact LoH result provenance without consulting a profile catalog', () => {
	const lohResult: MetaEvaluationResult = {
		...championsMeetingResult,
		mode: 'LeagueOfHeroes',
		profile: {
			...championsMeetingResult.profile,
			reference: { id: 'loh-mile', version: '2026.1' },
			provenance: { source: 'curated LoH matchup notes', reviewedAt: '2026-07-30' },
		},
	};

	assert.equal(metaMatchupPanelContent(lohResult)?.heading, 'LoH profile');
	assert.equal(metaMatchupPanelContent(lohResult)?.provenance, 'loh-mile v2026.1 — curated LoH matchup notes; reviewed 2026-07-30');
});

test('MetaMatchupPanel has no profile content before a result-owned meta evaluation exists', () => {
	assert.equal(metaMatchupPanelContent(null), null);
});
