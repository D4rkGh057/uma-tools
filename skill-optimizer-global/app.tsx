import { h, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import './app.css';

import { UmaSelect } from './components/UmaSelect';
import { UmaInput } from './components/umaInput';
import { BudgetRaceInputs, BudgetRaceInputsValue } from './components/BudgetRaceInputs';
import { HintTable } from './components/HintTable';
import { ResultPanel } from './components/ResultPanel';
import { ModeSelector } from './components/ModeSelector';
import { MetaMatchupPanel } from './components/MetaMatchupPanel';
import { evaluate } from './optimizer/evaluation';
import { profileCatalog } from './optimizer/profiles/catalog';
import { MetaProfileReference } from './optimizer/profiles/types';
import { EvaluationMode, EvaluationResult, HintInput, OptimizeInput } from './optimizer/types';
import { clearOptimizerBuild, defaultOptimizerBuildState, EntryMode, loadOptimizerBuildOutcome, ManualUmaState, OptimizerBuildSelection, saveOptimizerBuild } from './optimizerBuildStorage';
import { ResultPanelState } from './components/resultPanelState';

// Wires the input panels' state into `optimizer/optimize.ts`'s `OptimizeInput` and renders the result
// via `ResultPanel`. `selection` converges both the roster-import and manual-entry paths into one
// `UmaInput` shape (spec domain: manual-uma-entry, "Single Converged Uma Shape, No Silent Merge") --
// see components/UmaSelect.tsx / components/umaInput.ts.
function App() {
	const initialLoad = useMemo(loadOptimizerBuildOutcome, []);
	const initialBuild = initialLoad.state;
	const initialSelection: OptimizerBuildSelection = initialLoad.status === 'rejected' ? { mode: 'Score' } : initialLoad.selection;
	const [selection, setSelection] = useState<UmaInput | null>(null);
	const [entryMode, setEntryMode] = useState<EntryMode>(initialBuild.entryMode);
	const [manualState, setManualState] = useState<ManualUmaState>(initialBuild.manualUma);
	const [budgetRace, setBudgetRace] = useState<BudgetRaceInputsValue>({ budget: initialBuild.budget, raceContext: initialBuild.raceContext });
	const [hints, setHints] = useState<HintInput>(initialBuild.hints);
	const [mode, setMode] = useState<EvaluationMode>(initialSelection.mode);
	const [profile, setProfile] = useState<MetaProfileReference | undefined>(initialSelection.profile);
	const [result, setResult] = useState<EvaluationResult | null>(null);
	const [state, setState] = useState<ResultPanelState | null>(initialLoad.status === 'migrated' ? initialLoad : initialLoad.status === 'rejected' ? { status: 'invalid', mode: 'persisted', reason: initialLoad.reason } : null);
	const [resetKey, setResetKey] = useState(0);
	const skipNextPersistence = useRef(false);

	useEffect(() => {
		if (skipNextPersistence.current) {
			skipNextPersistence.current = false;
			return;
		}
		saveOptimizerBuild({ entryMode, manualUma: manualState, budget: budgetRace.budget, raceContext: budgetRace.raceContext, hints }, undefined, { mode, ...(profile ? { profile } : {}) });
	}, [entryMode, manualState, budgetRace, hints, mode, profile]);

	// `selection.ownedSkills` is exactly the shape `OptimizeInput.ownedSkills` expects (design decision
	// #7 precedent) -- passed straight through, no reshaping. `selection.build` enables HP-projection
	// Recovery scoring (see optimizer/score.ts, optimizer/hp.ts) whenever it's complete enough.
	const optimizeInput: OptimizeInput | null = useMemo(() => {
		if (!selection) return null;
		return {
			ownedSkills: selection.ownedSkills,
			budget: budgetRace.budget,
			hints,
			raceContext: budgetRace.raceContext,
			build: selection.build,
		};
	}, [selection, budgetRace, hints]);

	// Only recomputed on explicit "Optimize build" click, not on every input change -- avoids running
	// the optimizer on each keystroke and lets `plan` stay a plain user-triggered snapshot.
	function runOptimize() {
		const request = optimizeInput && ((mode === 'ChampionsMeeting' || mode === 'LeagueOfHeroes') && profile
			? { ...optimizeInput, mode, profile }
			: { ...optimizeInput, mode });
		setResult(request ? evaluate(request) : null);
		setState(null);
	}

	function changeMode(nextMode: EvaluationMode) {
		setMode(nextMode);
		const nextProfile = profileCatalog.find(candidate => candidate.mode === nextMode);
		setProfile(nextProfile && { id: nextProfile.id, version: nextProfile.version });
		setResult(null);
	}

	function resetBuild() {
		if (typeof window !== 'undefined' && !window.confirm('Reset this optimizer build? Your shared roster will not be changed.')) return;
		clearOptimizerBuild();
		const defaults = defaultOptimizerBuildState();
		// Effects only run when a dependency changes. Avoid leaving the skip flag armed when a
		// reset is clicked while this build is already at its defaults.
		skipNextPersistence.current = entryMode !== defaults.entryMode
			|| JSON.stringify(manualState) !== JSON.stringify(defaults.manualUma)
			|| budgetRace.budget !== defaults.budget
			|| budgetRace.raceContext !== undefined
			|| Object.keys(hints).length > 0;
		setSelection(null);
		setEntryMode(defaults.entryMode);
		setManualState(defaults.manualUma);
		setBudgetRace({ budget: defaults.budget });
		setHints(defaults.hints);
		setMode('Score');
		setProfile(undefined);
		setResult(null);
		setState(null);
		setResetKey(key => key + 1);
	}

	const metaResult = result?.status === 'ready' && (result.mode === 'ChampionsMeeting' || result.mode === 'LeagueOfHeroes') ? result : null;

	return (
		<div id="skillOptimizer">
			<header class="optimizer-header">
				<div>
					<h1 id="optimizer-title">Skill Optimizer</h1>
					<p>Configure a build, then optimize it explicitly.</p>
				</div>
				<button type="button" class="optimizer-reset" onClick={resetBuild}>Reset build</button>
			</header>
			<main class="optimizer-workflow" aria-labelledby="optimizer-title">
			<section class="optimizer-section" aria-labelledby="step-1-heading">
				<h2 id="step-1-heading">1. Select uma</h2>
				<UmaSelect
					key={resetKey}
					onSelect={setSelection}
					entryMode={entryMode}
					manualState={manualState}
					onEntryModeChange={setEntryMode}
					onManualChange={(state, input) => { setManualState(state); setSelection(input); }}
				/>
			</section>
			<section class="optimizer-section" aria-labelledby="step-2-heading">
				<h2 id="step-2-heading">2. Budget &amp; target race</h2>
				<BudgetRaceInputs value={budgetRace} onChange={setBudgetRace} />
			</section>
			<section class="optimizer-section" aria-labelledby="step-3-heading">
				<h2 id="step-3-heading">3. Hint levels</h2>
				<HintTable hints={hints} onChange={setHints} />
			</section>
			<section class="optimizer-section" aria-labelledby="step-4-heading">
				<h2 id="step-4-heading">4. Evaluation mode</h2>
				<ModeSelector mode={mode} onChange={changeMode} />
				<MetaMatchupPanel result={metaResult} />
			</section>
			<section class="optimizer-section optimizer-action" aria-labelledby="step-5-heading">
				<h2 id="step-5-heading">5. Optimize</h2>
				<button type="button" class="optimizer-submit" disabled={!optimizeInput} onClick={runOptimize}>
					Optimize build
				</button>
			</section>
			<section class="optimizer-results" aria-labelledby="results-heading" aria-live="polite">
				<h2 id="results-heading">Results</h2>
				<ResultPanel input={optimizeInput} plan={result?.status === 'ready' ? result.purchase : null} result={result} state={state} />
			</section>
			</main>
		</div>
	);
}

render(<App />, document.getElementById('app'));
