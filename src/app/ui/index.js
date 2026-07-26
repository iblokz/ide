'use strict';

const {body} = require('iblokz-snabbdom-helpers');
const {themeClass} = require('../util/theme');
const {isStartView} = require('../util/project');
const {clamp} = require('../util/split-drag');
const header = require('./header');
const sideBar = require('./side-bar');
const codebin = require('./codebin');
const imageViewer = require('./image-viewer');
const startScreen = require('./start-screen');
const emptyEditor = require('./empty-editor');
const splitGutter = require('./comp/split-gutter');

module.exports = ({state, actions}) => {
	const layout = state.layout || {};
	const onStart = isStartView(state);
	const sideBarOpen = !onStart && !!state.sideBar;
	const sideBarWidth = sideBarOpen ? (layout.sideBar || 260) : 0;
	const showingImage = state.type === 'image';
	const hasFile = !!(state.file && state.file.name);

	return body(`#ui.${themeClass(state.themeMode || 'dark')}${onStart ? '.start' : ''}`, [
		onStart
			? null
			: sideBar({
				state,
				actions,
				width: sideBarWidth
			}),
		onStart
			? null
			: splitGutter({
				axis: 'x',
				hidden: !sideBarOpen,
				onStart: () => {
					const el = document.querySelector('.side-bar');
					return {
						el,
						start: el ? el.getBoundingClientRect().width : (layout.sideBar || 260)
					};
				},
				onMove: (delta, ev, ctx) => {
					if (!ctx || !ctx.el) return;
					ctx.el.style.width = `${clamp(ctx.start + delta, 140, 480)}px`;
				},
				onEnd: (delta, ev, ctx) => {
					const next = clamp((ctx && ctx.start || 260) + delta, 140, 480);
					if (ctx && ctx.el) ctx.el.style.width = `${next}px`;
					actions.setLayout({sideBar: next});
				}
			}),
		header({state, actions}),
		onStart
			? startScreen({state, actions})
			: !hasFile
				? emptyEditor()
				: showingImage
					? imageViewer({file: state.file})
					: codebin({
						source: state.source || '',
						pos: state.pos,
						type: state.type || 'js',
						layout,
						setLayout: patch => actions.setLayout(patch),
						change: (source, pos) => actions.updateSource(source, pos),
						updatePos: pos => actions.updatePos(pos),
						undo: () => actions.undo(),
						redo: () => actions.redo()
					})
	].filter(Boolean));
};
