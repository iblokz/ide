/**
 * Markdown file preview — themed via host `--app-*` tokens.
 */
import {section, h} from 'iblokz-snabbdom-helpers';
import {markdownToHtml} from './markdown.js';

const wrapHtml = (body, theme) => {
	const mode = (theme && theme.mode) || 'dark';
	const vars = (theme && theme.vars) || '';
	return `<!doctype html><html data-theme="${mode}"><head><meta charset="utf-8">
<meta name="color-scheme" content="${mode}">
<style>
  :root {
	${vars}
  }
  html, body {
	margin: 0;
	padding: 0;
	background: var(--app-editor-bg, var(--app-bg-page));
	color: var(--app-editor-text, var(--app-text));
  }
  body {
	font: 15px/1.55 system-ui, sans-serif;
	padding: 16px 20px;
  }
  h1,h2,h3,h4 {
	line-height: 1.25;
	color: var(--app-text-strong, var(--app-text));
  }
  pre {
	overflow: auto;
	padding: 10px 12px;
	background: var(--app-bg-muted);
	border: 1px solid var(--app-border);
	border-radius: 6px;
  }
  code {
	font-family: 'Fira Code', ui-monospace, monospace;
	font-size: 0.92em;
  }
  pre code { font-size: 0.88em; }
  a { color: var(--app-accent); }
  ul, ol { padding-left: 1.4em; }
  hr {
	border: none;
	border-top: 1px solid var(--app-border);
	margin: 1.2em 0;
  }
  blockquote {
	margin: 0.8em 0;
	padding: 0.2em 0.9em;
	border-left: 3px solid var(--app-accent);
	color: var(--app-text-muted);
	background: var(--app-bg-muted);
  }
</style></head><body>${body}</body></html>`;
};

const applySrcdoc = (elm, html) => {
	if (!elm || html == null) return;
	if (elm.srcdoc === html) return;
	elm.srcdoc = html;
};

export default ({source, fileName = 'preview.md', theme}) => {
	const html = wrapHtml(markdownToHtml(source), theme);
	return section('.preview-file.preview-markdown', [
		h('iframe.preview-file-frame', {
			attrs: {
				title: fileName,
				sandbox: 'allow-same-origin'
			},
			hook: {
				// Snabbdom often skips patching iframe `srcdoc` via props — set it explicitly.
				insert: ({elm}) => applySrcdoc(elm, html),
				update: (_old, {elm}) => applySrcdoc(elm, html)
			}
		})
	]);
};
