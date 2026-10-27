import {obj} from 'iblokz-data';

const SIDE_BAR_SECTIONS = ['fileTree', 'search', 'git'];

export const initial = {
	toggles: {
		leftSideBar: true,
		rightSideBar: false,
		bottomPanel: false,
		preview: false,
		previewConsole: false,
		/** Preview column fills the workspace (editor share collapsed). */
		previewMaximized: false,
		/** Explorer “Recent” bottom panel. */
		recentRoots: true,
		/** Source Control “Commits” bottom panel. */
		gitCommits: true
	},
	dim: {
		leftSideBar: 260,
		rightSideBar: 320,
		bottomPanel: 320,
		preview: 0.5,
		previewConsole: 240,
		recentRoots: 120,
		gitCommits: 140
	},
	/** Left sidebar body: `fileTree` | `search` | `git`. */
	sideBarSection: 'fileTree'
};

/** Toggle a layout panel by key (`leftSideBar`, `preview`, …). */
export const toggle = key => state => {
	const path = ['layout', 'toggles', key];
	const next = !obj.sub(state, path);
	let nextState = obj.patch(state, path, next);
	// Closing preview also clears maximized so the next open restores the split.
	if (key === 'preview' && !next) {
		nextState = obj.patch(nextState, ['layout', 'toggles', 'previewMaximized'], false);
	}
	return nextState;
};

/** Hide the preview column and clear maximized. */
export const closePreview = () => state => {
	const toggles = Object.assign({}, (state.layout && state.layout.toggles) || {}, {
		preview: false,
		previewMaximized: false
	});
	return obj.patch(state, ['layout', 'toggles'], toggles);
};

/** Patch layout dimensions (`leftSideBar`, `preview`, …). */
export const set = patch => state => Object.assign({}, state, {
	layout: Object.assign({}, state.layout, {
		dim: Object.assign({}, state.layout.dim, patch)
	})
});

/** Switch left sidebar section (`fileTree` / `search` / `git`). */
export const setSideBarSection = section => state => {
	const next = SIDE_BAR_SECTIONS.indexOf(section) >= 0 ? section : 'fileTree';
	return obj.patch(state, ['layout', 'sideBarSection'], next);
};

export default {
	initial,
	toggle,
	closePreview,
	set,
	setSideBarSection
};
