'use strict';

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

const createTextTab = file => {
	const type = file.ext || 'js';
	const source = typeof file.source === 'string' ? file.source : '';
	return {
		id: newTabId(file),
		file,
		source,
		type,
		dirty: false,
		externalChange: null,
		saveError: null,
		index: 0,
		maxIndex: 0,
		pos: emptyPos,
		scroll: emptyScroll,
		history: emptyHistory(type, source)
	};
};

const createImageTab = file => ({
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
	history: emptyHistory('image', '')
});

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

const activateTabId = (state, id) => {
	if (!id || state.activeTabId === id) {
		return projectActive(state);
	}
	const tabs = state.tabs || [];
	if (findTabIndexById(tabs, id) < 0) return state;
	return projectActive(Object.assign({}, state, {activeTabId: id}));
};

/**
 * Activate existing tab for path, or append `tab` and activate it.
 * Does not revoke other tabs' URLs.
 */
const upsertTab = (state, tab) => {
	const tabs = state.tabs || [];
	const path = tab.file && tab.file.path;
	const existingIdx = findTabIndexByPath(tabs, path);
	if (existingIdx >= 0) {
		return activateTabId(state, tabs[existingIdx].id);
	}
	return projectActive(Object.assign({}, state, {
		tabs: tabs.concat([tab]),
		activeTabId: tab.id
	}));
};

const neighborTabId = (tabs, closedIdx) => {
	if (!tabs.length) return null;
	if (closedIdx < tabs.length) return tabs[closedIdx].id;
	if (closedIdx - 1 >= 0) return tabs[closedIdx - 1].id;
	return tabs[0].id;
};

module.exports = {
	emptyPos,
	emptyScroll,
	emptyHistory,
	emptyTabFields,
	newTabId,
	createTextTab,
	createImageTab,
	activeTab,
	projectActive,
	anyDirty,
	findTabIndexByPath,
	findTabIndexById,
	mapActiveTab,
	activateTabId,
	upsertTab,
	neighborTabId
};
