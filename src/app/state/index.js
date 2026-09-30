'use strict';

const {obj, arr} = require('iblokz-data');
const {dispatch} = require('iblokz-state');
const {getInitialThemeMode, persistThemeMode, readHostTheme} = require('../util/theme');
const {
	mergeAt,
	isImageFile,
	fileKind,
	collectExpandedPaths,
	reapplyExpandedPaths
} = require('../util/file-tree');
const {indexFilesDeep} = require('../util/file-search');
const {loadRecent, pushRecent} = require('../util/recent');
const {getFs, probeCapabilities, resetFs} = require('../services/fs');
const layout = require('./layout').default ?? require('./layout');
const find = require('./find').default ?? require('./find');
const fileSearch = require('./file-search').default ?? require('./file-search');
const {findMatch, findFirstMatch} = require('../util/find-in-source');
const findHighlight = require('../util/find-highlight').default
	?? require('../util/find-highlight');
const {
	emptyPos,
	emptyTabFields,
	createTextTab,
	createImageTab,
	activeTab,
	projectActive,
	anyDirty,
	mapActiveTab,
	activateTabId,
	upsertTab,
	findTabIndexById,
	findTabIndexByPath,
	neighborTabId
} = require('../util/tabs');

const emptyFind = find.initial || {open: false, query: '', caseSensitive: false};
const emptyFileSearch = fileSearch.initial || {
	open: false,
	query: '',
	activeIndex: 0,
	index: null,
	indexPath: null,
	indexing: false
};

/** Close project file search and clear the query; keep the file index. */
const clearFileSearchUi = state => obj.patch(
	state,
	'fileSearch',
	Object.assign({}, state.fileSearch || emptyFileSearch, {
		open: false,
		query: '',
		activeIndex: 0
	})
);

const revokeFileUrl = file => {
	if (!file || !file.url) return;
	const fs = getFs();
	if (typeof fs.revokeObjectUrl === 'function') {
		fs.revokeObjectUrl(file.url);
	}
};

/** Clear all tabs when opening / switching project. */
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

const initial = Object.assign({
	themeMode: getInitialThemeMode(),
	hostTheme: readHostTheme(),
	view: 'start',
	fsBackend: getFs().id,
	canOpenFolder: getFs().canOpenFolder,
	canWrite: false,
	project: null,
	recentRoots: loadRecent(),
	tabs: [],
	activeTabId: null,
	filesTree: [],
	find: emptyFind,
	fileSearch: emptyFileSearch
}, emptyTabFields());

const set = (key, value) => state => obj.patch(state, key, value);
const toggle = key => state => obj.patch(state, key, !obj.sub(state, key));
const arrToggle = (key, value) => state =>
	obj.patch(state, key,
		arr.toggle(obj.sub(state, key), value)
	);

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

