import {div, span, button, i} from 'iblokz-snabbdom-helpers';

const tabLabel = tab => {
	const name = (tab.file && tab.file.name) || 'untitled';
	return tab.dirty ? `${name} •` : name;
};

export default ({state, actions}) => {
	const tabs = state.tabs || [];
	if (!tabs.length) return null;

	return div('.tab-strip', {
		attrs: {role: 'tablist', 'aria-label': 'Open files'}
	}, tabs.map(tab => {
		const active = tab.id === state.activeTabId;
		const title = (tab.file && (tab.file.path || tab.file.name)) || tab.id;
		return div(`.tab${active ? '.is-active' : ''}${tab.dirty ? '.is-dirty' : ''}`, {
			attrs: {
				role: 'tab',
				'aria-selected': active ? 'true' : 'false',
				title
			},
			on: {
				click: ev => {
					if (ev.target.closest && ev.target.closest('.tab-close')) return;
					actions.setActiveTab(tab.id);
				},
				mousedown: ev => {
					// Middle-click close
					if (ev.button !== 1) return;
					ev.preventDefault();
					if (tab.dirty) {
						const ok = window.confirm(`Discard unsaved changes to ${tab.file && tab.file.name}?`);
						if (!ok) return;
					}
					actions.closeTab(tab.id);
				}
			}
		}, [
			span('.tab-label', tabLabel(tab)),
			button('.tab-close', {
				attrs: {
					type: 'button',
					'aria-label': `Close ${tab.file && tab.file.name || 'tab'}`,
					title: 'Close'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						if (tab.dirty) {
							const ok = window.confirm(`Discard unsaved changes to ${tab.file && tab.file.name}?`);
							if (!ok) return;
						}
						actions.closeTab(tab.id);
					}
				}
			}, [i('.fa.fa-times')])
		]);
	}));
};
