// Roster import + uma picker. Read-only reuse of `rosterDecoder` (design decision #7) -- this file
// does not fork or reimplement roster decoding, only decode/localStorage-load calls and UI around them.
import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

import { decodeRoster, loadRoster, DecodedUma } from '../../umalator/rosterDecoder';
import { skillGroups, skillMeta } from '../optimizer/skillGroups';

import umas from '../../umas.json';
import icons from '../../icons.json';

// Same key UmasTab.tsx (umalator/components/UmasTab.tsx) uses -- localStorage is shared per-origin,
// so a roster already imported there shows up here automatically. This is just a shared string, not
// a reuse of any decoding logic.
const STORAGE_KEY = 'umas_tab_roster';

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

/**
 * Owned-tier index per groupId for one uma, derived the same way `optimize.ts`'s private
 * `ownedIndexByGroup` does. Duplicated (not imported) because that helper isn't exported from
 * optimize.ts and optimizer/*.ts is frozen for this PR -- see design decision #7's "re-derive
 * locally" precedent (skillGroups.ts). This is UI-layer glue, not optimizer logic: PR4 will call the
 * real `optimize()` with `uma.skills` directly, this is only for the baseline summary shown here.
 */
export function ownedTiersFromSkills(skills: Array<{ id: number; level: number }>): Map<string, number> {
	const owned = new Map<string, number>();
	for (const s of skills) {
		const idStr = String(s.id);
		const groupId = skillMeta[idStr]?.groupId;
		if (!groupId) continue;
		const tiers = skillGroups.get(groupId);
		const idx = tiers ? tiers.indexOf(idStr) : -1;
		if (idx < 0) continue;
		const best = owned.get(groupId) ?? -1;
		if (idx > best) owned.set(groupId, idx);
	}
	return owned;
}

export interface UmaSelection {
	uma: DecodedUma;
	/** groupId -> owned tier index (-1 = unowned tiers are simply absent). Consumed by PR4's
	 *  `optimize()` call indirectly via `uma.skills`; exposed directly here for display. */
	ownedTiers: Map<string, number>;
}

export interface UmaSelectProps {
	onSelect: (selection: UmaSelection | null) => void;
}

export function UmaSelect({ onSelect }: UmaSelectProps) {
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

	function selectUma(idx: number) {
		setSelectedIdx(idx);
		const uma = roster[idx];
		if (idx < 0 || !uma) {
			onSelect(null);
			return;
		}
		onSelect({ uma, ownedTiers: ownedTiersFromSkills(uma.skills) });
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
	);
}
