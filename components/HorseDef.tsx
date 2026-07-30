import { h, Fragment } from 'preact';
import { useState, useReducer, useMemo, useEffect, useRef } from 'preact/hooks';
import { IntlProvider, Text, Localizer } from 'preact-i18n';
import { Set as ImmSet } from 'immutable';

import { Skill } from '../components/SkillList';
import { SkillPickerModal, ExpandedSkillView } from './SkillPicker';
import { SkillProcDataDialog } from './SkillProcDataDialog';

import { HorseParameters } from '../uma-skill-tools/HorseTypes';

import { SkillSet, HorseState, isDebuffSkill } from './HorseDefTypes';

// Leaf stat/aptitude/strategy widgets now live in ./HorseStatInputs (dependency-free: preact +
// HorseDef.css only) -- imported (for use below) and re-exported here, unchanged, so every existing
// import site keeps working. See HorseStatInputs.tsx's header comment for why this split exists
// (skill-optimizer-global cannot import anything from THIS file without pulling in umalator/app.tsx's
// top-level render() side effect).
import { rankForStat, Stat, APTITUDES, AptitudeIcon, AptitudeSelect, MoodSelect, StrategySelect } from './HorseStatInputs';
export { rankForStat, Stat, APTITUDES, AptitudeIcon, AptitudeSelect, MoodSelect, StrategySelect };

import './HorseDef.css';

import umas from '../umas.json';
import icons from '../icons.json';
import skilldata from '../uma-skill-tools/data/skill_data.json';
import skillmeta from '../skill_meta.json';

const umaAltIds = Object.keys(umas).flatMap(id => Object.keys(umas[id].outfits));
const umaNamesForSearch = {};
umaAltIds.forEach(id => {
	const u = umas[id.slice(0,4)];
	umaNamesForSearch[id] = (u.outfits[id] + ' ' + u.name[1]).toUpperCase().replace(/\./g, '');
});

function searchNames(query) {
	const q = query.toUpperCase().replace(/\./g, '');
	return umaAltIds.filter(oid => umaNamesForSearch[oid].indexOf(q) > -1);
}

