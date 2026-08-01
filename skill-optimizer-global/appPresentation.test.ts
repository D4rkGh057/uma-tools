import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file: string) => readFileSync(resolve(process.cwd(), 'skill-optimizer-global', file), 'utf8');

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
