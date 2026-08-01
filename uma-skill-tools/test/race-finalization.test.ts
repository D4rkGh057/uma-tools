import test from 'tape';

import { makeBuilder, RaceParams } from './arb/Race';
import { Perspective, RaceSolver } from '../RaceSolver';

test('cleanup deactivates every active skill in effect-family order', t => {
	const builder = makeBuilder({
		seed: 0,
		courseId: '10205',
		groundCondition: 0,
		mood: 0,
		horse: {
			speed: 1000,
			stamina: 1000,
			power: 1000,
			guts: 1000,
			wisdom: 1000,
			strategy: 'Nige',
			distanceAptitude: 'A',
			surfaceAptitude: 'A',
			strategyAptitude: 'A',
			skills: []
		},
		pacemakerCount: 0,
		nsamples: 1,
		presupposedSkills: [],
		skillsUnderTest: []
	} as unknown as RaceParams);
	const solver = builder.build().next().value as RaceSolver;
	const deactivated: Array<{skillId: string, perspective: Perspective | undefined}> = [];
	solver.onSkillDeactivate = (_solver, skillId, perspective) => {
		deactivated.push({skillId, perspective});
	};
	const activeSkills = (skillId: string, perspective?: Perspective) => ({skillId, perspective});

	solver.activeTargetSpeedSkills.push(activeSkills('target-speed', Perspective.Self) as any);
	solver.activeCurrentSpeedSkills.push(activeSkills('current-speed', Perspective.Other) as any);
	solver.activeAccelSkills.push(activeSkills('accel', Perspective.Self) as any);
	solver.activeLaneMovementSkills.push(activeSkills('lane-movement', Perspective.Other) as any);
	solver.activeChangeLaneSkills.push(activeSkills('change-lane', Perspective.Self) as any);

	solver.cleanup();

	t.deepEqual(deactivated, [
		{skillId: 'target-speed', perspective: Perspective.Self},
		{skillId: 'current-speed', perspective: Perspective.Other},
		{skillId: 'accel', perspective: Perspective.Self},
		{skillId: 'lane-movement', perspective: Perspective.Other},
		{skillId: 'change-lane', perspective: Perspective.Self}
	]);
	t.end();
});
