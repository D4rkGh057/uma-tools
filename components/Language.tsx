import { h, createContext } from 'preact';
import { useCallback, useContext, useState, useEffect } from 'preact/hooks';

import './Language.css';

function getDefaultLanguage() {
    return localStorage.getItem('language') || (navigator.language.startsWith('ja') ? 'ja' : 'en-ja');
}

export function useLanguageSelect() {
    const p = useState(getDefaultLanguage);
    useEffect(() => localStorage.setItem('language', p[0]), [p[0]]);
    return p;
}

// No default value is computed here: `createContext` runs at module load time, and
// `getDefaultLanguage()` must not touch `localStorage`/`navigator` until something actually
// consumes the language (see `useLanguage()` below), so callers outside a browser-like
// environment (e.g. the Node test harness) can import this module without it throwing.
export const Language = createContext(undefined as string | undefined);

export function useLanguage() {
    const language = useContext(Language);
    return language === undefined ? getDefaultLanguage() : language;
}

export function LanguageSelect(props) {
	const change = useCallback((e) => props.setLanguage(e.target.value), [props.setLanguage])

	return (
		<select class="langSelect" value={props.language} onChange={change}>
			<option value="en">English</option>
			<option value="ja">日本語</option>
			<option value="en-ja">English with Japanese skill names</option>
		</select>
	);
}
