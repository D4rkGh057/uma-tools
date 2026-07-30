// Pure, framework-free projected-HP model for Recovery (type 9) scoring (spec domain:
// skill-condition-scoring, "Recovery Effect Magnitude via Projected HP Deficit"). Mirrors a handful of
// constants and formulas from uma-skill-tools' race engine (HpPolicy.ts / RaceSolver.ts) rather than
// importing them directly, because RaceSolver.ts's own module import chain pulls in the full solver
// (see design decision #5) -- these are duplicated with explicit line-cited sources below, not
// reinvented, and MUST be kept in sync if the engine constants ever change.
//
// This module (like the rest of optimizer/) MUST NOT import preact, DOM, or any UI code.
import { calculateRequiredHp } from '../../uma-skill-tools/SpurtCalculator';

/** HpPolicy.ts:26 (`HpStrategyCoefficient`) -- strategy-indexed HP coefficient, 1=Nige..5=Oonige. */
const HP_STRATEGY_COEF = Object.freeze([0, 0.95, 0.89, 1.0, 0.995, 0.86]);

/** RaceSolver.ts:22-29 (`Speed.StrategyPhaseCoefficient`) -- [strategy][phase] speed coefficient. */
const SPEED_PHASE_COEF = Object.freeze([
	[],
	[1.0, 0.98, 0.962],
	[0.978, 0.991, 0.975],
	[0.938, 0.998, 0.994],
	[0.931, 1.0, 1.0],
	[1.063, 0.962, 0.95],
].map(a => Object.freeze(a)));

/** RaceSolver.ts:30 (`Speed.DistanceProficiencyModifier`) -- indexed 0=S..7=G. */
const DIST_PROFICIENCY = Object.freeze([1.05, 1.0, 0.9, 0.8, 0.6, 0.4, 0.2, 0.1]);

/** HpPolicy.ts:46 -- base target speed baseline, purely a function of course distance. */
export function baseSpeed(distance: number): number {
	return 20.0 - (distance - 2000) / 1000.0;
}

/** HpPolicy.ts:56 -- max HP pool for the race, before any Recovery heal is applied. */
export function maxHp(stamina: number, strategy: 1 | 2 | 3 | 4 | 5, distance: number): number {
	return 0.8 * HP_STRATEGY_COEF[strategy] * stamina + distance;
}

/** HpPolicy.ts:58 -- guts-derived HP consumption modifier applied during the spurt (last-third) phase. */
function gutsModifier(guts: number): number {
	return 1.0 + 200.0 / Math.sqrt(600.0 * guts);
}

/**
 * RaceSolver.ts:44-49 (`lastSpurtSpeed`) -- the constant target speed used for the final-third segment.
 * `distanceAptitude` is 0=S..7=G, indexing `DIST_PROFICIENCY` the same way `Aptitude` enum values do
 * (uma-skill-tools/HorseTypes.ts).
 */
function spurtSpeed(
	speed: number,
	guts: number,
	strategy: 1 | 2 | 3 | 4 | 5,
	distanceAptitude: number,
	distance: number
): number {
	const bs = baseSpeed(distance);
	const sp = Math.sqrt(500.0 * speed) * DIST_PROFICIENCY[distanceAptitude] * 0.002;
	const C = SPEED_PHASE_COEF[strategy];
	let v = (bs * C[2] + sp + 0.01 * bs) * 1.05 + sp;
	v += Math.pow(450.0 * guts, 0.597) * 0.0001;
	return v;
}

/**
 * Projected HP required to complete the race at documented-approximation constant per-segment target
 * speeds (design: "3-segment closed-form"). Segments: opening 1/6, middle 1/2, final-third spurt --
 * `d/6 + d/2 + d/3 = d`, mirroring SpurtCalculator.ts:255-261's final-third split. `groundCoef` is
 * fixed at 1.0 (Good ground, no RaceContext ground condition carried here -- design decision, see
 * Open Questions). No accel ramp, position-keep, Rushed, downhill, or skill-granted-speed modifiers --
 * same standing as the existing RUSHED_REDUCTION_MULTIPLIER approximation in score.ts.
 */
export function requiredHp(
	speed: number,
	guts: number,
	strategy: 1 | 2 | 3 | 4 | 5,
	distanceAptitude: number,
	distance: number
): number {
	const bs = baseSpeed(distance);
	const gMod = gutsModifier(guts);
	const C = SPEED_PHASE_COEF[strategy];
	const openingHp = calculateRequiredHp(bs * C[0], distance / 6, bs, 1.0, gMod, false);
	const middleHp = calculateRequiredHp(bs * C[1], distance / 2, bs, 1.0, gMod, false);
	const spurt = spurtSpeed(speed, guts, strategy, distanceAptitude, distance);
	const spurtHp = calculateRequiredHp(spurt, distance / 3, bs, 1.0, gMod, true);
	return openingHp + middleHp + spurtHp;
}

/** Pre-purchase projected HP deficit: how much HP short the uma is projected to be, before any
 *  Recovery heal is applied. Never negative -- a build with HP to spare simply deficits 0. */
export function projectedDeficit(
	stamina: number,
	speed: number,
	guts: number,
	strategy: 1 | 2 | 3 | 4 | 5,
	distanceAptitude: number,
	distance: number
): number {
	const max = maxHp(stamina, strategy, distance);
	const required = requiredHp(speed, guts, strategy, distanceAptitude, distance);
	return Math.max(0, required - max);
}
