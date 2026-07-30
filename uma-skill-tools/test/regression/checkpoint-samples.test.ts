import test from 'tape';

import { validateCheckpoint } from './checkpoint-schema';
import { DefaultCheckpointSampleCount, parseCheckpointSampleCount, selectCheckpointSamples } from './checkpoint-samples';

test('checkpoint sample tiers are explicit and deterministic', t => {
	t.equal(DefaultCheckpointSampleCount, 256);
	t.equal(parseCheckpointSampleCount('16'), 16);
	t.equal(parseCheckpointSampleCount('256'), 256);
	t.equal(parseCheckpointSampleCount('2000'), 2000);
	t.equal(parseCheckpointSampleCount('10000'), 10000);
	t.throws(() => parseCheckpointSampleCount('100'));
	t.throws(() => parseCheckpointSampleCount('16.5'));

	const cases = Array.from({length: 16}, (_, index) => index);
	t.deepEqual(selectCheckpointSamples(cases, 16, 0), selectCheckpointSamples(cases, 16, 0));
	t.throws(() => selectCheckpointSamples(cases, 256, 0));
	t.end();
});

test('checkpoint gain lengths are validated before replay', t => {
	const checkpoint = {
		case: {params: {nsamples: 2}, result: {err: false, gain: [1, 2]}, timestep: 1/15},
		lifecycle: 'pacer-aware',
		legacyPaceEffectsEnabled: false
	} as any;
	t.doesNotThrow(() => validateCheckpoint(checkpoint, 0));
	checkpoint.case.result.gain.pop();
	t.throws(() => validateCheckpoint(checkpoint, 0), /recorded 1 gains for 2 samples/);
	t.end();
});
