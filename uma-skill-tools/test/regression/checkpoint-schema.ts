import { RaceParams } from '../arb/Race';

export const CheckpointSchemaVersion = 1;

interface CheckpointResult {
	err: boolean
	gain: number[]
}

export interface VersionedCheckpointCase {
	version: typeof CheckpointSchemaVersion
	params: RaceParams
	result: CheckpointResult
	timestep: number
}

interface LegacyRaceParams extends Omit<RaceParams, 'horse' | 'pacemakerCount'> {
	horse: Omit<RaceParams['horse'], 'skills'>
	paceEffectsEnabled: boolean
}

interface LegacyCheckpointCase {
	params: LegacyRaceParams
	result: CheckpointResult
	timestep: number
}

export type CheckpointCase = VersionedCheckpointCase | LegacyCheckpointCase;

export interface NormalizedCheckpointCase {
	case: VersionedCheckpointCase
	lifecycle: 'sequential' | 'pacer-aware'
	legacyPaceEffectsEnabled: boolean
}

export function normalizeCheckpoint(testCase: CheckpointCase): NormalizedCheckpointCase {
	if ('version' in testCase) {
		if (testCase.version !== CheckpointSchemaVersion) {
			throw new Error('unsupported checkpoint schema version ' + testCase.version);
		}
		return {case: testCase, lifecycle: 'pacer-aware', legacyPaceEffectsEnabled: false};
	}

	const {paceEffectsEnabled, ...params} = testCase.params;
	return {
		case: {
			version: CheckpointSchemaVersion,
			params: {...params, horse: {...params.horse, skills: []}, pacemakerCount: 0},
			result: testCase.result,
			timestep: testCase.timestep
		},
		lifecycle: 'sequential',
		legacyPaceEffectsEnabled: paceEffectsEnabled
	};
}

export function validateCheckpoint(testCase: NormalizedCheckpointCase, caseIndex: number) {
	const {err, gain} = testCase.case.result;
	const expectedSamples = testCase.case.params.nsamples;
	const prefix = 'checkpoint case ' + caseIndex + ': ';
	if (!Number.isSafeInteger(expectedSamples) || expectedSamples < 0) {
		throw new Error(prefix + 'invalid sample count ' + expectedSamples);
	}
	if (typeof err !== 'boolean') {
		throw new Error(prefix + 'invalid error result');
	}
	if (!Array.isArray(gain) || gain.some(value => !Number.isFinite(value))) {
		throw new Error(prefix + 'gains must be finite numbers');
	}
	if (gain.length > expectedSamples || (!err && gain.length !== expectedSamples)) {
		throw new Error(prefix + 'recorded ' + gain.length + ' gains for ' + expectedSamples + ' samples');
	}
}
