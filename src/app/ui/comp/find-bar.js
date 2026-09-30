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
	const query = find.query || '';

	const step = dir => {
		if (dir < 0) actions.findPrev();
		else actions.findNext();
	};

	const onKeydown = ev => {
		if (!open) return;
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
	};

	return div('.find-bar', {
		class: {
			open,
			collapsed: !open
		},
		hook: {
			insert: ({elm}) => {
				if (!open) return;
				const field = elm.querySelector('.find-query');
				syncFindInput(field, query, true);
				focusFindField(field);
				field?.select();
			},
			update: (oldVnode, vnode) => {
				const wasOpen = !!(oldVnode.data && oldVnode.data.class && oldVnode.data.class.open);
				if (open && !wasOpen) {
					const field = vnode.elm && vnode.elm.querySelector('.find-query');
					syncFindInput(field, query, true);
					focusFindField(field);
					field?.select();
				}
			}
		},
		on: {keydown: onKeydown}
	}, [
		button('.find-toggle', {
			attrs: {
				type: 'button',
				tabindex: open ? '-1' : '0',
				'aria-hidden': open ? 'true' : 'false',
				'aria-label': 'Find in document',
				title: 'Find (Mod+F)'
			},
			on: {
				click: ev => {
					ev.preventDefault();
					if (!open) actions.openFind();
				}
			}
		}, [i('.fa.fa-search')]),
		span(`.find-query-wrap${query ? '.has-clear' : ''}`, [
			input('.find-query', {
				attrs: {
					type: 'search',
					placeholder: 'Find in document',
					'aria-label': 'Find in document',
					title: 'Tab selects the match in the editor',
					spellcheck: 'false',
					tabindex: open ? '0' : '-1'
				},
				props: {
					disabled: !open
				},
				hook: {
					insert: ({elm}) => {
						syncFindInput(elm, query, true);
					},
					update: (oldVnode, vnode) => {
						syncFindInput(vnode.elm, query);
					}
				},
				on: {
					input: ev => {
						actions.findQuery(ev.target.value);
					}
				}
			}),
			query
				? button('.find-clear.inset-clear', {
					attrs: {
						type: 'button',
						tabindex: open ? '0' : '-1',
						title: 'Clear',
						'aria-label': 'Clear find'
					},
					on: {
						mousedown: ev => ev.preventDefault(),
						click: ev => {
							ev.preventDefault();
							ev.stopPropagation();
							actions.findQuery('');
							queueMicrotask(() => {
								const field = document.querySelector('.find-bar .find-query');
								focusFindField(field);
							});
						}
					}
				}, [i('.fa.fa-times')])
				: null
		].filter(Boolean)),
		button('.find-prev', {
			attrs: {
				type: 'button',
				tabindex: open ? '0' : '-1',
				'aria-label': 'Previous match',
				title: 'Previous (Shift+Enter)'
			},
			on: {click: ev => { ev.preventDefault(); step(-1); }}
		}, [i('.fa.fa-chevron-up')]),
		button('.find-next', {
			attrs: {
				type: 'button',
				tabindex: open ? '0' : '-1',
				'aria-label': 'Next match',
				title: 'Next (Enter)'
			},
			on: {click: ev => { ev.preventDefault(); step(1); }}
		}, [i('.fa.fa-chevron-down')]),
		button('.find-case', {
			class: {active: !!find.caseSensitive},
			attrs: {
				type: 'button',
				tabindex: open ? '0' : '-1',
				'aria-label': 'Match case',
				title: 'Match case'
			},
			on: {
				click: ev => {
					ev.preventDefault();
					actions.setFind({caseSensitive: !find.caseSensitive});
					if (query) actions.findQuery(query);
				}
			}
		}, [span('Aa')]),
		button('.find-close.inset-clear', {
			attrs: {
				type: 'button',
				tabindex: open ? '0' : '-1',
				'aria-label': 'Close find',
				title: 'Close (Escape)'
			},
			on: {click: ev => { ev.preventDefault(); actions.closeFind(); }}
		}, [i('.fa.fa-chevron-right')])
	]);
};
