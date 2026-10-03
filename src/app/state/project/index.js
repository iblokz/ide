import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {
	mergeAt,
	isImageFile,
	fileKind,
	collectExpandedPaths,
	reapplyExpandedPaths
} from '../../util/file-tree';
import {pushRecent} from '../../util/recent';
import {
	sessionKey,
	loadSession,
	beginSessionRestore,
	endSessionRestore,
	sessionStillCurrent,
	fileStubFromPath,
	resolveFileInTree
} from '../../util/session.js';
import {getFs, probeCapabilities, resetFs} from '../../services/fs';
import {
	emptyTabFields,
	createTextTab,
	createImageTab,
	projectActive,
	mapActiveTab,
	upsertTab,
	findTabIndexByPath,
	activateTabId
} from '../../util/tabs';
import {initial as layoutInitial} from '../layout/index.js';
import {initial as previewInitial} from '../preview/index.js';
import find from '../find';
import fileSearch from '../file-search';

const emptyFind = find.initial || {open: false, query: '', caseSensitive: false};
const emptyFileSearch = fileSearch.initial || {
	open: false,
	query: '',
	activeIndex: 0,
	index: null,
	indexPath: null,
	indexing: false
};

/** Open-project pointer (`null` fields = no folder). Nested under `state.project`. */
export const initial = {
	id: null,
	name: null,
	path: null
};

const revokeFileUrl = file => {
	if (!file || !file.url) return;
	const fs = getFs();
	if (typeof fs.revokeObjectUrl === 'function') {
		fs.revokeObjectUrl(file.url);
	}
};

const clearFileSearchUi = state => obj.patch(
	state,
	'fileSearch',
	Object.assign({}, state.fileSearch || emptyFileSearch, {
		open: false,
		query: '',
		activeIndex: 0
	})
);

/** Clear tabs / find UI when opening or switching project. */
const clearOpenFile = state => {
	((state && state.tabs) || []).forEach(tab => {
		revokeFileUrl(tab && tab.file);
	});
	return Object.assign({}, emptyTabFields(), {
		tabs: [],
		activeTabId: null,
		find: emptyFind,
		fileSearch: emptyFileSearch
	});
};

const loadFile = file => state => clearFileSearchUi(upsertTab(state, createTextTab(file)));

const loadImage = file => state => clearFileSearchUi(upsertTab(state, createImageTab(file)));

const openImage = file => {
	if (typeof file.url === 'string' && file.url) {
		return loadImage(file);
	}
	const fs = getFs();
	if (typeof fs.getObjectUrl !== 'function') {
		console.error('getObjectUrl not available on FS backend', fs.id);
		return state => state;
	}
	return fs.getObjectUrl(file)
		.then(url => loadImage(Object.assign({}, file, {url, kind: 'image'})))
		.catch(err => {
			console.error('openImage failed', file && file.path, err);
			return state => state;
		});
};

export const openFile = file => {
	if (!file || file.isDir) return state => state;

	const kind = file.kind || fileKind(file.name, file.ext);
	if (kind === 'image' || isImageFile(file.name, file.ext)) {
		return openImage(file);
	}
	if (kind === 'binary' || file.readable === false) {
		return state => state;
	}
	if (typeof file.source === 'string') return loadFile(file);

	const fs = getFs();
	return fs.readFile(file)
		.then(source => {
			if (typeof source !== 'string') {
				throw new Error('File read did not return text');
			}
			return loadFile(Object.assign({}, file, {source, kind: 'text'}));
		})
		.catch(err => {
			console.error('openFile failed', file && file.path, err);
			return state => state;
		});
};

