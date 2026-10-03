'use strict';

const {obj, arr} = require('iblokz-data');
const {dispatch} = require('iblokz-state');
const {loadRecent} = require('../util/recent');
const {getFs} = require('../services/fs');

const revokeFileUrl = file => {
	if (!file || !file.url) return;
	const fs = getFs();
	if (typeof fs.revokeObjectUrl === 'function') {
		fs.revokeObjectUrl(file.url);
	}
};
const {indexFilesDeep} = require('../util/file-search');
const {findMatch, findFirstMatch} = require('../util/find-in-source');
const findHighlight = require('../util/find-highlight').default
	?? require('../util/find-highlight');
const {
	emptyTabFields,
	projectActive,
	activateTabId,
	findTabIndexById,
	neighborTabId,
	mapActiveTab
} = require('../util/tabs');

const layout = require('./layout').default ?? require('./layout');
const theme = require('./theme').default ?? require('./theme');
const editor = require('./editor').default ?? require('./editor');
const project = require('./project').default ?? require('./project');
const preview = require('./preview').default ?? require('./preview');
const find = require('./find').default ?? require('./find');
const fileSearch = require('./file-search').default ?? require('./file-search');

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

const initial = Object.assign({
	view: 'start',
	fsBackend: getFs().id,
	canOpenFolder: getFs().canOpenFolder,
	canWrite: false,
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

module.exports = {
	initial,
	layout,
	theme,
	editor,
	project,
	preview,
	find,
	fileSearch,
	set,
	toggle,
	arrToggle,
	setActiveTab,
	nextTab,
	prevTab,
	closeTab,
	setFind,
	findQuery,
	openFind,
	closeFind,
	findNext,
	findPrev,
	setFileSearch,
	setFileSearchQuery,
	openFileSearch,
	closeFileSearch
};
