'use strict';

const {h1, button, header, span, i} = require('iblokz-snabbdom-helpers');
const svgHamburger = require('./comp/svg/hamburger');

module.exports = ({state, actions}) => header([
	button('.menu-toggle', {
		attrs: {'aria-label': 'Toggle sidebar'},
		on: {click: () => actions.toggle('sideBar')}
	}, [
		svgHamburger(({state: state.sideBar ? 1 : 0, strokeWidth: '3px', size: 22}))
	]),
	h1('iBloKz IDE'),
	span('.header-actions', [
		button('.theme-toggle', {
			attrs: {
				'aria-label': state.themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
				title: state.themeMode === 'dark' ? 'Light theme' : 'Dark theme'
			},
			on: {click: () => actions.toggleTheme()}
		}, [
			i(`.fa.${state.themeMode === 'dark' ? 'fa-sun-o' : 'fa-moon-o'}`)
		])
	])
]);
