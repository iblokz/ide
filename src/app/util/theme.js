'use strict';

const STORAGE_KEY = 'iblokz-ide-theme';
const THEME_FAMILY = 'ide';
const THEME_MODES = ['light', 'dark'];

const themeClass = mode => `theme-${THEME_FAMILY}-${mode}`;
const themeModeClass = mode => `theme-mode-${mode}`;

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
	[...root.classList]
		.filter(c => c.startsWith('theme-'))
		.forEach(c => root.classList.remove(c));
	root.classList.add(themeClass(mode), themeModeClass(mode));
};

module.exports = {
	STORAGE_KEY,
	THEME_FAMILY,
	THEME_MODES,
	themeClass,
	themeModeClass,
	getInitialThemeMode,
	serializeTheme,
	applyDocumentTheme
};
