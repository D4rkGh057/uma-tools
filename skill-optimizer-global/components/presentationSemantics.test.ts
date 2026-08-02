import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { h } from 'preact';
import { act } from 'preact/test-utils';

import { ModeSelector, modeLabel } from './ModeSelector';
import { BudgetRaceInputs, BudgetRaceInputsValue } from './BudgetRaceInputs';
import { UmaSelect, UmaSelectProps } from './UmaSelect';
import { ManualUmaEntry } from './ManualUmaEntry';
import { EntryMode, ManualUmaState, defaultOptimizerBuildState } from '../optimizerBuildStorage';
import { renderToContainer } from '../testUtils/domRender';
import { Stat } from '../../components/HorseStatInputs';

const source = (file: string) => readFileSync(resolve(process.cwd(), 'skill-optimizer-global', file), 'utf8');

// BudgetRaceInputs itself has no hooks, but its import chain (../../components/RaceTrack ->
// ../../components/Language) previously read `localStorage`/`navigator` at module load time, which
// throws in this Node test harness (no browser globals) and made the whole import chain unusable
// outside a real browser -- see Language.tsx's `getDefaultLanguage()` lazy-init.
test('BudgetRaceInputs import chain does not throw when loaded outside a browser environment', async () => {
	await assert.doesNotReject(() => import('./BudgetRaceInputs'));
});

// UmaSelect, ManualUmaEntry, and HintTable call Preact hooks (useState/useEffect/useMemo) directly in
// their function bodies, so invoking them outside a real `preact.render()` throws (hook state lives on
// the component the diffing algorithm is currently visiting -- see preact/hooks internals). Rendering
// them needs either a DOM (not available in this Node harness) or extracting pure state-transition
// helpers, both out of scope for this test-only remediation slice; their control semantics remain
// covered by the source assertions below. ModeSelector has no hooks, so it is exercised for real.
test('ModeSelector selects the active mode and marks Team Trials rankings unavailable in real rendered output', () => {
	const calls: string[] = [];
	const vnode = ModeSelector({ mode: 'TeamTrials', onChange: m => calls.push(m) });
	const select = vnode.props.children[1];
	assert.equal(select.props.value, 'TeamTrials');
	const options: any[] = select.props.children;
	const teamTrials = options.find(o => o.props.value === 'TeamTrials');
	assert.equal(teamTrials.props.children, modeLabel('TeamTrials'));
	assert.match(teamTrials.props.children, /rankings unavailable/);
	assert.equal(options.find(o => o.props.value === 'Score').props.children, 'Score');

	select.props.onChange({ currentTarget: { value: 'ChampionsMeeting' } });
	assert.deepEqual(calls, ['ChampionsMeeting']);
});

// BudgetRaceInputs has no hooks of its own; its import chain (../../components/RaceTrack ->
// ../../components/Language) no longer throws at module load time now that Language.tsx's
// localStorage/navigator read is lazily invoked (see the import-chain test above). This lets us
// bare-call the component directly, exactly like ModeSelector above, and exercise its real
// race-context toggle/fieldset output plus the real onChange callback.
test('BudgetRaceInputs renders the race-context toggle and fires onChange with the toggled value', () => {
	const calls: BudgetRaceInputsValue[] = [];
	const value: BudgetRaceInputsValue = { budget: 100 };
	const vnode = BudgetRaceInputs({ value, onChange: v => calls.push(v) });

	const [, fieldset] = vnode.props.children;
	assert.equal(fieldset.type, 'fieldset');
	assert.equal(fieldset.props.class, 'race-context');

	const [legend, toggleLabel, fields] = fieldset.props.children;
	assert.equal(legend.props.children, 'Target race');
	assert.equal(toggleLabel.props.class, 'race-context-toggle');
	// No raceContext on `value`, so the conditional fields block is not rendered.
	assert.equal(fields, false);

	const [checkbox, span] = toggleLabel.props.children;
	assert.equal(checkbox.props.type, 'checkbox');
	assert.equal(checkbox.props.checked, false);
	assert.match(span.props.children, /No target race set/);

	checkbox.props.onChange({ target: { checked: true } });
	assert.deepEqual(calls, [{ budget: 100, raceContext: {} }]);
});