export function UmaSelector(props) {
	const randomMob = useMemo(() => `/uma-tools/icons/mob/trained_mob_chr_icon_${8000 + Math.floor(Math.random() * 624)}_000001_01.png`, []);
	const u = props.value && umas[props.value.slice(0,4)];

	const input = useRef(null);
	const suggestionsContainer = useRef(null);
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(-1);
	function update(q) {
		return {input: q, suggestions: searchNames(q)};
	}
	const [query, search] = useReducer((_,q) => update(q), u && u.name[1], update);

	function confirm(oid) {
		setOpen(false);
		props.select(oid);
		const uname = umas[oid.slice(0,4)].name[1];
		search(uname);
		setActiveIdx(-1);
		if (input.current != null) {
			input.current.value = uname;
			input.current.blur();
		}
	}

	function focus() {
		input.current && input.current.select();
	}

	function setActiveAndScroll(idx) {
		setActiveIdx(idx);
		if (!suggestionsContainer.current) return;
		const container = suggestionsContainer.current;
		const li = container.querySelector(`[data-uma-id="${query.suggestions[idx]}"]`);
		const ch = container.offsetHeight - 4;  // 4 for borders
		if (li.offsetTop < container.scrollTop) {
			container.scrollTop = li.offsetTop;
		} else if (li.offsetTop >= container.scrollTop + ch) {
			const h = li.offsetHeight;
			container.scrollTop = (li.offsetTop / h - (ch / h - 1)) * h;
		}
	}

	function handleClick(e) {
		const li = e.target.closest('.umaSuggestion');
		if (li == null) return;
		e.stopPropagation();
		confirm(li.dataset.umaId);
	}

	function handleInput(e) {
		search(e.target.value);
	}

	function handleKeyDown(e) {
		const l = query.suggestions.length;
		switch (e.keyCode) {
			case 13:
				if (activeIdx > -1) confirm(query.suggestions[activeIdx]);
				break;
			case 38:
				setActiveAndScroll((activeIdx - 1 + l) % l);
				break;
			case 40:
				setActiveAndScroll((activeIdx + 1 + l) % l);
				break;
		}
	}

	function handleBlur(e) {
		if (e.target.value.length == 0) props.select('');
		setOpen(false);
	}

	return (
		<div class="umaSelector">
			<div class="umaSelectorIconsBox" onClick={focus}>
				<img src={props.value ? icons[props.value] : randomMob} />
				<img src="/uma-tools/icons/utx_ico_umamusume_00.png" />
			</div>
			<div class="umaEpithet"><span>{props.value && u.outfits[props.value]}</span></div>
			{props.actions && <div class="umaSelectorActions">{props.actions}</div>}
			<div class="umaSelectWrapper">
				<input type="text" class="umaSelectInput" value={query.input} tabindex={props.tabindex} onInput={handleInput} onKeyDown={handleKeyDown} onFocus={() => setOpen(true)} onBlur={handleBlur} ref={input} />
				<ul class={`umaSuggestions ${open ? 'open' : ''}`} onMouseDown={handleClick} ref={suggestionsContainer}>
					{query.suggestions.map((oid, i) => {
						const uid = oid.slice(0,4);
						return (
							<li key={oid} data-uma-id={oid} class={`umaSuggestion ${i == activeIdx ? 'selected' : ''}`}>
								<img src={icons[oid]} loading="lazy" /><span>{umas[uid].outfits[oid]} {umas[uid].name[1]}</span>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

const nonUniqueSkills = Object.keys(skilldata).filter(id => skilldata[id].rarity < 3 || skilldata[id].rarity > 5);
const universallyAccessiblePinks = ['92111091' /* welfare kraft alt pink unique inherit */].concat(Object.keys(skilldata).filter(id => id[0] == '4'));

export function isGeneralSkill(id: string) {
	return skilldata[id].rarity < 3 || universallyAccessiblePinks.indexOf(id) > -1;
}

function assertIsSkill(sid: string): asserts sid is keyof typeof skilldata {
	console.assert(skilldata[sid] != null);
}

function uniqueSkillForUma(oid: typeof umaAltIds[number]): keyof typeof skilldata {
	const i = +oid.slice(1, -2), v = +oid.slice(-2);
	const sid = (100000 + 10000 * (v - 1) + i * 10 + 1).toString();
	assertIsSkill(sid);
	return sid;
}

function skillOrder(a: string, b: string) {
	const x = skillmeta[a].order, y = skillmeta[b].order;
	return +(y < x) - +(x < y) || +(b < a) - +(a < b);
}

let totalTabs = 0;
export function horseDefTabs() {
	return totalTabs;
}

export function HorseDef(props) {
	const {state, setState} = props;
	const [skillPickerOpen, setSkillPickerOpen] = useState(false);
	const [expanded, setExpanded] = useState(() => ImmSet());
	const [procDataSkillId, setProcDataSkillId] = useState<string | null>(null);

	const tabstart = props.tabstart();
	let tabi = 0;
	function tabnext() {
		if (++tabi > totalTabs) totalTabs = tabi;
		return tabstart + tabi - 1;
	}

	const umaId = state.outfitId;
	const selectableSkills = useMemo(() => nonUniqueSkills.filter(id => skilldata[id].rarity != 6 || id.startsWith(umaId) || universallyAccessiblePinks.indexOf(id) != -1), [umaId]);

	function setter(prop: keyof HorseState) {
		return (x) => setState(state.set(prop, x));
	}
	const setSkills = setter('skills');

	function setUma(id) {
		let newSkills = state.skills.filter(isGeneralSkill);

		if (id) {
			const uid = uniqueSkillForUma(id);
			newSkills = newSkills.set(skillmeta[uid].groupId, uid);
		}

		const removedSkillIds = state.skills.keySeq().toSet().subtract(newSkills.keySeq().toSet());
		let newForcedPositions = state.forcedSkillPositions;
		let newSkillLevels = state.skillLevels;
		removedSkillIds.forEach(skillId => {
			newForcedPositions = newForcedPositions.delete(skillId);
			newSkillLevels = newSkillLevels.delete(skillId);
		});

		setState(
			state.set('outfitId', id)
				.set('skills', newSkills)
				.set('forcedSkillPositions', newForcedPositions)
				.set('skillLevels', newSkillLevels)
		);
	}

	function openSkillPicker(e) {
		e.stopPropagation();
		setSkillPickerOpen(true);
	}

	function handlePickerSelect(skillId: string) {
		const groupId = skillmeta[skillId].groupId;
		let newSkills;
		if (isDebuffSkill(skillId)) {
			const ndebuffs = state.skills.count(isDebuffSkill);
			newSkills = state.skills.set(groupId + '-' + ndebuffs, skillId);
		} else {
			newSkills = state.skills.set(groupId, skillId);
		}
		setSkills(newSkills);
	}

	function handleSkillClick(e) {
		e.stopPropagation();
		if (e.target.classList.contains('forcedPositionInput')) {
			return;
		}
		const se = e.target.closest('.skill, .expandedSkill');
		if (se == null) return;
		if (e.target.classList.contains('skillDismiss')) {
			const skillId = se.dataset.skillid;
			setState(
				state.set('skills', state.skills.delete(state.skills.findKey(id => id == skillId)))
					.set('forcedSkillPositions', state.forcedSkillPositions.delete(skillId))
					.set('skillLevels', state.skillLevels.delete(skillId))
			);
		} else if (se.classList.contains('expandedSkill')) {
			setExpanded(expanded.delete(se.dataset.skillid));
		} else {
			setExpanded(expanded.add(se.dataset.skillid));
		}
	}

	function handlePositionChange(skillId: string, value: string) {
		const numValue = parseFloat(value);
		if (value === '' || isNaN(numValue)) {
			setState(state.set('forcedSkillPositions', state.forcedSkillPositions.delete(skillId)));
		} else {
			setState(state.set('forcedSkillPositions', state.forcedSkillPositions.set(skillId, numValue)));
		}
	}

	function handleSkillLevelChange(skillId: string, value: string) {
		const numValue = parseInt(value, 10);
		if (value === '' || isNaN(numValue)) {
			setState(state.set('skillLevels', state.skillLevels.delete(skillId)));
		} else {
			setState(state.set('skillLevels', state.skillLevels.set(skillId, Math.max(1, Math.min(10, numValue)))));
		}
	}

	useEffect(function () {
		window.requestAnimationFrame(() =>
			document.querySelectorAll('.horseExpandedSkill').forEach(e => {
				(e as HTMLElement).style.gridRow = 'span ' + Math.ceil((e.firstChild as HTMLElement).offsetHeight / 64);
			})
		);
	}, [expanded]);

	useEffect(function () {
		const currentSkillIds = state.skills.valueSeq().toSet();
		const forcedPositionSkillIds = state.forcedSkillPositions.keySeq().toSet();
		const orphanedSkillIds = forcedPositionSkillIds.subtract(currentSkillIds);
		if (orphanedSkillIds.size > 0) {
			let newForcedPositions = state.forcedSkillPositions;
			orphanedSkillIds.forEach(skillId => {
				newForcedPositions = newForcedPositions.delete(skillId);
			});
			setState(state.set('forcedSkillPositions', newForcedPositions));
		}
	}, [state.skills]);

	useEffect(function () {
		const currentSkillIds = state.skills.valueSeq().toSet();
		const skillLevelIds = state.skillLevels.keySeq().toSet();
		const orphanedSkillIds = skillLevelIds.subtract(currentSkillIds);
		if (orphanedSkillIds.size > 0) {
			let newSkillLevels = state.skillLevels;
			orphanedSkillIds.forEach(skillId => {
				newSkillLevels = newSkillLevels.delete(skillId);
			});
			setState(state.set('skillLevels', newSkillLevels));
		}
	}, [state.skills]);

	const hasRunawaySkill = state.skills.has('202051');
	useEffect(function () {
		if (hasRunawaySkill && state.strategy !== 'Oonige') {
			setState(state.set('strategy', 'Oonige'));
		}
	}, [hasRunawaySkill, state.strategy]);

	const skillList = useMemo(function () {
		const u = uniqueSkillForUma(umaId);
		const hasRunData = props.runData != null && props.umaIndex != null;
		return Array.from(state.skills.values() as Iterable<string>).sort(skillOrder).map(id =>
			expanded.has(id)
				? <li key={id} class="horseExpandedSkill">
					  <ExpandedSkillView
						  id={id}
						  distanceFactor={props.courseDistance}
						  dismissable={id != u}
						  forcedPosition={state.forcedSkillPositions.get(id) || ''}
						  onPositionChange={(value: string) => handlePositionChange(id, value)}
						  skillLevel={state.skillLevels.get(id)}
						  onSkillLevelChange={(value: string) => handleSkillLevelChange(id, value)}
						  runData={hasRunData ? props.runData : null}
						  umaIndex={hasRunData ? props.umaIndex : null}
						  onViewProcData={hasRunData ? () => setProcDataSkillId(id) : null}
					  />
				  </li>
				: <li key={id} style="">
					  <Skill
						  id={id}
						  selected={false}
						  dismissable={id != u}
						  skillLevel={state.skillLevels.get(id)}
						  onSkillLevelChange={(value: string) => handleSkillLevelChange(id, value)}
					  />
					  {state.forcedSkillPositions.has(id) && (
						  <span class="forcedPositionLabel inline">
							  @{state.forcedSkillPositions.get(id)}m
						  </span>
					  )}
				  </li>
		);
	}, [state.skills, umaId, expanded, props.courseDistance, state.forcedSkillPositions, state.skillLevels, props.runData, props.umaIndex]);

	return (
		<div class="horseDef">
			<div class="horseDefHeader">{props.children}</div>
			<UmaSelector value={umaId} select={setUma} tabindex={tabnext()} actions={props.headerActions} />
			<div class="horseStats">
				<Stat value={state.speed} change={setter('speed')} tabindex={tabnext()} label="Speed" statIdx={0} />
				<Stat value={state.stamina} change={setter('stamina')} tabindex={tabnext()} label="Stamina" statIdx={1} />
				<Stat value={state.power} change={setter('power')} tabindex={tabnext()} label="Power" statIdx={2} />
				<Stat value={state.guts} change={setter('guts')} tabindex={tabnext()} label="Guts" statIdx={3} />
				<Stat value={state.wisdom} change={setter('wisdom')} tabindex={tabnext()} label={CC_GLOBAL ? 'Wit' : 'Wisdom'} statIdx={4} />
			</div>
		<div class="horseApts">
			<div class="horseAptCell horseAptCell--run">
				<span class="horseAptLabel">{CC_GLOBAL ? 'Strategy' : 'Run Style'}</span>
				<StrategySelect s={state.strategy} setS={setter('strategy')} disabled={hasRunawaySkill} tabindex={tabnext()} />
			</div>
			<div class="horseAptCell horseAptCell--fixed">
				<span class="horseAptLabel">Surf</span>
				<AptitudeSelect a={state.surfaceAptitude} setA={setter('surfaceAptitude')} tabindex={tabnext()} />
			</div>
			<div class="horseAptCell horseAptCell--fixed">
				<span class="horseAptLabel">Dist</span>
				<AptitudeSelect a={state.distanceAptitude} setA={setter('distanceAptitude')} tabindex={tabnext()} />
			</div>
			<div class="horseAptCell horseAptCell--fixed">
				<span class="horseAptLabel">{CC_GLOBAL ? 'Style' : 'Strat'}</span>
				<AptitudeSelect a={state.strategyAptitude} setA={setter('strategyAptitude')} tabindex={tabnext()} />
			</div>
			<div class="horseAptCell horseAptCell--fixed">
				<span class="horseAptLabel">Mood</span>
				<MoodSelect m={state.mood} setM={setter('mood')} tabindex={tabnext()} />
			</div>
		</div>
	<div class="horseSectionLabel">Skills</div>
		<div class="horseSkillListWrapper" onClick={handleSkillClick}>
			<ul class="horseSkillPills">
				{skillList}
			</ul>
			<button class="horseAddSkillBtn" onClick={openSkillPicker} tabindex={tabnext()}>+ Add Skill</button>
		</div>
		<SkillPickerModal
			isOpen={skillPickerOpen}
			onClose={() => setSkillPickerOpen(false)}
			onSelect={handlePickerSelect}
			selectedSkills={Array.from(state.skills.values() as Iterable<string>)}
			availableSkillIds={selectableSkills}
		/>
		{procDataSkillId && props.runData != null && props.umaIndex != null && (
			<SkillProcDataDialog
				skillId={procDataSkillId}
				compareRunData={props.runData}
				courseDistance={props.courseDistance}
				umaIndex={props.umaIndex}
				onClose={() => setProcDataSkillId(null)}
			/>
		)}
		</div>
	);
}
