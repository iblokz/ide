import {fromEvent} from 'rxjs';
import {dispatch} from 'iblokz-state';
import {obj} from 'iblokz-data';

import hotkeyMap from '../../../config/hotkeys.yml';

const parseChord = chord => {
	const parts = chord.split('+').map(s => s.trim());
	const key = parts[parts.length - 1].toLowerCase();
	const mods = parts.slice(0, -1);
	return {
		key,
		mod: mods.includes('Mod'),
		shift: mods.includes('Shift'),
		alt: mods.includes('Alt')
	};
};

const bindings = Object.entries(hotkeyMap)
	.map(([chord, action]) => ({action, ...parseChord(chord)}))
	.sort((a, b) => (Number(b.mod) + Number(b.shift) + Number(b.alt))
		- (Number(a.mod) + Number(a.shift) + Number(a.alt)));

const keyMatches = (ev, b) => {
	const pressed = String(ev.key || '').toLowerCase();
	if (pressed === b.key) return true;
	// Physical `/` key (some layouts need Shift for `/`; Mod+/ still uses Slash).
	if (b.key === '/' && ev.code === 'Slash') return true;
	return false;
};

const match = (ev, b) =>
	keyMatches(ev, b)
	&& (ev.ctrlKey || ev.metaKey) === b.mod
	&& ev.shiftKey === b.shift
	&& ev.altKey === b.alt;

/** Resolve `layout.toggle` / `actions.layout.toggle` on the actions tree. */
const resolveFn = (actions, path) => {
	const parts = String(path || '')
		.replace(/^actions\./, '')
		.split('.')
		.filter(Boolean);
	return parts.reduce((node, key) => (node == null ? node : node[key]), actions);
};

const run = (action, actions = {}) => {
	const trimmed = String(action).trim();
	const space = trimmed.indexOf(' ');
	const path = space === -1 ? trimmed : trimmed.slice(0, space);
	const arg = space === -1 ? undefined : trimmed.slice(space + 1);

	// Legacy: `toggle layout.toggles.leftSideBar`
	if (path === 'toggle' && arg) {
		const statePath = arg.split('.');
		dispatch(state => obj.patch(state, statePath, !obj.sub(state, statePath)));
		return;
	}

	const fn = resolveFn(actions, path);
	if (typeof fn !== 'function') return;

	// Electron legacy/main File menu owns Cmd/Ctrl+O (open-folder-request).
	if (path === 'project.openFolder' || path === 'openFolder') {
		if (typeof window !== 'undefined' && window.app && window.app.platform === 'electron'
			&& typeof window.app.onOpenFolderRequest === 'function') {
			return;
		}
	}

	if (arg !== undefined) fn(arg);
	else fn();
};

export let stop = () => {};

export const start = (actions = {}) => {
	const sub = fromEvent(document, 'keydown').subscribe(ev => {
		const hit = bindings.find(b => match(ev, b));
		if (!hit) return;
		ev.preventDefault();
		run(hit.action, actions);
	});
	stop = () => sub.unsubscribe();
};

export default {
	start,
	stop
};
