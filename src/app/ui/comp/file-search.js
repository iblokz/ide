import {input, span, i, button} from 'iblokz-snabbdom-helpers';
import {formatHotkey} from '../../util/hotkey';
import {flattenFiles, filterFiles} from '../../util/file-search';
import dropdown from './dropdown';

/** Build text nodes with `.file-search-hit` spans for match ranges. */
const highlightText = (text, ranges) => {
	const src = String(text || '');
	const list = (ranges || []).filter(r => r && r.end > r.start);
	if (!src || !list.length) return [src];

	const parts = [];
	let cursor = 0;
	list.forEach(r => {
		const start = Math.max(0, Math.min(src.length, r.start));
		const end = Math.max(start, Math.min(src.length, r.end));
		if (start > cursor) parts.push(src.slice(cursor, start));
		if (end > start) {
			parts.push(span('.file-search-hit', [src.slice(start, end)]));
		}
		cursor = end;
	});
	if (cursor < src.length) parts.push(src.slice(cursor));
	return parts;
};

const renderItem = item => {
	const label = item.label || {};
	const dir = label.dir || '';
	const name = label.name || item.name || '';
	return span('.file-search-option', {
		attrs: {title: label.full || item.path || ''}
	}, [].concat(
		dir
			? span('.file-search-path', highlightText(dir + '/', label.dirRanges))
			: [],
		span('.file-search-name', highlightText(name, label.nameRanges))
	));
};

const focusQuery = () => {
	queueMicrotask(() => {
		const field = document.querySelector('.file-search .file-search-query');
		if (field) field.focus();
	});
};

export default ({state, actions}) => {
	const fsState = state.fileSearch || {open: false, query: '', activeIndex: 0};
	const open = !!fsState.open;
	const query = fsState.query || '';
	const rootPath = state.project && state.project.path;
	const indexed = fsState.indexPath === rootPath && Array.isArray(fsState.index)
		? fsState.index
		: flattenFiles(state.filesTree || []);
	const results = filterFiles(indexed, query, rootPath);
	const activeIndex = Math.max(
		0,
		Math.min(fsState.activeIndex || 0, Math.max(results.length - 1, 0))
	);
	const hotkey = formatHotkey('Mod+P');
	const showClear = query.length > 0;

	const pick = item => {
		if (!item || !item.file) return;
		actions.project.openFile(item.file);
		actions.closeFileSearch();
	};

	const clearSearch = ev => {
		ev.preventDefault();
		ev.stopPropagation();
		actions.setFileSearchQuery('');
		focusQuery();
	};

	const onKeydown = ev => {
		if (ev.key === 'Escape') {
			ev.preventDefault();
			ev.stopPropagation();
			actions.closeFileSearch();
			return;
		}
		if (ev.key === 'ArrowDown') {
			ev.preventDefault();
			if (results.length) {
				actions.setFileSearch({
					activeIndex: Math.min(activeIndex + 1, results.length - 1)
				});
			}
			return;
		}
		if (ev.key === 'ArrowUp') {
			ev.preventDefault();
			actions.setFileSearch({activeIndex: Math.max(activeIndex - 1, 0)});
			return;
		}
		if (ev.key === 'Enter') {
			ev.preventDefault();
			if (results[activeIndex]) pick(results[activeIndex]);
		}
	};

	const bindOutsideClose = elm => {
		if (!elm || elm._fileSearchOutside) return;
		const onDown = ev => {
			if (elm.contains(ev.target)) return;
			actions.closeFileSearch();
			const field = elm.querySelector('.file-search-query');
			if (field && document.activeElement === field) field.blur();
		};
		document.addEventListener('mousedown', onDown, true);
		elm._fileSearchOutside = onDown;
	};

	const unbindOutsideClose = elm => {
		const onDown = elm && elm._fileSearchOutside;
		if (!onDown) return;
		document.removeEventListener('mousedown', onDown, true);
		delete elm._fileSearchOutside;
	};

	return dropdown('.file-search', {
		open: open && results.length > 0,
		hook: {
			insert: vnode => bindOutsideClose(vnode.elm),
			update: (oldVnode, vnode) => {
				if (oldVnode.elm && vnode.elm && oldVnode.elm !== vnode.elm) {
					unbindOutsideClose(oldVnode.elm);
					bindOutsideClose(vnode.elm);
				} else if (vnode.elm && oldVnode.elm && oldVnode.elm._fileSearchOutside) {
					vnode.elm._fileSearchOutside = oldVnode.elm._fileSearchOutside;
				} else {
					bindOutsideClose(vnode.elm);
				}
			},
			destroy: vnode => unbindOutsideClose(vnode.elm)
		},
		handle: [
			i('.fa.fa-search'),
			input('.file-search-query', {
				attrs: {
					type: 'search',
					placeholder: `Go to File (${hotkey})`,
					spellcheck: 'false',
					autocomplete: 'off',
					'aria-label': 'Search files in project'
				},
				props: {value: query},
				hook: {
					update: (oldVnode, vnode) => {
						const el = vnode.elm;
						if (!el) return;
						if (el !== document.activeElement && el.value !== query) {
							el.value = query;
						}
					}
				},
				on: {
					focus: () => {
						if (!open) actions.openFileSearch();
					},
					input: ev => actions.setFileSearchQuery(ev.target.value),
					keydown: onKeydown
				}
			}),
			showClear
				? button('.file-search-clear.inset-clear', {
					attrs: {
						type: 'button',
						title: 'Clear',
						'aria-label': 'Clear file search'
					},
					on: {
						// Keep focus in the field so the dropdown doesn't dismiss first
						mousedown: ev => ev.preventDefault(),
						click: clearSearch
					}
				}, [i('.fa.fa-times')])
				: null
		].filter(Boolean),
		items: open
			? results.map((item, index) => Object.assign({}, item, {
				active: index === activeIndex
			}))
			: [],
		itemSelect: (ev, item) => {
			ev.preventDefault();
			pick(item);
		},
		renderItem
	});
};
