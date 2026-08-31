import {div, input, button, span, i} from 'iblokz-snabbdom-helpers';
import findHighlight from '../../util/find-highlight.js';

const focusFindField = field => !!field && field.focus();

const syncFindInput = (field, query, force = false) => {
	if (!field) return;
	if (!force && field === document.activeElement) return;
	const next = query || '';
	if (field.value !== next) field.value = next;
};

export default ({state, actions}) => {
	const find = state.find || {};
	if (!state.file || !state.file.name || state.type === 'image') return null;

	const open = !!find.open;

	if (!open) {
		return div('.find-bar.collapsed', [
			button('.find-toggle', {
				attrs: {
					'aria-label': 'Find in document',
					title: 'Find (Mod+F)'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						actions.openFind();
					}
				}
			}, [i('.fa.fa-search')])
		]);
	}

	const step = dir => {
		if (dir < 0) actions.findPrev();
		else actions.findNext();
	};

	return div('.find-bar.open', {
		hook: {
			insert: ({elm}) => {
				const field = elm.querySelector('.find-query');
				syncFindInput(field, find.query, true);
				focusFindField(field);
				field?.select();
			}
		},
		on: {
			keydown: ev => {
				if (ev.key === 'Escape') {
					ev.preventDefault();
					ev.stopPropagation();
					actions.closeFind();
					return;
				}
				if (ev.key === 'Tab') {
					ev.preventDefault();
					ev.stopPropagation();
					if (!ev.shiftKey) {
						findHighlight.focusEditorMatch(
							document.querySelector('code.source'),
							state.pos
						);
					}
					return;
				}
				if (ev.key === 'Enter') {
					ev.preventDefault();
					step(ev.shiftKey ? -1 : 1);
					return;
				}
				if (ev.key === 'F3') {
					ev.preventDefault();
					step(ev.shiftKey ? -1 : 1);
				}
			}
		}
	}, [
		input('.find-query', {
			attrs: {
				type: 'search',
				placeholder: 'Find in document',
				'aria-label': 'Find in document',
				title: 'Tab selects the match in the editor',
				spellcheck: 'false'
			},
			hook: {
				insert: ({elm}) => {
					syncFindInput(elm, find.query, true);
				},
				update: (oldVnode, vnode) => {
					syncFindInput(vnode.elm, find.query);
				}
			},
			on: {
				input: ev => {
					actions.findQuery(ev.target.value);
				}
			}
		}),
		button('.find-prev', {
			attrs: {'aria-label': 'Previous match', title: 'Previous (Shift+Enter)'},
			on: {click: ev => { ev.preventDefault(); step(-1); }}
		}, [i('.fa.fa-chevron-up')]),
		button('.find-next', {
			attrs: {'aria-label': 'Next match', title: 'Next (Enter)'},
			on: {click: ev => { ev.preventDefault(); step(1); }}
		}, [i('.fa.fa-chevron-down')]),
		button('.find-case', {
			class: {active: !!find.caseSensitive},
			attrs: {'aria-label': 'Match case', title: 'Match case'},
			on: {
				click: ev => {
					ev.preventDefault();
					actions.setFind({caseSensitive: !find.caseSensitive});
					if (find.query) actions.findQuery(find.query);
				}
			}
		}, [span('Aa')]),
		button('.find-close', {
			attrs: {'aria-label': 'Close find', title: 'Close (Escape)'},
			on: {click: ev => { ev.preventDefault(); actions.closeFind(); }}
		}, [i('.fa.fa-times')])
	]);
};
