import {rangeForPos, set as setCaret} from './caret.js';

const FIND_HIGHLIGHT_NAME = 'find-match';

export const isFindBarFocused = () => {
	const active = document.activeElement;
	return !!(active && active.closest && active.closest('.find-bar'));
};

export const refocusFindField = () => {
	queueMicrotask(() => {
		document.querySelector('.find-bar .find-query')?.focus();
	});
};

export const clearMatchHighlight = () => {
	if (typeof CSS !== 'undefined' && CSS.highlights) {
		CSS.highlights.delete(FIND_HIGHLIGHT_NAME);
	}
};

const unwrapMatchMarks = el => {
	if (!el) return;
	el.querySelectorAll('mark.find-match').forEach(mark => {
		const parent = mark.parentNode;
		if (!parent) return;
		while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
		parent.removeChild(mark);
	});
};

export const clearFindMarkup = el => {
	if (!el) return;
	el.querySelectorAll('li.find-match-line').forEach(li => {
		li.classList.remove('find-match-line');
	});
	clearMatchHighlight();
	unwrapMatchMarks(el);
};

const setMatchHighlight = (el, pos) => {
	clearMatchHighlight();
	unwrapMatchMarks(el);
	if (!el || !pos) return;
	const range = rangeForPos(el, pos);
	if (!range || range.collapsed) return;
	if (typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined') {
		CSS.highlights.set(FIND_HIGHLIGHT_NAME, new Highlight(range));
		return;
	}
	try {
		const mark = document.createElement('mark');
		mark.className = 'find-match';
		mark.appendChild(range.extractContents());
		range.insertNode(mark);
	} catch (e) {
		// Prettify spans can make surroundContents fail; skip fallback highlight.
	}
};

/** Scroll matching line into view; show match range while find bar keeps focus. */
export const applyFindMarkup = (el, pos) => {
	if (!el || !pos) return;
	el.querySelectorAll('li.find-match-line').forEach(li => {
		li.classList.remove('find-match-line');
	});
	const lis = el.querySelectorAll('li');
	const li = lis[pos.start.row];
	if (li) {
		li.classList.add('find-match-line');
		li.scrollIntoView({block: 'nearest', inline: 'nearest'});
	}
	if (isFindBarFocused()) {
		setMatchHighlight(el, pos);
		refocusFindField();
		return;
	}
	clearMatchHighlight();
	unwrapMatchMarks(el);
	setCaret(el, pos);
	el.focus();
};

/** Tab from find bar: move focus to editor and select the current match. */
export const focusEditorMatch = (el, pos) => {
	if (!el) return;
	clearMatchHighlight();
	unwrapMatchMarks(el);
	el.querySelectorAll('li.find-match-line').forEach(li => {
		li.classList.remove('find-match-line');
	});
	if (pos) setCaret(el, pos);
	el.focus();
};

export const applyFindResult = pos => {
	const el = typeof document !== 'undefined' && document.querySelector('code.source');
	if (!el) return;
	applyFindMarkup(el, pos);
};

export default {
	isFindBarFocused,
	refocusFindField,
	clearMatchHighlight,
	clearFindMarkup,
	applyFindMarkup,
	focusEditorMatch,
	applyFindResult
};
