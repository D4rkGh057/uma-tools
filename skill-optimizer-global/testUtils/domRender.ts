// Test-only DOM rendering infra (R9.2). Preact's function components that call hooks
// (useState/useEffect/useCallback/useMemo, etc.) can only be exercised through a real
// `preact.render()` pass -- hook state lives on the component instance the diffing algorithm is
// currently visiting, which is never set up for a bare function call (see the comment in
// presentationSemantics.test.ts documenting the exact failure). `linkedom` provides a real,
// spec-compliant DOM implementation without a browser, so `preact.render()` can run against it in
// this Node test harness. Import this module wherever a test needs to render a hook-using
// component; do not add behavioral assertions here -- this file is infra only.
import { render, VNode } from 'preact';
import { parseHTML } from 'linkedom';

// Preact's own `render()` reads the *global* `document` directly (e.g. to create new text/element
// nodes and to special-case rendering into `document` itself) -- it is not passed the container's
// owner document, so a global `document` must exist before any render happens. linkedom implements
// the DOM but not every Web platform global: it provides no `document`/`window` globals by itself,
// and some production modules also read `localStorage`/fully-populated `navigator` outside of a
// render pass (see components/Language.tsx's lazy-init). Install all of these once, idempotently,
// so importing this module repeatedly (once per test file) never clobbers state another test using
// it already set up.
let sharedDocument: ReturnType<typeof parseHTML>['document'] | undefined;

function installGlobals(): ReturnType<typeof parseHTML>['document'] {
	if (sharedDocument) return sharedDocument;

	const { document } = parseHTML('<!doctype html><html><body></body></html>');
	sharedDocument = document;

	const g = globalThis as Record<string, unknown>;
	g.document = document;
	if (typeof g.window === 'undefined') g.window = document.defaultView;

	if (typeof g.localStorage === 'undefined') {
		const store = new Map<string, string>();
		g.localStorage = {
			getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
			setItem: (key: string, value: string) => { store.set(key, String(value)); },
			removeItem: (key: string) => { store.delete(key); },
			clear: () => { store.clear(); },
			key: (index: number) => Array.from(store.keys())[index] ?? null,
			get length() { return store.size; },
		};
	}

	const navigator = g.navigator as { language?: string } | undefined;
	if (!navigator || !navigator.language) {
		g.navigator = { ...(navigator ?? {}), language: 'en' };
	}

	return document;
}

/**
 * Renders `vnode` via a real `preact.render()` call into a fresh element appended to a shared
 * `linkedom` document, returning the container element it was rendered into. Each call gets its
 * own container element so repeated calls (e.g. across tests in the same file) never leak
 * rendered DOM content into one another.
 */
export function renderToContainer(vnode: VNode<unknown> | null): Element {
	const document = installGlobals();
	const container = document.createElement('div') as unknown as Element;
	document.body.appendChild(container as never);
	render(vnode as VNode<unknown>, container);
	return container;
}
