'use strict';

/** VS Code–aligned defaults when Electron settings.yml is unavailable (web / Cap). */
const DEFAULTS = {
	windows: {
		singleInstance: false
	},
	editor: {
		enablePreview: true,
		enablePreviewFromQuickOpen: true,
		openPositioning: 'right'
	}
};

const isPlainObject = value =>
	value != null && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base, over) => {
	if (!isPlainObject(base)) return over != null ? over : base;
	if (!isPlainObject(over)) return base;
	const out = Object.assign({}, base);
	Object.keys(over).forEach(key => {
		out[key] = isPlainObject(base[key]) && isPlainObject(over[key])
			? deepMerge(base[key], over[key])
			: over[key];
	});
	return out;
};

let cached = null;

/** Merged app settings (Electron YAML via preload, else hardcoded defaults). */
const getAppSettings = () => {
	if (cached) return cached;
	let raw = null;
	try {
		if (typeof window !== 'undefined' && window.app
			&& typeof window.app.getSettingsSync === 'function') {
			raw = window.app.getSettingsSync();
		}
	} catch (_) {
		raw = null;
	}
	cached = deepMerge(DEFAULTS, isPlainObject(raw) ? raw : {});
	return cached;
};

const getEditorSettings = () => getAppSettings().editor || DEFAULTS.editor;

/**
 * Resolve open mode for a file open gesture.
 * @param {'tree'|'quickOpen'|'pin'|'session'} source
 * @returns {'audition'|'pinned'}
 */
const resolveOpenMode = source => {
	const editor = getEditorSettings();
	if (source === 'pin' || source === 'session') return 'pinned';
	if (!editor.enablePreview) return 'pinned';
	if (source === 'quickOpen' && !editor.enablePreviewFromQuickOpen) return 'pinned';
	return 'audition';
};

const getOpenPositioning = () => {
	const pos = getEditorSettings().openPositioning;
	return typeof pos === 'string' && pos ? pos : 'right';
};

module.exports = {
	DEFAULTS,
	getAppSettings,
	getEditorSettings,
	resolveOpenMode,
	getOpenPositioning
};