const openFile = file => {
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

const setActiveTab = id => state => activateTabId(state, id);

const cycleTab = delta => state => {
	const tabs = state.tabs || [];
	if (tabs.length < 2) return state;
	const idx = findTabIndexById(tabs, state.activeTabId);
	if (idx < 0) return activateTabId(state, tabs[0].id);
	const next = (idx + delta + tabs.length) % tabs.length;
	return activateTabId(state, tabs[next].id);
};

const nextTab = () => cycleTab(1);
const prevTab = () => cycleTab(-1);

const closeTab = id => state => {
	const tabs = state.tabs || [];
	const idx = findTabIndexById(tabs, id);
	if (idx < 0) return state;
	const closing = tabs[idx];
	revokeFileUrl(closing && closing.file);
	const nextTabs = tabs.slice(0, idx).concat(tabs.slice(idx + 1));
	let activeTabId = state.activeTabId;
	if (activeTabId === id) {
		activeTabId = neighborTabId(nextTabs, idx);
	}
	return projectActive(Object.assign({}, state, {
		tabs: nextTabs,
		activeTabId
	}));
};

const updateSource = (source, pos) => state => mapActiveTab(state, tab => {
	const nextPos = pos || tab.pos || emptyPos;
	return Object.assign({}, tab, {
		source,
		dirty: true,
		externalChange: null,
		saveError: null,
		index: tab.index + 1,
		maxIndex: tab.index + 1,
		pos: nextPos,
		history: [].concat(
			tab.history.slice(0, tab.index + 1),
			[{type: tab.type, source, pos: nextPos}]
		)
	});
});

const updatePos = pos => state => mapActiveTab(state, tab => Object.assign({}, tab, {
	pos,
	history: [].concat(
		tab.history.slice(0, tab.history.length - 1),
		[obj.patch(tab.history[tab.history.length - 1], 'pos', pos)]
	)
}));

const undo = () => state => mapActiveTab(state, tab => {
	const index = tab.index > 0 ? tab.index - 1 : 0;
	const entry = tab.history[index];
	if (!entry) return tab;
	return Object.assign({}, tab, entry, {
		index,
		dirty: true
	});
});

const redo = () => state => mapActiveTab(state, tab => {
	const index = tab.index < tab.maxIndex ? tab.index + 1 : tab.index;
	const entry = tab.history[index];
	if (!entry) return tab;
	return Object.assign({}, tab, entry, {
		index,
		dirty: true
	});
});

const toggleFolder = (path = [], item) => {
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

const setThemeMode = mode => state => obj.patch(state, 'themeMode', mode);
const setHostTheme = host => state => obj.patch(state, 'hostTheme', host || null);
const toggleTheme = () => state => {
	const mode = state.themeMode === 'dark' ? 'light' : 'dark';
	persistThemeMode(mode);
	return obj.patch(state, 'themeMode', mode);
};

const applyProjectResult = (fs, result) => {
	const recentRoots = pushRecent({
		id: result.id,
		name: result.name,
		path: result.path
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
		layout: {
			...state.layout,
			toggles: {
				...(state.layout && state.layout.toggles),
				leftSideBar: true
			}
		}
	});
};

const openFolder = () => {
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

const openRecent = root => {
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

const refreshFilesTree = (project, prevTree) => {
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

const markExternalChange = filePath => state => {
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

const refreshFsCapabilities = () => state => {
	resetFs();
	return Object.assign({}, state, probeCapabilities());
};

const setLayout = patch => state => Object.assign({}, state, {
	layout: Object.assign({}, state.layout, {
		dim: Object.assign({}, state.layout.dim, patch)
	})
});

const applyFindCaret = pos => {
	findHighlight.applyFindResult(pos);
};

const setFind = patch => state => obj.patch(
	state,
	'find',
	Object.assign({}, state.find || emptyFind, patch)
);

const isNonEmptySelection = pos => {
	if (!pos || !pos.start || !pos.end) return false;
	return pos.start.row !== pos.end.row || pos.start.col !== pos.end.col;
};

const selectedEditorText = () => {
	if (typeof document === 'undefined') return {text: '', pos: null};
	const el = document.querySelector('code.source');
	if (!el) return {text: '', pos: null};
	const sel = window.getSelection();
	if (!sel || sel.rangeCount < 1 || sel.isCollapsed) return {text: '', pos: null};
	if (!el.contains(sel.anchorNode) && el !== sel.anchorNode) return {text: '', pos: null};
	try {
		const caret = require('../util/caret');
		const pos = caret.get(el);
		if (!isNonEmptySelection(pos)) return {text: '', pos: null};
		return {text: sel.toString().replace(/\u00a0/g, ''), pos};
	} catch {
		const text = sel.toString().replace(/\u00a0/g, '');
		return text ? {text, pos: null} : {text: '', pos: null};
	}
};

/** Update find query and jump to the first match (live typing). */
const findQuery = query => state => {
	if (!state.file || state.type === 'image') {
		return obj.patch(state, 'find', Object.assign({}, state.find || emptyFind, {query}));
	}
	const findState = Object.assign({}, state.find || emptyFind, {query});
	let next = Object.assign({}, state, {find: findState});
	if (!query) {
		if (typeof document !== 'undefined') {
			findHighlight.clearFindMarkup(document.querySelector('code.source'));
		}
		return next;
	}
	const hit = findFirstMatch(state.source, query, {
		caseSensitive: findState.caseSensitive
	});
	if (!hit) {
		if (typeof document !== 'undefined') {
			findHighlight.clearFindMarkup(document.querySelector('code.source'));
		}
		return next;
	}
	applyFindCaret(hit);
	return mapActiveTab(Object.assign(next, {pos: hit}), tab => Object.assign({}, tab, {pos: hit}));
};

const openFind = () => state => {
	if (!state.file || state.type === 'image') return state;
	const {text: selectedText, pos: selectedPos} = selectedEditorText();
	const findPatch = {open: true};
	if (selectedText) findPatch.query = selectedText;
	let next = obj.patch(
		state,
		'find',
		Object.assign({}, state.find || emptyFind, findPatch)
	);
	if (selectedText) {
		const findState = next.find || emptyFind;
		const hit = selectedPos || findFirstMatch(state.source, selectedText, {
			caseSensitive: findState.caseSensitive
		});
		if (hit) {
			applyFindCaret(hit);
			next = mapActiveTab(Object.assign(next, {pos: hit}), tab => Object.assign({}, tab, {pos: hit}));
		}
	}
	if (typeof document !== 'undefined') {
		queueMicrotask(() => {
			const field = document.querySelector('.find-bar .find-query');
			if (field) {
				field.focus();
				field.select();
			}
		});
	}
	return next;
};

const closeFind = () => state => {
	if (typeof document !== 'undefined') {
		findHighlight.clearFindMarkup(document.querySelector('code.source'));
	}
	return obj.patch(
		state,
		'find',
		Object.assign({}, state.find || emptyFind, {open: false})
	);
};

const findStep = direction => state => {
	if (!state.file || state.type === 'image') return state;
	const findState = state.find || emptyFind;
	if (!findState.query) return state;
	const hit = findMatch(state.source, findState.query, state.pos, {
		caseSensitive: findState.caseSensitive,
		direction
	});
	if (!hit) return state;
	applyFindCaret(hit);
	return mapActiveTab(Object.assign({}, state, {pos: hit}), tab => Object.assign({}, tab, {pos: hit}));
};

const findNext = () => findStep(1);
const findPrev = () => findStep(-1);

const setFileSearch = patch => state => obj.patch(
	state,
	'fileSearch',
	Object.assign({}, state.fileSearch || emptyFileSearch, patch)
);

const setFileSearchQuery = query => state => obj.patch(
	state,
	'fileSearch',
	Object.assign({}, state.fileSearch || emptyFileSearch, {
		query: query || '',
		activeIndex: 0,
		open: true
	})
);

/** Build / refresh flat file index for Mod+P (walks unloaded subdirs via listDir). */
const startFileSearchIndex = (filesTree, projectPath) => {
	const fs = getFs();
	const listDir = typeof fs.listDir === 'function'
		? node => fs.listDir(node)
		: null;
	const token = projectPath || '';
	indexFilesDeep(filesTree || [], listDir)
		.then(files => {
			dispatch(state => {
				const cur = state.fileSearch || emptyFileSearch;
				const path = state.project && state.project.path;
				if (path !== token) return state;
				return obj.patch(
					state,
					'fileSearch',
					Object.assign({}, cur, {
						index: files,
						indexPath: token,
						indexing: false
					})
				);
			});
		})
		.catch(err => {
			console.error('file search index failed', err);
			dispatch(state => {
				const cur = state.fileSearch || emptyFileSearch;
				const path = state.project && state.project.path;
				if (path !== token) return state;
				return obj.patch(
					state,
					'fileSearch',
					Object.assign({}, cur, {indexing: false})
				);
			});
		});
};

const openFileSearch = () => state => {
	const projectPath = state.project && state.project.path;
	const cur = state.fileSearch || emptyFileSearch;
	const needsIndex = !cur.index || cur.indexPath !== projectPath;
	const next = obj.patch(
		state,
		'fileSearch',
		Object.assign({}, cur, {
			open: true,
			indexing: needsIndex ? true : !!cur.indexing
		})
	);
	if (typeof document !== 'undefined') {
		queueMicrotask(() => {
			const field = document.querySelector('.file-search .file-search-query');
			if (field) {
				field.focus();
				field.select();
			}
		});
	}
	if (needsIndex && !cur.indexing) {
		startFileSearchIndex(state.filesTree || [], projectPath);
	}
	return next;
};

const closeFileSearch = () => state => clearFileSearchUi(state);

const saveFile = (file, source, pickedHandle) => {
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

module.exports = {
	initial,
	layout,
	find,
	fileSearch,
	set,
	toggle,
	arrToggle,
	loadFile,
	openFile,
	setActiveTab,
	nextTab,
	prevTab,
	closeTab,
	updateSource,
	updatePos,
	undo,
	redo,
	toggleFolder,
	setThemeMode,
	setHostTheme,
	toggleTheme,
	openFolder,
	openRecent,
	saveFile,
	refreshFilesTree,
	markExternalChange,
	refreshFsCapabilities,
	setLayout,
	setFind,
	findQuery,
	openFind,
	closeFind,
	findNext,
	findPrev,
	setFileSearch,
	setFileSearchQuery,
	openFileSearch,
	closeFileSearch,
	activeTab,
	anyDirty
};
