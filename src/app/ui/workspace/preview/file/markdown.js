/**
 * Tiny markdown → HTML for file preview (no full md lib).
 * Headings, lists, GFM task checkboxes, code, tables, mermaid, links, images, emphasis.
 */
import {prettify, prettifyLang, escapeHtml} from '../../../codebin/prettify.js';

const formatCodeBlock = (code, lang) => {
	const escaped = escapeHtml(code);
	if (!lang) {
		return `<pre><code>${escaped}</code></pre>`;
	}
	try {
		const highlighted = prettify.prettyPrintOne(escaped, prettifyLang(lang));
		return `<pre class="prettyprint"><code class="prettyprint">${highlighted}</code></pre>`;
	} catch (_err) {
		return `<pre><code>${escaped}</code></pre>`;
	}
};

/**
 * Images first (raw capture), then escape + other inline.
 * Tokens `%%IMG_n%%` survive escapeHtml so the parent can inject URLs.
 */
const makeInline = images => s => {
	const withTokens = String(s).replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
		const idx = images.length;
		images.push({alt, src});
		return `%%IMG_${idx}%%`;
	});
	return escapeHtml(withTokens)
		.replace(/`([^`]+)`/g, '<code>$1</code>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
};

const splitTableRow = line => {
	let s = String(line || '').trim();
	if (s.startsWith('|')) s = s.slice(1);
	if (s.endsWith('|')) s = s.slice(0, -1);
	return s.split('|').map(c => c.trim());
};

const isTableSeparator = line => {
	const cells = splitTableRow(line);
	if (cells.length < 2) return false;
	return cells.every(c => /^:?-{3,}:?$/.test(c));
};

const looksLikeTableRow = line => {
	const s = String(line || '').trim();
	if (!s || s.startsWith('```')) return false;
	return s.includes('|') && splitTableRow(s).length >= 2;
};

const alignFromSep = cell => {
	const left = cell.startsWith(':');
	const right = cell.endsWith(':');
	if (left && right) return 'center';
	if (right) return 'right';
	if (left) return 'left';
	return '';
};

/**
 * @returns {{html: string, diagrams: string[], images: {alt: string, src: string}[]}}
 */
export const parseMarkdown = source => {
	const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
	const out = [];
	const diagrams = [];
	const images = [];
	const inline = makeInline(images);
	let i = 0;
	let inCode = false;
	let codeBuf = [];
	let codeLang = '';
	let listType = null;

	const flushList = () => {
		if (!listType) return;
		out.push(listType === 'ol' ? '</ol>' : '</ul>');
		listType = null;
	};

	const openList = type => {
		if (listType === type) return;
		flushList();
		if (type === 'ol') out.push('<ol>');
		else if (type === 'task') out.push('<ul class="md-task-list">');
		else out.push('<ul>');
		listType = type;
	};

	while (i < lines.length) {
		const line = lines[i];

		if (line.startsWith('```')) {
			if (inCode) {
				out.push(formatCodeBlock(codeBuf.join('\n'), codeLang));
				codeBuf = [];
				codeLang = '';
				inCode = false;
				i += 1;
				continue;
			}
			const lang = line.slice(3).trim().toLowerCase();
			if (lang === 'mermaid') {
				flushList();
				const buf = [];
				i += 1;
				while (i < lines.length && !lines[i].startsWith('```')) {
					buf.push(lines[i]);
					i += 1;
				}
				if (i < lines.length) i += 1;
				const idx = diagrams.length;
				diagrams.push(buf.join('\n'));
				out.push(`%%MERMAID_${idx}%%`);
				continue;
			}
			flushList();
			inCode = true;
			codeLang = lang;
			i += 1;
			continue;
		}

		if (inCode) {
			codeBuf.push(line);
			i += 1;
			continue;
		}

		if (/^\s*$/.test(line)) {
			flushList();
			i += 1;
			continue;
		}

		if (looksLikeTableRow(line)
			&& i + 1 < lines.length
			&& isTableSeparator(lines[i + 1])) {
			flushList();
			const headers = splitTableRow(line);
			const aligns = splitTableRow(lines[i + 1]).map(alignFromSep);
			i += 2;
			const body = [];
			while (i < lines.length && looksLikeTableRow(lines[i]) && !isTableSeparator(lines[i])) {
				body.push(splitTableRow(lines[i]));
				i += 1;
			}
			const th = headers.map((h, hi) => {
				const a = aligns[hi];
				const style = a ? ` style="text-align:${a}"` : '';
				return `<th${style}>${inline(h)}</th>`;
			}).join('');
			const rows = body.map(cells => {
				const tds = headers.map((_, hi) => {
					const a = aligns[hi];
					const style = a ? ` style="text-align:${a}"` : '';
					return `<td${style}>${inline(cells[hi] || '')}</td>`;
				}).join('');
				return `<tr>${tds}</tr>`;
			}).join('\n');
			out.push(`<div class="md-table-wrap"><table>\n<thead><tr>${th}</tr></thead>\n<tbody>\n${rows}\n</tbody>\n</table></div>`);
			continue;
		}

		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			flushList();
			const level = heading[1].length;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			i += 1;
			continue;
		}

		const hr = /^(-\s*){3,}$|^\*{3,}$|^_{3,}$/.exec(line.trim());
		if (hr) {
			flushList();
			out.push('<hr>');
			i += 1;
			continue;
		}

		const bq = /^>\s?(.*)$/.exec(line);
		if (bq) {
			flushList();
			out.push(`<blockquote><p>${inline(bq[1])}</p></blockquote>`);
			i += 1;
			continue;
		}

		// GFM task list: - [ ] / - [x] / - [X]
		const task = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
		if (task) {
			openList('task');
			const checked = task[1] !== ' ';
			out.push(
				`<li class="md-task${checked ? ' is-checked' : ''}">`
				+ `<input type="checkbox" disabled${checked ? ' checked' : ''}>`
				+ `<span>${inline(task[2])}</span></li>`
			);
			i += 1;
			continue;
		}

		const ul = /^[-*+]\s+(.*)$/.exec(line);
		if (ul) {
			openList('ul');
			out.push(`<li>${inline(ul[1])}</li>`);
			i += 1;
			continue;
		}

		const ol = /^(\d+)\.\s+(.*)$/.exec(line);
		if (ol) {
			openList('ol');
			out.push(`<li>${inline(ol[2])}</li>`);
			i += 1;
			continue;
		}

		flushList();
		out.push(`<p>${inline(line)}</p>`);
		i += 1;
	}

	if (inCode) {
		out.push(formatCodeBlock(codeBuf.join('\n'), codeLang));
	}
	flushList();
	return {html: out.join('\n'), diagrams, images};
};

export const markdownToHtml = source => parseMarkdown(source).html;

export default {markdownToHtml, parseMarkdown};
