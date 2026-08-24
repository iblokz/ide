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

const match = (ev, b) =>
	String(ev.key || '').toLowerCase() === b.key
	&& (ev.ctrlKey || ev.metaKey) === b.mod
	&& ev.shiftKey === b.shift
	&& ev.altKey === b.alt;

const run = action => {
	const [verb, target] = String(action).trim().split(/\s+/);
	if (verb !== 'toggle' || !target) return;
	const path = target.split('.');
	dispatch(state => obj.patch(state, path, !obj.sub(state, path)));
};

export let stop = () => {};

export const start = () => {
	const sub = fromEvent(document, 'keydown').subscribe(ev => {
		const hit = bindings.find(b => match(ev, b));
		if (!hit) return;
		ev.preventDefault();
		run(hit.action);
	});
	stop = () => sub.unsubscribe();
};

export default {
	start,
	stop
};