export const toggleFolder = (path = [], item) => {
	if (!item || !item.isDir) return state => state;

	const patchTree = (state, patch) => obj.patch(
		state,
		'filesTree',
		mergeAt({
			list: obj.sub(state, 'filesTree') || [],
			path,
			nodesProp: 'files',
			patch
		})
	);

	if (item.expanded) {
		return state => patchTree(state, {expanded: false});
	}

	if (item.childrenLoaded) {
		return state => patchTree(state, {expanded: true});
	}

	const fs = getFs();
	if (typeof fs.listDir !== 'function') {
		return state => patchTree(state, {expanded: true, childrenLoaded: true});
	}

	return fs.listDir(item)
		.then(files => state => patchTree(state, {
			expanded: true,
			childrenLoaded: true,
			files: files || []
		}))
		.catch(err => {
			console.error('listDir failed', item && item.path, err);
			return state => state;
		});
};

const layoutFromSession = (state, session) => {
	if (session && session.layout) {
		return {
			toggles: Object.assign({}, layoutInitial.toggles, session.layout.toggles || {}),
			dim: Object.assign({}, layoutInitial.dim, (state.layout && state.layout.dim) || {}, session.layout.dim || {})
		};
	}
	return {
		toggles: Object.assign({}, layoutInitial.toggles, state.layout && state.layout.toggles, {
			leftSideBar: true
		}),
		dim: Object.assign({}, layoutInitial.dim, state.layout && state.layout.dim)
	};
};

const previewFromSession = session => {
	if (session && session.preview) {
		return Object.assign({}, previewInitial, {
			mode: session.preview.mode,
			url: session.preview.url,
			input: session.preview.input,
			reloadToken: 0
		});
	}
	return Object.assign({}, previewInitial);
};

/** Re-open saved tab paths after project switch (disk read; skips missing files). */
const restoreSessionTabs = async (session, filesTree, token) => {
	const paths = (session && session.tabPaths) || [];
	if (!paths.length) {
		endSessionRestore(token);
		return;
	}
	const activePath = session.activePath;
	const ordered = activePath
		? paths.filter(p => p !== activePath).concat([activePath])
		: paths.slice();

	try {
		for (let i = 0; i < ordered.length; i++) {
			if (!sessionStillCurrent(token)) return;
			const path = ordered[i];
			const node = resolveFileInTree(filesTree, path) || fileStubFromPath(path);
			if (!node || node.isDir || node.readable === false) continue;
			try {
				const result = openFile(node);
				const reducer = (result && typeof result.then === 'function')
					? await result
					: result;
				if (!sessionStillCurrent(token)) return;
				if (typeof reducer === 'function') dispatch(reducer);
			} catch (err) {
				console.warn('[session] tab restore skipped', path, err);
			}
		}
		if (activePath && sessionStillCurrent(token)) {
			dispatch(state => {
				const tabs = state.tabs || [];
				const tab = tabs.find(t => t && t.file && t.file.path === activePath);
				if (!tab) return state;
				return activateTabId(state, tab.id);
			});
		}
	} finally {
		endSessionRestore(token);
	}
};

const applyProjectResult = (fs, result) => {
	const recentRoots = pushRecent({
		id: result.id,
		name: result.name,
		path: result.path
	});
	const key = sessionKey(result);
	const session = loadSession(key);
	const token = beginSessionRestore();
	queueMicrotask(() => {
		restoreSessionTabs(session, result.filesTree || [], token);
	});

	return state => Object.assign({}, state, clearOpenFile(state), {
		view: 'workspace',
		fsBackend: fs.id,
		canOpenFolder: true,
		canWrite: result.writable === true,
		projectAccess: result.access || (result.writable ? 'fsa-rw' : 'input'),
		project: {
			id: result.id,
			name: result.name,
			path: result.path
		},
		filesTree: result.filesTree,
		recentRoots,
		layout: layoutFromSession(state, session),
		preview: previewFromSession(session)
	});
};

