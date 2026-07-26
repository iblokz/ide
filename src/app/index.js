'use strict';

const {map, distinctUntilChanged, fromEvent, filter} = require('rxjs');
const {createState, dispatch} = require('iblokz-state');
const {patchStream} = require('iblokz-snabbdom-helpers');
const {toVNode} = require('snabbdom');

const actionsTree = require('./state');
let ui = require('./ui');
const viewport = require('./services/viewport');
const {filesFromDrop, isElectronBridge} = require('./services/drop-files');
const {
	STORAGE_KEY,
	serializeTheme,
	applyDocumentTheme
} = require('./util/theme');
const {triggerSave} = require('./util/trigger-save');

let {actions, state$} = createState(actionsTree);

viewport.start();
applyDocumentTheme(state$.getValue().themeMode);
actions.refreshFsCapabilities();

state$
	.pipe(
		map(s => s.themeMode),
		distinctUntilChanged()
	)
	.subscribe(mode => {
		applyDocumentTheme(mode);
		localStorage.setItem(STORAGE_KEY, serializeTheme(mode));
	});

state$
	.pipe(
		map(s => !!s.dirty),
		distinctUntilChanged()
	)
	.subscribe(dirty => {
		if (isElectronBridge() && typeof window.app.setDirty === 'function') {
			window.app.setDirty(dirty);
		}
	});

fromEvent(window, 'beforeunload').subscribe(ev => {
	if (!state$.getValue().dirty) return;
	if (isElectronBridge()) return;
	ev.preventDefault();
	ev.returnValue = '';
});

fromEvent(document, 'dragover').subscribe(ev => {
	ev.preventDefault();
	if (ev.dataTransfer) {
		ev.dataTransfer.dropEffect = 'copy';
	}
});

fromEvent(document, 'drop').subscribe(ev => {
	ev.preventDefault();
	filesFromDrop(ev.dataTransfer).then(nodes => {
		if (!nodes.length) return;
		const file = nodes[0];
		actions.openFile(file);
	}).catch(err => {
		console.error('drop open failed', err);
	});
});

if (isElectronBridge() && typeof window.app.onFsChange === 'function') {
	window.app.onFsChange(payload => {
		const changedPath = payload && payload.path;
		const state = state$.getValue();
		if (state.project && state.project.path && state.project.id !== 'demo') {
			actions.refreshFilesTree(state.project);
		}
		if (!changedPath || !state.file || state.file.path !== changedPath) return;
		if (state.dirty) {
			actions.markExternalChange(changedPath);
			return;
		}
		actions.openFile(Object.assign({}, state.file, {source: undefined, url: undefined}));
	});
}

fromEvent(document, 'keydown')
	.pipe(
		filter(ev => ev.ctrlKey || ev.metaKey),
		filter(ev => !ev.altKey)
	)
	.subscribe(ev => {
		const key = String(ev.key || '').toLowerCase();
		if (key === 's') {
			ev.preventDefault();
			triggerSave({state: state$.getValue(), actions});
			return;
		}
		if (key === 'o') {
			ev.preventDefault();
			actions.openFolder();
		}
	});

let vnode$ = state$.pipe(map(state => ui({state, actions})));
let patchSubscription = patchStream(vnode$, toVNode(document.body));

if (module.hot) {
	module.hot.dispose(function(data) {
		data.state = state$.getValue();
		viewport.stop();
		patchSubscription.unsubscribe();
		state$.complete();
		document.body.innerHTML = '';
	});
	module.hot.accept(function() {
		ui = require('./ui');
		if (module.hot.data && module.hot.data.state) {
			dispatch(() => module.hot.data.state);
		} else {
			dispatch(state => state);
		}
		viewport.start();
	});
}
