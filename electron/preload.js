'use strict';

const {contextBridge, ipcRenderer} = require('electron');

// Inline WM detect — sandboxed preload cannot require('./util/wm').
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

const detectWindowManager = (env = process.env) => {
	const raw = String(env.XDG_CURRENT_DESKTOP || env.XDG_SESSION_DESKTOP || '').toLowerCase();
	const tokens = raw.split(/[:;,]/).map(s => s.trim()).filter(Boolean);
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

const windowManager = detectWindowManager();

contextBridge.exposeInMainWorld('app', {
	platform: 'electron',
	versions: {
		node: process.versions.node,
		chrome: process.versions.chrome,
		electron: process.versions.electron
	},
	/** Linux session heuristic: tiling vs floating DE (macOS/Windows → tiling false). */
	windowManager,
	/** Live read — frozen snapshot stays stale across loadURL navigations. */
	getLoadModeSync: () => ipcRenderer.sendSync('getLoadModeSync'),
	getLoadMode: () => ipcRenderer.invoke('getLoadMode'),
	toggleLoadMode: () => ipcRenderer.invoke('toggleLoadMode'),
	onLoadModeChange: callback => {
		const handler = (_event, mode) => callback(mode);
		ipcRenderer.on('load-mode', handler);
		return () => ipcRenderer.removeListener('load-mode', handler);
	},
	getHostThemeSync: () => ipcRenderer.sendSync('getHostThemeSync'),
	getHostTheme: () => ipcRenderer.invoke('getHostTheme'),
	onHostThemeChange: callback => {
		const handler = (_event, theme) => callback(theme);
		ipcRenderer.on('host-theme', handler);
		return () => ipcRenderer.removeListener('host-theme', handler);
	},
	selectRootFolder: () => ipcRenderer.invoke('selectRootFolder'),
	openRootFolder: dirPath => ipcRenderer.invoke('openRootFolder', dirPath),
	listDir: dirPath => ipcRenderer.invoke('listDir', dirPath),
	readFile: filePath => ipcRenderer.invoke('readFile', filePath),
	readFileDataUrl: filePath => ipcRenderer.invoke('readFileDataUrl', filePath),
	writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
	setDirty: value => ipcRenderer.invoke('setDirty', value),
	onFsChange: callback => {
		const handler = (_event, payload) => callback(payload);
		ipcRenderer.on('fs-change', handler);
		return () => ipcRenderer.removeListener('fs-change', handler);
	},
	minimize: () => ipcRenderer.invoke('minimize'),
	toggleMaximize: () => ipcRenderer.invoke('toggleMaximize'),
	close: () => ipcRenderer.invoke('close'),
	onOpenFolderRequest: callback => {
		const handler = () => callback();
		ipcRenderer.on('open-folder-request', handler);
		return () => ipcRenderer.removeListener('open-folder-request', handler);
	}
});
