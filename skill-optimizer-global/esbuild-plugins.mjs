// Shared esbuild plugins used by both build.mjs (app bundle) and test.mjs (test harness), so the
// GLOBAL-dataset redirect and the node:assert mock behave identically in both contexts.
import * as path from 'node:path';

/**
 * Redirects `data/`-relative imports (at every depth reachable from either entry point) to the
 * GLOBAL dataset directory instead of the JP dataset under uma-skill-tools/data.
 * NOTE: this must match `data/` imports at every depth reachable from a bundle:
 *   - `app.tsx`'s own imports:                 `../uma-skill-tools/data/...`      (1 level)
 *   - `optimizer/*.ts`'s imports (one dir deeper): `../../uma-skill-tools/data/...` (2 levels)
 *   - `uma-skill-tools/CourseData.ts` and `RaceSolverBuilder.ts`'s *own* same-directory
 *     imports (reachable transitively via ActivationConditions.ts -> CourseData.ts):
 *     `./data/...` (0 levels, bare `./`, no `uma-skill-tools/` segment)
 * `(?:\.\.?\/)+` matches one-or-more leading `./` or `../` segments (in any mix), so
 * all three depths redirect to the GLOBAL dataset. There is only one `data/` directory
 * in the whole repo (`uma-skill-tools/data`), so this cannot over-match an unrelated dir.
 */
export function makeRedirectData(datadir) {
	return {
		name: 'redirectData',
		setup(build) {
			build.onResolve({filter: /^(?:\.\.?\/)+(?:uma-skill-tools\/)?data\//}, args => ({
				path: path.join(datadir, args.path.split('/data/')[1])
			}));
			build.onResolve({filter: /skill_meta.json$/}, args => ({
				path: path.join(datadir, 'skill_meta.json')
			}));
			build.onResolve({filter: /umas.json$/}, args => ({
				path: path.join(datadir, 'umas.json')
			}));
		}
	};
}

/** Mocks `node:assert` so `assert()` calls in bundled source (stripped in production via
 *  unassert-cli, still present here) don't hard-crash the bundle/tests. `debug: true` keeps
 *  assertions visible via console.assert instead of silently no-op'ing them. */
export function makeMockAssert(debug) {
	const mockAssertFn = debug ? 'console.assert' : 'function(){}';
	return {
		name: 'mockAssert',
		setup(build) {
			build.onResolve({filter: /^node:assert$/}, args => ({
				path: args.path, namespace: 'mockAssert-ns'
			}));
			build.onLoad({filter: /.*/, namespace: 'mockAssert-ns'}, () => ({
				contents: 'module.exports={strict:'+mockAssertFn+'};',
				loader: 'js'
			}));
		}
	};
}
