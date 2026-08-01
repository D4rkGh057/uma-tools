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

test('ResultPanel identifies empty, unavailable, and retained output as status feedback', () => {
	const source = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/components/ResultPanel.tsx'), 'utf8');

	assert.match(source, /role="status"[^>]*>Select an uma to see a recommended purchase combo\./);
	assert.match(source, /role="status"[^>]*>\{resultPanelStateContent\(stateContent\)\.message\}/);
	assert.match(source, /Last optimized result/);
	assert.doesNotMatch(source, /(?:fresh|stale|current inputs|matches current)/i);
});

test('ResultPanel keeps its complete result content and exposes the breakdown state', () => {
	const source = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/components/ResultPanel.tsx'), 'utf8');

	assert.match(source, /Total cost: \{displayedPlan\.totalCost\} SP/);
	assert.match(source, /Situational \(not scored\)/);
	assert.match(source, /aria-expanded=\{showBreakdown\}/);
	assert.match(source, /aria-controls="result-breakdown"/);
});

test('ResultPanel puts every dense result table in a labeled focusable overflow region', () => {
	const source = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/components/ResultPanel.tsx'), 'utf8');
	const css = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/app.css'), 'utf8');

	assert.match(source, /aria-label="Recommended purchases" tabIndex=\{0\}/);
	assert.match(source, /aria-label="Situational purchases" tabIndex=\{0\}/);
	assert.match(source, /aria-label=\{`Developer breakdown for group \$\{g\.groupId\}`\} tabIndex=\{0\}/);
	assert.match(css, /\.result-table-overflow\s*\{[^}]*overflow-x:\s*auto/);
	assert.match(css, /\.result-picks,[\s\S]*\.result-situational-table,[\s\S]*\.result-breakdown-group table\s*\{[^}]*min-width:/);
});

test('MetaMatchupPanel exposes its matchup output as a labeled feedback region', () => {
	const source = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/components/MetaMatchupPanel.tsx'), 'utf8');

	assert.match(source, /role="region" aria-label="Meta matchup profile"/);
	assert.match(source, /aria-live="polite"/);
});
