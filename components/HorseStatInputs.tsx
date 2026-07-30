// Leaf stat/aptitude/strategy widgets, extracted verbatim out of HorseDef.tsx (sdd/manual-uma-recovery-scoring
// design decision #1). HorseDef.tsx re-exports these so every existing import site (umalator) is
// unchanged; skill-optimizer-global imports them from HERE instead, never from HorseDef.tsx directly.
//
// This is the load-bearing part of the extraction: HorseDef.tsx -> ./SkillProcDataDialog ->
// '../umalator/app' (which has a top-level `render(<App/>, document.getElementById('app'))` side
// effect). Importing ANY symbol from HorseDef.tsx -- even a named export re-exported from here -- would
// therefore still pull in and execute the full umalator app. This file MUST NOT import
// SkillProcDataDialog, SkillPicker, HorseDefTypes, or anything else that reaches umalator/app.tsx --
// its only dependencies are preact and ./HorseDef.css.
import { h } from 'preact';
import { useState } from 'preact/hooks';

import './HorseDef.css';

export function rankForStat(x: number) {
	if (x > 1200) {
		// over 1200 letter (eg UG) goes up by 100 and minor number (eg UG8) goes up by 10
		return Math.min(18 + Math.floor((x - 1200) / 100) * 10 + Math.floor(x / 10) % 10, 97);
	} else if (x >= 1150) {
		return 17; // SS+
	} else if (x >= 1100) {
		return 16; // SS
	} else if (x >= 400) {
		// between 400 and 1100 letter goes up by 100 starting with C (8)
		return 8 + Math.floor((x - 400) / 100);
	} else {
		// between 1 and 400 letter goes up by 50 starting with G+ (0)
		return Math.floor(x / 50);
	}
}

export function Stat(props) {
	return (
		<div class="horseStat">
			<span class="horseStatLabel">{props.label}</span>
			<img class="horseStatIcon" src={`/uma-tools/icons/status_0${props.statIdx}.png`} />
			<img class="horseStatRank" src={`/uma-tools/icons/statusrank/ui_statusrank_${(100 + rankForStat(props.value)).toString().slice(1)}.png`} />
			<input type="number" min="1" max="2000" value={props.value} tabindex={props.tabindex} onInput={(e) => props.change(+e.currentTarget.value)} />
		</div>
	);
}

export const APTITUDES = Object.freeze(['S','A','B','C','D','E','F','G']);
export function AptitudeIcon(props) {
	const idx = 7 - APTITUDES.indexOf(props.a);
	return <img src={`/uma-tools/icons/utx_ico_statusrank_${(100 + idx).toString().slice(1)}.png`} loading="lazy" />;
}

export function AptitudeSelect(props){
	const [open, setOpen] = useState(false);
	function setAptitude(e) {
		e.stopPropagation();
		props.setA(e.currentTarget.dataset.horseAptitude);
		setOpen(false);
	}
	function selectByKey(e: KeyboardEvent) {
		const k = e.key.toUpperCase();
		if (APTITUDES.indexOf(k) > -1) {
			props.setA(k);
		}
	}
	return (
		<div class="horseAptitudeSelect" tabindex={props.tabindex} onClick={() => setOpen(!open)} onBlur={setOpen.bind(null, false)} onKeyDown={selectByKey}>
			<span><AptitudeIcon a={props.a} /></span>
			<ul style={open ? "display:block" : "display:none"}>
				{APTITUDES.map(a => <li key={a} data-horse-aptitude={a} onClick={setAptitude}><AptitudeIcon a={a} /></li>)}
			</ul>
		</div>
	);
}

export function MoodSelect(props){
	const [open, setOpen] = useState(false);
	const moodValues = [
		{value: 2, icon: 'utx_ico_motivation_m_04', label: 'Great'},
		{value: 1, icon: 'utx_ico_motivation_m_03', label: 'Good'},
		{value: 0, icon: 'utx_ico_motivation_m_02', label: 'Normal'},
		{value: -1, icon: 'utx_ico_motivation_m_01', label: 'Bad'},
		{value: -2, icon: 'utx_ico_motivation_m_00', label: 'Awful'}
	];

	function setMood(e) {
		e.stopPropagation();
		props.setM(+e.currentTarget.dataset.mood);
		setOpen(false);
	}

	return (
		<div class="horseMoodSelect" tabindex={props.tabindex} onClick={() => setOpen(!open)} onBlur={setOpen.bind(null, false)}>
			<span>
				<img src={`/uma-tools/icons/global/${moodValues.find(m => m.value === props.m)?.icon}.png`} />
			</span>
			<ul style={open ? "display:block" : "display:none"}>
				{moodValues.map(mood =>
					<li key={mood.value} data-mood={mood.value} onClick={setMood}>
						<img src={`/uma-tools/icons/global/${mood.icon}.png`} title={mood.label} />
					</li>
				)}
			</ul>
		</div>
	);
}

export function StrategySelect(props) {
	const disabled = props.disabled || false;
	if (CC_GLOBAL) {
		return (
			<select class="horseStrategySelect" value={props.s} tabindex={props.tabindex} disabled={disabled} onInput={(e) => props.setS(e.currentTarget.value)}>
				<option value="Oonige">Runaway</option>
				<option value="Nige">Front Runner</option>
				<option value="Senkou">Pace Chaser</option>
				<option value="Sasi">Late Surger</option>
				<option value="Oikomi">End Closer</option>
			</select>
		);
	}
	return (
		<select class="horseStrategySelect" value={props.s} tabindex={props.tabindex} disabled={disabled} onInput={(e) => props.setS(e.currentTarget.value)}>
			<option value="Nige">逃げ</option>
			<option value="Senkou">先行</option>
			<option value="Sasi">差し</option>
			<option value="Oikomi">追込</option>
			<option value="Oonige">大逃げ</option>
		</select>
	);
}
