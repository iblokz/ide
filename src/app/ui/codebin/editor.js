/**
 * Contenteditable source editor surface (no preview / console).
 */
import {fromEvent, merge} from 'rxjs';
import {map, takeUntil, share, debounceTime} from 'rxjs/operators';
import {code} from 'iblokz-snabbdom-helpers';
import * as caret from '../../util/caret.js';
import findHighlightMod from '../../util/find-highlight.js';
import {prettifySource, unprettify} from './prettify.js';

const findHighlight = findHighlightMod.default ?? findHighlightMod;
const caretApi = caret.default ?? caret;

const insertNewlineAtPos = (source, pos) => {
	const lines = String(source || '').split('\n');
	const maxRow = Math.max(0, lines.length - 1);
	const startRow = Math.max(0, Math.min(pos.start.row, maxRow));
	const endRow = Math.max(0, Math.min(pos.end.row, maxRow));

	const startLine = lines[startRow] || '';
	const endLine = lines[endRow] || '';
	const startCol = Math.max(0, Math.min(pos.start.col, startLine.length));
	const endCol = Math.max(0, Math.min(pos.end.col, endLine.length));

	const head = lines.slice(0, startRow);
	const tail = lines.slice(endRow + 1);
	const before = startLine.slice(0, startCol);
	const after = endLine.slice(endCol);
	const indent = (before.match(/^\s*/) || [''])[0];
	const nextLine = indent + after;
	const nextSource = [].concat(head, [before, nextLine], tail).join('\n');
	const nextPos = {
		start: {row: startRow + 1, col: indent.length},
		end: {row: startRow + 1, col: indent.length}
	};
	return {source: nextSource, pos: nextPos};
};

let inputSyncGen = 0;

const readScroll = el => ({
	top: (el && el.scrollTop) || 0,
	left: (el && el.scrollLeft) || 0
});

const applyScroll = (el, scroll) => {
	if (!el || !scroll) return;
	el.scrollTop = scroll.top || 0;
	el.scrollLeft = scroll.left || 0;
};

let scrollSaveTimer = null;
const scheduleScrollSave = (el, tabId, updateScroll) => {
	if (!el || typeof updateScroll !== 'function') return;
	const id = tabId || null;
	clearTimeout(scrollSaveTimer);
	scrollSaveTimer = setTimeout(() => {
		scrollSaveTimer = null;
		if (!el.isConnected) return;
		updateScroll(readScroll(el), id);
	}, 120);
};

export default ({
	source,
	pos,
	type,
	scroll = {top: 0, left: 0},
	tabId = null,
	change = () => {},
	updateScroll = () => {},
	undo = () => {},
	redo = () => {}
}) => code(`.source[type="${type}"][contenteditable="true"][spellcheck="false"]`, {
	attrs: {
		spellcheck: 'false',
		autocorrect: 'off',
		autocapitalize: 'off',
		autocomplete: 'off'
	},
	props: {
		spellcheck: false
	},
	hook: {
		insert: ({elm}) => {
			elm.spellcheck = false;
			elm.innerHTML = prettifySource(source || '', type);
			caretApi.set(elm, pos);
			applyScroll(elm, scroll);
		},
		update: (oldVnode, vnode) => {
			const elm = vnode.elm;
			elm.spellcheck = false;
			const prev = oldVnode.data && oldVnode.data.dataset
				? oldVnode.data.dataset.source
				: null;
			const next = source || '';
			const prevPos = oldVnode.data && oldVnode.data.dataset
				? oldVnode.data.dataset.posKey
				: null;
			const nextPos = JSON.stringify(pos || null);
			const prevTab = oldVnode.data && oldVnode.data.dataset
				? oldVnode.data.dataset.tabKey
				: '';
			const nextTab = tabId || '';
			const tabChanged = prevTab !== nextTab;
			const liveScroll = readScroll(elm);
			if (prev === next && prevPos === nextPos && !tabChanged) return;
			if (tabChanged && prevTab) {
				const outgoing = liveScroll;
				const outgoingId = prevTab;
				clearTimeout(scrollSaveTimer);
				scrollSaveTimer = null;
				setTimeout(() => updateScroll(outgoing, outgoingId), 0);
			}
			if (prev !== next) {
				elm.innerHTML = prettifySource(next, type);
				findHighlight.clearFindMarkup(elm);
			}
			if (tabChanged) {
				applyScroll(elm, scroll);
			} else if (prev !== next) {
				applyScroll(elm, liveScroll);
			}
			if (findHighlight.isFindBarFocused()) {
				findHighlight.applyFindMarkup(elm, pos);
			} else {
				caretApi.set(elm, pos);
			}
			if (tabChanged) {
				applyScroll(elm, scroll);
			}
		}
	},
	dataset: {
		source: source || '',
		posKey: JSON.stringify(pos || null),
		tabKey: tabId || ''
	},
	on: {
		scroll: ev => scheduleScrollSave(ev.target, tabId, updateScroll),
		keydown: ev => {
			if (ev.key === 'Tab') {
				ev.preventDefault();
				inputSyncGen += 1;
				caretApi.indent(ev.target, ev.shiftKey === true ? 'left' : 'right');
				ev.target.dispatchEvent(new Event('input'));
			} else if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
				ev.preventDefault();
				inputSyncGen += 1;
				try {
					const el = ev.target;
					const curSource = unprettify(el.innerHTML) || source || '';
					let cur;
					try {
						cur = caretApi.get(el);
					} catch (err) {
						const lines = curSource.split('\n');
						const row = Math.max(0, lines.length - 1);
						const col = (lines[row] || '').length;
						cur = {
							start: {row, col},
							end: {row, col}
						};
					}
					const next = insertNewlineAtPos(curSource, cur);
					const liveScroll = readScroll(el);
					el.innerHTML = prettifySource(next.source, type);
					applyScroll(el, liveScroll);
					caretApi.set(el, next.pos);
					change(next.source, next.pos);
				} catch (err) {
					console.warn('[codebin/editor] Enter failed', err);
				}
			} else if (ev.key === 'z' && ev.ctrlKey) {
				undo();
			} else if (ev.key === 'y' && ev.ctrlKey) {
				redo();
			}
		},
		focus: ({target}) => [fromEvent(target, 'input')
			.pipe(
				map(ev => ({el: ev.target, gen: inputSyncGen})),
				takeUntil(fromEvent(target, 'blur')),
				share()
			)
		].map(inputs$ => merge(
			inputs$.pipe(
				debounceTime(200),
				map(({el, gen}) => {
					if (gen !== inputSyncGen) return 0;
					if (!el || !el.isConnected) return 0;
					let nextPos;
					try {
						nextPos = caretApi.get(el);
					} catch (err) {
						return 0;
					}
					if (gen !== inputSyncGen) return 0;
					const liveScroll = readScroll(el);
					const sourceCode = unprettify(el.innerHTML);
					el.innerHTML = prettifySource(sourceCode, type);
					if (gen !== inputSyncGen) return 0;
					applyScroll(el, liveScroll);
					caretApi.set(el, nextPos);
					return 1;
				})
			),
			inputs$.pipe(
				debounceTime(500),
				map(({el, gen}) => {
					if (gen !== inputSyncGen) return 0;
					if (!el || !el.isConnected) return 0;
					let nextPos;
					try {
						nextPos = caretApi.get(el);
					} catch (err) {
						return 0;
					}
					if (gen !== inputSyncGen) return 0;
					change(unprettify(el.innerHTML), nextPos);
					return 1;
				})
			)
		)).pop().subscribe()
	}
});
