'use strict';

const {h1, button, header, span, i} = require('iblokz-snabbdom-helpers');
const svgHamburger = require('./comp/svg/hamburger');
const {panesLabel, panesIcon, normalizePanes, nextPanes} = require('../util/layout');
const {canSave, saveHint} = require('../util/save');
const {triggerSave} = require('../util/trigger-save');

const isElectron = () =>
	typeof window !== 'undefined'
	&& window.app
	&& window.app.platform === 'electron';

module.exports = ({state, actions}) => {
	const panes = normalizePanes(state.layout && state.layout.panes);
	const nextLabel = panesLabel(nextPanes(panes));
	const saveEnabled = canSave(state);
	const saveTitle = state.saveError || saveHint(state);
	const electron = isElectron();

	return header({
		on: electron ? {
			// Fallback when dblclick lands outside the drag region (e.g. Linux quirks)
			dblclick: ev => {
				const t = ev.target;
				if (!t || !t.closest) return;
				if (t.closest('button, a, input')) return;
				if (typeof window.app.toggleMaximize === 'function') {
					window.app.toggleMaximize();
				}
			}
		} : {}
	}, [
		span('.header-start', [
			span('.app-icon', {
				attrs: {
					role: 'img',
					'aria-label': 'iBloKz IDE'
				}
			}),
			button('.menu-toggle', {
				attrs: {'aria-label': 'Toggle sidebar'},
				on: {click: () => actions.toggle('sideBar')}
			}, [
				svgHamburger(({state: state.sideBar ? 1 : 0, strokeWidth: '3px', size: 22}))
			])
		]),
		h1([
			'iBloKz IDE',
			state.file && state.file.name
				? span('.file-title', [
					' — ',
					state.file.name,
					state.dirty ? ' •' : '',
					state.externalChange ? span('.external-change', ' (changed on disk)') : '',
					state.saveError ? span('.save-error', ` — ${state.saveError}`) : ''
				])
				: []
		]),
		span('.header-actions', [
			button('.save-file', {
				attrs: {
					'aria-label': 'Save file',
					title: saveTitle
				},
				props: {
					disabled: !saveEnabled
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
			button('.panes-toggle', {
				attrs: {
					'aria-label': `Layout: ${panesLabel(panes)}. Click for ${nextLabel}`,
					title: `${panesLabel(panes)} → ${nextLabel}`
				},
				on: {click: () => actions.cyclePanes()}
			}, [
				i(`.fa.${panesIcon(panes)}`)
			]),
			button('.theme-toggle', {
				attrs: {
					'aria-label': state.themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
					title: state.themeMode === 'dark' ? 'Light theme' : 'Dark theme'
				},
				on: {click: () => actions.toggleTheme()}
			}, [
				i(`.fa.${state.themeMode === 'dark' ? 'fa-sun-o' : 'fa-moon-o'}`)
			]),
			...(electron ? [
				button('.window-minimize', {
					attrs: {
						'aria-label': 'Minimize',
						title: 'Minimize'
					},
					on: {click: () => window.app.minimize()}
				}, [
					i('.fa.fa-minus')
				]),
				button('.window-close', {
					attrs: {
						'aria-label': 'Close',
						title: 'Close'
					},
					on: {click: () => window.app.close()}
				}, [
					i('.fa.fa-close')
				])
			] : [])
		])
	]);
};
