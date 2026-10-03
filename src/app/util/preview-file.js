/** Active buffer types that offer an in-app file preview. */
const kindFromExt = value => {
	const t = String(value || '').toLowerCase().replace(/^\./, '');
	if (t === 'md' || t === 'markdown' || t === 'mdown' || t === 'mkd') return 'markdown';
	if (t === 'svg') return 'svg';
	return null;
};

const extFromName = name => {
	const base = String(name || '').split(/[/\\]/).pop() || '';
	const i = base.lastIndexOf('.');
	return i > 0 ? base.slice(i + 1) : '';
};

/**
 * Resolve preview kind from buffer `type` and/or the open file name/path.
 * (`type` can be wrong when `file.ext` was falsy and fell back to `js`.)
 */
export const filePreviewKind = (type, file) => {
	const fromType = kindFromExt(type);
	if (fromType) return fromType;
	if (!file) return null;
	return kindFromExt(file.ext)
		|| kindFromExt(extFromName(file.name))
		|| kindFromExt(extFromName(file.path));
};

/** CSS custom properties mirrored into file-preview iframes. */
const PREVIEW_THEME_VARS = [
	'--app-bg-page',
	'--app-bg-panel',
	'--app-bg-muted',
	'--app-bg-hover',
	'--app-text',
	'--app-text-muted',
	'--app-text-strong',
	'--app-accent',
	'--app-accent-soft',
	'--app-border',
	'--app-editor-bg',
	'--app-editor-text',
	'--app-input-bg',
	'--app-input-border',
	'--app-input-text'
];

/**
 * Snapshot live `--app-*` tokens from the host document so srcdoc iframes
 * can use the same palette (CSS variables do not cross iframe boundaries).
 */
export const snapshotPreviewTheme = (mode = 'dark') => {
	const resolved = mode === 'light' ? 'light' : 'dark';
	let vars = '';
	if (typeof document !== 'undefined') {
		const el = document.querySelector('body.app') || document.documentElement;
		const cs = getComputedStyle(el);
		vars = PREVIEW_THEME_VARS
			.map(name => {
				const value = cs.getPropertyValue(name).trim();
				return value ? `${name}: ${value};` : '';
			})
			.filter(Boolean)
			.join('\n\t');
	}
	return {mode: resolved, vars};
};

export default {filePreviewKind, snapshotPreviewTheme};
