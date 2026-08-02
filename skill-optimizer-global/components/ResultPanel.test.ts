import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { h } from 'preact';
import { act } from 'preact/test-utils';

import { readyResultContent, ReadyEvaluationResult } from './resultPanelReady';
import { resultPanelStateContent } from './resultPanelState';
import { MetaMatchupPanel } from './MetaMatchupPanel';
import { ResultPanel } from './ResultPanel';
import type { MetaEvaluationResult } from '../optimizer/types';
import { renderToContainer } from '../testUtils/domRender';

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

// Renders real dense data (long values, a situational row, and the dev breakdown) through a real
// `preact.render()` pass instead of matching source text, closing spec scenario "Dense table DOM
// structure" (narrow-screen-dense-data delta): every dense result table must sit inside a labelled,
// focusable (tabIndex=0) overflow wrapper, and every header/cell must survive intact -- including long
// values that a real browser would need to scroll to, which this DOM-only harness cannot itself prove
// (see the separate 320px browser record; this test makes no width/media-query/scroll/focus-visibility
// claim, only structural survival of the labelled wrapper and full header/cell content).
test('ResultPanel renders every dense result table in a labelled, focusable overflow wrapper with full header and cell content, including long values', async () => {
	const longPickSkillId = 'extremely-long-pick-skill-identifier-used-to-prove-nothing-is-clipped-in-the-dom-0001';
	const longStepSkillId = 'extremely-long-step-skill-identifier-used-to-prove-nothing-is-clipped-in-the-dom-0002';
	const longSituationalSkillId = 'extremely-long-situational-skill-identifier-used-to-prove-nothing-is-clipped-0003';
	const longSituationalReason = 'Positioning skill excluded from the blended score because it changes lane rather than contributing measurable speed, stamina, power, guts, or wisdom to the run.';
	const longBreakdownPickedSkillId = 'extremely-long-breakdown-picked-skill-identifier-used-to-prove-nothing-is-clipped-0004';
	const longBreakdownExcludedSkillId = 'extremely-long-breakdown-excluded-skill-identifier-used-to-prove-nothing-is-clipped-0005';
	const longExclusionReason = 'Excluded because a cheaper option in the same group already covers the same condition-fit at a lower cost per effect magnitude.';

	const result: ReadyEvaluationResult = {
		status: 'ready',
		mode: 'Score',
		purchase: {
			totalCost: 987654,
			totalScore: 9.999,
			picks: [{
				groupId: 'dense-pick-group',
				targetIdx: 3,
				skillId: longPickSkillId,
				cost: 654321,
				score: 9.999,
				steps: [{ skillId: longStepSkillId, baseCost: 500000, hint: 5, cost: 400000 }],
			}],
			situational: [{
				groupId: 'dense-situational-group',
				skillId: longSituationalSkillId,
				cost: 111111,
				reason: longSituationalReason,
			}],
		},
		breakdown: [{
			groupId: 'dense-breakdown-group',
			ownedSkillId: null,
			candidates: [
				{ skillId: longBreakdownPickedSkillId, cost: 222222, score: 8.888, picked: true, excluded: false, exclusionReason: null },
				{ skillId: longBreakdownExcludedSkillId, cost: 333333, score: 1.111, picked: false, excluded: true, exclusionReason: longExclusionReason },
			],
		}],
	};

	const container = renderToContainer(h(ResultPanel, { input: { ownedSkills: [], budget: 999999, hints: {} }, plan: null, result }));

	// Preact intentionally routes `tabIndex` through `dom.setAttribute('tabIndex', value)` rather than a
	// direct property assignment (see preact/src/diff/props.js's explicit `tabIndex` exclusion, done so
	// the browser's `-1`-default/`''`-cast-to-`0` property semantics never leak in). linkedom's attribute
	// storage is case-sensitive and does not lower-case HTML attribute names the way a real browser's
	// `setAttribute` does, so the literal-cased `getAttribute('tabIndex')` is required here -- both the
	// lower-cased `getAttribute('tabindex')` and the `.tabIndex` IDL property getter (which itself has an
	// unrelated linkedom bug turning a real `0` into `-1` via `parseFloat(...) || -1`) would read back
	// nothing from this harness even though the attribute the DOM will actually expose is correct.
	const readTabIndex = (el: Element) => el.getAttribute('tabIndex');

	// -- Recommended purchases: labelled, focusable overflow wrapper; full header + cell survival.
	const picksWrapper = container.querySelector('[aria-label="Recommended purchases"]');
	assert.ok(picksWrapper, 'expected a labelled overflow wrapper around the recommended purchases table');
	assert.equal(readTabIndex(picksWrapper!), '0');
	const picksTable = picksWrapper!.querySelector('table.result-picks');
	assert.ok(picksTable, 'expected the overflow wrapper to contain the recommended purchases table');
	assert.deepEqual(Array.from(picksTable!.querySelectorAll('thead th')).map(th => th.textContent), ['Skill', 'Cost', 'Score', 'Steps']);
	const pickRowText = picksTable!.querySelector('tbody tr')?.textContent ?? '';
	assert.ok(pickRowText.includes(`Skill ${longPickSkillId}`));
	assert.ok(pickRowText.includes('654321'));
	assert.ok(pickRowText.includes('9.999'));
	assert.ok(pickRowText.includes(`Skill ${longStepSkillId} (hint 5, 400000 SP)`));

	// -- Situational purchases: labelled, focusable overflow wrapper; full header + cell survival.
	const situationalWrapper = container.querySelector('[aria-label="Situational purchases"]');
	assert.ok(situationalWrapper, 'expected a labelled overflow wrapper around the situational purchases table');
	assert.equal(readTabIndex(situationalWrapper!), '0');
	const situationalTable = situationalWrapper!.querySelector('table.result-situational-table');
	assert.ok(situationalTable, 'expected the overflow wrapper to contain the situational purchases table');
	assert.deepEqual(Array.from(situationalTable!.querySelectorAll('thead th')).map(th => th.textContent), ['Skill', 'Cost', 'Reason']);
	const situationalCells = Array.from(situationalTable!.querySelectorAll('tbody tr td')).map(td => td.textContent);
	assert.equal(situationalCells[0], `Skill ${longSituationalSkillId}`);
	assert.equal(situationalCells[1], '111111');
	assert.equal(situationalCells[2], longSituationalReason);

	// -- Dev breakdown only renders after the existing toggle is activated; assert its wrapper and every
	// header/cell (including the excluded row's long reason) survive too.
	const toggle = container.querySelector('.result-breakdown-toggle');
	assert.ok(toggle, 'expected the dev breakdown toggle button to render');
	const ClickEvent = (globalThis as any).window.Event;
	await act(() => {
		toggle!.dispatchEvent(new ClickEvent('click', { bubbles: true }));
	});

	const breakdownWrapper = container.querySelector('[aria-label="Developer breakdown for group dense-breakdown-group"]');
	assert.ok(breakdownWrapper, 'expected a labelled overflow wrapper around the developer breakdown table');
	assert.equal(readTabIndex(breakdownWrapper!), '0');
	const breakdownTable = breakdownWrapper!.querySelector('table');
	assert.ok(breakdownTable, 'expected the overflow wrapper to contain the developer breakdown table');
	assert.deepEqual(Array.from(breakdownTable!.querySelectorAll('thead th')).map(th => th.textContent), ['Skill', 'Cost', 'Score', 'Picked', 'Excluded']);
	const breakdownRows = Array.from(breakdownTable!.querySelectorAll('tbody tr'));
	assert.equal(breakdownRows.length, 2);

	const pickedCells = Array.from(breakdownRows[0].querySelectorAll('td')).map(td => td.textContent);
	assert.equal(pickedCells[0], `Skill ${longBreakdownPickedSkillId}`);
	assert.equal(pickedCells[1], '222222');
	assert.equal(pickedCells[2], '8.888');
	assert.equal(pickedCells[3], 'yes');
	assert.equal(pickedCells[4], '');

	const excludedCells = Array.from(breakdownRows[1].querySelectorAll('td')).map(td => td.textContent);
	assert.equal(excludedCells[0], `Skill ${longBreakdownExcludedSkillId}`);
	assert.equal(excludedCells[1], '333333');
	assert.equal(excludedCells[2], '1.111');
	assert.equal(excludedCells[3], '');
	assert.equal(excludedCells[4], longExclusionReason);
});

