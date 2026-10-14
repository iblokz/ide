/**
 * SVG file preview — isolated document on the app theme background.
 */
import {section, h} from 'iblokz-snabbdom-helpers';
import {snapshotPreviewTheme, stripSrcdocScripts} from '../../../../util/preview-file.js';

const asSvgMarkup = source => {
	const raw = String(source || '').trim();
	if (!raw) {
		return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
	}
	if (/<svg[\s>]/i.test(raw)) return raw;
	return `<svg xmlns="http://www.w3.org/2000/svg">${raw}</svg>`;
};

const wrapHtml = (svg, theme) => {
	const mode = (theme && theme.mode) || 'dark';
	const vars = (theme && theme.vars) || '';
	return `<!doctype html><html data-theme="${mode}"><head><meta charset="utf-8">
<style>
  :root {
	${vars}
	color-scheme: ${mode};
  }
  html, body {
	margin: 0;
	padding: 0;
	width: 100%;
	height: 100%;
	background: var(--app-editor-bg, var(--app-bg-page));
	color: var(--app-editor-text, var(--app-text));
  }
  body {
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
	padding: 16px;
	overflow: auto;
  }
  svg {
	max-width: 100%;
	max-height: 100%;
	height: auto;
  }
</style></head><body>${svg}</body></html>`;
};

const applySrcdoc = (elm, html) => {
	if (!elm || html == null) return;
	const next = stripSrcdocScripts(html);
	if (elm.srcdoc === next) return;
	elm.srcdoc = next;
};

export default ({source, fileName = 'preview.svg', themeMode = 'dark'}) => {
	const svg = asSvgMarkup(source);
	const paint = elm => {
		applySrcdoc(elm, wrapHtml(svg, snapshotPreviewTheme(themeMode)));
	};

	return section('.preview-file.preview-svg', [
		h('iframe.preview-file-frame', {
			attrs: {
				title: fileName,
				sandbox: 'allow-same-origin'
			},
			dataset: {themeMode: String(themeMode || 'dark')},
			hook: {
				insert: ({elm}) => paint(elm),
				update: (_old, {elm}) => paint(elm)
			}
		})
	]);
};
