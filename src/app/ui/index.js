'use strict';

const {body} = require('iblokz-snabbdom-helpers');
const {themeClass} = require('../util/theme');
const header = require('./header');
const sideBar = require('./side-bar');
const codebin = require('./codebin');

module.exports = ({state, actions}) => body(`#ui.${themeClass(state.themeMode || 'dark')}`, [
	sideBar({state, actions}),
	header({state, actions}),
	codebin({
		source: state.source || '',
		pos: state.pos,
		type: state.type || 'js',
		change: (source, pos) => actions.updateSource(source, pos),
		updatePos: pos => actions.updatePos(pos),
		undo: () => actions.undo(),
		redo: () => actions.redo()
	})
]);
