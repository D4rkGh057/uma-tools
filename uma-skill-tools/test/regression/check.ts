import * as fs from 'fs';
import * as path from 'path';
import test from 'tape';
import { program, Option } from 'commander';

import { makeBuilder } from '../arb/Race';
import { RaceSolver } from '../../RaceSolver';
import { Rule30CARng } from '../../Random';
import { CheckpointCase, normalizeCheckpoint, NormalizedCheckpointCase, validateCheckpoint } from './checkpoint-schema';
import { DefaultCheckpointSampleCount, parseCheckpointSampleCount, selectCheckpointSamples } from './checkpoint-samples';

// This is more or less arbitrary but results in basically the level of precision we care about for the sim results.
const Epsilon = 5e11 * Number.EPSILON;
function almostEqual(a: number, b: number) {
	if (a == b) return true;
	return Math.abs(a - b) < Math.max(Epsilon * (Math.abs(a) + Math.abs(b)), Number.EPSILON);
}

(test as any).Test.prototype.almostEqual = function (a: number, b: number, msg: string, extra: any) {
	this._assert(almostEqual(a, b), {
		message: msg || 'should be closer than ' + Math.max(Epsilon * (Math.abs(a) + Math.abs(b)), Number.EPSILON) + ' (actual difference: ' + Math.abs(a - b) + ')',
		operator: 'almostEqual',
		actual: a,
		expected: b,
		extra: extra
	});
}

function getLatestCheckpoint() {
	const dir = path.join(path.dirname(process.argv[1]), 'checkpoints');
	// sort by the date contained in the filename; we can't sort by ctime/mtime since git does not preserve those when cloning
	// this does mean this isn't guaranteed to find the latest file if multiple checkpoints were created on the same day, but we can
	// simply avoid doing that for the most part.
	// we could of course simply include the exact timestamp in the filename, but i dont like how that looks.
	return fs.readdirSync(dir)
		.map(f => [path.join(dir, f), Date.parse(f.split('.',1)[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))] as [string,number])
		.sort((a,b) => b[1] - a[1])[0][0];
}

program
	.argument('[cases]', 'JSON file of test cases')
	.addOption(new Option('-n, --samples <number>', 'checkpoint cases to replay: 16 preflight, 256 development, 2000 CI/rebaseline, or 10000 full')
		.default(DefaultCheckpointSampleCount)
		.argParser(parseCheckpointSampleCount))
	.addOption(new Option('--seed <number>', 'seed to use for deterministic sample selection')
		.default(0)
		.argParser(n => parseInt(n,10) >>> 0))
	.option('-l, --failure-log <file>', 'file to log failing cases to', 'failures.json');

program.parse();
const options = program.opts();

const casefile = program.args.length > 0 ? program.args[0] : getLatestCheckpoint();
const checkpointCases: NormalizedCheckpointCase[] = JSON.parse(fs.readFileSync(casefile, 'utf-8'))
	.map((testCase: CheckpointCase) => normalizeCheckpoint(testCase));
checkpointCases.forEach(validateCheckpoint);
const cases = selectCheckpointSamples(checkpointCases, options.samples, options.seed);

console.log('checkpoint samples: ' + cases.length + ' (seed: ' + options.seed + ')');

test('should give results similar to the checkpoint', t => {
	t.plan(cases.length + cases.reduce((a,b) => a + b.case.result.gain.length, 0));

	const failures = [];
	cases.forEach(normalized => {
		const testCase = normalized.case;
		const standard = makeBuilder(testCase.params);
		const compare = standard.fork();
		testCase.params.skillsUnderTest.forEach(id => compare.addSkill(id));
		if (normalized.legacyPaceEffectsEnabled) standard.useDefaultPacer();
		const pacemakerCount = testCase.params.pacemakerCount;
		const pacerHorse = pacemakerCount > 0 ? standard.useDefaultPacer() : null;
		const g1 = compare.build();
		const g2 = standard.build();
		const basePacerRng = new Rule30CARng(testCase.params.seed + 1);
		let err = false;
		for (let i = 0; i < testCase.result.gain.length; ++i) {
			try {
				const compareSolver = g1.next().value as RaceSolver;
				const standardSolver = g2.next().value as RaceSolver;
				let gain: number;
				if (normalized.lifecycle == 'pacer-aware') {
					const pacers = Array.from({length: pacemakerCount}, () =>
						pacerHorse != null ? standard.buildPacer(pacerHorse, i, new Rule30CARng(basePacerRng.int32())) : null
					);
					const pacer = pacers[0] || null;

					standardSolver.initUmas([compareSolver, ...pacers]);
					compareSolver.initUmas([standardSolver, ...pacers]);
					pacers.forEach(p => p?.initUmas([standardSolver, compareSolver, ...pacers.filter(p2 => p2 !== p)]));

					let standardFinished = false;
					let compareFinished = false;
					while (!standardFinished || !compareFinished) {
						if (pacer) {
							const currentPacer = pacer.getPacer();
							pacer.umas.forEach(uma => uma.updatePacer(currentPacer));
						}

						pacers.forEach(p => {
							if (p && p.pos < standard._course.distance) p.step(testCase.timestep);
						});

						if (compareSolver.pos < standard._course.distance) compareSolver.step(testCase.timestep);
						else compareFinished = true;
						if (standardSolver.pos < standard._course.distance) standardSolver.step(testCase.timestep);
						else standardFinished = true;
					}

					pacers.forEach(p => {
						if (p && p.pos < standard._course.distance) p.step(testCase.timestep);
					});
					compareSolver.cleanup();
					standardSolver.cleanup();
					gain = compareSolver.pos - standardSolver.pos;
				} else {
					while (compareSolver.pos < standard._course.distance) {
						compareSolver.step(testCase.timestep);
					}

					while (standardSolver.accumulatetime.t < compareSolver.accumulatetime.t) {
						standardSolver.step(testCase.timestep);
					}
					gain = compareSolver.pos - standardSolver.pos;
				}
				if (almostEqual(gain, testCase.result.gain[i])) {
					t.ok(true);
				} else {
					(t as any).almostEqual(gain, testCase.result.gain[i]);
					failures.push({params: testCase.params, caseIdx: (t as any).assertCount - 1, sampleIdx: i, expected: testCase.result.gain[i], actual: gain});
				}
			} catch (_) {
				err = true;
				for (; i < testCase.result.gain.length; ++i) {
					t.fail('expected sample was not produced');
				}
				break;
			}
		}
		t.assert(err == testCase.result.err);
	});

	if (failures.length > 0) {
		fs.writeFileSync(options.failureLog, JSON.stringify(failures));
		t.comment('wrote ' + failures.length + ' failure' + (failures.length == 1 ? '' : 's') + ' to ' + options.failureLog);
	}

	if (options.fast) {
		t.comment('seed ' + options.seed);
	}
});
