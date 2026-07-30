// Converges roster-import and manual-entry data into one uma shape (spec domain: manual-uma-entry,
// "Single Converged Uma Shape, No Silent Merge"). Pure, framework-free -- no preact/DOM import here;
// ManualUmaEntry.tsx and UmaSelect.tsx consume this, not the other way around.
import { APTITUDES } from '../../components/HorseStatInputs';
import { DecodedUma } from '../../umalator/rosterDecoder';
import { skillGroups, skillMeta } from '../optimizer/skillGroups';
import { UmaBuild } from '../optimizer/types';

export interface UmaInput {
	source: 'roster' | 'manual';
	label: string;
	ownedSkills: Array<{ id: number; level: number }>;
	build: UmaBuild;
	/** groupId -> owned tier index, same shape UmaSelect.tsx's (now-removed) local helper produced. */
	ownedTiers: Map<string, number>;
}

/**
 * Owned-tier index per groupId for one uma, derived the same way `optimize.ts`'s private
 * `ownedIndexByGroup` does. Duplicated (not imported) because that helper isn't exported from
 * optimize.ts and optimizer/*.ts is frozen for this PR -- see design decision #7's "re-derive locally"
 * precedent (skillGroups.ts). This is UI-layer glue, not optimizer logic: `optimize()` itself derives
 * this independently from `ownedSkills`; this copy is only for display (UmaSelect.tsx's summary line).
 */
export function ownedTiersFromSkills(skills: Array<{ id: number; level: number }>): Map<string, number> {
	const owned = new Map<string, number>();
	for (const s of skills) {
		const idStr = String(s.id);
		const groupId = skillMeta[idStr]?.groupId;
		if (!groupId) continue;
		const tiers = skillGroups.get(groupId);
		const idx = tiers ? tiers.indexOf(idStr) : -1;
		if (idx < 0) continue;
		const best = owned.get(groupId) ?? -1;
		if (idx > best) owned.set(groupId, idx);
	}
	return owned;
}

/** Clamps a stat input to [1, 2000]; NaN/empty/non-finite becomes `undefined` ("unset"), never 0 or a
 *  clamped NaN (spec: "Manual Stat Input Validation" -- "clamp stat inputs to 1-2000 and MUST treat
 *  non-numeric input as unset, never crashing"). Accepts the raw string an <input type=number> gives,
 *  or an already-parsed number (roster-derived values pass through the same clamp). */
export function clampStat(raw: number | string | undefined | null): number | undefined {
	if (raw === '' || raw == null) return undefined;
	const n = typeof raw === 'number' ? raw : +raw;
	if (!Number.isFinite(n)) return undefined;
	return Math.max(1, Math.min(2000, n));
}

/** 10-entry aptitude scale (0-9, V1 format) -> letter, mirrors umalator/app.tsx's
 *  `decodedUmaToUmaState`'s `aptToLetter` exactly (duplicated, not imported -- that function is
 *  private to umalator/app.tsx, which is unimportable, see design's RESOLVED BLOCKER). */
function aptToLetter(v: number): string {
	return (['G', 'G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S'] as const)[Math.max(0, Math.min(9, v))];
}

/** Letter ('S'..'G') -> UmaBuild.distanceAptitude index (0=S..7=G). Returns undefined for an
 *  unrecognized letter rather than defaulting silently. */
function letterToAptitudeIndex(letter: string): UmaBuild['distanceAptitude'] {
	const idx = APTITUDES.indexOf(letter);
	return idx >= 0 ? (idx as UmaBuild['distanceAptitude']) : undefined;
}

const STRATEGY_NAME_TO_NUMBER: Record<string, 1 | 2 | 3 | 4 | 5> = {
	Nige: 1,
	Senkou: 2,
	Sasi: 3,
	Oikomi: 4,
	Oonige: 5,
};

/**
 * Roster-import path -> UmaInput. Mirrors umalator/app.tsx:1535-1580's `decodedUmaToUmaState` for the
 * strategy/distance-aptitude derivation (explicit `running_style` preferred over the highest-aptitude
 * guess; Oonige=5 has no aptitude of its own, so it's only reachable via an explicit `running_style`).
 * Duplicated, not imported -- `decodedUmaToUmaState` is private to umalator/app.tsx, which is
 * unimportable (design's RESOLVED BLOCKER); same precedent as `ownedTiersFromSkills` above.
 */
export function fromDecodedUma(uma: DecodedUma, label?: string): UmaInput {
	const RUNNING_STYLE_STRATEGY: Record<number, 1 | 2 | 3 | 4 | 5> = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
	const aptitudeStrategies: Array<{ key: keyof DecodedUma; strat: 1 | 2 | 3 | 4 }> = [
		{ key: 'apt_nige', strat: 1 },
		{ key: 'apt_senko', strat: 2 },
		{ key: 'apt_sashi', strat: 3 },
		{ key: 'apt_oikomi', strat: 4 },
	];
	const bestStrat: 1 | 2 | 3 | 4 | 5 =
		(uma.running_style != null && RUNNING_STYLE_STRATEGY[uma.running_style]) ||
		aptitudeStrategies.reduce(
			(best, curr) => ((uma[curr.key] as number) >= (uma[best.key] as number) ? curr : best)
		).strat;

	const bestDistApt = Math.max(uma.apt_short, uma.apt_mile, uma.apt_middle, uma.apt_long);
	const distanceAptitude = letterToAptitudeIndex(aptToLetter(bestDistApt));

	const ownedSkills = uma.skills;
	return {
		source: 'roster',
		label: label ?? String(uma.card_id),
		ownedSkills,
		build: {
			speed: uma.speed,
			stamina: uma.stamina,
			power: uma.power,
			guts: uma.guts,
			wisdom: uma.wisdom,
			strategy: bestStrat,
			distanceAptitude,
		},
		ownedTiers: ownedTiersFromSkills(ownedSkills),
	};
}

/** Plain-object local state ManualUmaEntry.tsx keeps -- no immutable `Record`, no `CC_GLOBAL`-dependent
 *  `HorseState` (design's "UI Shape"). Stat fields are already clamped/unset via `clampStat` by the
 *  time they reach here (the container's own responsibility, not this converter's). */
export interface ManualForm {
	speed?: number;
	stamina?: number;
	power?: number;
	guts?: number;
	wisdom?: number;
	strategy: 'Nige' | 'Senkou' | 'Sasi' | 'Oikomi' | 'Oonige';
	distanceAptitude: string; // one of APTITUDES ('S'..'G')
	ownedSkills: Array<{ id: number; level: number }>;
	label?: string;
}

/** Manual-entry path -> UmaInput. Letter -> index via `APTITUDES.indexOf`, strategy name -> 1..5. */
export function fromManualForm(form: ManualForm): UmaInput {
	return {
		source: 'manual',
		label: form.label ?? 'Manual entry',
		ownedSkills: form.ownedSkills,
		build: {
			speed: form.speed,
			stamina: form.stamina,
			power: form.power,
			guts: form.guts,
			wisdom: form.wisdom,
			strategy: STRATEGY_NAME_TO_NUMBER[form.strategy],
			distanceAptitude: letterToAptitudeIndex(form.distanceAptitude),
		},
		ownedTiers: ownedTiersFromSkills(form.ownedSkills),
	};
}
