// Unit tests for the roster/manual -> UmaInput converters (spec domain: manual-uma-entry). Run via
// `node test.mjs` (see test.mjs / esbuild-plugins.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';

import { clampStat, fromDecodedUma, fromManualForm, ownedTiersFromSkills, ManualForm } from './umaInput';
import { DecodedUma } from '../../umalator/rosterDecoder';

function baseDecodedUma(overrides: Partial<DecodedUma> = {}): DecodedUma {
	return {
		card_id: 100201,
		speed: 1000,
		stamina: 900,
		power: 800,
		guts: 700,
		wisdom: 600,
		apt_short: 5,
		apt_mile: 6,
		apt_middle: 7, // highest -> aptToLetter(7) = 'A'
		apt_long: 4,
		apt_turf: 8,
		apt_dirt: 2,
		apt_nige: 3,
		apt_senko: 5,
		apt_sashi: 9, // highest aptitude-derived strategy -> Sasi (3), used when running_style is absent
		apt_oikomi: 4,
		skills: [],
		...overrides,
	};
}

test('umaInput: roster and manual converge to an identical UmaBuild for equivalent inputs', () => {
	const decoded = baseDecodedUma({ running_style: 3 /* Sasi, explicit */ });
	const rosterInput = fromDecodedUma(decoded, 'Test Uma');

	const manualForm: ManualForm = {
		speed: 1000,
		stamina: 900,
		power: 800,
		guts: 700,
		wisdom: 600,
		strategy: 'Sasi',
		distanceAptitude: 'A', // matches apt_middle=7 -> aptToLetter(7)='A'
		ownedSkills: [],
		label: 'Test Uma',
	};
	const manualInput = fromManualForm(manualForm);

	assert.deepEqual(rosterInput.build, manualInput.build);
	assert.equal(rosterInput.source, 'roster');
	assert.equal(manualInput.source, 'manual');
});

test('umaInput: fromDecodedUma prefers explicit running_style over the highest-aptitude guess', () => {
	// apt_sashi is highest (9) but running_style explicitly says Oikomi (4).
	const decoded = baseDecodedUma({ running_style: 4 });
	const input = fromDecodedUma(decoded);
	assert.equal(input.build.strategy, 4);
});

test('umaInput: fromDecodedUma falls back to the highest-aptitude guess when running_style is absent', () => {
	const decoded = baseDecodedUma({ running_style: undefined });
	const input = fromDecodedUma(decoded);
	assert.equal(input.build.strategy, 3); // apt_sashi=9 is highest among apt_nige/senko/sashi/oikomi
});

test('umaInput: Oonige is only reachable via an explicit running_style (no aptitude of its own)', () => {
	const decoded = baseDecodedUma({ running_style: 5 });
	const input = fromDecodedUma(decoded);
	assert.equal(input.build.strategy, 5);
});

test('umaInput: fromManualForm maps every strategy name to its numeric enum value', () => {
	const names: Array<[ManualForm['strategy'], number]> = [
		['Nige', 1], ['Senkou', 2], ['Sasi', 3], ['Oikomi', 4], ['Oonige', 5],
	];
	for (const [name, expected] of names) {
		const input = fromManualForm({ strategy: name, distanceAptitude: 'S', ownedSkills: [] });
		assert.equal(input.build.strategy, expected);
	}
});

test('clampStat: clamps in-range and out-of-range numbers to [1, 2000]', () => {
	assert.equal(clampStat(500), 500);
	assert.equal(clampStat(1), 1);
	assert.equal(clampStat(2000), 2000);
	assert.equal(clampStat(0), 1);
	assert.equal(clampStat(-50), 1);
	assert.equal(clampStat(5000), 2000);
});

test('clampStat: treats NaN/empty/non-numeric input as unset (undefined), never 0', () => {
	assert.equal(clampStat(''), undefined);
	assert.equal(clampStat('abc'), undefined);
	assert.equal(clampStat(undefined), undefined);
	assert.equal(clampStat(null), undefined);
	assert.equal(clampStat(NaN), undefined);
});

test('clampStat: accepts numeric strings the same way <input type=number> gives them', () => {
	assert.equal(clampStat('750'), 750);
	assert.equal(clampStat('-10'), 1);
	assert.equal(clampStat('9999'), 2000);
});

test('umaInput: ownedTiersFromSkills matches optimize.ts-shape owned-tier derivation for an empty roster', () => {
	const tiers = ownedTiersFromSkills([]);
	assert.equal(tiers.size, 0);
});
