import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {
	isImageFile,
	fileKind,
	hashPath,
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
import {clearEditorconfigCache, resolveIndent, DEFAULT_INDENT} from '../../util/editorconfig.js';
import {getFs, probeCapabilities, resetFs} from '../../adapters/fs';
import {
	emptyTabFields,
	emptyHistory,
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
import {
	initial as fileTreeInitial,
	slice as fileTreeSlice,
	patch as patchFileTree,
	safeSelectedPath
} from '../file-tree/index.js';
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
		fileTree: Object.assign({}, fileTreeInitial),
		find: emptyFind,
		fileSearch: emptyFileSearch
	});
};

const loadFile = file => state => {
	const base = clearFileSearchUi(upsertTab(state, createTextTab(file)));
	const tree = fileTreeSlice(base);
	return patchFileTree(base, {
		selectedPath: safeSelectedPath(base, file.path),
		pendingDeletePath: tree.pendingDeletePath === file.path
			? tree.pendingDeletePath
			: null
	});
};

const loadFileWithIndent = (file, sourcePatch) => state => {
	const base = Object.assign({}, file, sourcePatch || {});
	const rootPath = state.project && state.project.path;
	resolveIndent(getFs(), base.path, rootPath)
		.catch(err => {
			console.warn('[editorconfig] resolve failed', err);
			return DEFAULT_INDENT;
		})
		.then(indent => {
			dispatch(loadFile(Object.assign({}, base, {indent: indent || DEFAULT_INDENT})));
		});
	return state;
};

const loadImage = file => state => {
	const base = clearFileSearchUi(upsertTab(state, createImageTab(file)));
	const tree = fileTreeSlice(base);
	return patchFileTree(base, {
		selectedPath: safeSelectedPath(base, file.path),
		pendingDeletePath: tree.pendingDeletePath === file.path
			? tree.pendingDeletePath
			: null
	});
};

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
	if (typeof file.source === 'string') return loadFileWithIndent(file);

	const fs = getFs();
	return fs.readFile(file)
		.then(source => {
			if (typeof source !== 'string') {
				throw new Error('File read did not return text');
			}
			return loadFileWithIndent(file, {source, kind: 'text'});
		})
		.catch(err => {
			console.error('openFile failed', file && file.path, err);
			return state => state;
		});
};

