'use strict';

const {extOf} = require('./file-tree');

const emptyPos = {
	start: {row: 0, col: 0},
	end: {row: 0, col: 0}
};

const emptyScroll = {
	top: 0,
	left: 0
};

const emptyHistory = (type = 'js', source = '') => [{
	type,
	source,
	pos: emptyPos
}];

const emptyTabFields = () => ({
	file: null,
	source: '',
	type: 'js',
	indent: {style: 'tab', size: 2, tabWidth: 2},
	dirty: false,
	externalChange: null,
	saveError: null,
	index: 0,
	maxIndex: 0,
	pos: emptyPos,
	scroll: emptyScroll,
	history: emptyHistory()
});

const newTabId = file => {
	if (file && file.path) return String(file.path);
	if (file && file.id) return `id:${file.id}`;
	return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * @param {object} file
 * @param {{pinned?: boolean}} [opts] — default pinned (session / permanent opens)
 */
const createTextTab = (file, opts) => {
	const type = (file && file.ext) || extOf(file && file.name) || 'js';
	const source = typeof file.source === 'string' ? file.source : '';
	const pinned = !(opts && opts.pinned === false);
	return {
		id: newTabId(file),
		file,
		source,
		type,
		indent: file.indent || {style: 'tab', size: 2, tabWidth: 2},
		dirty: false,
		externalChange: null,
		saveError: null,
		index: 0,
		maxIndex: 0,
		pos: emptyPos,
		scroll: emptyScroll,
		history: emptyHistory(type, source),
		pinned
	};
};

/**
 * @param {object} file
 * @param {{pinned?: boolean}} [opts]
 */
const createImageTab = (file, opts) => {
	const pinned = !(opts && opts.pinned === false);
	return {
		id: newTabId(file),
		file,
		source: '',
		type: 'image',
		dirty: false,
		externalChange: null,
		saveError: null,
		index: 0,
		maxIndex: 0,
		pos: emptyPos,
		scroll: emptyScroll,
		history: emptyHistory('image', ''),
		pinned
	};
};

/** PDF tab — content shown in the file preview pane only. */
const createPdfTab = (file, opts) => {
	const pinned = !(opts && opts.pinned === false);
	return {
		id: newTabId(file),
		file,
		source: '',
		type: 'pdf',
		dirty: false,
		externalChange: null,
		saveError: null,
		index: 0,
		maxIndex: 0,
		pos: emptyPos,
		scroll: emptyScroll,
		history: emptyHistory('pdf', ''),
		pinned
	};
};

/** Tabs that are not text buffers (no editor / find / save). */
const isMediaTabType = type => type === 'image' || type === 'pdf';

const activeTab = state => {
	const tabs = (state && state.tabs) || [];
	const id = state && state.activeTabId;
	if (!id) return null;
	return tabs.find(t => t.id === id) || null;
};

const projectActive = state => {
	const tab = activeTab(state);
	if (!tab) {
		return Object.assign({}, state, emptyTabFields());
	}
	return Object.assign({}, state, {
		file: tab.file,
		source: tab.source,
		type: tab.type,
		indent: tab.indent || {style: 'tab', size: 2, tabWidth: 2},
		dirty: tab.dirty,
		externalChange: tab.externalChange,
		saveError: tab.saveError,
		index: tab.index,
		maxIndex: tab.maxIndex,
		pos: tab.pos,
		scroll: tab.scroll || emptyScroll,
		history: tab.history
	});
};

const anyDirty = state => ((state && state.tabs) || []).some(t => t.dirty);

const findTabIndexByPath = (tabs, path) => {
	if (!path) return -1;
	return (tabs || []).findIndex(t => t.file && t.file.path === path);
};

const findTabIndexById = (tabs, id) =>
	(tabs || []).findIndex(t => t.id === id);

const findAuditionIndex = tabs =>
	(tabs || []).findIndex(t => t && t.pinned === false);

/** Replace active tab via mapper; re-project root mirrors. */
const mapActiveTab = (state, fn) => {
	const tabs = state.tabs || [];
	const idx = findTabIndexById(tabs, state.activeTabId);
	if (idx < 0) return state;
	const nextTab = fn(tabs[idx]);
	if (!nextTab || nextTab === tabs[idx]) return state;
	const nextTabs = tabs.slice();
	nextTabs[idx] = nextTab;
	return projectActive(Object.assign({}, state, {tabs: nextTabs}));
};

const neighborTabId = (tabs, closedIdx) => {
	if (!tabs.length) return null;
	if (closedIdx < tabs.length) return tabs[closedIdx].id;
	if (closedIdx - 1 >= 0) return tabs[closedIdx - 1].id;
	return tabs[0].id;
};

/**
 * Index to insert a new tab for `openPositioning`.
 * @param {object[]} tabs
 * @param {string|null} activeTabId
 * @param {string} openPositioning
 */
const insertIndexFor = (tabs, activeTabId, openPositioning) => {
	const n = (tabs || []).length;
	const pos = openPositioning || 'right';
	if (pos === 'first') return 0;
	if (pos === 'last' || !n) return n;
	const activeIdx = findTabIndexById(tabs, activeTabId);
	if (activeIdx < 0) return n;
	if (pos === 'left') return activeIdx;
	return activeIdx + 1;
};

module.exports = {
	emptyPos,
	emptyScroll,
	emptyHistory,
	emptyTabFields,
	newTabId,
	createTextTab,
	createImageTab,
	createPdfTab,
	isMediaTabType,
	activeTab,
	projectActive,
	anyDirty,
	findTabIndexByPath,
	findTabIndexById,
	findAuditionIndex,
	mapActiveTab,
	neighborTabId,
	insertIndexFor
};
