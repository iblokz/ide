import {body, section, p} from 'iblokz-snabbdom-helpers';
import {fn, obj} from 'iblokz-data';
import {themeClass} from '../util/theme';
import {isStartView} from '../util/project';
import {clamp} from '../util/split-drag';
import header from './header';
import sideBar from './side-bar';
import codebin from './codebin';
import imageViewer from './image-viewer';
import startScreen from './start-screen';
import splitGutter from './comp/split-gutter';

export default ({state, actions}) => fn.pipe(
	() => ({
		toggles: state.layout.toggles,
		dim: state.layout.dim
	}),
	({toggles, dim}) => body(
		`#ui.${themeClass(state.themeMode || 'dark')}${isStartView(state) ? '.start' : ''}`,
		isStartView(state)
			? [
				header({state, actions}),
				startScreen({state, actions})
			] : [
				sideBar({
					state,
					actions,
					width: toggles.leftSideBar ? dim.leftSideBar : 0
				}),
				splitGutter({
					axis: 'x',
					hidden: !toggles.leftSideBar,
					onStart: () => {
						const el = document.querySelector('.side-bar');
						return {
							el,
							start: el ? el.getBoundingClientRect().width : dim.leftSideBar
						};
					},
					onMove: (delta, ev, ctx) => {
						if (!ctx || !ctx.el) return;
						ctx.el.style.width = `${clamp(ctx.start + delta, 140, 480)}px`;
					},
					onEnd: (delta, ev, ctx) => {
						const next = clamp((ctx && ctx.start || dim.leftSideBar) + delta, 140, 480);
						if (ctx && ctx.el) ctx.el.style.width = `${next}px`;
						actions.setLayout({leftSideBar: next});
					}
				}),
				header({state, actions}),
				!(state.file && state.file.name)
					? section('.empty-editor', [
						p(['Select a file from the sidebar to open it.'])
					])
					: state.type === 'image'
						? imageViewer({file: state.file})
						: codebin({
							source: state.source || '',
							pos: state.pos,
							type: state.type || 'js',
							layout: state.layout ?? {},
							setLayout: patch => actions.setLayout(patch),
							change: (source, pos) => actions.updateSource(source, pos),
							updatePos: pos => actions.updatePos(pos),
							undo: () => actions.undo(),
							redo: () => actions.redo()
						})
			]
	)
)();
