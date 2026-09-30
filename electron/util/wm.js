'use strict';

/** Known tiling WMs / compositors (lowercase). Heuristic — Wayland has no tiling API. */
const TILING_DESKTOPS = new Set([
	'awesome',
	'bspwm',
	'dwl',
	'dwm',
	'herbstluftwm',
	'hyprland',
	'i3',
	'leftwm',
	'niri',
	'qtile',
	'river',
	'spectrwm',
	'sway',
	'xmonad'
]);

const splitDesktopList = value =>
	String(value || '')
		.toLowerCase()
		.split(/[:;,]/)
		.map(s => s.trim())
		.filter(Boolean);

/**
 * @returns {{tiling: boolean, desktop: string, sessionType: string}}
 */
const detectWindowManager = (env = process.env) => {
	const desktopRaw = env.XDG_CURRENT_DESKTOP || env.XDG_SESSION_DESKTOP || '';
	const tokens = splitDesktopList(desktopRaw);
	const desktop = tokens[0] || '';

	const tilingByName = tokens.some(t => TILING_DESKTOPS.has(t));
	const tilingByEnv = Boolean(
		env.HYPRLAND_INSTANCE_SIGNATURE
		|| env.SWAYSOCK
		|| env.I3SOCK
		|| env.NIRI_SOCKET
	);

	return {
		tiling: tilingByName || tilingByEnv,
		desktop: desktop || (tilingByEnv
			? (env.HYPRLAND_INSTANCE_SIGNATURE && 'hyprland')
				|| (env.SWAYSOCK && 'sway')
				|| (env.I3SOCK && 'i3')
				|| (env.NIRI_SOCKET && 'niri')
				|| ''
			: ''),
		sessionType: String(env.XDG_SESSION_TYPE || '').toLowerCase()
	};
};

module.exports = {
	TILING_DESKTOPS,
	detectWindowManager
};