const layoutFromSession = (state, session) => {
	const sideBarSection = (state.layout && state.layout.sideBarSection)
		|| layoutInitial.sideBarSection
		|| 'fileTree';
	if (session && session.layout) {
		return {
			toggles: Object.assign({}, layoutInitial.toggles, session.layout.toggles || {}),
			dim: Object.assign({}, layoutInitial.dim, (state.layout && state.layout.dim) || {}, session.layout.dim || {}),
			sideBarSection
		};
	}
	return {
		toggles: Object.assign({}, layoutInitial.toggles, state.layout && state.layout.toggles, {
			leftSideBar: true
		}),
		dim: Object.assign({}, layoutInitial.dim, state.layout && state.layout.dim),
		sideBarSection
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
	clearEditorconfigCache();
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
		fileTree: Object.assign({}, fileTreeInitial, {
			nodes: result.filesTree || []
		}),
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
				.then(nodes => state => {
					const tree = fileTreeSlice(state);
					return Object.assign({}, state, {
						fileTree: Object.assign({}, tree, {
							nodes,
							selectedPath: safeSelectedPath(state, tree.selectedPath),
							treeEdit: null
						}),
						fileSearch: Object.assign({}, state.fileSearch || emptyFileSearch, {
							index: null,
							indexPath: null,
							indexing: false
						})
					});
				});
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

/**
 * Re-read an open file from disk into its tab.
 * No-ops if the tab is missing or dirty (dirty → markExternalChange).
 * Unlike openFile/upsertTab, this updates source in place instead of only activating.
 */
export const reloadFile = file => {
	if (!file || !file.path || file.isDir) {
		return Promise.resolve(state => state);
	}

	const path = file.path;
	const kind = file.kind || fileKind(file.name, file.ext);
	const fs = getFs();

	const applyTextReload = source => state => {
		const tabs = state.tabs || [];
		const idx = findTabIndexByPath(tabs, path);
		if (idx < 0) return state;
		const tab = tabs[idx];
		if (tab.dirty) return markExternalChange(path)(state);
		const nextFile = Object.assign({}, tab.file, file, {source, kind: kind || tab.file.kind});
		const nextTabs = tabs.slice();
		nextTabs[idx] = Object.assign({}, tab, {
			file: nextFile,
			source,
			dirty: false,
			externalChange: null,
			saveError: null,
			history: emptyHistory(tab.type, source)
		});
		return projectActive(Object.assign({}, state, {tabs: nextTabs}));
	};

	const applyImageReload = url => state => {
		const tabs = state.tabs || [];
		const idx = findTabIndexByPath(tabs, path);
		if (idx < 0) return state;
		const tab = tabs[idx];
		if (tab.dirty) return markExternalChange(path)(state);
		revokeFileUrl(tab.file);
		const nextFile = Object.assign({}, tab.file, file, {url, kind: 'image'});
		const nextTabs = tabs.slice();
		nextTabs[idx] = Object.assign({}, tab, {
			file: nextFile,
			source: '',
			dirty: false,
			externalChange: null,
			saveError: null
		});
		return projectActive(Object.assign({}, state, {tabs: nextTabs}));
	};

	if (kind === 'image' || isImageFile(file.name, file.ext)) {
		if (typeof fs.getObjectUrl !== 'function') {
			return Promise.resolve(state => state);
		}
		return fs.getObjectUrl(file)
			.then(applyImageReload)
			.catch(err => {
				console.error('reloadFile image failed', path, err);
				return state => state;
			});
	}

	if (kind === 'binary' || file.readable === false) {
		return Promise.resolve(state => state);
	}

	if (typeof fs.readFile !== 'function') {
		return Promise.resolve(state => state);
	}

	return fs.readFile(file)
		.then(source => {
			if (typeof source !== 'string') {
				throw new Error('File read did not return text');
			}
			return applyTextReload(source);
		})
		.catch(err => {
			console.error('reloadFile failed', path, err);
			return state => state;
		});
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

const pathIsUnder = (filePath, rootPath) => {
	if (!filePath || !rootPath) return false;
	if (filePath === rootPath) return true;
	const sep = rootPath.indexOf('\\') >= 0 ? '\\' : '/';
	const prefix = rootPath.endsWith('/') || rootPath.endsWith('\\')
		? rootPath
		: rootPath + sep;
	return String(filePath).indexOf(prefix) === 0;
};

const scheduleTreeRefresh = state => {
	const result = refreshFilesTree(state.project, fileTreeSlice(state).nodes);
	if (result && typeof result.then === 'function') {
		result
			.then(reducer => {
				if (typeof reducer === 'function') dispatch(reducer);
			})
			.catch(err => console.error('refresh after mutation failed', err));
	}
};

const closeTabsUnderPath = (state, rootPath) => {
	const tabs = state.tabs || [];
	const kept = [];
	let closedActive = false;
	tabs.forEach(tab => {
		const p = tab && tab.file && tab.file.path;
		if (pathIsUnder(p, rootPath)) {
			if (tab.id === state.activeTabId) closedActive = true;
			revokeFileUrl(tab.file);
		} else {
			kept.push(tab);
		}
	});
	if (kept.length === tabs.length) return state;
	const activeTabId = closedActive
		? (kept[0] && kept[0].id) || null
		: state.activeTabId;
	return projectActive(Object.assign({}, state, {tabs: kept, activeTabId}));
};

const rewriteTabsAfterRename = (state, oldPath, newPath, newName) => {
	if (!oldPath || !newPath || oldPath === newPath) return state;
	const tabs = state.tabs || [];
	let changed = false;
	const nextTabs = tabs.map(tab => {
		const file = tab && tab.file;
		if (!file || !file.path) return tab;
		let nextPath = null;
		if (file.path === oldPath) nextPath = newPath;
		else if (pathIsUnder(file.path, oldPath)) {
			nextPath = newPath + file.path.slice(oldPath.length);
		}
		if (!nextPath) return tab;
		changed = true;
		const name = file.path === oldPath
			? (newName || file.name)
			: file.name;
		return Object.assign({}, tab, {
			file: Object.assign({}, file, {
				path: nextPath,
				name,
				id: hashPath(nextPath)
			})
		});
	});
	if (!changed) return state;
	const tree = fileTreeSlice(state);
	const prevSel = tree.selectedPath;
	const selectedPath = prevSel === oldPath
		? newPath
		: (pathIsUnder(prevSel, oldPath)
			? newPath + prevSel.slice(oldPath.length)
			: prevSel);
	return projectActive(patchFileTree(
		Object.assign({}, state, {tabs: nextTabs}),
		{
			selectedPath: safeSelectedPath(state, selectedPath),
			pendingDeletePath: null,
			treeEdit: null
		}
	));
};

const guardMutation = (methodName, run) => {
	const fs = getFs();
	if (typeof fs[methodName] !== 'function') {
		return Promise.resolve(state => state);
	}
	return run(fs)
		.catch(err => {
			console.error(`${methodName} failed`, err);
			return state => state;
		});
};

export const createFile = (parent, name) => guardMutation('createFile', fs =>
	fs.createFile(parent, name).then(created => state => {
		if (!state.canWrite) return state;
		scheduleTreeRefresh(state);
		const tree = fileTreeSlice(state);
		return patchFileTree(state, {
			selectedPath: safeSelectedPath(
				state,
				(created && created.path) || tree.selectedPath
			),
			pendingDeletePath: null,
			treeEdit: null
		});
	})
);

export const createFolder = (parent, name) => guardMutation('mkdir', fs =>
	fs.mkdir(parent, name).then(created => state => {
		if (!state.canWrite) return state;
		scheduleTreeRefresh(state);
		const tree = fileTreeSlice(state);
		return patchFileTree(state, {
			selectedPath: safeSelectedPath(
				state,
				(created && created.path) || tree.selectedPath
			),
			pendingDeletePath: null,
			treeEdit: null
		});
	})
);

export const renameItem = (item, newName) => {
	if (!item || !item.path) {
		return Promise.resolve(state => state);
	}
	return guardMutation('rename', fs => {
		// Web FSA: folder rename needs recursive copy; skip for now.
		if (fs.id === 'web' && item.isDir) {
			console.warn('[fs] folder rename is not supported in the browser yet');
			return Promise.resolve(state => state);
		}
		return fs.rename(item, newName).then(result => state => {
			if (!state.canWrite) return state;
			const rootPath = state.project && state.project.path;
			if (rootPath && item.path === rootPath) return state;
			const next = rewriteTabsAfterRename(
				state,
				item.path,
				result && result.path,
				result && result.name
			);
			scheduleTreeRefresh(next);
			return next;
		});
	});
};

export const deleteItem = item => {
	if (!item || !item.path) {
		return Promise.resolve(state => state);
	}
	return guardMutation('remove', fs =>
		fs.remove(item).then(() => state => {
			if (!state.canWrite) return state;
			const rootPath = state.project && state.project.path;
			if (rootPath && item.path === rootPath) return state;
			const tree = fileTreeSlice(state);
			const next = closeTabsUnderPath(patchFileTree(state, {
				selectedPath: tree.selectedPath === item.path
					? null
					: tree.selectedPath,
				pendingDeletePath: null,
				treeEdit: null
			}), item.path);
			scheduleTreeRefresh(next);
			return next;
		})
	);
};

export default {
	initial,
	openFile,
	openFolder,
	openRecent,
	refreshFilesTree,
	markExternalChange,
	reloadFile,
	refreshFsCapabilities,
	saveFile,
	createFile,
	createFolder,
	renameItem,
	deleteItem
};
