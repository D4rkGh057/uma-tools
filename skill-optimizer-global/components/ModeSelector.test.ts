import test from 'node:test';
import assert from 'node:assert/strict';
import { modeLabel } from './ModeSelector';
import { profileProvenance } from './MetaMatchupPanel';
import { profileCatalog } from '../optimizer/profiles/catalog';
import { resultPanelStateContent } from './resultPanelState';

test('mode/profile UI state exposes Score, Team Trials availability, provenance, and invalid/migrated states', () => {
	assert.equal(modeLabel('Score'), 'Score');
	assert.equal(modeLabel('TeamTrials'), 'Team Trials (rankings unavailable)');
	assert.match(profileProvenance(profileCatalog[0]) ?? '', /cm-mile v2026.1.*Virgo Cup/);
	assert.match(resultPanelStateContent({ status: 'invalid', mode: 'Unknown', reason: 'Unsupported' }).message, /Invalid evaluation mode/);
	assert.match(resultPanelStateContent({ status: 'migrated', state: {} as never, selection: { mode: 'Score' } }).message, /migrated to Score/);
});
