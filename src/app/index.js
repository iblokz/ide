'use strict';

const {map, distinctUntilChanged, fromEvent, filter} = require('rxjs');
const {createState, dispatch} = require('iblokz-state');
const {patchStream} = require('iblokz-snabbdom-helpers');
const {toVNode} = require('snabbdom');

const actionsTree = require('./state');
let ui = require('./ui')?.default ?? require('./ui');
const viewport = require('./services/viewport');
const hotkeys = require('./services/hotkeys');
const {filesFromDrop, isElectronBridge} = require('./services/drop-files');
const {
	applyDocumentTheme,
	applyHostAccent,
	readHostTheme,
	shouldFollowHostMode
} = require('./util/theme');
const {anyDirty} = require('./util/tabs');
const {triggerSave} = require('./util/trigger-save');

let {actions, state$} = createState(actionsTree);

viewport.start();
hotkeys.start(actions);
{
	const boot = state$.getValue();
	applyDocumentTheme(boot.theme && boot.theme.mode);
}
applyHostAccent(readHostTheme());
actions.project.refreshFsCapabilities();

state$
	.pipe(
		map(s => s.theme && s.theme.mode),
		distinctUntilChanged()
	)
	.subscribe(mode => {
		applyDocumentTheme(mode);
		// Re-apply after theme class swap so host vars stay on #ui/body.
		applyHostAccent(readHostTheme());
	});

state$
	.pipe(
		map(s => anyDirty(s)),
		distinctUntilChanged()
	)
	.subscribe(dirty => {
		if (isElectronBridge() && typeof window.app.setDirty === 'function') {
			window.app.setDirty(dirty);
		}
	});

fromEvent(window, 'beforeunload').subscribe(ev => {
	if (!anyDirty(state$.getValue())) return;
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
		actions.project.openFile(file);
	}).catch(err => {
		console.error('drop open failed', err);
	});
});

let stopFsChange = null;
let stopOpenFolderRequest = null;
let stopHostTheme = null;
if (isElectronBridge() && typeof window.app.onFsChange === 'function') {
	stopFsChange = window.app.onFsChange(payload => {
		const changedPath = payload && payload.path;
		const state = state$.getValue();
		if (state.view === 'workspace' && state.project && state.project.path) {
			actions.project.refreshFilesTree(state.project, state.filesTree);
		}
		if (!changedPath || !state.file || state.file.path !== changedPath) return;
		if (state.dirty) {
			actions.project.markExternalChange(changedPath);
			return;
		}
		actions.project.openFile(Object.assign({}, state.file, {source: undefined, url: undefined}));
	});
}
if (isElectronBridge() && typeof window.app.onOpenFolderRequest === 'function') {
	stopOpenFolderRequest = window.app.onOpenFolderRequest(() => {
		actions.project.openFolder();
	});
}
if (isElectronBridge() && typeof window.app.onHostThemeChange === 'function') {
	stopHostTheme = window.app.onHostThemeChange(host => {
		applyHostAccent(host);
		actions.theme.setHost(host);
		// Omarchy `mode` → theme.mode so .theme-mode-* syntax colors track the palette.
		if (shouldFollowHostMode(host)) {
			actions.theme.setMode(host.mode);
		}
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
		}
	});

let vnode$ = state$.pipe(map(state => ui({state, actions})));
let patchSubscription = patchStream(vnode$, toVNode(document.body));

if (module.hot) {
	module.hot.dispose(function(data) {
		data.state = state$.getValue();
		if (typeof stopFsChange === 'function') {
			stopFsChange();
			stopFsChange = null;
		}
		if (typeof stopOpenFolderRequest === 'function') {
			stopOpenFolderRequest();
			stopOpenFolderRequest = null;
		}
		if (typeof stopHostTheme === 'function') {
			stopHostTheme();
			stopHostTheme = null;
		}
		viewport.stop();
		hotkeys.stop();
		patchSubscription.unsubscribe();
		state$.complete();
		document.body.innerHTML = '';
	});
	module.hot.accept(function() {
		ui = require('./ui')?.default ?? require('./ui');
		if (module.hot.data && module.hot.data.state) {
			dispatch(() => module.hot.data.state);
		} else {
			dispatch(state => state);
		}
		viewport.start();
		hotkeys.start(actions);
	});
}
