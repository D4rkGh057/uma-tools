import type { MetaCommunityGuidance, MetaProfileReference } from './optimizer/profiles/types';
import { isCommunityGuidanceList } from './optimizer/profiles/guidanceValidation';

export const COMMUNITY_GUIDANCE_STORAGE_KEY = 'skill_optimizer_community_guidance';

interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

function profileKey(reference: MetaProfileReference): string {
	return `${reference.id}@${reference.version}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value != null && !Array.isArray(value);
}

function readStore(storage: StorageLike | null): Record<string, MetaCommunityGuidance[]> {
	if (!storage) return {};
	try {
		const raw = storage.getItem(COMMUNITY_GUIDANCE_STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!isRecord(parsed)) return {};
		const store: Record<string, MetaCommunityGuidance[]> = {};
		for (const [key, entries] of Object.entries(parsed)) if (isCommunityGuidanceList(entries)) store[key] = entries;
		return store;
	} catch {
		return {};
	}
}

export function loadCommunityGuidance(reference: MetaProfileReference, storage: StorageLike | null = browserStorage()): readonly MetaCommunityGuidance[] {
	return readStore(storage)[profileKey(reference)] ?? [];
}

export function addCommunityGuidance(reference: MetaProfileReference, entry: MetaCommunityGuidance, storage: StorageLike | null = browserStorage()): readonly MetaCommunityGuidance[] {
	const store = readStore(storage);
	const updated = [...(store[profileKey(reference)] ?? []), entry];
	store[profileKey(reference)] = updated;
	if (storage) {
		try {
			storage.setItem(COMMUNITY_GUIDANCE_STORAGE_KEY, JSON.stringify(store));
		} catch {
			// Persistence is optional: private browsing and quota errors must not affect the session's guidance list.
		}
	}
	return updated;
}
