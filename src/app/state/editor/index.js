import {obj} from 'iblokz-data';
import {
	emptyPos,
	emptyScroll,
	mapActiveTab,
	findTabIndexById,
	projectActive
} from '../../util/tabs';
import {
	toggleComment as toggleCommentInSource,
	readLiveEditor
} from '../../util/toggle-comment.js';

/** No dedicated slice yet — buffer fields live on the active tab / root mirrors. */
export const initial = {};

export const updateSource = (source, pos) => state => mapActiveTab(state, tab => {
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

export const updatePos = pos => state => mapActiveTab(state, tab => Object.assign({}, tab, {
	pos,
	history: [].concat(
		tab.history.slice(0, tab.history.length - 1),
		[obj.patch(tab.history[tab.history.length - 1], 'pos', pos)]
	)
}));

/** Persist editor scroll for a tab (defaults to active). Does not mark dirty. */
export const updateScroll = (scroll, tabId) => state => {
	const tabs = state.tabs || [];
	const id = tabId || state.activeTabId;
	const idx = findTabIndexById(tabs, id);
	if (idx < 0) return state;
	const nextScroll = {
		top: Math.max(0, (scroll && scroll.top) || 0),
		left: Math.max(0, (scroll && scroll.left) || 0)
	};
	const tab = tabs[idx];
	const prev = tab.scroll || emptyScroll;
	if (prev.top === nextScroll.top && prev.left === nextScroll.left) return state;
	let nextTabs = tabs.slice();
	nextTabs[idx] = Object.assign({}, tab, {scroll: nextScroll});
	return projectActive(Object.assign({}, state, {tabs: nextTabs}));
};

export const undo = () => state => mapActiveTab(state, tab => {
	const index = tab.index > 0 ? tab.index - 1 : 0;
	const entry = tab.history[index];
	if (!entry) return tab;
	return Object.assign({}, tab, entry, {
		index,
		dirty: true
	});
});

export const redo = () => state => mapActiveTab(state, tab => {
	const index = tab.index < tab.maxIndex ? tab.index + 1 : tab.index;
	const entry = tab.history[index];
	if (!entry) return tab;
	return Object.assign({}, tab, entry, {
		index,
		dirty: true
	});
});

/** Toggle line comments on the selection (Mod+/). Flushes live DOM when ahead of state. */
export const toggleComment = () => state => {
	if (!state.file || state.type === 'image') return state;

	let source = state.source || '';
	let pos = state.pos || emptyPos;
	const live = readLiveEditor();
	if (live) {
		if (typeof live.source === 'string') source = live.source;
		if (live.pos) pos = live.pos;
	}

	const next = toggleCommentInSource(source, pos, state.type || 'js');
	if (next.source === source
		&& next.pos.start.row === pos.start.row
		&& next.pos.start.col === pos.start.col
		&& next.pos.end.row === pos.end.row
		&& next.pos.end.col === pos.end.col) {
		return state;
	}
	return updateSource(next.source, next.pos)(state);
};

export default {
	initial,
	updateSource,
	updatePos,
	updateScroll,
	undo,
	redo,
	toggleComment
};
