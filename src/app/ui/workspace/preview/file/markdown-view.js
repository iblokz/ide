/**
 * Markdown file preview — themed via host `--app-*` tokens.
 * GFM tables + mermaid fences (rendered to SVG in the parent, then srcdoc).
 */
import {section, h} from 'iblokz-snabbdom-helpers';
import {snapshotPreviewTheme} from '../../../../util/preview-file.js';
import {parseMarkdown} from './markdown.js';

const wrapHtml = (body, theme) => {
	const mode = (theme && theme.mode) || 'dark';
	const vars = (theme && theme.vars) || '';
	// No color-scheme meta: a mismatch with snapped vars makes Chromium invert the iframe.
	return `<!doctype html><html data-theme="${mode}"><head><meta charset="utf-8">
<style>
  :root {
	${vars}
	color-scheme: ${mode};
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
  ul.md-task-list {
	list-style: none;
	padding-left: 0.2em;
	margin: 0.6em 0;
  }
  ul.md-task-list > li.md-task {
	display: flex;
	align-items: flex-start;
	gap: 0.5em;
	margin: 0.25em 0;
	line-height: 1.45;
  }
  ul.md-task-list > li.md-task > input[type="checkbox"] {
	flex: 0 0 auto;
	margin: 0.2em 0 0;
	accent-color: var(--app-accent);
	cursor: default;
  }
  ul.md-task-list > li.md-task.is-checked > span {
	color: var(--app-text-muted);
	text-decoration: line-through;
  }
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
  .md-table-wrap {
	overflow-x: auto;
	margin: 0.9em 0;
  }
  table {
	border-collapse: collapse;
	width: 100%;
	font-size: 0.92em;
  }
  thead { background: var(--app-bg-muted); }
  th, td {
	border: 1px solid var(--app-border);
	padding: 6px 10px;
	text-align: left;
  }
  th {
	font-weight: 600;
	color: var(--app-text-strong, var(--app-text));
  }
  tr:nth-child(even) td { background: var(--app-bg-muted); }
  .md-mermaid {
	margin: 1em 0;
	overflow: auto;
	text-align: center;
	/* Mermaid SVG already has absolute fills — don't let color-scheme remap them. */
	color-scheme: only light;
  }
  .md-mermaid svg { max-width: 100%; height: auto; }
  /* SVG text labels (htmlLabels:false) — force readable fill in the iframe */
  .md-mermaid text,
  .md-mermaid tspan {
	fill: var(--app-text-strong, var(--app-text)) !important;
  }
  .md-mermaid .nodeLabel,
  .md-mermaid .edgeLabel,
  .md-mermaid .label,
  .md-mermaid foreignObject,
  .md-mermaid foreignObject div {
	color: var(--app-text-strong, var(--app-text)) !important;
  }
  .md-mermaid-error {
	margin: 1em 0;
	padding: 10px 12px;
	border: 1px solid var(--app-danger, #c44);
	border-radius: 6px;
	color: var(--app-danger, #c44);
	background: var(--app-bg-muted);
	white-space: pre-wrap;
	font-family: 'Fira Code', ui-monospace, monospace;
	font-size: 0.85em;
	text-align: left;
  }
</style></head><body>${body}</body></html>`;
};

const applySrcdoc = (elm, html) => {
	if (!elm || html == null) return;
	if (elm.srcdoc === html) return;
	elm.srcdoc = html;
};

let mermaidReady = null;
const getMermaid = () => {
	if (!mermaidReady) {
		mermaidReady = import('mermaid').then(mod => mod.default || mod);
	}
	return mermaidReady;
};

const escapeHtml = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

/** Map host `--app-*` tokens into mermaid so labels stay readable on our bg. */
const mermaidThemeVariables = (theme) => {
	const mode = (theme && theme.mode) || 'dark';
	const dark = mode !== 'light';
	const read = (name, fallback) => {
		if (typeof document === 'undefined') return fallback;
		const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return v || fallback;
	};
	const bg = read('--app-editor-bg', dark ? '#1e2229' : '#ffffff');
	const text = read('--app-text-strong', dark ? '#f0f2f5' : '#12161c');
	const muted = read('--app-text-muted', dark ? '#8b93a1' : '#6b7582');
	const panel = read('--app-bg-panel', dark ? '#22262e' : '#ffffff');
	const soft = read('--app-bg-muted', dark ? '#2a2f38' : '#eef1f4');
	const border = read('--app-border', dark ? '#3a424e' : '#d5dbe3');
	const accent = read('--app-accent', dark ? '#6b9bff' : '#2f6fed');
	return {
		darkMode: dark,
		background: bg,
		primaryColor: soft,
		primaryTextColor: text,
		primaryBorderColor: border,
		secondaryColor: panel,
		secondaryTextColor: text,
		secondaryBorderColor: border,
		tertiaryColor: soft,
		tertiaryTextColor: text,
		tertiaryBorderColor: border,
		lineColor: muted,
		textColor: text,
		mainBkg: soft,
		nodeBorder: border,
		clusterBkg: panel,
		clusterBorder: border,
		titleColor: text,
		edgeLabelBackground: bg,
		nodeTextColor: text,
		fontFamily: 'system-ui, sans-serif'
	};
};

const fillMermaid = async (html, diagrams, theme) => {
	if (!diagrams || !diagrams.length) return html;
	let body = html;
	try {
		const mermaid = await getMermaid();
		// htmlLabels:false → native SVG <text> (survives srcdoc handoff).
		// securityLevel strict strips foreignObject HTML, which left empty labels.
		mermaid.initialize({
			startOnLoad: false,
			securityLevel: 'strict',
			theme: 'base',
			themeVariables: mermaidThemeVariables(theme),
			htmlLabels: false,
			flowchart: {htmlLabels: false},
			sequence: {htmlLabels: false},
			class: {htmlLabels: false}
		});
		for (let i = 0; i < diagrams.length; i++) {
			const token = `%%MERMAID_${i}%%`;
			let replacement;
			try {
				const id = `md-mmd-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
				const {svg} = await mermaid.render(id, diagrams[i]);
				replacement = `<div class="md-mermaid">${svg}</div>`;
			} catch (err) {
				const msg = (err && err.message) || String(err);
				replacement = `<pre class="md-mermaid-error">${escapeHtml(msg)}</pre>`;
			}
			body = body.split(token).join(replacement);
		}
	} catch (err) {
		console.error('[markdown preview] mermaid load failed', err);
		for (let i = 0; i < diagrams.length; i++) {
			body = body.split(`%%MERMAID_${i}%%`).join(
				`<pre class="md-mermaid-error">${escapeHtml('Mermaid unavailable')}</pre>`
			);
		}
	}
	return body;
};

export default ({source, fileName = 'preview.md', themeMode = 'dark'}) => {
	const {html, diagrams} = parseMarkdown(source);
	let paintGen = 0;

	const paint = elm => {
		const gen = ++paintGen;
		const theme = snapshotPreviewTheme(themeMode);
		fillMermaid(html, diagrams, theme).then(body => {
			if (gen !== paintGen) return;
			applySrcdoc(elm, wrapHtml(body, theme));
		});
	};

	return section('.preview-file.preview-markdown', [
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
