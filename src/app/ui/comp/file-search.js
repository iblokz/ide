import {input, span, i} from 'iblokz-snabbdom-helpers';
import {formatHotkey} from '../../util/hotkey';
import {flattenFiles, filterFiles} from '../../util/file-search';
import dropdown from './dropdown';

const parentPath = path => {
	const normalized = String(path || '').replace(/\\/g, '/');
	const i = normalized.lastIndexOf('/');
	return i > 0 ? normalized.slice(0, i) : '';
};

const renderItem = item => {
	const name = String(item.name || '');
	const dir = parentPath(item.path);
	return span('.file-search-option', [].concat(
		span('.file-search-name', [name]),
		dir ? span('.file-search-path', [dir]) : []
	));
};

export default ({state, actions}) => {
	const fsState = state.fileSearch || {open: false, query: '', activeIndex: 0};
	const open = !!fsState.open;
	const query = fsState.query || '';
	const rootPath = state.project && state.project.path;
	const results = filterFiles(
		flattenFiles(state.filesTree || []),
		query,
		rootPath
	);
	const activeIndex = Math.max(
		0,
		Math.min(fsState.activeIndex || 0, Math.max(results.length - 1, 0))
	);
	const hotkey = formatHotkey('Mod+P');

	const pick = item => {
		if (!item || !item.file) return;
		actions.openFile(item.file);
		actions.closeFileSearch();
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
			})
		],
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
