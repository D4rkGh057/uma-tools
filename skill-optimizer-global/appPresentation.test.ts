import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act } from 'preact/test-utils';
import { renderToContainer } from './testUtils/domRender';

const source = (file: string) => readFileSync(resolve(process.cwd(), 'skill-optimizer-global', file), 'utf8');

// `App()`'s hooks (see below) can now be exercised for real via `renderToContainer` (R9.2). `App` itself
// is not exported -- app.tsx only self-mounts via a top-level `render(<App />, document.getElementById('app'))`
// once a real `#app` element exists -- so this test creates that element and installs the shared DOM
// globals FIRST, then dynamically imports `./app` so its self-mount runs against a real, already-present
// `#app` container. No production export or other change is needed. `act()` (already shipped inside the
// `preact` dependency, not a new devDependency) synchronously flushes both the debounced re-render preact
// schedules for `setState` calls from event handlers and the deferred `useEffect` callbacks preact/hooks
// schedules via `requestAnimationFrame`/`setTimeout` (see node_modules/preact/hooks/dist/hooks.js's `A()`),
// neither of which this linkedom environment provides natively.
test('App click-path: selecting manual entry and clicking Optimize renders and retains the real evaluated result', async () => {
	renderToContainer(null);
	const document = (globalThis as any).document;
	const appRoot = document.createElement('div');
	appRoot.id = 'app';
	document.body.appendChild(appRoot);

	await act(() => import('./app'));

	const ClickEvent = (globalThis as any).window.Event;
	const [, manualButton] = Array.from(appRoot.querySelectorAll('.uma-select-path-switch button')) as any[];
	await act(() => { manualButton.dispatchEvent(new ClickEvent('click', { bubbles: true })); });

	const optimizeButton = appRoot.querySelector('.optimizer-submit') as any;
	assert.equal(optimizeButton.disabled, false);
	await act(() => { optimizeButton.dispatchEvent(new ClickEvent('click', { bubbles: true })); });

	const resultPanel = appRoot.querySelector('.result-panel') as any;
	assert.match(resultPanel.querySelector('h3').textContent, /Last optimized result/);
	assert.equal(resultPanel.querySelector('.result-summary').textContent, 'Total cost: 0 SPTotal score: 0.000');
	assert.equal(resultPanel.querySelector('.result-empty').textContent, 'No purchase improves the score within budget.');

	const retainedResult = resultPanel.textContent;
	const speedInput = appRoot.querySelector('.manual-uma-entry input') as any;
	speedInput.value = '1000';
	await act(() => { speedInput.dispatchEvent(new ClickEvent('input', { bubbles: true })); });

	assert.equal((appRoot.querySelector('.manual-uma-entry input') as any).value, '1000');
	assert.equal(resultPanel.textContent, retainedResult);
});

test('repository-root build executes the optimizer entrypoint deterministically', () => {
	const build = spawnSync(
		process.execPath,
		['skill-optimizer-global/build.mjs'],
		{ cwd: resolve(process.cwd()), encoding: 'utf8' },
	);

	assert.equal(build.status, 0, build.stderr || build.stdout);
});

test('App evaluates the current manual input once and retains the first evaluator result after an edit', async () => {
	const { h } = await import('preact');
	const { App } = await import('./app');
	const requests: any[] = [];
	const firstResult = {
		status: 'ready' as const,
		mode: 'Score' as const,
		purchase: { totalCost: 111, totalScore: 1.111, picks: [], situational: [] },
		breakdown: [],
	};
	const secondResult = {
		...firstResult,
		purchase: { totalCost: 222, totalScore: 2.222, picks: [], situational: [] },
	};
	const evaluator = (request: any) => {
		requests.push(request);
		return requests.length === 1 ? firstResult : secondResult;
	};

	const appRoot = renderToContainer(h(App, { evaluator }));
	const ClickEvent = (globalThis as any).window.Event;
	const [, manualButton] = Array.from(appRoot.querySelectorAll('.uma-select-path-switch button')) as any[];
	await act(() => { manualButton.dispatchEvent(new ClickEvent('click', { bubbles: true })); });

	const speedInput = appRoot.querySelector('.manual-uma-entry input') as any;
	speedInput.value = '1000';
	await act(() => { speedInput.dispatchEvent(new ClickEvent('input', { bubbles: true })); });
	await act(() => { (appRoot.querySelector('.optimizer-submit') as any).dispatchEvent(new ClickEvent('click', { bubbles: true })); });

	assert.equal(requests.length, 1);
	assert.equal(requests[0].build.speed, 1000);
	assert.match((appRoot.querySelector('.result-summary') as any).textContent, /Total cost: 111 SP/);

	speedInput.value = '1200';
	await act(() => { speedInput.dispatchEvent(new ClickEvent('input', { bubbles: true })); });
	assert.equal(requests.length, 1);
	assert.match((appRoot.querySelector('.result-summary') as any).textContent, /Total cost: 111 SP/);
});

test('workflow exposes five ordered steps, an explicit action, and a labeled snapshot region', () => {
	const app = source('app.tsx');
	assert.match(app, /<main[^>]*aria-labelledby="optimizer-title"/);
	assert.match(app, /<section[^>]*aria-labelledby="step-1-heading"[\s\S]*?<section[^>]*aria-labelledby="step-5-heading"/);
	assert.match(app, /<button[^>]*onClick=\{runOptimize\}[^>]*>\s*Optimize build/);
	assert.match(app, /<section[^>]*aria-labelledby="results-heading"[^>]*aria-live="polite"/);
});

test('workflow shell excludes stale-result and re-optimization guidance', () => {
	const app = source('app.tsx');
	assert.doesNotMatch(app, /Input edits apply when you optimize again\./);
	assert.doesNotMatch(app, /Results show the last optimized snapshot\./);
});

test('presentation is locally responsive and accessible without global tokens', () => {
	const css = source('app.css');
	const html = source('index.html');
	assert.match(css, /#skillOptimizer\s*\{[\s\S]*--optimizer-focus/);
	assert.match(css, /:focus-visible[\s\S]*outline/);
	assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
	assert.match(css, /@media \(max-width: 768px\)/);
	assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});
