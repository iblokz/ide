'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {execFileSync} = require('child_process');

const OMARCHY_CURRENT = path.join(os.homedir(), '.local', 'state', 'omarchy', 'current');
const OMARCHY_COLORS = path.join(OMARCHY_CURRENT, 'theme', 'colors.toml');
const OMARCHY_THEME_NAME = path.join(OMARCHY_CURRENT, 'theme.name');

/** GNOME accent-color enum → approximate hex (Adwaita-ish). */
const GNOME_ACCENT_HEX = {
	blue: '#3584e4',
	teal: '#2190a4',
	green: '#3a944a',
	yellow: '#c88800',
	orange: '#ed5b00',
	red: '#e62d42',
	pink: '#d56199',
	purple: '#9141ac',
	slate: '#6f8396'
};

const normalizeHex = value => {
	if (value == null) return null;
	let s = String(value).trim().replace(/^['"]|['"]$/g, '');
	if (!s) return null;
	if (/^[0-9a-fA-F]{6}$/.test(s)) s = `#${s}`;
	if (/^[0-9a-fA-F]{8}$/.test(s)) s = `#${s.slice(0, 6)}`;
	if (!/^#[0-9a-fA-F]{6}$/.test(s)) return null;
	return s.toLowerCase();
};

const hexToRgb = hex => {
	const h = normalizeHex(hex);
	if (!h) return null;
	const n = parseInt(h.slice(1), 16);
	return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
};

const hexToRgba = (hex, alpha) => {
	const rgb = hexToRgb(hex);
	if (!rgb) return null;
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

/** Relative luminance 0–1 (sRGB). */
const luminance = hex => {
	const rgb = hexToRgb(hex);
	if (!rgb) return 0;
	const lin = c => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
};

const softAlpha = mode => (mode === 'dark' ? 0.16 : 0.12);

const parseTomlSimple = text => {
	const out = {};
	String(text || '').split(/\r?\n/).forEach(line => {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) return;
		const m = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
		if (!m) return;
		let raw = m[2].trim();
		if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
			raw = raw.slice(1, -1);
		}
		out[m[1]] = raw;
	});
	return out;
};

/** Map Omarchy colors.toml → IDE --app-* token values (without --app- prefix). */
const omarchyToAppVars = (colors, mode) => {
	const bg = normalizeHex(colors.background || colors.bg);
	const darkBg = normalizeHex(colors.dark_background || colors.dark_bg) || bg;
	const darkerBg = normalizeHex(colors.darker_background || colors.darker_bg) || darkBg;
	const lighterBg = normalizeHex(colors.lighter_background || colors.lighter_bg) || bg;
	const fg = normalizeHex(colors.foreground || colors.fg);
	const brightFg = normalizeHex(colors.bright_foreground || colors.bright_fg) || fg;
	const lightFg = normalizeHex(colors.light_foreground || colors.light_fg);
	const muted = normalizeHex(colors.muted);
	const selection = normalizeHex(colors.selection || colors.selection_background);
	const accent = normalizeHex(colors.accent || colors.orange || colors.blue);
	const danger = normalizeHex(colors.red);
	const border = selection || muted || lighterBg;
	const textMuted = lightFg || muted || darkFgFallback(colors);
	const onAccent = accent && luminance(accent) > 0.4
		? (darkerBg || darkBg || '#12161c')
		: '#ffffff';

	if (!bg || !fg || !accent) return null;

	const soft = softAlpha(mode);
	// Match Omarchy’s own apps (e.g. vscode-theme): chrome uses `background`,
	// not `lighter_background` — that token is for hovers / raised controls.
	const panel = bg;
	const mutedBg = darkBg || selection || bg;
	const hoverBg = lighterBg || selection || bg;
	return {
		'bg-page': bg,
		'bg-panel': panel,
		'bg-muted': mutedBg,
		'bg-hover': hoverBg,
		'bg-header-formed': hexToRgba(panel, 0.95),
		'panel-shadow': mode === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.35)' : '0 1px 2px rgba(18, 22, 28, 0.05)',
		text: fg,
		'text-hover': brightFg,
		'text-muted': textMuted,
		'text-strong': brightFg,
		'text-on-accent': onAccent,
		shadow: mode === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(18, 22, 28, 0.15)',
		'shadow-soft': mode === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.35)' : '0 1px 2px rgba(18, 22, 28, 0.05)',
		border,
		accent,
		'accent-soft': hexToRgba(accent, soft),
		danger: danger || undefined,
		'btn-primary-bg': accent,
		'btn-primary-text': onAccent,
		'btn-secondary-bg': mutedBg,
		'btn-secondary-text': fg,
		'btn-secondary-border': border,
		'input-bg': darkBg || bg,
		'input-border': border,
		'input-text': fg,
		'editor-bg': darkBg || bg,
		'editor-text': fg,
		'console-bg': darkerBg || darkBg || bg,
		icon: textMuted,
		'icon-hover': brightFg,
		'arrow-fill': textMuted,
		'control-border-formed': hexToRgba(border, 0.7),
		'control-bg-formed': hexToRgba(hoverBg, 0.9)
	};
};

