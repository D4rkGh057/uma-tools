// Unit-test harness for the pure optimizer/ + components/umaInput pipeline (spec domains:
// skill-condition-scoring, manual-uma-entry). There is no test runner wired into this repo today, so
// this bundles each *.test.ts entry point (and any transitive optimizer/uma-skill-tools imports it
// pulls in) with esbuild -- reusing build.mjs's own `redirectData`/`mockAssert` plugins (see
// esbuild-plugins.mjs) so the test bundles see the same GLOBAL dataset redirect as the real app --
// then runs all the bundles through Node's built-in test runner (`node --test`) in one process.
// Run via `node test.mjs`.
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

import { makeRedirectData, makeMockAssert } from './esbuild-plugins.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const datadir = path.join(dirname, '..', 'umalator-global');
const outdir = path.join(dirname, '.test-bundle');

// Every *.test.ts suite in the pure optimizer/components pipeline. Add new suites here.
const entryPoints = [
	path.join(dirname, 'optimizer', 'score.test.ts'),
	path.join(dirname, 'optimizer', 'hp.test.ts'),
	path.join(dirname, 'components', 'umaInput.test.ts'),
];

await esbuild.build({
	entryPoints,
	bundle: true,
	platform: 'node',
	format: 'esm',
	outdir,
	define: {CC_DEBUG: 'true', CC_GLOBAL: 'true'},
	// node:test and node:assert/strict are Node's own built-ins used directly by the *.test.ts files --
	// they must stay real runtime imports, not be bundled. The bare 'node:assert' specifier (used
	// internally by ConditionMatcher.ts, a transitive import of ./conditions, not by the test files
	// themselves) is intercepted by mockAssert instead (debug=true keeps it visible via console.assert
	// -- see esbuild-plugins.mjs), matching the real app bundle's behavior for that library code.
	external: ['node:test', 'node:assert/strict'],
	plugins: [makeRedirectData(datadir), makeMockAssert(true)],
});

const outfiles = entryPoints.map(entry =>
	path.join(outdir, path.relative(dirname, entry).replace(/\.tsx?$/, '.js'))
);

const child = spawn(process.execPath, ['--test', ...outfiles], {stdio: 'inherit'});
child.on('exit', code => process.exit(code == null ? 1 : code));
child.on('error', err => {
	console.error(err);
	process.exit(1);
});
