/**
 * File preview router (markdown / svg) for the active buffer.
 */
import {section, p} from 'iblokz-snabbdom-helpers';
import {filePreviewKind, snapshotPreviewTheme} from '../../../../util/preview-file.js';
import markdownView from './markdown-view.js';
import svgView from './svg.js';

export default ({state}) => {
	const kind = filePreviewKind(state.type, state.file);
	const source = state.source || '';
	const fileName = (state.file && state.file.name) || 'preview';
	const theme = snapshotPreviewTheme(state.theme && state.theme.mode);

	if (kind === 'markdown') {
		return markdownView({source, fileName, theme});
	}
	if (kind === 'svg') {
		return svgView({source, fileName, theme});
	}
	return section('.preview-file.preview-file-empty', [
		p(['No file preview for this type. Open a Markdown or SVG file, or switch to URL.'])
	]);
};
