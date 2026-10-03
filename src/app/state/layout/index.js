import {obj} from 'iblokz-data';

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
	}
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

export default {
	initial,
	toggle,
	set
};
