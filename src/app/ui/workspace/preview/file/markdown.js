/**
 * Tiny markdown → HTML for file preview (no external md lib).
 * Covers headings, lists, code, links, emphasis, paragraphs.
 */
const escapeHtml = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

const inline = s => escapeHtml(s)
	.replace(/`([^`]+)`/g, '<code>$1</code>')
	.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	.replace(/\*([^*]+)\*/g, '<em>$1</em>')
	.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');

export const markdownToHtml = source => {
	const lines = String(source || '').replace(/\r\n/g, '\n').split('\n');
	const out = [];
	let i = 0;
	let inCode = false;
	let codeBuf = [];
	let listType = null;

	const flushList = () => {
		if (!listType) return;
		out.push(listType === 'ol' ? '</ol>' : '</ul>');
		listType = null;
	};

	while (i < lines.length) {
		const line = lines[i];
		if (line.startsWith('```')) {
			if (inCode) {
				out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
				codeBuf = [];
				inCode = false;
			} else {
				flushList();
				inCode = true;
			}
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
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			flushList();
			const level = heading[1].length;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			i += 1;
			continue;
		}
		const ul = /^[-*+]\s+(.*)$/.exec(line);
		if (ul) {
			if (listType !== 'ul') {
				flushList();
				out.push('<ul>');
				listType = 'ul';
			}
			out.push(`<li>${inline(ul[1])}</li>`);
			i += 1;
			continue;
		}
		const ol = /^(\d+)\.\s+(.*)$/.exec(line);
		if (ol) {
			if (listType !== 'ol') {
				flushList();
				out.push('<ol>');
				listType = 'ol';
			}
			out.push(`<li>${inline(ol[2])}</li>`);
			i += 1;
			continue;
		}
		flushList();
		out.push(`<p>${inline(line)}</p>`);
		i += 1;
	}
	if (inCode) {
		out.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
	}
	flushList();
	return out.join('\n');
};

export default {markdownToHtml};