// Smoke test for the linkedom-backed `renderToContainer` test helper (R9.2 infra): proves a real
// `preact.render()` into a real `linkedom` `document` produces real DOM nodes with the expected shape,
// which is the prerequisite for R9.4-R9.8's hook-using component render tests. No behavioral scenario
// assertions belong in this test -- it only proves the rendering infra itself works.
test('renderToContainer renders a trivial vnode into a real DOM container', () => {
	const container = renderToContainer(h('span', { class: 'greeting' }, 'hello world'));
	assert.equal(container.children.length, 1);
	const span = container.children[0];
	assert.equal(span.tagName, 'SPAN');
	assert.equal(span.className, 'greeting');
	assert.equal(span.textContent, 'hello world');
});

// UmaSelect calls hooks (useState/useEffect/useCallback) directly, so it must be exercised through a
// real `renderToContainer` (R9.2) render, not a bare call. `switchPath` does not own `path` itself --
// it only invokes `onEntryModeChange` -- so the real `aria-pressed` flip on the DOM node can only be
// proven by re-rendering with the updated `entryMode` prop, exactly as the real parent (app.tsx) does
// after handling the callback. Closes spec scenario #7.
test('UmaSelect toggle buttons fire onEntryModeChange and reflect aria-pressed on real rendered output', () => {
	const manualState: ManualUmaState = {
		strategy: 'Senkou',
		distanceAptitude: 'A',
		surfaceAptitude: 'A',
		strategyAptitude: 'A',
		ownedSkills: [],
	};
	const entryModeChanges: EntryMode[] = [];
	const propsFor = (entryMode: EntryMode): UmaSelectProps => ({
		onSelect: () => {},
		entryMode,
		manualState,
		onEntryModeChange: m => entryModeChanges.push(m),
		onManualChange: () => {},
	});

	const container = renderToContainer(h(UmaSelect, propsFor('roster')));
	const [rosterButton, manualButton] = Array.from(container.querySelectorAll('.uma-select-path-switch button')) as any[];
	assert.equal(rosterButton.getAttribute('aria-pressed'), 'true');
	assert.equal(manualButton.getAttribute('aria-pressed'), 'false');

	const ClickEvent = (globalThis as any).window.Event;
	manualButton.dispatchEvent(new ClickEvent('click', { bubbles: true }));
	assert.deepEqual(entryModeChanges, ['manual']);

	const afterContainer = renderToContainer(h(UmaSelect, propsFor('manual')));
	const [rosterButtonAfter, manualButtonAfter] = Array.from(afterContainer.querySelectorAll('.uma-select-path-switch button')) as any[];
	assert.equal(manualButtonAfter.getAttribute('aria-pressed'), 'true');
	assert.equal(rosterButtonAfter.getAttribute('aria-pressed'), 'false');
});

test('editable selection controls expose names, selected state, and feedback roles', () => {
	const umaSelect = source('components/UmaSelect.tsx');
	const manualEntry = source('components/ManualUmaEntry.tsx');

	assert.match(umaSelect, /aria-pressed=\{path === 'roster'\}/);
	assert.match(umaSelect, /aria-pressed=\{path === 'manual'\}/);
	assert.match(umaSelect, /aria-label="Roster URL or code"/);
	assert.match(umaSelect, /role="alert"/);
	assert.match(umaSelect, /role="status"/);
	assert.match(umaSelect, /alt=\{`\$\{getCharInfo\(selected\.card_id\)\.charName\} portrait`\}/);
	assert.match(manualEntry, /<fieldset class="manual-uma-stats">/);
	assert.match(manualEntry, /<legend>Build stats<\/legend>/);
	assert.match(manualEntry, /aria-label=\{`Remove skill \$\{s\.id\}`\}/);
});

test('editable budget, hint, and mode controls expose grouped labels and responsive states', () => {
	const budgetRace = source('components/BudgetRaceInputs.tsx');
	const hints = source('components/HintTable.tsx');
	const mode = source('components/ModeSelector.tsx');
	const css = source('app.css');

	assert.match(budgetRace, /<fieldset class="race-context">/);
	assert.match(budgetRace, /<legend>Target race<\/legend>/);
	assert.match(hints, /<caption>Skill hint levels<\/caption>/);
	assert.match(hints, /aria-label=\{`Hint level for \$\{getSkillName\(skillId\)\}`\}/);
	assert.match(hints, /aria-label=\{`Remove hint for \$\{getSkillName\(skillId\)\}`\}/);
	assert.match(mode, /aria-describedby="mode-help"/);
	assert.match(mode, /id="mode-help"/);
	assert.match(css, /\.uma-select-path-switch button\[aria-pressed="true"\]/);
	assert.match(css, /#skillOptimizer input:invalid/);
	assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.race-context-fields/);
});

