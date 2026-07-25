'use strict';

const {map, distinctUntilChanged} = require('rxjs');
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

let {actions, state$} = createState(actionsTree);

viewport.start();
applyDocumentTheme(state$.getValue().themeMode);

state$
	.pipe(
		map(s => s.themeMode),
		distinctUntilChanged()
	)
	.subscribe(mode => {
		applyDocumentTheme(mode);
		localStorage.setItem(STORAGE_KEY, serializeTheme(mode));
	});

let vnode$ = state$.pipe(map(state => ui({state, actions})));
let patchSubscription = patchStream(vnode$, toVNode(document.body));

if (module.hot) {
	module.hot.dispose(function(data) {
		data.state = state$.getValue();
		viewport.stop();
		patchSubscription.unsubscribe();
		state$.complete();
		document.body.innerHTML = document.body.innerHTML;
	});
	module.hot.accept('./ui', function() {
		ui = require('./ui');
		dispatch(state => state);
	});
	module.hot.accept(function() {
		if (module.hot.data && module.hot.data.state) {
			dispatch(() => module.hot.data.state);
		}
		viewport.start();
	});
}
