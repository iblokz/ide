import {modKeyLabel, os} from './platform';

/** macOS menu order: Control → Option → Shift → Command → key. */
const MAC_MOD_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'];

const MAC_SYMBOL = {
	Mod: '⌘',
	Shift: '⇧',
	Alt: '⌥',
	Ctrl: '⌃'
};

const macKey = key => (key.length === 1 ? key.toUpperCase() : key);

/** `Mod+Shift+B` → `⇧⌘B` (macOS) or `Ctrl+Shift+B`. */
export const formatHotkey = chord => {
	if (!chord) return '';
	const parts = String(chord).split('+').map(s => s.trim());
	if (os() === 'macos') {
		const key = parts[parts.length - 1];
		const mods = parts.slice(0, -1);
		return MAC_MOD_ORDER
			.filter(m => mods.includes(m))
			.map(m => MAC_SYMBOL[m])
			.join('') + macKey(key);
	}
	return parts.map(part => {
		if (part === 'Mod') return modKeyLabel();
		if (part === 'Shift') return 'Shift';
		if (part === 'Alt') return 'Alt';
		return part;
	}).join('+');
};

/** Invert config map: `toggle layout.toggles.leftSideBar` → `Mod+B`. */
export const chordForAction = (hotkeyMap, action) =>
	Object.entries(hotkeyMap).find(([, a]) => a === action)?.[0] || '';

export default {
	formatHotkey,
	chordForAction
};
