import {h1, button, header, span, i} from 'iblokz-snabbdom-helpers';
import svgHamburger from './comp/svg/hamburger';
import {canSave, saveHint} from '../util/save';
import {isStartView} from '../util/project';
import {triggerSave} from '../util/trigger-save';
import {isElectron} from '../util/platform';
import {formatHotkey, chordForAction} from '../util/hotkey';
import hotkeyMap from '../../../config/hotkeys.yml';
import dropdown from './comp/dropdown';

const ideTitle = 'iBlokz IDE';

const prepFileTitle = state =>
	!isStartView(state) && state.file && state.file.name
		? span('.file-title', [].concat(
			' — ',
			String(state.file.name),
			state.dirty ? ' •' : [],
			state.externalChange
				? span('.external-change', ' (changed on disk)')
				: [],
			state.saveError
				? span('.save-error', ` — ${state.saveError}`)
				: []
		))
		: [];

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

export default ({state, actions}) => header({
	on: isElectron() ? {
		dblclick: ev => {
			const t = ev.target;
			if (!t || !t.closest) return;
			if (t.closest('button, a, input')) return;
			if (typeof window.app.toggleMaximize === 'function') {
				window.app.toggleMaximize();
			}
		}
	} : {}
}, [].concat(
	span('.header-start', [].concat(
		span('.app-icon', {
			attrs: {
				role: 'img',
				'aria-label': 'iBloKz IDE'
			}
		}),
		isStartView(state)
			? []
			: button('.menu-toggle', {
				attrs: {'aria-label': 'Toggle sidebar'},
				on: {click: () => actions.toggle(['layout', 'toggles', 'leftSideBar'])}
			}, [
				svgHamburger(({state: state.layout.toggles.leftSideBar ? 1 : 0, strokeWidth: '3px', size: 22}))
			])
	)),
	h1([].concat(ideTitle, prepFileTitle(state))),
	span('.header-actions', [].concat(
		isStartView(state) ? [] : button('.save-file', {
			attrs: {
				'aria-label': 'Save file',
				title: state.saveError || saveHint(state)
			},
			props: {
				disabled: !canSave(state)
			},
			on: {
				click: ev => {
					ev.preventDefault();
					triggerSave({state, actions});
				}
			}
		}, [
			i('.fa.fa-save')
		]),
		dropdown('.layout-menu', {
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
		isElectron() ? [
			button('.window-minimize[aria-label="Minimize"][title="Minimize"]', {
				on: {click: () => window.app.minimize()}
			}, [i('.fa.fa-minus')]),
			button('.window-close[aria-label="Close"][title="Close"]', {
				on: {click: () => window.app.close()}
			}, [i('.fa.fa-close')])
		] : []
	))
));
