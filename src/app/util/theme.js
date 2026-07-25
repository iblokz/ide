'use strict';

const STORAGE_KEY = 'iblokz-ide-theme';
const THEME_MODES = ['light', 'dark'];

const themeClass = mode => `theme-${mode}`;

const parseStoredTheme = () => {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (THEME_MODES.includes(parsed.mode)) return parsed.mode;
		if (THEME_MODES.includes(raw)) return raw;
	} catch (_) {
		/* ignore */
	}
	return null;
};

const getInitialThemeMode = () => {
	const stored = parseStoredTheme();
	if (stored) return stored;
	if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
		return 'light';
	}
	return 'dark';
};

const serializeTheme = mode => JSON.stringify({mode});

const applyDocumentTheme = mode => {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	root.dataset.theme = mode;
	root.style.colorScheme = mode;
	root.classList.remove('theme-light', 'theme-dark');
	root.classList.add(`theme-${mode}`);
};

module.exports = {
	STORAGE_KEY,
	THEME_MODES,
	themeClass,
	getInitialThemeMode,
	serializeTheme,
	applyDocumentTheme
};
