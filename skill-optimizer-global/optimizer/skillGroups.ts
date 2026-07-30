// Local re-derivation of UmasTab.tsx's `skillGroups` (umalator/components/UmasTab.tsx:70-85).
// Re-derived here (rather than imported) so this module stays preact/DOM-free -- design decision #7.
//
// NB: paths below mirror the existing skill-visualizer-global / umalator-global convention
// (`../uma-skill-tools/data/...`, `../skill_meta.json`); esbuild's `redirectData` plugin (added in
// PR2's build.mjs, copied from skill-visualizer-global/build.mjs) swaps these for the GLOBAL dataset
// at bundle time. Outside of that bundler, these paths resolve to the real on-disk JP dataset, which
// is structurally identical and sufficient for standalone verification of this module.
import skilldata from '../../uma-skill-tools/data/skill_data.json';
import skillmeta from '../../skill_meta.json';

export interface SkillData {
	rarity: number;
	alternatives: Array<{
		precondition: string;
		condition: string;
		baseDuration: number;
		effects: Array<{ type: number; modifier: number; target: number }>;
	}>;
}

export interface SkillMeta {
	groupId: string;
	baseCost: number;
	iconId: string;
	order: number;
}

export const skillData = skilldata as Record<string, SkillData>;
export const skillMeta = skillmeta as Record<string, SkillMeta>;

/**
 * Only white (rarity 1) and gold (rarity 2) tiers are true SP-shop purchasable items.
 *
 * - Evolved/pink (rarity 6) skills are never SP-purchasable at all -- they unlock via in-game mission
 *   conditions on their gold skill, not a shop/SP transaction (confirmed fact, not a design guess; see
 *   sdd/skill-optimizer/design-clarification obs #65).
 * - Rarity 3-5 ("unique" skill levels, one per specific character) are likewise never SP-purchasable:
 *   every rarity-3/4/5 entry in `skill_meta.json` has `baseCost === 0`, is a singleton (not an upgrade
 *   chain), and has no per-uma eligibility scoping in this module -- offering them as candidates lets
 *   ANY uma's optimizer recommend every OTHER character's unique skill as a "free" purchase (verify
 *   report finding, sdd/skill-optimizer/verify-report obs #69). They are upgraded via a separate
 *   in-game mechanism, not bought from the skill shop like white/gold/pink tiers are.
 *
 * This mirrors the same rarity-boundary constants (`r < 3`, `r > 5`) that UmasTab.tsx's `calcTotalSP`
 * already uses to identify non-shop tiers (`countsTowardSP = r < 3 || r > 5`), applied here as a
 * POOL-INCLUSION filter (drop the tier entirely) rather than an SP-total filter. Since only rarities
 * 1-6 exist in the dataset, "purchasable" reduces to `rarity < 3`, which excludes both the 3-5 range
 * and the 6+ range in one check.
 */
function isSpPurchasableRarity(rarity: number): boolean {
	return rarity < 3;
}

/** iconId convention for unique/inherited (purple) skills: their icon id ends in '4'. Re-derived
 *  locally from umalator/BasinnChart.tsx's `isPurpleSkill` to avoid importing that (preact) module. */
function isPurpleSkill(id: string): boolean {
	const iconId = skillMeta[id]?.iconId ?? '';
	return iconId.length > 0 && iconId[iconId.length - 1] === '4';
}

/**
 * groupId -> ordered array of tier skill ids (white -> gold -> pink, or the multiple levels of a
 * unique skill), identical sort to UmasTab.tsx:70-85, with rarity-6 tiers excluded before grouping.
 */
export const skillGroups: Map<string, string[]> = Object.keys(skillData)
	.filter(id => skillMeta[id] && isSpPurchasableRarity(skillData[id].rarity))
	.sort((a, b) =>
		(isPurpleSkill(a) ? 1 : 0) - (isPurpleSkill(b) ? 1 : 0) ||
		skillData[a].rarity - skillData[b].rarity ||
		+b - +a
	)
	.reduce((groups, id) => {
		const groupId = skillMeta[id].groupId;
		if (groups.has(groupId)) {
			groups.get(groupId)!.push(id);
		} else {
			groups.set(groupId, [id]);
		}
		return groups;
	}, new Map<string, string[]>());

export default skillGroups;