export const openFolder = () => {
	const fs = getFs();
	if (!fs.canOpenFolder) {
		return Promise.resolve(state => Object.assign({}, state, probeCapabilities()));
	}
	return fs.openFolder()
		.then(result => {
			if (!result) return state => Object.assign({}, state, probeCapabilities());
			return applyProjectResult(fs, result);
		})
		.catch(err => {
			console.error(err);
			return state => Object.assign({}, state, probeCapabilities());
		});
};

export const openRecent = root => {
	const fs = getFs();
	if (!root || !root.path) {
		return openFolder();
	}
	if (typeof fs.openFolderByPath === 'function') {
		return fs.openFolderByPath(root.path, root)
			.then(result => {
				if (!result) return openFolder();
				return applyProjectResult(fs, result);
			})
			.catch(err => {
				console.error('openRecent failed', root.path, err);
				return openFolder();
			});
	}
	return openFolder();
};

export const refreshFilesTree = (project, prevTree) => {
	const fs = getFs();
	if (!project || !project.path || typeof fs.listDir !== 'function') {
		return state => state;
	}
	const expandedPaths = collectExpandedPaths(prevTree || []);
	const rootNode = {
		id: project.id,
		name: project.name,
		path: project.path,
		isDir: true
	};
	return fs.listDir(rootNode)
		.then(files => {
			const baseTree = [{
				id: project.id,
				name: project.name,
				path: project.path,
				isDir: true,
				ext: false,
				expanded: true,
				childrenLoaded: true,
				files: files || []
			}];
			return reapplyExpandedPaths(fs, baseTree, expandedPaths, project.path)
				.then(filesTree => state => Object.assign({}, state, {
					filesTree,
					fileSearch: Object.assign({}, state.fileSearch || emptyFileSearch, {
						index: null,
						indexPath: null,
						indexing: false
					})
				}));
		})
		.catch(err => {
			console.error('refreshFilesTree failed', project.path, err);
			return state => state;
		});
};

export const markExternalChange = filePath => state => {
	if (!filePath) return state;
	const tabs = state.tabs || [];
	const idx = findTabIndexByPath(tabs, filePath);
	if (idx < 0) return state;
	const tab = tabs[idx];
	if (!tab.dirty) return state;
	const nextTabs = tabs.slice();
	nextTabs[idx] = Object.assign({}, tab, {externalChange: filePath});
	return projectActive(Object.assign({}, state, {tabs: nextTabs}));
};

export const refreshFsCapabilities = () => state => {
	resetFs();
	return Object.assign({}, state, probeCapabilities());
};

export const saveFile = (file, source, pickedHandle) => {
	const fs = getFs();
	if (!file || fs.id === 'memory') {
		return Promise.resolve(state => state);
	}
	return fs.writeFile(file, source, pickedHandle)
		.then(result => state => {
			const path = file.path;
			const tabs = state.tabs || [];
			const idx = findTabIndexByPath(tabs, path);
			if (idx < 0) {
				return Object.assign({}, state, {
					dirty: false,
					externalChange: null,
					saveError: null,
					canWrite: state.canWrite || (result && result.method === 'handle'),
					file: Object.assign({}, file, {source})
				});
			}
			const tab = tabs[idx];
			const nextFile = Object.assign({}, tab.file, file, {source});
			const nextTabs = tabs.slice();
			nextTabs[idx] = Object.assign({}, tab, {
				file: nextFile,
				source,
				dirty: false,
				externalChange: null,
				saveError: null
			});
			return projectActive(Object.assign({}, state, {
				tabs: nextTabs,
				canWrite: state.canWrite || (result && result.method === 'handle')
			}));
		})
		.catch(err => {
			console.error('saveFile failed', file && file.path, err);
			const message = (err && err.message) || 'Save failed';
			return state => mapActiveTab(state, tab => Object.assign({}, tab, {saveError: message}));
		});
};

export default {
	initial,
	openFile,
	toggleFolder,
	openFolder,
	openRecent,
	refreshFilesTree,
	markExternalChange,
	refreshFsCapabilities,
	saveFile
};
