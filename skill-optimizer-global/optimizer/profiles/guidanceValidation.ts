import { MetaCommunityGuidance, RunningStyle, SkillTier, StatKey, StyleGuidance } from './types';

export const RUNNING_STYLES: readonly RunningStyle[] = [1, 2, 3, 4, 5];
export const STAT_KEYS: readonly StatKey[] = ['speed', 'stamina', 'power', 'guts', 'wisdom'];
export const SKILL_TIER_KEYS: readonly SkillTier[] = ['core', 'good', 'situational'];

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isRunningStyle(key: string): key is `${RunningStyle}` {
	const parsed = Number(key);
	return RUNNING_STYLES.includes(parsed as RunningStyle) && String(parsed) === key;
}

function isValidIdealStats(value: unknown): value is Partial<Record<StatKey, number>> {
	if (value === undefined) return true;
	if (!isPlainObject(value)) return false;
	return Object.entries(value).every(([key, stat]) => (STAT_KEYS as readonly string[]).includes(key) && Number.isFinite(stat));
}

function isValidSkillTiers(value: unknown): value is Partial<Record<SkillTier, readonly string[]>> {
	if (value === undefined) return true;
	if (!isPlainObject(value)) return false;
	return Object.entries(value).every(([key, skills]) =>
		(SKILL_TIER_KEYS as readonly string[]).includes(key) && Array.isArray(skills) && skills.every(skill => typeof skill === 'string'));
}

function isValidStyleGuidance(value: unknown): value is StyleGuidance {
	if (!isPlainObject(value)) return false;
	return isValidIdealStats(value.idealStats) && isValidSkillTiers(value.skillTiers);
}

/** The one shared structural validator for `MetaCommunityGuidance` -- imported by both the catalog
 *  validator (`isValidMetaProfile`) and the browser-local storage validator (`isGuidanceList`) so
 *  validation logic exists in exactly one place. Never throws. */
export function isValidCommunityGuidance(value: unknown): value is MetaCommunityGuidance {
	if (!isPlainObject(value)) return false;
	if (!text(value.source)) return false;
	if (!isPlainObject(value.byStyle)) return false;
	return Object.entries(value.byStyle).every(([key, styleGuidance]) => isRunningStyle(key) && isValidStyleGuidance(styleGuidance));
}

export function isCommunityGuidanceList(value: unknown): value is MetaCommunityGuidance[] {
	return Array.isArray(value) && value.every(isValidCommunityGuidance);
}
