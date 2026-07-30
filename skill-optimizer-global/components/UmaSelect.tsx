// Roster import + uma picker, plus a manual-entry path switch (spec domain: manual-uma-entry, "Manual
// Entry As Equal Alternative To Roster Import"). Read-only reuse of `rosterDecoder` (design decision
// #7) -- this file does not fork or reimplement roster decoding, only decode/localStorage-load calls
// and UI around them.
import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

import { decodeRoster, loadRoster, DecodedUma } from '../../umalator/rosterDecoder';

import { ManualUmaEntry } from './ManualUmaEntry';
import { fromDecodedUma, ownedTiersFromSkills, UmaInput } from './umaInput';

import umas from '../../umas.json';
import icons from '../../icons.json';

// Same key UmasTab.tsx (umalator/components/UmasTab.tsx) uses -- localStorage is shared per-origin,
// so a roster already imported there shows up here automatically. This is just a shared string, not
// a reuse of any decoding logic.
const STORAGE_KEY = 'umas_tab_roster';

// Re-exported so ResultPanel.tsx's existing `import { ownedTiersFromSkills } from './UmaSelect'` stays
// valid unchanged -- the canonical definition now lives in ./umaInput (shared with fromDecodedUma /
// fromManualForm), not duplicated here anymore.
export { ownedTiersFromSkills } from './umaInput';

function getCharInfo(cardId: number): { charName: string; outfitName: string } {
	const charId = String(Math.floor(cardId / 100));
	const outfitId = String(cardId);
	const character = (umas as any)[charId];
	const charName = character?.name?.[1] ?? `Unknown (${charId})`;
	const outfitName = character?.outfits?.[outfitId] ?? '';
	return { charName, outfitName };
}

function getCharIcon(cardId: number): string {
	const outfitId = String(cardId);
	const charId = String(Math.floor(cardId / 100));
	return (icons as any)[outfitId] ?? (icons as any)[charId] ?? '/uma-tools/icons/utx_ico_umamusume_00.png';
}

export interface UmaSelectProps {
	onSelect: (input: UmaInput | null) => void;
}

type EntryPath = 'roster' | 'manual';

export function UmaSelect({ onSelect }: UmaSelectProps) {
	const [path, setPath] = useState<EntryPath>('roster');

	const [roster, setRoster] = useState<DecodedUma[]>(() => []);
	const [selectedIdx, setSelectedIdx] = useState(-1);
	const [inputValue, setInputValue] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const decoded = await loadRoster(raw);
					if (decoded.length > 0) setRoster(decoded);
				}
			} catch {
				// ignore -- roster stays empty, user can paste manually
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	// Switching path discards the other path's data first, never merges it (spec: "Single Converged Uma
	// Shape, No Silent Merge"). The roster side resets its own selection here; the manual side's local
	// state is discarded for free by unmounting <ManualUmaEntry> below (conditional rendering).
	function switchPath(next: EntryPath) {
		if (next === path) return;
		setPath(next);
		setSelectedIdx(-1);
		onSelect(null);
	}

	function selectUma(idx: number) {
		setSelectedIdx(idx);
		const uma = roster[idx];
		if (idx < 0 || !uma) {
			onSelect(null);
			return;
		}
		const { charName, outfitName } = getCharInfo(uma.card_id);
		onSelect(fromDecodedUma(uma, `${charName} ${outfitName}`.trim()));
	}

	const handleImport = useCallback(async () => {
		if (!inputValue.trim()) return;
		setError('');
		try {
			const decoded = await decodeRoster(inputValue);
			if (decoded.length === 0) {
				setError('Could not decode -- please check the URL or code and try again.');
				return;
			}
			setRoster(decoded);
			setInputValue('');
			setSelectedIdx(-1);
			onSelect(null);
		} catch (e: any) {
			setError('Decode failed: ' + (e?.message ?? 'Unknown error'));
		}
	}, [inputValue, onSelect]);

	const selected = selectedIdx >= 0 ? roster[selectedIdx] : null;
	const selectedTierCount = selected ? ownedTiersFromSkills(selected.skills).size : 0;

	return (
		<div class="uma-select">
			<div class="uma-select-path-switch">
				<button type="button" class={path === 'roster' ? 'active' : ''} onClick={() => switchPath('roster')}>
					Import roster
				</button>
				<button type="button" class={path === 'manual' ? 'active' : ''} onClick={() => switchPath('manual')}>
					Enter manually
				</button>
			</div>

			{path === 'roster' && (
				<div class="uma-select-roster">
					<div class="uma-select-import">
						<input
							type="text"
							placeholder="Paste your roster URL or code from roster.uma.guide…"
							value={inputValue}
							onInput={e => setInputValue((e.target as HTMLInputElement).value)}
							onKeyDown={e => { if (e.key === 'Enter') handleImport(); }}
						/>
						<button type="button" onClick={handleImport}>Load roster</button>
					</div>
					{error && <div class="uma-select-error">{error}</div>}
					{loading && <div class="uma-select-status">Loading saved roster…</div>}
					{!loading && roster.length === 0 && (
						<div class="uma-select-status">No roster loaded yet. Paste a URL or code above.</div>
					)}
					{roster.length > 0 && (
						<select
							class="uma-select-dropdown"
							value={selectedIdx}
							onChange={e => selectUma(+(e.target as HTMLSelectElement).value)}
						>
							<option value={-1}>-- Select an uma --</option>
							{roster.map((uma, i) => {
								const { charName, outfitName } = getCharInfo(uma.card_id);
								return (
									<option key={`${uma.card_id}-${i}`} value={i}>
										{charName} {outfitName}
									</option>
								);
							})}
						</select>
					)}
					{selected && (
						<div class="uma-select-summary">
							<img class="uma-select-icon" src={getCharIcon(selected.card_id)} loading="lazy" />
							<span>Owned skill tiers: {selectedTierCount} group(s), {selected.skills.length} total skills</span>
						</div>
					)}
				</div>
			)}

			{path === 'manual' && <ManualUmaEntry onChange={onSelect} />}
		</div>
	);
}
