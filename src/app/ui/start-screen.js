'use strict';

const {div, h1, p, button, ul, li, span, i} = require('iblokz-snabbdom-helpers');
const {isElectron} = require('../util/platform');

module.exports = ({state, actions}) => {
	const recent = (state.recentRoots || []).filter(root => root && root.name);
	const canOpen = state.canOpenFolder !== false;
	const electron = isElectron();

	return div('.start-screen', {
		class: {
			desktop: electron
		}
	}, [
		div('.start-panel', [].concat(
			span('.start-logo', {
				attrs: {
					role: 'img',
					'aria-label': 'iBloKz IDE'
				}
			}),
			h1(['iBloKz IDE']),
			p('.start-tagline', ['Open a project folder to get started.']),
			div('.start-actions', [
				button('.primary.open-project', {
					attrs: {
						type: 'button',
						title: canOpen ? 'Open folder (Ctrl+O)' : 'Folder open not available'
					},
					props: {disabled: !canOpen},
					on: {
						click: ev => {
							ev.preventDefault();
							actions.openFolder();
						}
					}
				}, [
					i('.fa.fa-folder-open-o'),
					' Open Project'
				])
			]),
			recent.length
				? div('.start-recent', [
					span('.label', ['Recent']),
					ul(recent.map(root =>
						li([
							button('.recent-item', {
								attrs: {
									type: 'button',
									title: root.path || root.name
								},
								on: {
									click: ev => {
										ev.preventDefault();
										actions.openRecent(root);
									}
								}
							}, [].concat(
								i('.fa.fa-folder-o'),
								span('.name', [String(root.name)]),
								root.path && root.path !== root.name
									? span('.path', [String(root.path)])
									: []
							))
						])
					))
				])
				: []
		))
	]);
};
