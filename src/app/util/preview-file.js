/** Active buffer types that offer an in-app file preview. */
const kindFromExt = value => {
	const t = String(value || '').toLowerCase().replace(/^\./, '');
	if (t === 'md' || t === 'markdown' || t === 'mdown' || t === 'mkd') return 'markdown';
	if (t === 'svg') return 'svg';
	if (t === 'pdf') return 'pdf';
	return null;
};

const extFromName = name => {
	const base = String(name || '').split(/[/\\]/).pop() || '';
	const i = base.lastIndexOf('.');
	return i > 0 ? base.slice(i + 1) : '';
};

const posix = p => String(p || '').replace(/\\/g, '/');

const isWindowsAbs = s => /^[a-zA-Z]:\//.test(s);

const hasUrlScheme = s => /^[a-z][a-z0-9+.-]*:/i.test(s) && !isWindowsAbs(s);

const dirname = p => {
	const s = posix(p).replace(/\/+$/, '');
	const i = s.lastIndexOf('/');
	if (i <= 0) return i === 0 ? '/' : '';
	return s.slice(0, i);
};

/** Collapse `.` / `..` while preserving a leading `/` or Windows drive. */
const normalizePath = path => {
	const s = posix(path);
	if (!s) return '';
	const win = /^([a-zA-Z]:)(\/.*)?$/.exec(s);
	const absUnix = !win && s.startsWith('/');
	const body = win ? (win[2] || '/') : s;
	const out = [];
	for (const part of body.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (out.length) out.pop();
			else if (!win && !absUnix) out.push('..');
			continue;
		}
		out.push(part);
	}
	if (win) return `${win[1]}/${out.join('/')}`;
	if (absUnix) return `/${out.join('/')}`;
	return out.join('/');
};

/**
 * Classify a markdown `href` for preview navigation.
 * @returns {{kind: 'fragment'|'external'|'path', path?: string}}
 */
export const classifyMarkdownHref = href => {
	const raw = String(href || '').trim();
	if (!raw || raw.startsWith('#')) return {kind: 'fragment'};
	if (hasUrlScheme(raw)) return {kind: 'external'};
	const pathPart = raw.split('#')[0].split('?')[0];
	if (!pathPart) return {kind: 'fragment'};
	return {kind: 'path', path: pathPart};
};

/**
 * Resolve a relative (or absolute) markdown href against the open file path.
 */
export const resolveMarkdownPath = (baseFilePath, hrefPath) => {
	const target = posix(hrefPath);
	if (!target) return null;
	if (isWindowsAbs(target) || target.startsWith('/')) {
		return normalizePath(target);
	}
	const base = posix(baseFilePath);
	if (!base) return normalizePath(target);
	const dir = dirname(base);
	return normalizePath(dir ? `${dir}/${target}` : target);
};

/** Preferred index docs when a markdown link points at a directory. */
export const DIR_INDEX_NAMES = ['README.md', 'readme.md', 'index.md'];

export const joinDirFile = (dirPath, name) => {
	const d = posix(dirPath).replace(/\/+$/, '');
	const n = String(name || '');
	if (!d) return n;
	if (!n) return d;
	return `${d}/${n}`;
};

/**
 * Pick README.md / readme.md / index.md from a directory listing.
 * Exact names first (in priority order), then case-insensitive fallback.
 */
export const pickDirIndexFromChildren = (children = []) => {
	const files = (children || []).filter(f => f && !f.isDir && f.name);
	for (let i = 0; i < DIR_INDEX_NAMES.length; i++) {
		const name = DIR_INDEX_NAMES[i];
		const hit = files.find(f => f.name === name);
		if (hit) return hit;
	}
	for (let i = 0; i < DIR_INDEX_NAMES.length; i++) {
		const lower = DIR_INDEX_NAMES[i].toLowerCase();
		const hit = files.find(f => String(f.name).toLowerCase() === lower);
		if (hit) return hit;
	}
	return null;
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
 *
 * Prefer `documentElement`: `applyDocumentTheme` updates it before the UI
 * patch, while `body.app` still has the previous theme class during vnode build.
 * When called from iframe hooks (after body patch), either node is fine.
 */
export const snapshotPreviewTheme = (mode = 'dark') => {
	const resolved = mode === 'light' ? 'light' : 'dark';
	let vars = '';
	if (typeof document !== 'undefined') {
		const el = document.documentElement;
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

/**
 * Remove script tags before writing sandboxed srcdoc (no allow-scripts).
 * Mermaid SVG output often embeds scripts that would only log a console block.
 */
export const stripSrcdocScripts = html => String(html || '')
	.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
	.replace(/<script\b[^>]*\/?>/gi, '');

export default {
	filePreviewKind,
	snapshotPreviewTheme,
	stripSrcdocScripts,
	classifyMarkdownHref,
	resolveMarkdownPath,
	DIR_INDEX_NAMES,
	joinDirFile,
	pickDirIndexFromChildren
};
