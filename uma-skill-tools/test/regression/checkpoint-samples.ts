import { Rule30CARng } from '../../Random';

export const CheckpointSampleCounts = [16, 256, 2000, 10000] as const;
export const DefaultCheckpointSampleCount = 256;

const SampleCountDescription = '16 (preflight), 256 (development), 2000 (CI/rebaseline), or 10000 (full)';

export function parseCheckpointSampleCount(value: string): number {
	const count = Number(value);
	if (!Number.isSafeInteger(count) || CheckpointSampleCounts.indexOf(count as typeof CheckpointSampleCounts[number]) < 0) {
		throw new Error('sample count must be one of ' + SampleCountDescription);
	}
	return count;
}

export function selectCheckpointSamples<T>(cases: T[], count: number, seed: number): T[] {
	if (cases.length < count) {
		throw new Error('checkpoint contains ' + cases.length + ' cases, but ' + count + ' samples were requested');
	}

	const selected = cases.slice();
	const rng = new Rule30CARng(seed);
	for (let i = selected.length; --i >= 0;) {
		const j = rng.uniform(i + 1);
		[selected[i], selected[j]] = [selected[j], selected[i]];
	}
	return selected.slice(0, count);
}
