/**
 * Line-comment toggle for the codebin buffer (VS Code–style).
 * Pure: (source, pos, type) → { source, pos }.
 */

import {get as getCaret} from './caret.js';

const JS_LIKE = new Set([
	'js', 'mjs', 'cjs', 'jsx',
	'ts', 'tsx', 'mts', 'cts',
	'javascript', 'typescript',
	'css', 'scss', 'sass', 'less',
	'jsonc', 'json5'
]);

const HASH_LIKE = new Set([
	'py', 'python',
	'yml', 'yaml',
	'sh', 'bash', 'zsh',
	'toml', 'gitignore', 'dockerignore', 'env', 'dotenv'
]);

const WRAP_LIKE = new Set([
	'html', 'htm', 'xml', 'svg', 'vue', 'svelte'
]);

/** @returns {{kind:'line', prefix:string}|{kind:'wrap', open:string, close:string}|null} */
export const commentStyle = type => {
	const key = String(type || 'js').toLowerCase();
	if (JS_LIKE.has(key)) return {kind: 'line', prefix: '// '};
	if (HASH_LIKE.has(key)) return {kind: 'line', prefix: '# '};
	if (WRAP_LIKE.has(key)) return {kind: 'wrap', open: '<!-- ', close: ' -->'};
	return null;
};

const clampPos = (lines, pos) => {
	const maxRow = Math.max(0, lines.length - 1);
	const startRow = Math.max(0, Math.min((pos && pos.start && pos.start.row) || 0, maxRow));
	const endRow = Math.max(0, Math.min((pos && pos.end && pos.end.row) || startRow, maxRow));
	const lo = Math.min(startRow, endRow);
	const hi = Math.max(startRow, endRow);
	const startLine = lines[lo] || '';
	const endLine = lines[hi] || '';
	const startCol = Math.max(0, Math.min((pos && pos.start && pos.start.col) || 0, startLine.length));
	const endCol = Math.max(0, Math.min((pos && pos.end && pos.end.col) || 0, endLine.length));
	return {lo, hi, startCol, endCol, startRow: lo, endRow: hi};
};

/** Shift caret when a prefix is inserted/removed after `at` (usually end of leading ws). */
const shiftColAt = (col, at, delta) => {
	if (!delta) return col;
	if (delta > 0) return col >= at ? col + delta : col;
	const removed = -delta;
	if (col >= at + removed) return col - removed;
	if (col > at) return at;
	return col;
};

const leadingWs = line => {
	const m = String(line || '').match(/^\s*/);
	return m ? m[0] : '';
};

const stripLinePrefix = (line, prefix) => {
	const ws = leadingWs(line);
	const rest = line.slice(ws.length);
	const bare = prefix.trimEnd();
	if (rest.startsWith(prefix)) return ws + rest.slice(prefix.length);
	if (rest.startsWith(`${bare} `)) return ws + rest.slice(bare.length + 1);
	if (rest.startsWith(bare)) return ws + rest.slice(bare.length);
	return line;
};

const hasLinePrefix = (line, prefix) => {
	const rest = line.slice(leadingWs(line).length);
	const bare = prefix.trimEnd();
	return rest.startsWith(bare);
};

const applyLinePrefix = (line, prefix) => {
	const ws = leadingWs(line);
	return ws + prefix + line.slice(ws.length);
};

const stripWrap = (line, open, close) => {
	const ws = leadingWs(line);
	let rest = line.slice(ws.length);
	const openBare = open.trimEnd();
	const closeBare = close.trimStart();
	if (rest.startsWith(open)) rest = rest.slice(open.length);
	else if (rest.startsWith(openBare)) rest = rest.slice(openBare.length).replace(/^\s/, '');
	else return line;
	if (rest.endsWith(close)) rest = rest.slice(0, -close.length);
	else if (rest.endsWith(closeBare)) rest = rest.slice(0, -closeBare.length).replace(/\s$/, '');
	else return line;
	return ws + rest;
};

const hasWrap = (line, open, close) => {
	const rest = line.slice(leadingWs(line).length);
	const openBare = open.trimEnd();
	const closeBare = close.trimStart();
	return (rest.startsWith(open) || rest.startsWith(openBare))
		&& (rest.endsWith(close) || rest.endsWith(closeBare));
};

const applyWrap = (line, open, close) => {
	const ws = leadingWs(line);
	return ws + open + line.slice(ws.length) + close;
};

/**
 * @param {string} source
 * @param {{start:{row:number,col:number}, end:{row:number,col:number}}} pos
 * @param {string} type file ext / lang id
 * @returns {{source:string, pos:typeof pos}}
 */
export const toggleComment = (source, pos, type) => {
	const style = commentStyle(type);
	const text = String(source || '');
	const lines = text.split('\n');
	const {lo, hi, startCol, endCol} = clampPos(lines, pos);

	if (!style) {
		return {
			source: text,
			pos: {
				start: {row: lo, col: startCol},
				end: {row: hi, col: endCol}
			}
		};
	}

	const idxs = [];
	for (let i = lo; i <= hi; i += 1) idxs.push(i);

	const nonEmpty = idxs.filter(i => (lines[i] || '').trim().length > 0);
	const targets = nonEmpty.length ? nonEmpty : idxs;

	let shouldUncomment = false;
	if (style.kind === 'line') {
		shouldUncomment = targets.length > 0
			&& targets.every(i => hasLinePrefix(lines[i], style.prefix));
	} else {
		shouldUncomment = targets.length > 0
			&& targets.every(i => hasWrap(lines[i], style.open, style.close));
	}

	const before = lines.slice();
	const next = lines.slice();

	targets.forEach(i => {
		const line = next[i] || '';
		if (style.kind === 'line') {
			next[i] = shouldUncomment
				? stripLinePrefix(line, style.prefix)
				: applyLinePrefix(line, style.prefix);
		} else {
			next[i] = shouldUncomment
				? stripWrap(line, style.open, style.close)
				: applyWrap(line, style.open, style.close);
		}
	});

	const colDelta = (row, col) => {
		if (!targets.includes(row)) return col;
		const oldLine = before[row] || '';
		const newLine = next[row] || '';
		const at = leadingWs(oldLine).length;
		if (style.kind === 'line') {
			return shiftColAt(col, at, newLine.length - oldLine.length);
		}
		// wrap: `<!-- ` after ws, ` -->` at end
		if (shouldUncomment) {
			const closeAt = oldLine.length - style.close.length;
			if (col >= closeAt) return newLine.length;
			return shiftColAt(col, at, -style.open.length);
		}
		return shiftColAt(col, at, style.open.length);
	};

	return {
		source: next.join('\n'),
		pos: {
			start: {row: lo, col: colDelta(lo, startCol)},
			end: {row: hi, col: colDelta(hi, endCol)}
		}
	};
};

/** Read live codebin buffer (source may be ahead of debounced state). */
export const readLiveEditor = () => {
	if (typeof document === 'undefined') return null;
	const el = document.querySelector('code.source');
	if (!el) return null;
	const lis = el.querySelectorAll('li');
	let source = '';
	if (lis.length) {
		source = Array.from(lis)
			.map(li => {
				const raw = li.textContent || '';
				if (!raw || raw === '\xA0' || raw === '\u00a0') return '';
				return raw.replace(/\u00a0/g, ' ');
			})
			.join('\n');
	} else {
		source = (el.textContent || '').replace(/\u00a0/g, ' ');
	}
	let pos = null;
	try {
		pos = getCaret(el);
	} catch {
		pos = null;
	}
	return {el, source, pos};
};

export default {
	commentStyle,
	toggleComment,
	readLiveEditor
};
