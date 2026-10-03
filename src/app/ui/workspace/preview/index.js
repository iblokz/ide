/**
 * Workspace preview column: chrome + url iframe | file preview | sandbox.
 */
import {section} from 'iblokz-snabbdom-helpers';
import {preview as previewFrame, previewPane} from '../../codebin/index.js';
import {filePreviewKind} from '../../../util/preview-file.js';
import chrome from './chrome.js';
import filePreview from './file/index.js';

export default ({
	state,
	actions,
	open = true,
	flex = '1 1 auto',
	flexGrow,
	flexShrink,
	flexBasis
}) => {
	const toggles = state.layout.toggles || {};
	const dim = state.layout.dim || {};
	const showPreview = !!toggles.preview;
	const showConsole = !!toggles.previewConsole;
	const preview = state.preview || {};
	const canFile = !!filePreviewKind(state.type, state.file);
	let mode = preview.mode === 'file' || preview.mode === 'sandbox'
		? preview.mode
		: 'url';
	// Prefer file preview when the active tab supports it and mode isn't sandbox
	if (canFile && mode !== 'sandbox') {
		mode = preview.mode === 'url' ? 'url' : 'file';
	} else if (mode === 'file') {
		mode = 'url';
	}

	let body;
	if (mode === 'file') {
		body = filePreview({state});
	} else if (mode === 'sandbox') {
		body = previewPane({
			source: state.source || '',
			type: state.type || 'js',
			showPreview,
			showConsole,
			dim,
			setLayout: patch => actions.layout.set(patch)
		});
	} else {
		body = previewFrame({
			src: preview.url || 'about:blank',
			reloadToken: preview.reloadToken || 0,
			hidden: false,
			flex: '1 1 auto'
		});
	}

	return section('.preview', {
		class: {toggled: !!open},
		style: flexGrow != null
			? {
				flexGrow,
				flexShrink: flexShrink != null ? flexShrink : 0,
				flexBasis: flexBasis || '0%',
				minWidth: '0px',
				maxWidth: '80%'
			}
			: {flex}
	}, [
		chrome({state, actions}),
		body
	]);
};
