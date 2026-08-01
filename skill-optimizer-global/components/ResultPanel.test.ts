import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readyResultContent, ReadyEvaluationResult } from './resultPanelReady';
import { resultPanelStateContent } from './resultPanelState';

test('ResultPanel preserves the ready evaluation purchase and immutable breakdown', () => {
	const breakdown = Object.freeze([{ groupId: 'speed', ownedSkillId: null, candidates: Object.freeze([]) }]);
	const result: ReadyEvaluationResult = {
		status: 'ready',
		mode: 'Score',
		purchase: { totalCost: 120, totalScore: 1.25, picks: [], situational: [] },
		breakdown,
	};

	const content = readyResultContent(result);

	assert.strictEqual(content.plan, result.purchase);
	assert.strictEqual(content.breakdown, breakdown);
});

test('ResultPanel does not rebuild the centralized evaluation breakdown', () => {
	const source = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/components/ResultPanel.tsx'), 'utf8');

	assert.doesNotMatch(source, /\bbuildBreakdown\b/);
	assert.doesNotMatch(source, /optimizer\/(?:cost|conditions|optimize|probes|score|skillGroups)/);
});

test('ResultPanel renders unavailable, invalid, and migrated result states explicitly', () => {
	assert.equal(
		resultPanelStateContent({ status: 'unavailable', mode: 'TeamTrials', reason: 'Source-backed rankings are not available.', purchase: { totalCost: 0, totalScore: 0, picks: [], situational: [] }, breakdown: [] }).message,
		'Rankings are unavailable: Source-backed rankings are not available.',
	);
	assert.equal(
		resultPanelStateContent({ status: 'invalid', mode: 'Unknown', reason: 'Unsupported evaluation mode.' }).message,
		'Invalid evaluation mode (Unknown): Unsupported evaluation mode.',
	);
	assert.equal(
		resultPanelStateContent({ status: 'migrated', state: {} as never, selection: { mode: 'Score' } }).message,
		'Saved optimizer build was migrated to Score mode.',
	);
});
