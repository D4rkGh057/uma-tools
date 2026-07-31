import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyResultsState, mergeResults, updateResultsState } from './resultsState';

test('results state resets every result field when the course changes', () => {
	const state = updateResultsState({
		...createEmptyResultsState(100),
		results: [1],
		runData: {meanrun: 'mean'},
		chartData: 'mean',
		displaying: 'meanrun',
		spurtInfo: {},
		staminaStats: {},
		firstUmaStats: {}
	}, 200);
	assert.deepEqual(state, createEmptyResultsState(200));
});

test('results state selects a chart run without changing the result payload', () => {
	const state = {
		...createEmptyResultsState(100),
		results: [1],
		runData: {meanrun: 'mean', maxrun: 'max'},
		spurtInfo: {spurt: true},
		staminaStats: {stamina: true},
		firstUmaStats: {first: true}
	};
	assert.deepEqual(updateResultsState(state, 'maxrun'), {
		...state,
		chartData: 'max',
		displaying: 'maxrun'
	});
});

test('results state defaults incoming results to the mean run', () => {
	const runData = {meanrun: 'mean', medianrun: 'median'};
	assert.deepEqual(updateResultsState(createEmptyResultsState(100), {
		results: [1, 2],
		runData,
		spurtInfo: {},
		staminaStats: {},
		firstUmaStats: {}
	}), {
		courseId: 100,
		results: [1, 2],
		runData,
		chartData: 'mean',
		displaying: 'meanrun',
		spurtInfo: {},
		staminaStats: {},
		firstUmaStats: {}
	});
});

test('mergeResults combines samples and all-runs skill data', () => {
	const first = {
		id: 'skill', results: [-2, 2], min: -2, max: 2, mean: 0, median: 0,
		runData: {meanrun: 'first', minrun: 'first-min', maxrun: 'first-max', allruns: {totalRuns: 2, sk: [{a: [[1]]}, {}]}}
	};
	const second = {
		id: 'skill', results: [-1, 3, 5], min: -1, max: 5, mean: 7 / 3, median: 3,
		runData: {meanrun: 'second', minrun: 'second-min', maxrun: 'second-max', allruns: {totalRuns: 3, sk: [{a: [[2]], b: [[3]]}, {}]}}
	};
	assert.deepEqual(mergeResults(first, second), {
		id: 'skill', results: [-2, -1, 2, 3, 5], min: -2, max: 5, mean: 1.4, median: 2,
		runData: {
			meanrun: 'second', minrun: 'first-min', maxrun: 'second-max',
			allruns: {totalRuns: 5, sk: [{a: [[1], [2]], b: [[3]]}, {}]}
		}
	});
});
