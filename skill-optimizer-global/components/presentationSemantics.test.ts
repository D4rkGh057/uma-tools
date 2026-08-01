import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (file: string) => readFileSync(resolve(process.cwd(), 'skill-optimizer-global', file), 'utf8');

test('editable selection controls expose names, selected state, and feedback roles', () => {
	const umaSelect = source('components/UmaSelect.tsx');
	const manualEntry = source('components/ManualUmaEntry.tsx');

	assert.match(umaSelect, /aria-pressed=\{path === 'roster'\}/);
	assert.match(umaSelect, /aria-pressed=\{path === 'manual'\}/);
	assert.match(umaSelect, /aria-label="Roster URL or code"/);
	assert.match(umaSelect, /role="alert"/);
	assert.match(umaSelect, /role="status"/);
	assert.match(umaSelect, /alt=\{`\$\{getCharInfo\(selected\.card_id\)\.charName\} portrait`\}/);
	assert.match(manualEntry, /<fieldset class="manual-uma-stats">/);
	assert.match(manualEntry, /<legend>Build stats<\/legend>/);
	assert.match(manualEntry, /aria-label=\{`Remove skill \$\{s\.id\}`\}/);
});

test('editable budget, hint, and mode controls expose grouped labels and responsive states', () => {
	const budgetRace = source('components/BudgetRaceInputs.tsx');
	const hints = source('components/HintTable.tsx');
	const mode = source('components/ModeSelector.tsx');
	const css = source('app.css');

	assert.match(budgetRace, /<fieldset class="race-context">/);
	assert.match(budgetRace, /<legend>Target race<\/legend>/);
	assert.match(hints, /<caption>Skill hint levels<\/caption>/);
	assert.match(hints, /aria-label=\{`Hint level for \$\{getSkillName\(skillId\)\}`\}/);
	assert.match(hints, /aria-label=\{`Remove hint for \$\{getSkillName\(skillId\)\}`\}/);
	assert.match(mode, /aria-describedby="mode-help"/);
	assert.match(mode, /id="mode-help"/);
	assert.match(css, /\.uma-select-path-switch button\[aria-pressed="true"\]/);
	assert.match(css, /#skillOptimizer input:invalid/);
	assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.race-context-fields/);
});
