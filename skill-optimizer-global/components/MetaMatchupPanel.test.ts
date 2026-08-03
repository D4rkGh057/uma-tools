import { h } from 'preact';
import test from 'node:test';
import assert from 'node:assert/strict';

import { metaMatchupPanelContent, MetaMatchupPanel } from './MetaMatchupPanel';
import { renderToContainer } from '../testUtils/domRender';
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
		communityGuidance: [],
	},
};

test('MetaMatchupPanel exposes result-owned CM provenance and assumptions', () => {
	assert.deepEqual(metaMatchupPanelContent(championsMeetingResult), {
		heading: 'CM profile',
		provenance: 'cm-mile v2026.1 — curated CM matchup notes; reviewed 2026-07-30',
		assumptions: 'Course: 1600m turf; lobby: profile-scoped opponents',
		communityGuidance: [],
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

test('MetaMatchupPanel reports no community guidance groups when neither the profile nor local storage declares any', () => {
	assert.deepEqual(metaMatchupPanelContent(championsMeetingResult)?.communityGuidance, []);
});

test('MetaMatchupPanel groups catalog and local guidance covering the same style under one shared group, in style order', () => {
	const guidedResult: MetaEvaluationResult = {
		...championsMeetingResult,
		profile: {
			...championsMeetingResult.profile,
			communityGuidance: [
				{ source: 'curated CM guide', byStyle: { 5: { idealStats: { speed: 1300 } }, 1: { skillTiers: { core: ['Straightaway Recovery'] } } } },
			],
		},
	};
	const localGuidance = [
		{ source: 'moomoocows CM tier guide', byStyle: { 5: { skillTiers: { good: ['Speed Star'] } } } },
	];

	const groups = metaMatchupPanelContent(guidedResult, localGuidance)?.communityGuidance;
	assert.deepEqual(groups, [
		{
			style: 1,
			label: 'Front Runner',
			items: [
				{ source: 'curated CM guide', idealStats: [], skillTiers: [{ tier: 'core', skills: ['Straightaway Recovery'] }] },
			],
		},
		{
			style: 5,
			label: 'Runaway',
			items: [
				{ source: 'curated CM guide', idealStats: [{ stat: 'speed', value: 1300 }], skillTiers: [] },
				{ source: 'moomoocows CM tier guide', idealStats: [], skillTiers: [{ tier: 'good', skills: ['Speed Star'] }] },
			],
		},
	]);
});

test('MetaMatchupPanel omits styles with no guidance from any source', () => {
	const guidedResult: MetaEvaluationResult = {
		...championsMeetingResult,
		profile: {
			...championsMeetingResult.profile,
			communityGuidance: [{ source: 'curated CM guide', byStyle: { 2: { idealStats: { power: 900 } } } } ],
		},
	};

	const groups = metaMatchupPanelContent(guidedResult)?.communityGuidance;
	assert.deepEqual(groups?.map(group => group.style), [2]);
	assert.equal(groups?.some(group => group.style === 4), false);
});

test('MetaMatchupPanel renders one heading per guidance-covered style, hides guidance-free styles, and labels each item by source', () => {
	const guidedResult: MetaEvaluationResult = {
		...championsMeetingResult,
		profile: {
			...championsMeetingResult.profile,
			communityGuidance: [{ source: 'curated CM guide', byStyle: { 1: { idealStats: { speed: 1200 } } } }],
		},
	};
	const localGuidance = [{ source: 'moomoocows CM tier guide', byStyle: { 3: { skillTiers: { situational: ['Uma Stan'] } } } }];

	const container = renderToContainer(h(MetaMatchupPanel, { result: guidedResult, localGuidance }));

	const headings = Array.from(container.querySelectorAll('.meta-matchup-panel-community h4')).map(el => el.textContent);
	assert.deepEqual(headings, ['Front Runner', 'Late Surger']);

	const communitySection = container.querySelector('.meta-matchup-panel-community')!;
	assert.ok(communitySection.textContent?.includes('curated CM guide'));
	assert.ok(communitySection.textContent?.includes('moomoocows CM tier guide'));

	// Guidance-free styles never get a heading or row.
	assert.equal(Array.from(communitySection.querySelectorAll('h4')).some(h4 => h4.textContent === 'Pace Chaser'), false);
});

test('MetaMatchupPanel has no rendered output before a result-owned meta evaluation exists', () => {
	assert.equal(MetaMatchupPanel({ result: null }), null);
});
