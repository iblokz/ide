/**
 * Plain-text find helpers for the codebin editor (search `state.source`, not prettify DOM).
 */

export const indexFromPos = (source, {row = 0, col = 0} = {}) => {
	const lines = String(source || '').split('\n');
	let idx = 0;
	const r = Math.max(0, Math.min(row, Math.max(0, lines.length - 1)));
	for (let i = 0; i < r; i += 1) {
		idx += lines[i].length + 1;
	}
	const line = lines[r] || '';
	return idx + Math.max(0, Math.min(col, line.length));
};

export const posFromIndex = (source, index) => {
	const lines = String(source || '').split('\n');
	let remaining = Math.max(0, index);
	for (let row = 0; row < lines.length; row += 1) {
		const len = lines[row].length;
		if (remaining <= len) {
			const col = remaining;
			return {
				start: {row, col},
				end: {row, col}
			};
		}
		remaining -= len + 1;
	}
	const lastRow = Math.max(0, lines.length - 1);
	const lastCol = (lines[lastRow] || '').length;
	return {
		start: {row: lastRow, col: lastCol},
		end: {row: lastRow, col: lastCol}
	};
};

const posForRange = (source, startIndex, endIndex) => {
	const start = posFromIndex(source, startIndex);
	const end = posFromIndex(source, endIndex);
	return {
		start: start.start,
		end: end.end
	};
};

/**
 * Find first match in source (always from document start).
 */
export const findFirstMatch = (source, query, {caseSensitive = false} = {}) => {
	if (!query) return null;
	const text = String(source || '');
	const hay = caseSensitive ? text : text.toLowerCase();
	const needle = caseSensitive ? query : query.toLowerCase();
	if (!needle.length) return null;
	const i = hay.indexOf(needle, 0);
	if (i === -1) return null;
	return posForRange(text, i, i + needle.length);
};

/**
 * Find next/prev match in source.
 * @param {number} direction 1 = next, -1 = prev
 * @returns {{ start, end } | null} caret/selection pos
 */
export const findMatch = (source, query, pos, {caseSensitive = false, direction = 1} = {}) => {
	if (!query) return null;
	const text = String(source || '');
	const hay = caseSensitive ? text : text.toLowerCase();
	const needle = caseSensitive ? query : query.toLowerCase();
	if (!needle.length) return null;

	const start = pos?.start || {row: 0, col: 0};
	const end = pos?.end || start;

	if (direction >= 0) {
		let from = indexFromPos(text, end) + 1;
		let i = hay.indexOf(needle, from);
		if (i === -1) i = hay.indexOf(needle, 0);
		if (i === -1) return null;
		return posForRange(text, i, i + needle.length);
	}

	let from = indexFromPos(text, start) - 1;
	let i = hay.lastIndexOf(needle, from);
	if (i === -1) i = hay.lastIndexOf(needle);
	if (i === -1) return null;
	return posForRange(text, i, i + needle.length);
};

export default {
	indexFromPos,
	posFromIndex,
	findFirstMatch,
	findMatch
};
