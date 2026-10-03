'use strict';

const STORAGE_KEY = 'iblokz-ide-theme';
const THEME_FAMILY = 'ide';
const THEME_MODES = ['light', 'dark'];

/** Token keys we may set from host theme (without --app- prefix). */
const HOST_VAR_KEYS = [
	'bg-page',
	'bg-panel',
	'bg-muted',
	'bg-hover',
	'bg-header-formed',
	'panel-shadow',
	'text',
	'text-hover',
	'text-muted',
	'text-strong',
	'text-on-accent',
	'shadow',
	'shadow-soft',
	'border',
	'accent',
	'accent-soft',
	'danger',
	'btn-primary-bg',
	'btn-primary-text',
	'btn-secondary-bg',
	'btn-secondary-text',
	'btn-secondary-border',
	'input-bg',
	'input-border',
	'input-text',
	'editor-bg',
	'editor-text',
	'console-bg',
	'icon',
	'icon-hover',
	'arrow-fill',
	'control-border-formed',
	'control-bg-formed'
];

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

const readHostTheme = () => {
	if (typeof window === 'undefined') return null;
	const api = window.app;
	if (!api || typeof api.getHostThemeSync !== 'function') return null;
	try {
		const host = api.getHostThemeSync();
		if (host && THEME_MODES.includes(host.mode)) return host;
	} catch (_) {
		/* ignore */
	}
	return null;
};

const getInitialThemeMode = () => {
	const host = readHostTheme();
	// Omarchy `mode` drives light/dark (syntax highlight + chrome) when present.
	if (host && host.source === 'omarchy' && THEME_MODES.includes(host.mode)) {
		return host.mode;
	}
	const stored = parseStoredTheme();
	if (stored) return stored;
	if (host) return host.mode;
	if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
		return 'light';
	}
	return 'dark';
};

/** Whether host theme changes should update app light/dark mode. */
const shouldFollowHostMode = host => {
	if (!host || !THEME_MODES.includes(host.mode)) return false;
	if (host.source === 'omarchy') return true;
	return parseStoredTheme() == null;
};


const serializeTheme = mode => JSON.stringify({mode});

const persistThemeMode = mode => {
	if (typeof localStorage === 'undefined' || !THEME_MODES.includes(mode)) return;
	localStorage.setItem(STORAGE_KEY, serializeTheme(mode));
};

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

/** Resolve host → CSS custom-property map for snabbdom `style` (keys like `--app-accent`). */
const hostStyleProps = host => {
	let vars = host && host.vars;
	if (!vars && host && host.accent) {
		vars = {
			accent: host.accent,
			'accent-soft': host.accentSoft,
			'btn-primary-bg': host.accent
		};
	}
	if (!vars) return null;
	const style = {};
	Object.keys(vars).forEach(key => {
		const value = vars[key];
		if (value == null || value === '') return;
		style[`--app-${key}`] = value;
	});
	return Object.keys(style).length ? style : null;
};

const clearHostVars = el => {
	HOST_VAR_KEYS.forEach(key => {
		el.style.removeProperty(`--app-${key}`);
	});
};

/**
 * Apply host palette on <html> only (early paint / before body.app mounts).
 * body.app vars must go through snabbdom `style` via hostStyleProps — otherwise
 * the attributes module strips the style attribute on the first patch.
 */
const applyHostAccent = host => {
	if (typeof document === 'undefined' || !document.documentElement) return;
	const root = document.documentElement;
	clearHostVars(root);
	const style = hostStyleProps(host);
	if (!style) return;
	Object.keys(style).forEach(prop => {
		root.style.setProperty(prop, style[prop]);
	});
};

module.exports = {
	STORAGE_KEY,
	THEME_FAMILY,
	THEME_MODES,
	HOST_VAR_KEYS,
	themeClass,
	themeModeClass,
	parseStoredTheme,
	readHostTheme,
	getInitialThemeMode,
	shouldFollowHostMode,
	serializeTheme,
	persistThemeMode,
	applyDocumentTheme,
	hostStyleProps,
	applyHostAccent
};
