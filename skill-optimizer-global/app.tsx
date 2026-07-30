import { h, render } from 'preact';
import { useMemo, useState } from 'preact/hooks';

import './app.css';

import { UmaSelect } from './components/UmaSelect';
import { UmaInput } from './components/umaInput';
import { BudgetRaceInputs, BudgetRaceInputsValue } from './components/BudgetRaceInputs';
import { HintTable } from './components/HintTable';
import { ResultPanel } from './components/ResultPanel';
import { optimize } from './optimizer/optimize';
import { HintInput, OptimizeInput, Plan } from './optimizer/types';

// Wires the input panels' state into `optimizer/optimize.ts`'s `OptimizeInput` and renders the result
// via `ResultPanel`. `selection` converges both the roster-import and manual-entry paths into one
// `UmaInput` shape (spec domain: manual-uma-entry, "Single Converged Uma Shape, No Silent Merge") --
// see components/UmaSelect.tsx / components/umaInput.ts.
function App() {
	const [selection, setSelection] = useState<UmaInput | null>(null);
	const [budgetRace, setBudgetRace] = useState<BudgetRaceInputsValue>({ budget: 0 });
	const [hints, setHints] = useState<HintInput>({});
	const [plan, setPlan] = useState<Plan | null>(null);

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

	return (
		<div id="skillOptimizer">
			<h1>Skill Optimizer</h1>
			<section class="optimizer-section">
				<h2>1. Select uma</h2>
				<UmaSelect onSelect={setSelection} />
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