test('ResultPanel renders an explicit status empty state before evaluation', () => {
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null }));
	const emptyState = container.querySelector('[role="status"]');

	assert.ok(emptyState);
	assert.equal(emptyState.textContent, 'Select an uma to see a recommended purchase combo.');
});

test('ResultPanel keeps the explicit empty state when editable input exists without an evaluation', () => {
	const container = renderToContainer(h(ResultPanel, { input: { ownedSkills: [], budget: 100, hints: {} }, plan: null }));
	const emptyState = container.querySelector('[role="status"]');

	assert.ok(emptyState);
	assert.equal(emptyState.textContent, 'Select an uma to see a recommended purchase combo.');
	assert.equal(container.querySelector('h3'), null);
});

test('ResultPanel renders a retained evaluated result for changed editable input', () => {
	const result: ReadyEvaluationResult = { status: 'ready', mode: 'Score', purchase: { totalCost: 120, totalScore: 1.25, picks: [], situational: [] }, breakdown: [] };
	const container = renderToContainer(h(ResultPanel, { input: { ownedSkills: [], budget: 600, hints: {} }, plan: null, result }));
	assert.equal(container.querySelector('h3')?.textContent, 'Last optimized result');
	assert.match(container.textContent ?? '', /Total cost: 120 SP/);
	assert.match(container.textContent ?? '', /Total score: 1\.250/);
	assert.match(container.textContent ?? '', /No purchase improves the score within budget\./);
	assert.doesNotMatch(container.textContent ?? '', /(?:fresh|stale|current inputs|matches current)/i);
});
test('ResultPanel retains evaluated purchases and situational content across different editable input', () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 340, totalScore: 2.75,
			picks: [{
				groupId: 'retained-group', targetIdx: 1, skillId: 'retained-skill', cost: 240, score: 2.5,
				steps: [{ skillId: 'retained-step', baseCost: 240, hint: 1, cost: 240 }],
			}],
			situational: [{ groupId: 'retained-situational', skillId: 'situational-skill', cost: 100, reason: 'Positioning' }],
		},
		breakdown: [],
	};
	const container = renderToContainer(h(ResultPanel, { input: { ownedSkills: [{ id: 1, level: 1 }], budget: 999, hints: { 1: 5 } }, plan: null, result }));
	assert.match(container.textContent ?? '', /Total cost: 340 SP/);
	assert.match(container.textContent ?? '', /Total score: 2\.750/);
	assert.ok(container.querySelector('[aria-label="Recommended purchases"]'));
	assert.match(container.textContent ?? '', /Skill retained-skill/);
	assert.ok(container.querySelector('[aria-label="Situational purchases"]'));
	assert.match(container.textContent ?? '', /Situational \(not scored\)/);
	assert.match(container.textContent ?? '', /Skill situational-skill/);
	assert.doesNotMatch(container.textContent ?? '', /(?:fresh|stale|current inputs|matches current)/i);
});

