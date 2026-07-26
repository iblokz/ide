'use strict';

const {map, distinctUntilChanged, fromEvent, filter} = require('rxjs');
const {createState, dispatch} = require('iblokz-state');
const {patchStream} = require('iblokz-snabbdom-helpers');
const {toVNode} = require('snabbdom');

const actionsTree = require('./state');
let ui = require('./ui');
const viewport = require('./services/viewport');
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
