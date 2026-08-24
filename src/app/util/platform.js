const ua = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';

const navPlatform = () => (typeof navigator !== 'undefined' ? navigator.platform : '') || '';

const getCapacitor = () => {
	if (typeof window === 'undefined') return null;
	return window.Capacitor || null;
};

/** Electron preload bridge (`window.app.platform === 'electron'`). */
export const isElectron = () =>
	typeof window !== 'undefined'
	&& !!window.app
	&& window.app.platform === 'electron';

/** @deprecated use isElectron */
export const isElectronBridge = isElectron;

/** Capacitor WebView with native bridge (Android / iOS app). */
export const isCapacitorNative = () => {
	if (typeof window === 'undefined') return false;
	if (window.androidBridge) return true;
	if (window.webkit?.messageHandlers?.bridge) return true;
	const Cap = getCapacitor();
	return !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
};

/** Capacitor platform id: `ios` | `android` | `web`, or null when unavailable. */
export const capacitorPlatform = () => {
	const Cap = getCapacitor();
	return Cap && typeof Cap.getPlatform === 'function' ? Cap.getPlatform() : null;
};

/** App shell: `electron` | `capacitor` | `web`. */
export const runtime = () => {
	if (isElectron()) return 'electron';
	if (isCapacitorNative()) return 'capacitor';
	return 'web';
};

/** Host OS: `macos` | `windows` | `linux` | `ios` | `android` | `unknown`. */
export const os = () => {
	const cap = capacitorPlatform();
	if (cap === 'ios' || cap === 'android') return cap;

	const u = ua();
	const platform = navPlatform();

	if (/Win/i.test(platform) || /Windows/i.test(u)) return 'windows';
	if (/iPhone|iPad|iPod/i.test(u)) return 'ios';
	if (/Android/i.test(u)) return 'android';
	if (/Mac/i.test(platform) || /Macintosh/i.test(u)) {
		if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) return 'ios';
		return 'macos';
	}
	if (/Linux/i.test(platform) || /Linux/i.test(u)) return 'linux';
	return 'unknown';
};

/** Coarse device class: `mobile` | `tablet` | `desktop`. */
export const deviceType = () => {
	const u = ua();
	if (/iPad|Tablet/i.test(u) || (/Android/i.test(u) && !/Mobile/i.test(u))) return 'tablet';
	if (/Mobi|iPhone|iPod|Android/i.test(u)) return 'mobile';
	if (typeof window !== 'undefined') {
		const w = window.innerWidth;
		if (w < 576) return 'mobile';
		if (w < 992) return 'tablet';
	}
	return 'desktop';
};

/** Browser engine / vendor: `chrome` | `firefox` | `safari` | `edge` | `brave` | `unknown`. */
export const browser = () => {
	if (typeof navigator !== 'undefined' && navigator.brave) return 'brave';
	const u = ua();
	if (/Brave/i.test(u)) return 'brave';
	if (/Edg\//.test(u)) return 'edge';
	if (/Firefox\//.test(u)) return 'firefox';
	if (/Chrome\//.test(u)) return 'chrome';
	if (/Safari\//.test(u)) return 'safari';
	return 'unknown';
};

/** Primary modifier for shortcuts: `meta` (macOS) or `ctrl`. */
export const modKey = () => (os() === 'macos' ? 'meta' : 'ctrl');

/** Human label for the primary modifier (`Cmd` / `Ctrl`). */
export const modKeyLabel = () => (os() === 'macos' ? 'Cmd' : 'Ctrl');

export {ua, getCapacitor};

export default {
	ua,
	runtime,
	os,
	deviceType,
	browser,
	modKey,
	modKeyLabel,
	isElectron,
	isElectronBridge,
	isCapacitorNative,
	capacitorPlatform,
	getCapacitor
};