test('ResultPanel renders three visually separated result-section cards when picks, situational, and revealed breakdown are all present', async () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 300, totalScore: 3,
			picks: [{
				groupId: 'section-pick-group', targetIdx: 0, skillId: 'section-pick-skill', cost: 200, score: 2,
				steps: [{ skillId: 'section-step-skill', baseCost: 200, hint: 1, cost: 200 }],
			}],
			situational: [{ groupId: 'section-situational-group', skillId: 'section-situational-skill', cost: 100, reason: 'Positioning' }],
		},
		breakdown: [{
			groupId: 'section-breakdown-group', ownedSkillId: null,
			candidates: [{ skillId: 'section-breakdown-skill', cost: 50, score: 1, picked: true, excluded: false, exclusionReason: null }],
		}],
	};
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null, result }));

	const toggle = container.querySelector('.result-breakdown-toggle');
	const ClickEvent = (globalThis as any).window.Event;
	await act(() => {
		toggle!.dispatchEvent(new ClickEvent('click', { bubbles: true }));
	});

	assert.equal(container.querySelectorAll('.result-section').length, 3);
});

test('ResultPanel renders exactly one result-section card when only picks have content', () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 200, totalScore: 2,
			picks: [{ groupId: 'lone-pick-group', targetIdx: 0, skillId: 'lone-pick-skill', cost: 200, score: 2, steps: [] }],
			situational: [],
		},
		breakdown: [],
	};
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null, result }));

	assert.equal(container.querySelectorAll('.result-section').length, 1);
	assert.equal(container.querySelector('.result-situational'), null);
	assert.equal(container.querySelector('.result-breakdown'), null);
});

