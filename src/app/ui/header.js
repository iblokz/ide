import {button, header, h1, span, i} from 'iblokz-snabbdom-helpers';
import svgHamburger from './comp/svg/hamburger';
import {isStartView} from '../util/project';
import {isElectron, showWindowControls} from '../util/platform';
import {formatHotkey, chordForAction} from '../util/hotkey';
import hotkeyMap from '../../../config/hotkeys.yml';
import dropdown from './comp/dropdown';
import tabs from './comp/tabs';
import fileSearch from './comp/file-search';

const ideTitle = 'iBlokz IDE';
const loadModeHotkey = formatHotkey('Mod+Shift+H');

const layoutIcon = name => span(`.layout-icon.${name}`);

const layoutMenuItems = [
	{id: 'left-side-bar', label: 'Left Side Bar', toggleKey: 'leftSideBar'},
	{id: 'right-side-bar', label: 'Right Side Bar', toggleKey: 'rightSideBar'},
	{id: 'bottom-panel', label: 'Bottom Panel', toggleKey: 'bottomPanel'},
	{id: 'preview', label: 'Preview', toggleKey: 'preview'}
].map(item => Object.assign({}, item, {
	hotkey: formatHotkey(chordForAction(hotkeyMap, `toggle layout.toggles.${item.toggleKey}`))
}));

const renderLayoutItem = item => span('.layout-option', [
	layoutIcon(item.id),
	span('.layout-label', item.label),
	span('.layout-hotkey', item.hotkey)
]);

const resolveLoadMode = () => {
	if (!isElectron() || typeof window === 'undefined' || !window.app) return null;
	if (typeof window.app.getLoadModeSync === 'function') {
		const mode = window.app.getLoadModeSync();
		if (mode === 'dev' || mode === 'static') return mode;
	}
	if (window.app.loadMode === 'dev' || window.app.loadMode === 'static') {
		return window.app.loadMode;
	}
	try {
		const u = new URL(window.location.href);
		if ((u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.port === '1234') {
			return 'dev';
		}
	} catch (err) { /* ignore */ }
	return 'static';
};

const isHmrLoadMode = () => resolveLoadMode() === 'dev';

export default ({state, actions}) => {
	const start = isStartView(state);
	const tabStrip = start ? null : tabs({state, actions});

	return header({
		on: showWindowControls() ? {
			dblclick: ev => {
				const t = ev.target;
				if (!t || !t.closest) return;
				if (t.closest('button, a, input, .tab, .tab-strip, .file-search, .dropdown')) return;
				if (typeof window.app.toggleMaximize === 'function') {
					window.app.toggleMaximize();
				}
			}
		} : {}
	}, [].concat(
		span('.header-start', [].concat(
			start
				? []
				: button('.menu-toggle', {
					attrs: {'aria-label': 'Toggle sidebar'},
					on: {click: () => actions.toggle(['layout', 'toggles', 'leftSideBar'])}
				}, [
					svgHamburger(({state: state.layout.toggles.leftSideBar ? 1 : 0, strokeWidth: '3px', size: 22}))
				]),
			span('.app-icon', {
				attrs: {
					role: 'img',
					'aria-label': 'iBloKz IDE'
				}
			}),
			start ? h1([ideTitle]) : (tabStrip || []),
			start ? [] : fileSearch({state, actions})
		)),
		span('.header-actions', [].concat(
			start ? [] : dropdown('.layout-menu', {
				handle: layoutIcon('menu'),
				itemSelect: (ev, item) =>
					actions.toggle(['layout', 'toggles', item.toggleKey]),
				items: layoutMenuItems.map(item => ({
					...item,
					active: !!state.layout.toggles[item.toggleKey]
				})),
				renderItem: renderLayoutItem,
				toLeft: true
			}),
			button('.theme-toggle', {
				attrs: {
					'aria-label': state.themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
					title: state.themeMode === 'dark' ? 'Light theme' : 'Dark theme'
				},
				on: {click: () => actions.toggleTheme()}
			}, [
				i(`.fa.${state.themeMode === 'dark' ? 'fa-sun-o' : 'fa-moon-o'}`)
			]),
			isHmrLoadMode()
				? button('.load-mode-flag.is-hmr', {
					attrs: {
						'aria-label': 'Development HMR — switch to static',
						title: `Development (HMR) — ${loadModeHotkey}`
					},
					on: {
						click: ev => {
							ev.preventDefault();
							if (typeof window.app.toggleLoadMode === 'function') {
								window.app.toggleLoadMode();
							}
						}
					}
				}, [
					span('.load-mode-label', 'HMR')
				])
				: [],
			showWindowControls() ? [
				button('.window-minimize[aria-label="Minimize"][title="Minimize"]', {
					on: {click: () => window.app.minimize()}
				}, [i('.fa.fa-minus')]),
				button('.window-close[aria-label="Close"][title="Close"]', {
					on: {click: () => window.app.close()}
				}, [i('.fa.fa-close')])
			] : []
		))
	));
};
