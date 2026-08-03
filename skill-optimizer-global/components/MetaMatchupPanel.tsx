import { h } from 'preact';
import type { MetaEvaluationResult } from '../optimizer/types';
import type { MetaCommunityGuidance, RunningStyle, SkillTier, StatKey } from '../optimizer/profiles/types';
import { RUNNING_STYLES, SKILL_TIER_KEYS, STAT_KEYS } from '../optimizer/profiles/guidanceValidation';
import { RUNNING_STYLE_LABELS } from './runningStyleLabels';

export interface StyleGuidanceItem {
	readonly source: string;
	readonly idealStats: readonly { readonly stat: StatKey; readonly value: number }[];
	readonly skillTiers: readonly { readonly tier: SkillTier; readonly skills: readonly string[] }[];
}

export interface StyleGuidanceGroup {
	readonly style: RunningStyle;
	readonly label: string;
	readonly items: readonly StyleGuidanceItem[];
}

export function profileProvenance(profile: import('../optimizer/profiles/types').MetaProfile | null): string | null {
	return profile && `${profile.id} v${profile.version} — ${profile.provenance.source}; reviewed ${profile.provenance.reviewedAt}; ${profile.assumptions.course}, ${profile.assumptions.lobby}`;
}

function itemForStyle(entry: MetaCommunityGuidance, style: RunningStyle): StyleGuidanceItem | null {
	const styleGuidance = entry.byStyle[style];
	if (!styleGuidance) return null;
	const idealStats = STAT_KEYS
		.filter(stat => styleGuidance.idealStats?.[stat] !== undefined)
		.map(stat => ({ stat, value: styleGuidance.idealStats![stat]! }));
	const skillTiers = SKILL_TIER_KEYS
		.filter(tier => styleGuidance.skillTiers?.[tier] !== undefined)
		.map(tier => ({ tier, skills: styleGuidance.skillTiers![tier]! }));
	return { source: entry.source, idealStats, skillTiers };
}

function buildStyleGuidanceGroups(entries: readonly MetaCommunityGuidance[]): readonly StyleGuidanceGroup[] {
	const groups: StyleGuidanceGroup[] = [];
	for (const style of RUNNING_STYLES) {
		const items = entries.map(entry => itemForStyle(entry, style)).filter((item): item is StyleGuidanceItem => item !== null);
		if (items.length > 0) groups.push({ style, label: RUNNING_STYLE_LABELS[style], items });
	}
	return groups;
}

// `localGuidance` is browser-local, user-added notes (see communityGuidanceStorage.ts) merged on top
// of the catalog's curated `profile.communityGuidance` -- both render identically since neither is
// simulator-verified; only their storage location differs.
export function metaMatchupPanelContent(result: MetaEvaluationResult | null, localGuidance: readonly MetaCommunityGuidance[] = []) {
	if (!result) return null;
	const { profile } = result;
	return {
		heading: result.mode === 'ChampionsMeeting' ? 'CM profile' : 'LoH profile',
		provenance: `${profile.reference.id} v${profile.reference.version} — ${profile.provenance.source}; reviewed ${profile.provenance.reviewedAt}`,
		assumptions: `Course: ${profile.assumptions.course}; lobby: ${profile.assumptions.lobby}`,
		communityGuidance: buildStyleGuidanceGroups([...profile.communityGuidance, ...localGuidance]),
	};
}

export function MetaMatchupPanel({ result, localGuidance = [] }: { result: MetaEvaluationResult | null; localGuidance?: readonly MetaCommunityGuidance[] }) {
	const content = metaMatchupPanelContent(result, localGuidance);
	return content && <div class="meta-matchup-panel" role="region" aria-label="Meta matchup profile" aria-live="polite">
		<strong>{content.heading}:</strong> {content.provenance}
		<div>{content.assumptions}</div>
		<div class="meta-matchup-panel-community" role="note">
			<strong>Community guidance (unverified, not simulator-tested):</strong>
			{content.communityGuidance.map(group => <div class="meta-matchup-style-group">
				<h4>{group.label}</h4>
				<ul>{group.items.map(item => <li>
					{item.idealStats.length > 0 && <span class="meta-matchup-ideal-stats">
						Ideal stats: {item.idealStats.map(({ stat, value }) => `${stat} ${value}`).join(', ')}
					</span>}
					{item.skillTiers.length > 0 && <span class="meta-matchup-skill-tiers">
						{item.skillTiers.map(({ tier, skills }) => `${tier}: ${skills.join(', ')}`).join('; ')}
					</span>}
					<span class="meta-matchup-item-source"> (source: {item.source})</span>
				</li>)}</ul>
			</div>)}
		</div>
	</div>;
}