// ModeSelector has no hooks (see the comment above), so it is exercised the same way as the existing
// "selects the active mode" test above: a bare function call plus a synthetic event object standing in
// for a real DOM change event. Closes spec scenarios "Selected and unavailable choices" and "Supported
// mode activation" (presentation-only-boundary delta): Team Trials must render `disabled`, a forged
// change event selecting it must never reach `onChange`, and a supported mode must still dispatch.
test('ModeSelector disables Team Trials, ignores a forged change event selecting it, and still fires onChange for a supported mode', () => {
	const calls: string[] = [];
	const vnode = ModeSelector({ mode: 'Score', onChange: m => calls.push(m) });
	const select = vnode.props.children[1];
	const options: any[] = select.props.children;

	const teamTrials = options.find(o => o.props.value === 'TeamTrials');
	assert.equal(teamTrials.props.disabled, true);
	for (const supported of ['Score', 'ChampionsMeeting', 'LeagueOfHeroes']) {
		assert.equal(options.find(o => o.props.value === supported).props.disabled, false);
	}

	// A forged/synthetic change event carrying the unavailable mode's value must stay inert: no
	// callback, no state transition.
	select.props.onChange({ currentTarget: { value: 'TeamTrials' } });
	assert.deepEqual(calls, []);

	select.props.onChange({ currentTarget: { value: 'ChampionsMeeting' } });
	assert.deepEqual(calls, ['ChampionsMeeting']);
});

// `Stat` has no hooks either (plain function component), but unlike `<select>`/checkbox `onChange`
// above, preact/compat's vnode normalization rewrites a bare-called `<input>` element's `onInput` prop
// key (see node_modules preact/compat vnode hook), so a real `renderToContainer` render plus a real
// dispatched DOM `input` event is used here instead of reading `.props.onInput` directly -- exactly the
// same rendered-DOM pattern `appPresentation.test.ts` (Phase 1) uses for `speedInput`. Proves the
// optional `onRawValidityChange` seam is a true no-op when the prop is omitted -- the exact shape every
// existing shared caller (HorseDef.tsx) uses today -- so adding the seam cannot break them (design
// decision "Optional raw-validity callback").
test('Stat omitting onRawValidityChange does not throw and still reports the coerced numeric change on real rendered output', () => {
	const changes: number[] = [];
	const container = renderToContainer(h(Stat, { label: 'Speed', statIdx: 0, value: 900, change: (v: number) => changes.push(v) }));
	const input = container.querySelector('input') as any;
	const InputEvent = (globalThis as any).window.Event;
	assert.doesNotThrow(() => {
		input.value = '1500';
		input.dispatchEvent(new InputEvent('input', { bubbles: true }));
	});
	assert.deepEqual(changes, [1500]);
});

// ManualUmaEntry calls hooks (useState), so it needs a real `renderToContainer` render, and its
// `role="alert"` feedback needs `act()` to flush the same instance's re-render across the sequence of
// input events (unlike UmaSelect's toggle test above, this scenario must observe the SAME instance
// recover, not just re-render fresh props). Closes spec scenario "Invalid manual entry recovery"
// (complete-control-presentation delta): empty, non-finite, and out-of-range raw input must each alert
// while the value stays clamped, and a later valid input must clear the alert.
test('manual stat entry alerts on empty, non-finite, and out-of-range raw input, keeps the value clamped, and clears the alert on valid recovery', async () => {
	const initialState = defaultOptimizerBuildState().manualUma;
	const container = renderToContainer(h(ManualUmaEntry, { initialState, onChange: () => {} }));
	const speedInput = container.querySelector('.horseStat input') as any;
	const InputEvent = (globalThis as any).window.Event;

	assert.equal(container.querySelector('[role="alert"]'), null);

	const invalidRawInputs = ['', 'abc', '5000'];
	for (const raw of invalidRawInputs) {
		await act(() => {
			speedInput.value = raw;
			speedInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
		});
		assert.ok(container.querySelector('[role="alert"]'), `expected an alert for raw input ${JSON.stringify(raw)}`);
	}
	// The last invalid case above ('5000', out-of-range) still lands through the existing clamp path.
	assert.equal(speedInput.value, '2000');

	await act(() => {
		speedInput.value = '1000';
		speedInput.dispatchEvent(new InputEvent('input', { bubbles: true }));
	});
	assert.equal(speedInput.value, '1000');
	assert.equal(container.querySelector('[role="alert"]'), null);
});
