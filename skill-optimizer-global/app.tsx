import { h, render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

import './app.css';

import { UmaSelect } from './components/UmaSelect';
import { UmaInput } from './components/umaInput';
import { BudgetRaceInputs, BudgetRaceInputsValue } from './components/BudgetRaceInputs';
import { HintTable } from './components/HintTable';
import { ResultPanel } from './components/ResultPanel';
import { optimize } from './optimizer/optimize';
import { HintInput, OptimizeInput, Plan } from './optimizer/types';
import { clearOptimizerBuild, defaultOptimizerBuildState, EntryMode, loadOptimizerBuild, ManualUmaState, saveOptimizerBuild } from './optimizerBuildStorage';

// Wires the input panels' state into `optimizer/optimize.ts`'s `OptimizeInput` and renders the result
// via `ResultPanel`. `selection` converges both the roster-import and manual-entry paths into one
// `UmaInput` shape (spec domain: manual-uma-entry, "Single Converged Uma Shape, No Silent Merge") --
// see components/UmaSelect.tsx / components/umaInput.ts.
function App() {
	const initialBuild = useMemo(loadOptimizerBuild, []);
	const [selection, setSelection] = useState<UmaInput | null>(null);
	const [entryMode, setEntryMode] = useState<EntryMode>(initialBuild.entryMode);
	const [manualState, setManualState] = useState<ManualUmaState>(initialBuild.manualUma);
	const [budgetRace, setBudgetRace] = useState<BudgetRaceInputsValue>({ budget: initialBuild.budget, raceContext: initialBuild.raceContext });
	const [hints, setHints] = useState<HintInput>(initialBuild.hints);
	const [plan, setPlan] = useState<Plan | null>(null);
	const [resetKey, setResetKey] = useState(0);
	const skipNextPersistence = useRef(false);

	useEffect(() => {
		if (skipNextPersistence.current) {
			skipNextPersistence.current = false;
			return;
		}
		saveOptimizerBuild({ entryMode, manualUma: manualState, budget: budgetRace.budget, raceContext: budgetRace.raceContext, hints });
	}, [entryMode, manualState, budgetRace, hints]);

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
		setPlan(optimizeInput ? optimize(optimizeInput) : null);
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
		setPlan(null);
		setResetKey(key => key + 1);
	}

	return (
		<div id="skillOptimizer">
			<div class="optimizer-header">
				<h1>Skill Optimizer</h1>
				<button type="button" class="optimizer-reset" onClick={resetBuild}>Reset build</button>
			</div>
			<section class="optimizer-section">
				<h2>1. Select uma</h2>
				<UmaSelect
					key={resetKey}
					onSelect={setSelection}
					entryMode={entryMode}
					manualState={manualState}
					onEntryModeChange={setEntryMode}
					onManualChange={(state, input) => { setManualState(state); setSelection(input); }}
				/>
			</section>
			<section class="optimizer-section">
				<h2>2. Budget &amp; target race</h2>
				<BudgetRaceInputs value={budgetRace} onChange={setBudgetRace} />
			</section>
			<section class="optimizer-section">
				<h2>3. Hint levels</h2>
				<HintTable hints={hints} onChange={setHints} />
			</section>
			<section class="optimizer-section">
				<h2>4. Result</h2>
				<button type="button" disabled={!optimizeInput} onClick={runOptimize}>
					Optimize build
				</button>
				<ResultPanel input={optimizeInput} plan={plan} />
			</section>
		</div>
	);
}

render(<App />, document.getElementById('app'));
