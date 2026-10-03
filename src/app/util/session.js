/**
 * Per-project workspace session (layout, preview, open tabs).
 * Paths only — buffers are re-read from disk on restore.
 */
import {
	hashPath,
	extOf,
	fileKind,
	findIndexPathByFilePath,
	nodeAtIndexPath
} from './file-tree.js';

export const STORAGE_KEY = 'iblokz-ide-project-sessions';
export const MAX_SESSIONS = 24;
export const MAX_TAB_PATHS = 32;

let restoreToken = 0;
let restoreActive = false;

export const isSessionRestoring = () => restoreActive;

export const beginSessionRestore = () => {
	restoreActive = true;
	restoreToken += 1;
	return restoreToken;
};

export const endSessionRestore = (token) => {
	if (token == null || token === restoreToken) {
		restoreActive = false;
	}
};

export const sessionStillCurrent = token =>
	restoreActive && token === restoreToken;

export const sessionKey = project => {
	if (!project || typeof project !== 'object') return null;
	const key = project.path || project.id;
	return key && typeof key === 'string' ? key : null;
};

const sanitizeLayout = layout => {
	if (!layout || typeof layout !== 'object') return null;
	const toggles = layout.toggles && typeof layout.toggles === 'object'
		? Object.assign({}, layout.toggles)
		: null;
	const dim = layout.dim && typeof layout.dim === 'object'
		? Object.assign({}, layout.dim)
		: null;
	if (!toggles && !dim) return null;
	return {toggles: toggles || {}, dim: dim || {}};
};

const sanitizePreview = preview => {
	if (!preview || typeof preview !== 'object') return null;
	const mode = preview.mode === 'file' || preview.mode === 'url' || preview.mode === 'sandbox'
		? preview.mode
		: null;
	return {
		mode,
		url: typeof preview.url === 'string' ? preview.url : 'about:blank',
		input: typeof preview.input === 'string' ? preview.input : 'about:blank'
	};
};

const sanitizeTabPaths = paths => {
	if (!Array.isArray(paths)) return [];
	const out = [];
	const seen = new Set();
	paths.forEach(p => {
		if (typeof p !== 'string' || !p || seen.has(p)) return;
		seen.add(p);
		out.push(p);
	});
	return out.slice(0, MAX_TAB_PATHS);
};

export const sanitizeSession = raw => {
	if (!raw || typeof raw !== 'object') return null;
	return {
		layout: sanitizeLayout(raw.layout),
		preview: sanitizePreview(raw.preview),
		tabPaths: sanitizeTabPaths(raw.tabPaths),
		activePath: typeof raw.activePath === 'string' ? raw.activePath : null,
		savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now()
	};
};

const readMap = () => {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch (_) {
		return {};
	}
};

const writeMap = map => {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
	} catch (err) {
		console.warn('[session] save failed', err);
	}
};

export const loadSession = key => {
	if (!key) return null;
	const map = readMap();
	return sanitizeSession(map[key]);
};

export const saveSession = (key, session) => {
	if (!key) return;
	const clean = sanitizeSession(session);
	if (!clean) return;
	const map = readMap();
	map[key] = Object.assign({}, clean, {savedAt: Date.now()});
	const entries = Object.keys(map)
		.map(k => ({key: k, savedAt: (map[k] && map[k].savedAt) || 0}))
		.sort((a, b) => b.savedAt - a.savedAt);
	const next = {};
	entries.slice(0, MAX_SESSIONS).forEach(({key: k}) => {
		next[k] = map[k];
	});
	writeMap(next);
};

/** Snapshot of the bits we persist for the active workspace. */
export const serializeSession = state => {
	const tabs = (state && state.tabs) || [];
	const active = tabs.find(t => t && t.id === state.activeTabId);
	return sanitizeSession({
		layout: state && state.layout,
		preview: state && state.preview,
		tabPaths: tabs.map(t => t && t.file && t.file.path).filter(Boolean),
		activePath: (active && active.file && active.file.path) || null,
		savedAt: Date.now()
	});
};

export const fileStubFromPath = path => {
	const name = String(path || '').split(/[/\\]/).pop() || path;
	const ext = extOf(name);
	return {
		id: hashPath(path),
		name,
		path,
		ext,
		isDir: false,
		kind: fileKind(name, ext)
	};
};

export const resolveFileInTree = (filesTree, path) => {
	if (!path) return null;
	const indexPath = findIndexPathByFilePath(filesTree || [], path);
	if (!indexPath) return null;
	const node = nodeAtIndexPath(filesTree || [], indexPath);
	return node && !node.isDir ? node : null;
};

export default {
	STORAGE_KEY,
	MAX_SESSIONS,
	MAX_TAB_PATHS,
	isSessionRestoring,
	beginSessionRestore,
	endSessionRestore,
	sessionStillCurrent,
	sessionKey,
	sanitizeSession,
	loadSession,
	saveSession,
	serializeSession,
	fileStubFromPath,
	resolveFileInTree
};
