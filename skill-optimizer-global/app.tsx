import { h, render } from 'preact';
import { useMemo, useState } from 'preact/hooks';

import './app.css';

import { UmaSelect, UmaSelection } from './components/UmaSelect';
import { BudgetRaceInputs, BudgetRaceInputsValue } from './components/BudgetRaceInputs';
import { HintTable } from './components/HintTable';
import { ResultPanel } from './components/ResultPanel';
import { optimize } from './optimizer/optimize';
import { HintInput, OptimizeInput, Plan } from './optimizer/types';

// PR4 scope (sdd/skill-optimizer/tasks Phase 4): wire the input panels' state into
// `optimizer/optimize.ts`'s `OptimizeInput` and render the result via `ResultPanel`.
function App() {
	const [selection, setSelection] = useState<UmaSelection | null>(null);
	const [budgetRace, setBudgetRace] = useState<BudgetRaceInputsValue>({ budget: 0 });
	const [hints, setHints] = useState<HintInput>({});

	// `selection.uma.skills` is exactly the shape `OptimizeInput.ownedSkills` expects (design decision
	// #7 precedent, confirmed by PR3's UmaSelect.tsx) -- passed straight through, no reshaping.
	const optimizeInput: OptimizeInput | null = useMemo(() => {
		if (!selection) return null;
		return {
			ownedSkills: selection.uma.skills,
			budget: budgetRace.budget,
			hints,
			raceContext: budgetRace.raceContext,
		};
	}, [selection, budgetRace, hints]);

	const plan: Plan | null = useMemo(
		() => (optimizeInput ? optimize(optimizeInput) : null),
		[optimizeInput]
	);

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
				<ResultPanel input={optimizeInput} plan={plan} />
			</section>
		</div>
	);
}

render(<App />, document.getElementById('app'));