test('ResultPanel marks every recommended-purchase row as a result pick', () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 300, totalScore: 3,
			picks: [
				{ groupId: 'first-pick-group', targetIdx: 0, skillId: 'first-pick', cost: 100, score: 1, steps: [] },
				{ groupId: 'second-pick-group', targetIdx: 1, skillId: 'second-pick', cost: 200, score: 2, steps: [] },
			],
			situational: [],
		},
		breakdown: [],
	};
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null, result }));
	const rows = Array.from(container.querySelectorAll('.result-picks tbody tr'));

	assert.equal(rows.length, result.purchase.picks.length);
	assert.ok(rows.every(row => row.classList.contains('result-pick')));
});

// Closes spec scenario "Picks and situational both present at wide viewport" (skill-optimizer-results-columns
// delta): picks and situational must share one `.result-columns` pairing wrapper so the wide-viewport CSS grid
// can lay them out side by side, while the developer breakdown -- rendered after the wrapper, outside it --
// must never become a grid child.
test('ResultPanel wraps picks and situational sections in a shared .result-columns pairing container', () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 500, totalScore: 5,
			picks: [{ groupId: 'columns-pick-group', targetIdx: 0, skillId: 'columns-pick-skill', cost: 300, score: 3, steps: [] }],
			situational: [{ groupId: 'columns-situational-group', skillId: 'columns-situational-skill', cost: 200, reason: 'Positioning' }],
		},
		breakdown: [],
	};
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null, result }));

	const columns = container.querySelector('.result-columns');
	assert.ok(columns, 'expected a .result-columns wrapper around picks and situational');
	assert.equal(columns!.children.length, 2);
	assert.ok(columns!.querySelector('.result-section-picks'), 'expected the picks section inside .result-columns');
	assert.ok(columns!.querySelector('.result-situational'), 'expected the situational section inside .result-columns');
	assert.equal(columns!.querySelector('.result-breakdown'), null, 'the developer breakdown must never be a child of .result-columns');
});

// Closes spec scenario "Only picks present at wide viewport": when situational has no content, the wrapper
// must hold exactly the picks section and no empty second child, so the `:only-child` CSS rule can span it
// across both grid tracks without an empty cell appearing beside it.
test('ResultPanel keeps .result-columns to a single child when situational is absent', () => {
	const result: ReadyEvaluationResult = {
		status: 'ready', mode: 'Score',
		purchase: {
			totalCost: 200, totalScore: 2,
			picks: [{ groupId: 'columns-lone-pick-group', targetIdx: 0, skillId: 'columns-lone-pick-skill', cost: 200, score: 2, steps: [] }],
			situational: [],
		},
		breakdown: [],
	};
	const container = renderToContainer(h(ResultPanel, { input: null, plan: null, result }));

	const columns = container.querySelector('.result-columns');
	assert.ok(columns, 'expected a .result-columns wrapper even when only picks are present');
	assert.equal(columns!.children.length, 1);
	assert.ok(columns!.querySelector('.result-section-picks'));
});

