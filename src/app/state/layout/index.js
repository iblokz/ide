import {obj} from 'iblokz-data';

const SIDE_BAR_SECTIONS = ['fileTree', 'search', 'git'];

export const initial = {
	toggles: {
		leftSideBar: true,
		rightSideBar: false,
		bottomPanel: false,
		preview: false,
		previewConsole: false
	},
	dim: {
		leftSideBar: 260,
		rightSideBar: 320,
		bottomPanel: 320,
		preview: 0.5,
		previewConsole: 240
	},
	/** Left sidebar body: `fileTree` | `search` | `git`. */
	sideBarSection: 'fileTree'
};

/** Toggle a layout panel by key (`leftSideBar`, `preview`, …). */
export const toggle = key => state => {
	const path = ['layout', 'toggles', key];
	return obj.patch(state, path, !obj.sub(state, path));
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
	set,
	setSideBarSection
};
