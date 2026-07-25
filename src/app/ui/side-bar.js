'use strict';

const {
	div, a, span, ul, li, i, button, header
} = require('iblokz-snabbdom-helpers');

const fileSort = (a, b) => !a.isDir && b.isDir ? 1 : -1;

const levelUp = fn => (path = [], level, cb) =>
	(item, index) => fn(...[item, [].concat(path, index), level + 1, cb]);

const treeMap = (item, path = [], level = 0, cb) => {
	if (!item || !item.name) return null;

	const children = [
		a({
			style: {
				paddingLeft: `${(4 + 16 * level)}px`
			},
			class: {
				expanded: !!item.expanded,
				disabled: item.readable === false
			},
			attrs: {
				title: item.path || item.name
			},
			on: {
				click: ev => cb(item, path, level)
			}
		}, [
			item.isDir ? i(`.fa.${item.expanded ? 'fa-caret-down' : 'fa-caret-right'}`) : null,
			i(`.fa.${item.isDir ? 'fa-folder-o' : 'fa-file-o'}`, {
				style: {
					marginLeft: item.isDir ? '0px' : '16px'
				}
			}),
			span(String(item.name))
		].filter(Boolean))
	];

	if (item.isDir && item.expanded && Array.isArray(item.files) && item.files.length) {
		children.push(
			ul(item.files.slice().sort(fileSort).map(levelUp(treeMap)(path, level, cb)).filter(Boolean))
		);
	}

	return li(children);
};

module.exports = ({state, actions}) => {
	const recent = (state.recentRoots || []).filter(root => root && root.name);
	const tree = (state.filesTree || [])
		.slice()
		.sort(fileSort)
		.map((item, index) => treeMap(item, [index], 0,
			(item, path, level) => item.isDir
				? actions.toggleFolder(path, item.expanded)
				: actions.openFile(item)
		))
		.filter(Boolean);

	const title = (!state.project || state.project.id === 'demo')
		? 'Open Project'
		: (state.project.name || 'Project');

	return div('.side-bar', {
		class: {
			toggled: state.sideBar
		}
	}, [
		header([
			span({
				class: {
					placeholder: !state.project || state.project.id === 'demo'
				}
			}, title),
			button('.open-folder', {
				attrs: {
					title: 'Open folder',
					'aria-label': 'Open folder',
					type: 'button'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						actions.openFolder();
					}
				}
			}, [i('.fa.fa-folder-open-o')])
		]),
		ul('.file-list', tree),
		recent.length
			? div('.recent-roots', [
				span('.label', 'Recent'),
				ul(recent.map(root =>
					li([span({attrs: {title: root.path || root.name}}, root.name)])
				))
			])
			: null
	].filter(child => child != null));
};
