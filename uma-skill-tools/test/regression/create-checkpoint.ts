import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import { program, Option } from 'commander';

import * as arb from '../arb/Race';
import { RaceSolver } from '../../RaceSolver';
import { Rule30CARng } from '../../Random';
import { CheckpointSchemaVersion } from './checkpoint-schema';
import { CheckpointSampleCounts, parseCheckpointSampleCount } from './checkpoint-samples';

program
	.addOption(new Option('-t, --tests <number>', 'checkpoint cases to generate: 16 preflight, 256 development, 2000 CI/rebaseline, or 10000 full')
		.default(CheckpointSampleCounts[2])
		.argParser(parseCheckpointSampleCount))
	.addOption(new Option('--timestep <dt>', 'integration timestep in seconds')
		.default(1/15, '1/15')
		.argParser(ts => ts.split('/').reduceRight((a,b) => +b / +a, 1.0)))
	.addOption(new Option('--seed <number>', 'seed for random generator')
		.default((Date.now() ^ (Math.random() * 0x100000000)) >>> 0)  // this seems to be what fast-check uses by default
		.argParser(x => parseInt(x,10)));

program.parse();
const options = program.opts();

fc.configureGlobal({seed: options.seed});

const results = [];
fc.sample(arb.Race().filter(params => {
	try {
		arb.makeBuilder(params);
		return true;
	} catch (_) {
		return false;
	}
}), options.tests).forEach(params => {
	const standard = arb.makeBuilder(params);
	const compare = standard.fork();
	params.skillsUnderTest.forEach(id => compare.addSkill(id));
	const pacerHorse = params.pacemakerCount > 0 ? standard.useDefaultPacer() : null;
	const g1 = compare.build();
	const g2 = standard.build();
	const basePacerRng = new Rule30CARng(params.seed + 1);
	const result = {err: false, gain: []};
	for (let i = 0; i < params.nsamples; ++i) {
		try {
			const compareSolver = g1.next().value as RaceSolver;
			const standardSolver = g2.next().value as RaceSolver;
			const pacers = Array.from({length: params.pacemakerCount}, () =>
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
					if (p && p.pos < standard._course.distance) p.step(options.timestep);
				});

				if (compareSolver.pos < standard._course.distance) compareSolver.step(options.timestep);
				else compareFinished = true;
				if (standardSolver.pos < standard._course.distance) standardSolver.step(options.timestep);
				else standardFinished = true;
			}

			pacers.forEach(p => {
				if (p && p.pos < standard._course.distance) p.step(options.timestep);
			});
			compareSolver.cleanup();
			standardSolver.cleanup();
			result.gain.push(compareSolver.pos - standardSolver.pos);
		} catch (_) {
			result.err = true;
			break;
		}
	}
	results.push({version: CheckpointSchemaVersion, params, result, timestep: options.timestep});
});

let root = path.resolve(path.dirname(process.argv[1]), '..', '..', '..');
const head = fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf-8').trim();
const rev = head.startsWith('ref: ') ? fs.readFileSync(path.join(root, '.git', head.slice(5)), 'utf-8').trim() : head;
const date = new Date().toISOString().slice(0,10).replace(/-/g,'');  // why does this godforsaken programming language not have normal date formatting
const outfile = path.join(path.dirname(process.argv[1]), 'checkpoints', date + '.' + rev.slice(0,7) + '.' + options.seed + '.json');

fs.writeFileSync(outfile, JSON.stringify(results));

console.log('wrote ' + outfile);
