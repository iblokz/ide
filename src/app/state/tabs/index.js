import {getFs} from '../../adapters/fs';
import {
	projectActive,
	findTabIndexById,
	findTabIndexByPath,
	findAuditionIndex,
	neighborTabId,
	insertIndexFor
} from '../../util/tabs';
import {getOpenPositioning} from '../../util/app-settings.js';
import {revokeDisplayUrl} from '../../util/object-url.js';

const revokeFileUrl = file => {
	if (!file || !file.url) return;
	const fs = getFs();
	if (typeof fs.revokeObjectUrl === 'function') {
		fs.revokeObjectUrl(file.url);
	}
	revokeDisplayUrl(file.url);
};

export const activateTabId = (state, id) => {
	if (!id || state.activeTabId === id) {
		return projectActive(state);
	}
	const tabs = state.tabs || [];
	if (findTabIndexById(tabs, id) < 0) return state;
	return projectActive(Object.assign({}, state, {activeTabId: id}));
};

export const setActiveTab = id => state => activateTabId(state, id);

const cycleTab = delta => state => {
	const tabs = state.tabs || [];
	if (tabs.length < 2) return state;
	const idx = findTabIndexById(tabs, state.activeTabId);
	if (idx < 0) return activateTabId(state, tabs[0].id);
	const next = (idx + delta + tabs.length) % tabs.length;
	return activateTabId(state, tabs[next].id);
};

export const nextTab = () => cycleTab(1);
export const prevTab = () => cycleTab(-1);

export const closeTab = id => state => {
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

/** Pin a tab in place (idempotent). */
export const pinTab = id => state => {
	const tabs = state.tabs || [];
	const idx = findTabIndexById(tabs, id);
	if (idx < 0) return state;
	const tab = tabs[idx];
	if (tab.pinned !== false) return state;
	const nextTabs = tabs.slice();
	nextTabs[idx] = Object.assign({}, tab, {pinned: true});
	return projectActive(Object.assign({}, state, {tabs: nextTabs}));
};

/** Pin the active tab if it is an audition. */
export const pinActiveTab = () => state => {
	if (!state.activeTabId) return state;
	return pinTab(state.activeTabId)(state);
};

/**
 * Open or activate a tab.
 * @param {object} tab — from createTextTab / createImageTab
 * @param {{mode?: 'audition'|'pinned', openPositioning?: string}} [opts]
 */
export const openTab = (tab, opts) => state => {
	const mode = (opts && opts.mode) || 'pinned';
	const openPositioning = (opts && opts.openPositioning) || getOpenPositioning();
	const tabs = state.tabs || [];
	const path = tab.file && tab.file.path;
	const existingIdx = findTabIndexByPath(tabs, path);

	if (existingIdx >= 0) {
		const existing = tabs[existingIdx];
		let next = activateTabId(state, existing.id);
		if (mode === 'pinned' && existing.pinned === false) {
			next = pinTab(existing.id)(next);
		}
		return next;
	}

	const wantAudition = mode === 'audition';
	const nextTab = Object.assign({}, tab, {
		pinned: !wantAudition
	});

	if (wantAudition) {
		const auditionIdx = findAuditionIndex(tabs);
		if (auditionIdx >= 0) {
			const prev = tabs[auditionIdx];
			revokeFileUrl(prev && prev.file);
			const nextTabs = tabs.slice();
			nextTabs[auditionIdx] = nextTab;
			return projectActive(Object.assign({}, state, {
				tabs: nextTabs,
				activeTabId: nextTab.id
			}));
		}
		const at = insertIndexFor(tabs, state.activeTabId, openPositioning);
		const nextTabs = tabs.slice(0, at).concat([nextTab], tabs.slice(at));
		return projectActive(Object.assign({}, state, {
			tabs: nextTabs,
			activeTabId: nextTab.id
		}));
	}

	// Permanent opens append (openPositioning is for new auditions only).
	const nextTabs = tabs.concat([nextTab]);
	return projectActive(Object.assign({}, state, {
		tabs: nextTabs,
		activeTabId: nextTab.id
	}));
};

export default {
	setActiveTab,
	nextTab,
	prevTab,
	closeTab,
	pinTab,
	pinActiveTab,
	openTab,
	activateTabId
};