const darkFgFallback = colors =>
	normalizeHex(colors.dark_foreground || colors.dark_fg);

const accentOnlyVars = (accent, mode) => {
	const hex = normalizeHex(accent);
	if (!hex) return null;
	const onAccent = luminance(hex) > 0.55 ? '#12161c' : '#ffffff';
	return {
		accent: hex,
		'accent-soft': hexToRgba(hex, softAlpha(mode)),
		'btn-primary-bg': hex,
		'btn-primary-text': onAccent,
		'text-on-accent': onAccent
	};
};

const finishTheme = theme => {
	const vars = theme.vars || null;
	const accent = vars && vars.accent ? vars.accent : theme.accent;
	const accentSoft = vars && vars['accent-soft'] ? vars['accent-soft'] : theme.accentSoft;
	return Object.assign({}, theme, {
		accent: accent || null,
		accentSoft: accentSoft || null,
		vars: vars || null
	});
};

const readOmarchy = () => {
	if (!fs.existsSync(OMARCHY_COLORS)) return null;
	let text;
	try {
		text = fs.readFileSync(OMARCHY_COLORS, 'utf8');
	} catch (err) {
		return null;
	}
	const colors = parseTomlSimple(text);
	const mode = colors.mode === 'light' ? 'light' : 'dark';
	let name = null;
	try {
		if (fs.existsSync(OMARCHY_THEME_NAME)) {
			name = fs.readFileSync(OMARCHY_THEME_NAME, 'utf8').trim() || null;
		}
	} catch (err) { /* ignore */ }
	const vars = omarchyToAppVars(colors, mode);
	const accent = vars && vars.accent
		? vars.accent
		: normalizeHex(colors.accent || colors.orange || colors.blue);
	return finishTheme({
		source: 'omarchy',
		mode,
		name,
		colors,
		accent,
		accentSoft: vars ? vars['accent-soft'] : hexToRgba(accent, softAlpha(mode)),
		vars
	});
};

const gsettingsGet = key => {
	try {
		const out = execFileSync(
			'gsettings',
			['get', 'org.gnome.desktop.interface', key],
			{encoding: 'utf8', timeout: 1500}
		).trim();
		return out.replace(/^['"]|['"]$/g, '');
	} catch (err) {
		return null;
	}
};

const readGnome = () => {
	const scheme = gsettingsGet('color-scheme');
	if (!scheme) return null;
	const mode = /prefer-light/i.test(scheme) ? 'light' : 'dark';
	const accentName = (gsettingsGet('accent-color') || '').toLowerCase();
	const accent = GNOME_ACCENT_HEX[accentName] || null;
	const vars = accentOnlyVars(accent, mode);
	return finishTheme({
		source: 'gnome',
		mode,
		name: accentName || null,
		colors: null,
		accent: vars && vars.accent,
		accentSoft: vars && vars['accent-soft'],
		vars
	});
};

const readMacos = () => {
	if (process.platform !== 'darwin') return null;
	try {
		const {nativeTheme, systemPreferences} = require('electron');
		const mode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
		let accent = null;
		if (typeof systemPreferences.getAccentColor === 'function') {
			accent = systemPreferences.getAccentColor();
		}
		const vars = accentOnlyVars(accent, mode);
		return finishTheme({
			source: 'macos',
			mode,
			name: null,
			colors: null,
			accent: vars && vars.accent,
			accentSoft: vars && vars['accent-soft'],
			vars
		});
	} catch (err) {
		return null;
	}
};

const readNativeThemeFallback = () => {
	try {
		const {nativeTheme} = require('electron');
		return finishTheme({
			source: 'electron',
			mode: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
			accent: null,
			accentSoft: null,
			name: null,
			colors: null,
			vars: null
		});
	} catch (err) {
		return finishTheme({
			source: 'unknown',
			mode: 'dark',
			accent: null,
			accentSoft: null,
			name: null,
			colors: null,
			vars: null
		});
	}
};

/**
 * Prefer Omarchy palette when present, else GNOME scheme/accent, else macOS, else Electron nativeTheme.
 */
const detectHostTheme = () =>
	readOmarchy()
	|| (process.platform === 'linux' ? readGnome() : null)
	|| readMacos()
	|| readNativeThemeFallback();

/** IPC payload — includes CSS var map for the renderer. */
const toHostThemePayload = theme => ({
	source: theme.source,
	mode: theme.mode,
	accent: theme.accent,
	accentSoft: theme.accentSoft,
	name: theme.name,
	vars: theme.vars || null
});

module.exports = {
	OMARCHY_CURRENT,
	OMARCHY_COLORS,
	OMARCHY_THEME_NAME,
	detectHostTheme,
	toHostThemePayload,
	omarchyToAppVars,
	normalizeHex,
	hexToRgba
};
