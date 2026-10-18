/**
 * PDF file preview — Chromium PDF viewer via embed (no iframe sandbox).
 */
import {section, h, p} from 'iblokz-snabbdom-helpers';

const applySrc = (elm, url) => {
	if (!elm || url == null) return;
	const next = String(url);
	if (elm.getAttribute('src') === next) return;
	elm.setAttribute('src', next);
};

export default ({url = '', fileName = 'preview.pdf'}) => {
	if (!url) {
		return section('.preview-file.preview-file-empty', [
			p(['PDF preview unavailable (no file URL).'])
		]);
	}

	return section('.preview-file.preview-pdf', [
		// <embed> hosts the built-in viewer more reliably than a sandboxed iframe.
		h('embed.preview-file-frame', {
			attrs: {
				type: 'application/pdf',
				title: fileName,
				src: url
			},
			hook: {
				insert: ({elm}) => applySrc(elm, url),
				update: (_old, {elm}) => applySrc(elm, url)
			}
		})
	]);
};