// Closes spec scenarios "Wide-Viewport Two-Column Arrangement" and "Consistent Inter-Section Spacing"
// (skill-optimizer-results-columns delta): reads `app.css` as text per the established convention
// (`appPresentation.test.ts:116`, `presentationSemantics.test.ts:146`), since linkedom provides no CSS
// cascade or layout to assert against.
// The former "Results Container Widening Scoped to Breakpoint" scenario's `margin-inline`/900px-coupled
// narrowing was superseded by `skill-optimizer-three-column-results-layout`: Results now sizes relative
// to the widened/capped shell (`width: 100%; min-width: 0` at `min-width: 1100px`) instead of narrowing
// itself independently at 1520px -- see presentationSemantics.test.ts's "shell-relative retained-results
// zone" test for that coverage. This test keeps asserting the parts of the original scenario that are
// still true: the sibling-spacing selector list and the `.result-columns` two-column subgrid itself.
test('app.css defines a wide-viewport two-column grid for .result-columns and repairs sibling spacing for the wrapper', () => {
	const css = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/app.css'), 'utf8');

	assert.match(
		css,
		/#skillOptimizer \.optimizer-results \.result-section ~ \.result-section,\s*\n#skillOptimizer \.optimizer-results \.result-columns ~ \.result-section \{ margin-top: 0\.75rem; \}/,
		'expected the base sibling-spacing selector list to also cover .result-columns ~ .result-section',
	);

	const mediaMatch = css.match(/@media \(min-width: 1520px\) \{([\s\S]*?)\n\}/);
	assert.ok(mediaMatch, 'expected a @media (min-width: 1520px) block');
	const mediaBlock = mediaMatch![1];
	assert.match(mediaBlock, /repeat\(2, minmax\(0, 1fr\)\)/, 'expected the two-column grid track definition');
	assert.match(mediaBlock, /align-items: start/, 'expected align-items: start to prevent equal-height stretch');
	assert.doesNotMatch(mediaBlock, /margin-inline/, 'expected the superseded 900px-coupled margin-inline narrowing to be gone');
});

test('app.css scopes separated recommended-purchase rows and their narrow-screen compaction to .result-picks', () => {
	const css = readFileSync(resolve(process.cwd(), 'skill-optimizer-global/app.css'), 'utf8');
	const picksRule = css.match(/#skillOptimizer \.result-picks\s*\{([\s\S]*?)\n\}/);
	const pickCellsRule = css.match(/#skillOptimizer \.result-picks \.result-pick td\s*\{([\s\S]*?)\n\}/);
	const narrowScreenRule = css.match(/@media \(max-width: 768px\) \{([\s\S]*?)\n\}/);

	assert.ok(picksRule, 'expected a scoped recommended-purchases table rule');
	assert.match(picksRule![1], /border-collapse:\s*separate/);
	assert.match(picksRule![1], /border-spacing:\s*0\s+[^;]+/);
	assert.ok(pickCellsRule, 'expected visual treatment on recommended-purchase cells');
	assert.match(pickCellsRule![1], /background:/);
	assert.match(pickCellsRule![1], /border-(?:top|bottom):/);
	assert.ok(narrowScreenRule, 'expected a narrow-screen media rule');
	assert.match(narrowScreenRule![1], /#skillOptimizer \.result-picks\s*\{\s*border-spacing:/);
	assert.equal(Array.from(narrowScreenRule![1].matchAll(/border-spacing\s*:/g)).length, 1, 'only the recommended-purchases table should compact row spacing on narrow screens');
});

// ResultPanel itself calls `useState` (for the dev breakdown toggle), so it cannot be invoked as a bare
// function here -- it needs a real Preact render, which needs a DOM this Node harness does not have.
// Its ready/empty/retained message content is exercised above through the real
// `resultPanelStateContent`/`readyResultContent` production functions it renders from.
test('MetaMatchupPanel renders its matchup output as a labeled, live feedback region with result-derived content', () => {
	const result: MetaEvaluationResult = {
		status: 'ready', mode: 'ChampionsMeeting',
		purchase: { totalCost: 0, totalScore: 0, picks: [], situational: [] }, breakdown: [],
		profile: {
			reference: { id: 'cm-mile', version: '2026.1' },
			provenance: { source: 'curated CM matchup notes', reviewedAt: '2026-07-30' },
			assumptions: { course: '1600m turf', lobby: 'profile-scoped opponents' },
			archetypes: [{ id: 'runner', label: 'Front runner' }],
			rules: ['Use pairwise or pacer evidence only'],
		},
		matchups: [{ archetype: { id: 'runner', label: 'Front runner' }, status: 'ready', observation: 'supported', evidence: { scope: 'pairwise', coverage: '1 pair', reproduction: 'seeded pairwise fixture', simulatorVersion: 'umalator-1' } }],
	};

	const panel = MetaMatchupPanel({ result });
	assert.equal(panel!.props.role, 'region');
	assert.equal(panel!.props['aria-label'], 'Meta matchup profile');
	assert.equal(panel!.props['aria-live'], 'polite');
	assert.match(panel!.props.children[2], /cm-mile v2026\.1 — curated CM matchup notes/);
	assert.equal(MetaMatchupPanel({ result: null }), null);
});
