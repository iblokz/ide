'use strict';

const LAYOUT_KEY = 'iblokz-ide.layout';

// Cycle: editor only → editor|preview → editor/console → full
const PANE_MODES = ['editor', 'preview', 'console', 'full'];

const defaults = {
	sideBar: 260,
	editor: 0.5,
	preview: 0.5,
	panes: 'full'
};

const normalizePanes = panes =>
	PANE_MODES.includes(panes) ? panes : defaults.panes;

const clampLayout = (layout = {}) => ({
	sideBar: Math.min(480, Math.max(140, Number(layout.sideBar) || defaults.sideBar)),
	editor: Math.min(0.8, Math.max(0.2, Number(layout.editor) || defaults.editor)),
	preview: Math.min(0.8, Math.max(0.2, Number(layout.preview) || defaults.preview)),
	panes: normalizePanes(layout.panes)
});

const loadLayout = () => {
	try {
		const raw = localStorage.getItem(LAYOUT_KEY);
		if (!raw) return Object.assign({}, defaults);
		return clampLayout(JSON.parse(raw));
	} catch (err) {
		return Object.assign({}, defaults);
	}
};

const saveLayout = layout => {
	try {
		localStorage.setItem(LAYOUT_KEY, JSON.stringify(clampLayout(layout)));
	} catch (err) {
		// ignore quota / private mode
	}
	return clampLayout(layout);
};

const nextPanes = panes => {
	const i = PANE_MODES.indexOf(normalizePanes(panes));
	return PANE_MODES[(i + 1) % PANE_MODES.length];
};

const panesLabel = panes => ({
	editor: 'Editor only',
	preview: 'Editor & preview',
	console: 'Editor & console',
	full: 'Editor, preview & console'
}[normalizePanes(panes)]);

const panesIcon = panes => ({
	editor: 'fa-file-code-o',
	preview: 'fa-columns',
	console: 'fa-list-alt',
	full: 'fa-th-large'
}[normalizePanes(panes)]);

module.exports = {
	LAYOUT_KEY,
	PANE_MODES,
	defaults,
	clampLayout,
	loadLayout,
	saveLayout,
	normalizePanes,
	nextPanes,
	panesLabel,
	panesIcon
};
