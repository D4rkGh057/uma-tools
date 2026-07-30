// Derives {matchProbes, conflictFacts, distanceBucket} from an optional RaceContext.
import courseData from '../../uma-skill-tools/data/course_data.json';
import { C } from './conditions';
import { DistanceBucket, RaceContext, RaceFact, RaceProbes } from './types';

interface CourseEntry {
	distanceType: 1 | 2 | 3 | 4;
	surface: 1 | 2;
}

const courses = courseData as unknown as Record<string, CourseEntry>;

/** 1=Short, 2=Mile, 3=Mid, 4=Long -- matches uma-skill-tools/CourseData.ts's DistanceType enum and
 *  the distance filter buckets already used in components/SkillPicker.tsx's filterOps. */
const BUCKET_NAMES: Record<1 | 2 | 3 | 4, DistanceBucket> = { 1: 'Short', 2: 'Mile', 3: 'Mid', 4: 'Long' };

/** Fallback bucket when a race context is set but its distance can't be resolved. Deliberately the
 *  same "no stamina boost" baseline as the acceleration-favoring default (obs #66). */
const FALLBACK_BUCKET: DistanceBucket = 'Short';

/**
 * Builds race probes for target-race mode. Returns null when no race context is given at all --
 * callers use that to select generic mode (spec: "No target race set").
 */
export function buildProbes(ctx?: RaceContext): RaceProbes | null {
	if (!ctx) return null;

	let distanceType = ctx.distanceType;
	let surface = ctx.surface;
	if (distanceType == null && ctx.trackId != null) {
		const course = courses[String(ctx.trackId)];
		if (course) {
			distanceType = course.distanceType;
			if (surface == null) surface = course.surface;
		}
	}

	const matchProbes: unknown[] = [];
	const conflictFacts: RaceFact[] = [];

	if (distanceType != null) {
		matchProbes.push(C(`distance_type==${distanceType}`));
		conflictFacts.push({ condition: 'distance_type', value: distanceType });
	}
	if (surface != null) {
		matchProbes.push(C(`ground_type==${surface}`));
		conflictFacts.push({ condition: 'ground_type', value: surface });
	}
	if (ctx.style != null) {
		matchProbes.push(C(`running_style==${ctx.style}`));
		conflictFacts.push({ condition: 'running_style', value: ctx.style });
	}
	if (ctx.phase != null) {
		// Phase describes WHEN within any race a skill can fire, not a static per-race fact -- it
		// contributes to soft fit matching only, never to hard exclusion (every race has all phases).
		matchProbes.push(C(`phase==${ctx.phase}`));
	}

	return {
		matchProbes,
		conflictFacts,
		distanceBucket: distanceType != null ? BUCKET_NAMES[distanceType] : FALLBACK_BUCKET,
	};
}
