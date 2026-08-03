import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { MetaCommunityGuidance, RunningStyle, SkillTier, StatKey, StyleGuidance } from '../optimizer/profiles/types';
import { RUNNING_STYLES, SKILL_TIER_KEYS, STAT_KEYS } from '../optimizer/profiles/guidanceValidation';
import { RUNNING_STYLE_LABELS } from './runningStyleLabels';

interface StyleDraft {
	readonly stats: Record<StatKey, string>;
	readonly tiers: Record<SkillTier, string>;
}

function emptyStyleDraft(): StyleDraft {
	return {
		stats: { speed: '', stamina: '', power: '', guts: '', wisdom: '' },
		tiers: { core: '', good: '', situational: '' },
	};
}

function emptyDrafts(): Record<RunningStyle, StyleDraft> {
	const drafts = {} as Record<RunningStyle, StyleDraft>;
	for (const style of RUNNING_STYLES) drafts[style] = emptyStyleDraft();
	return drafts;
}

function buildStyleGuidance(draft: StyleDraft): StyleGuidance | null {
	const idealStats: Partial<Record<StatKey, number>> = {};
	for (const stat of STAT_KEYS) {
		const raw = draft.stats[stat].trim();
		if (raw !== '' && Number.isFinite(Number(raw))) idealStats[stat] = Number(raw);
	}

	const skillTiers: Partial<Record<SkillTier, readonly string[]>> = {};
	for (const tier of SKILL_TIER_KEYS) {
		const skills = draft.tiers[tier].split(',').map(skill => skill.trim()).filter(skill => skill.length > 0);
		if (skills.length > 0) skillTiers[tier] = skills;
	}

	const hasStats = Object.keys(idealStats).length > 0;
	const hasTiers = Object.keys(skillTiers).length > 0;
	if (!hasStats && !hasTiers) return null;
	return { ...(hasStats ? { idealStats } : {}), ...(hasTiers ? { skillTiers } : {}) };
}

export function CommunityGuidanceForm({ onAdd }: { onAdd(entry: MetaCommunityGuidance): void }) {
	const [open, setOpen] = useState(false);
	const [source, setSource] = useState('');
	const [activeStyle, setActiveStyle] = useState<RunningStyle>(1);
	const [drafts, setDrafts] = useState<Record<RunningStyle, StyleDraft>>(emptyDrafts);

	if (!open) {
		return <button type="button" class="community-guidance-add" onClick={() => setOpen(true)}>+ Add community note</button>;
	}

	function updateStat(stat: StatKey, value: string) {
		setDrafts(current => ({ ...current, [activeStyle]: { ...current[activeStyle], stats: { ...current[activeStyle].stats, [stat]: value } } }));
	}

	function updateTier(tier: SkillTier, value: string) {
		setDrafts(current => ({ ...current, [activeStyle]: { ...current[activeStyle], tiers: { ...current[activeStyle].tiers, [tier]: value } } }));
	}

	function submit(event: { preventDefault(): void }) {
		event.preventDefault();
		const trimmedSource = source.trim();
		if (!trimmedSource) return;

		const byStyle: Partial<Record<RunningStyle, StyleGuidance>> = {};
		for (const style of RUNNING_STYLES) {
			const styleGuidance = buildStyleGuidance(drafts[style]);
			if (styleGuidance) byStyle[style] = styleGuidance;
		}
		if (Object.keys(byStyle).length === 0) return;

		onAdd({ source: trimmedSource, byStyle });
		setSource('');
		setActiveStyle(1);
		setDrafts(emptyDrafts());
		setOpen(false);
	}

	const activeDraft = drafts[activeStyle];

	return <form class="community-guidance-form" onSubmit={submit}>
		<label>Source
			<input class="community-guidance-source-input" value={source} onInput={(event: { currentTarget: { value: string } }) => setSource(event.currentTarget.value)} />
		</label>
		<div class="community-guidance-tab-strip" role="tablist">
			{RUNNING_STYLES.map(style => <button
				type="button"
				class="community-guidance-tab"
				data-style={style}
				aria-selected={style === activeStyle}
				onClick={() => setActiveStyle(style)}
			>{RUNNING_STYLE_LABELS[style]}</button>)}
		</div>
		<fieldset class="community-guidance-style-fields">
			<legend>{RUNNING_STYLE_LABELS[activeStyle]}</legend>
			{STAT_KEYS.map(stat => <label>{stat}
				<input
					class="community-guidance-stat-input"
					data-stat={stat}
					value={activeDraft.stats[stat]}
					onInput={(event: { currentTarget: { value: string } }) => updateStat(stat, event.currentTarget.value)}
				/>
			</label>)}
			{SKILL_TIER_KEYS.map(tier => <label>{tier}
				<input
					class="community-guidance-tier-input"
					data-tier={tier}
					value={activeDraft.tiers[tier]}
					onInput={(event: { currentTarget: { value: string } }) => updateTier(tier, event.currentTarget.value)}
				/>
			</label>)}
		</fieldset>
		<button type="submit">Save</button>
		<button type="button" onClick={() => setOpen(false)}>Cancel</button>
	</form>;
}
