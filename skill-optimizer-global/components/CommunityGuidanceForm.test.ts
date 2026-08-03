import { h } from 'preact';
import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';

import { CommunityGuidanceForm } from './CommunityGuidanceForm';
import { renderToContainer } from '../testUtils/domRender';
import type { MetaCommunityGuidance } from '../optimizer/profiles/types';

const InputEvent = () => (globalThis as any).window.Event;

function openForm(container: Element) {
	const openButton = container.querySelector('.community-guidance-add') as any;
	return act(() => { openButton.dispatchEvent(new (InputEvent())('click', { bubbles: true })); });
}

function selectTab(container: Element, style: number) {
	const tab = container.querySelector(`.community-guidance-tab[data-style="${style}"]`) as any;
	return act(() => { tab.dispatchEvent(new (InputEvent())('click', { bubbles: true })); });
}

function setStat(container: Element, stat: string, value: string) {
	const input = container.querySelector(`.community-guidance-stat-input[data-stat="${stat}"]`) as any;
	return act(() => {
		input.value = value;
		input.dispatchEvent(new (InputEvent())('input', { bubbles: true }));
	});
}

function setTier(container: Element, tier: string, value: string) {
	const input = container.querySelector(`.community-guidance-tier-input[data-tier="${tier}"]`) as any;
	return act(() => {
		input.value = value;
		input.dispatchEvent(new (InputEvent())('input', { bubbles: true }));
	});
}

function setSource(container: Element, value: string) {
	const input = container.querySelector('.community-guidance-source-input') as any;
	return act(() => {
		input.value = value;
		input.dispatchEvent(new (InputEvent())('input', { bubbles: true }));
	});
}

function submit(container: Element) {
	const form = container.querySelector('.community-guidance-form') as any;
	const SubmitEvent = InputEvent();
	return act(() => { form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })); });
}

test('CommunityGuidanceForm presents five tabs labeled with the human-readable running style names', async () => {
	const container = renderToContainer(h(CommunityGuidanceForm, { onAdd: () => {} }));
	await openForm(container);

	const tabLabels = Array.from(container.querySelectorAll('.community-guidance-tab')).map(tab => tab.textContent);
	assert.deepEqual(tabLabels, ['Front Runner', 'Pace Chaser', 'Late Surger', 'End Closer', 'Runaway']);
});

test('CommunityGuidanceForm aggregates only the filled tabs into byStyle and calls onAdd exactly once', async () => {
	const added: MetaCommunityGuidance[] = [];
	const container = renderToContainer(h(CommunityGuidanceForm, { onAdd: (entry: MetaCommunityGuidance) => added.push(entry) }));
	await openForm(container);

	await setSource(container, 'moomoocow');

	// Style 1 (default active tab): fill idealStats only.
	await setStat(container, 'speed', '1200');

	// Style 3: fill skillTiers only.
	await selectTab(container, 3);
	await setTier(container, 'core', 'Straightaway Recovery, Speed Star');

	// Styles 2, 4, 5 stay empty.
	await submit(container);

	assert.equal(added.length, 1);
	assert.equal(added[0].source, 'moomoocow');
	assert.deepEqual(Object.keys(added[0].byStyle).map(Number).sort(), [1, 3]);
	assert.deepEqual(added[0].byStyle[1], { idealStats: { speed: 1200 } });
	assert.deepEqual(added[0].byStyle[3], { skillTiers: { core: ['Straightaway Recovery', 'Speed Star'] } });
});

test('CommunityGuidanceForm preserves a tab\'s entered values when switching away and back', async () => {
	const container = renderToContainer(h(CommunityGuidanceForm, { onAdd: () => {} }));
	await openForm(container);

	await setStat(container, 'stamina', '900');
	await selectTab(container, 5);
	await selectTab(container, 1);

	const staminaInput = container.querySelector('.community-guidance-stat-input[data-stat="stamina"]') as any;
	assert.equal(staminaInput.value, '900');
});

test('CommunityGuidanceForm rejects a source-only submission where every tab is empty', async () => {
	const added: MetaCommunityGuidance[] = [];
	const container = renderToContainer(h(CommunityGuidanceForm, { onAdd: (entry: MetaCommunityGuidance) => added.push(entry) }));
	await openForm(container);

	await setSource(container, 'moomoocow');
	await submit(container);

	assert.equal(added.length, 0);
});
