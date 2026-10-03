/**
 * Workspace editor column: toolbox (find/save) + editor surface.
 */
import {section, button, i, p} from 'iblokz-snabbdom-helpers';
import {editor} from '../../codebin/index.js';
import imageViewer from '../../image-viewer.js';
import findBar from '../../comp/find-bar.js';
import {canSave, saveHint} from '../../../util/save.js';
import {triggerSave} from '../../../util/trigger-save.js';

const toolbox = ({state, actions}) => {
	if (!(state.file && state.file.name) || state.type === 'image') {
		return null;
	}
	return section('.editor-toolbox', [
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

const surface = ({state, actions}) => {
	if (!(state.file && state.file.name)) {
		return section('.empty-editor', [
			p(['Select a file from the sidebar to open it.'])
		]);
	}
	if (state.type === 'image') {
		return imageViewer({file: state.file});
	}
	return editor({
		source: state.source || '',
		pos: state.pos,
		scroll: state.scroll || {top: 0, left: 0},
		tabId: state.activeTabId || null,
		type: state.type || 'js',
		change: (source, pos) => actions.editor.updateSource(source, pos),
		updatePos: pos => actions.editor.updatePos(pos),
		updateScroll: (scroll, tabId) => actions.editor.updateScroll(scroll, tabId),
		undo: () => actions.editor.undo(),
		redo: () => actions.editor.redo()
	});
};

export default ({state, actions, flex = '1 1 auto', flexGrow, flexShrink, flexBasis}) => section('.editor', {
	style: flexGrow != null
		? {flexGrow, flexShrink: flexShrink != null ? flexShrink : 0, flexBasis: flexBasis || 'auto'}
		: {flex}
}, [
	toolbox({state, actions}),
	surface({state, actions})
].filter(Boolean));
