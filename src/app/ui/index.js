import {body, main, section, p, button, i} from 'iblokz-snabbdom-helpers';
import {fn} from 'iblokz-data';
import {themeClass, hostStyleProps} from '../util/theme';
import {isStartView} from '../util/project';
import {canSave, saveHint} from '../util/save';
import {triggerSave} from '../util/trigger-save';
import {clamp} from '../util/split-drag';
import header from './header';
import sideBar from './side-bar';
import codebin from './codebin';
import imageViewer from './image-viewer';
import startScreen from './start-screen';
import splitGutter from './comp/split-gutter';
import findBar from './comp/find-bar';

const editorPane = ({state, actions}) => {
	if (!(state.file && state.file.name)) {
		return section('.empty-editor', [
			p(['Select a file from the sidebar to open it.'])
		]);
	}
	if (state.type === 'image') {
		return imageViewer({file: state.file});
	}
	return codebin({
		source: state.source || '',
		pos: state.pos,
		type: state.type || 'js',
		layout: state.layout ?? {},
		setLayout: patch => actions.setLayout(patch),
		change: (source, pos) => actions.updateSource(source, pos),
		updatePos: pos => actions.updatePos(pos),
		undo: () => actions.undo(),
		redo: () => actions.redo()
	});
};

const editorFloat = ({state, actions}) => {
	if (!(state.file && state.file.name) || state.type === 'image') {
		return null;
	}
	return section('.editor-float', [
		findBar({state, actions}),
		button('.save-file', {
			attrs: {
				'aria-label': 'Save file',
				title: state.saveError || saveHint(state),
				type: 'button'
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
		}, [i('.fa.fa-save')])
	]);
};

export default ({state, actions}) => fn.pipe(
	() => ({
		toggles: state.layout.toggles,
		dim: state.layout.dim,
		hostStyle: hostStyleProps(state.hostTheme)
	}),
	({toggles, dim, hostStyle}) => body(
		`#ui.${themeClass(state.themeMode || 'dark')}${isStartView(state) ? '.start' : ''}`,
		hostStyle ? {style: hostStyle} : {},
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
				main('.main', [
					header({state, actions}),
					editorFloat({state, actions}),
					editorPane({state, actions})
				])
			]
	)
)();
