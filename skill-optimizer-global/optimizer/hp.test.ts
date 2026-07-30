// Unit tests for the projected-HP model (spec domain: skill-condition-scoring, "Recovery Effect
// Magnitude via Projected HP Deficit"). Run via `node test.mjs` (see test.mjs / esbuild-plugins.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';

import { maxHp, requiredHp, projectedDeficit } from './hp';

function closeTo(actual: number, expected: number, epsilon: number): void {
	assert.ok(
		Math.abs(actual - expected) < epsilon,
		`expected ${actual} to be close to ${expected} (diff ${Math.abs(actual - expected)})`
	);
}

// Design decision #7 defaults (HorseDefTypes.ts CC_GLOBAL Record): speed 1200, guts 400,
// distanceAptitude 0 (S) -- used for every worked build below since only stamina/strategy/distance are
// varied by the design's sanity checks.
const DEFAULT_SPEED = 1200;
const DEFAULT_GUTS = 400;
const DEFAULT_DIST_APT = 0;

test('hp: 600 stamina / Sasi / 3000m -> maxHp 3480, requiredHp ~4292-4295, deficit ~812-815', () => {
	const strategy = 3; // Sasi
	const distance = 3000;
	const max = maxHp(600, strategy, distance);
	closeTo(max, 3480, 1e-9);
	const required = requiredHp(DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	closeTo(required, 4294.68, 1);
	const deficit = projectedDeficit(600, DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	closeTo(deficit, 814.68, 1);
	assert.ok(deficit > 0);
});

test('hp: 1200 stamina / Nige / 1200m -> maxHp 2112, requiredHp ~1541, deficit 0 (never negative)', () => {
	const strategy = 1; // Nige
	const distance = 1200;
	const max = maxHp(1200, strategy, distance);
	closeTo(max, 2112, 1e-9);
	const required = requiredHp(DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	closeTo(required, 1541.68, 1);
	const deficit = projectedDeficit(1200, DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	assert.equal(deficit, 0);
});

test('hp: 1200 stamina / Sasi / 2400m -> break-even, deficit ~0', () => {
	const strategy = 3; // Sasi
	const distance = 2400;
	const max = maxHp(1200, strategy, distance);
	closeTo(max, 3360, 1e-9);
	const required = requiredHp(DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	assert.ok(required < max, `expected requiredHp ${required} < maxHp ${max} (break-even)`);
	const deficit = projectedDeficit(1200, DEFAULT_SPEED, DEFAULT_GUTS, strategy, DEFAULT_DIST_APT, distance);
	assert.equal(deficit, 0);
});

test('hp: low-stamina Long build projects a strictly larger deficit than a high-stamina Short build', () => {
	const lowStamLong = projectedDeficit(600, DEFAULT_SPEED, DEFAULT_GUTS, 3, DEFAULT_DIST_APT, 3000);
	const highStamShort = projectedDeficit(1200, DEFAULT_SPEED, DEFAULT_GUTS, 1, DEFAULT_DIST_APT, 1200);
	assert.ok(lowStamLong > highStamShort);
});
