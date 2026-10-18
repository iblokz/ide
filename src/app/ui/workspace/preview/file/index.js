/**
 * File preview router (markdown / svg / pdf) for the active buffer.
 */
import {section, p} from 'iblokz-snabbdom-helpers';
import {filePreviewKind} from '../../../../util/preview-file.js';
import {openPreviewPath} from '../../../../util/preview-nav.js';
import markdownView from './markdown-view.js';
import svgView from './svg.js';
import pdfView from './pdf.js';

export default ({state, actions}) => {
	const kind = filePreviewKind(state.type, state.file);
	const source = state.source || '';
	const fileName = (state.file && state.file.name) || 'preview';
	const filePath = (state.file && state.file.path) || null;
	const themeMode = (state.theme && state.theme.mode) || 'dark';
	const treeNodes = (state.fileTree && state.fileTree.nodes) || [];

	if (kind === 'markdown') {
		return markdownView({
			source,
			fileName,
			themeMode,
			filePath,
			treeNodes,
			onOpenFile: path => openPreviewPath({
				path,
				treeNodes,
				actions,
				currentPath: filePath
			})
		});
	}
	if (kind === 'svg') {
		return svgView({source, fileName, themeMode});
	}
	if (kind === 'pdf') {
		return pdfView({
			url: (state.file && state.file.url) || '',
			fileName
		});
	}
	return section('.preview-file.preview-file-empty', [
		p(['No file preview for this type. Open a Markdown, SVG, or PDF file, or switch to URL.'])
	]);
};
