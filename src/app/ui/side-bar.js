import {
	div, a, span, ul, li, i, button, header
} from 'iblokz-snabbdom-helpers';
import {fn, obj} from 'iblokz-data';
import {fileIcon} from '../util/file-tree';

export const fileSort = (a, b) => !a.isDir && b.isDir ? 1 : -1;

/** Sort for display but keep each node's index in the unsorted state array. */
export const sortedWithIndex = (list = []) => list
	.map((item, index) => ({item, index}))
	.sort((a, b) => fileSort(a.item, b.item));

const fileLeafNode = (item, path = [], level = 0, cb) =>
	// main node
	(!item || !item.name) ? [] : li([].concat(
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
				click: ev => cb(item, path, level, ev)
			}
		}, [].concat(
			item.isDir ? i(`.fa.${item.expanded ? 'fa-caret-down' : 'fa-caret-right'}`) : [],
			i(`.fa.${fileIcon(item)}`, {
				style: {
					marginLeft: item.isDir ? '0px' : '16px'
				}
			}),
			// Pass text as a child array — names like ".env" must not be
			// treated as hyperscript selectors (span('.env') → empty span.env).
			span([String(item.name)])
		)),
		// children nodes
		(item.isDir && item.expanded && Array.isArray(item.files) && item.files.length)
		? ul([].concat(...sortedWithIndex(item.files).map(({item: child, index}) =>
			fileLeafNode(child, [].concat(path, index), level + 1, cb)
		)))
		: []
	));

export default ({state, actions, width}) => fn.pipe(
	// prep vars
	() => ({
		recent: (state.recentRoots || []).filter(root => root && root.name),
		fileTree: [].concat(...sortedWithIndex(state.filesTree || [])
			.map(({item, index}) => fileLeafNode(item, [index], 0,
				(item, path, level) => item.isDir
					? actions.toggleFolder(path, item)
					: actions.openFile(item)
			))),
		title: (!state.project || state.project.id === 'demo')
			? 'Open Project'
			: (state.project.name || 'Project'),
		open: !!obj.sub(state, ['layout', 'toggles', 'leftSideBar']),
		dim: obj.sub(state, ['layout', 'dim', 'leftSideBar']) || 260
	}),
	({open, dim, ...rest}) => ({
		...rest,
		open,
		resolvedWidth: open
			? (typeof width === 'number' ? width : dim)
			: 0
	}),
	// render
	({recent, fileTree, title, open, resolvedWidth}) => div('.side-bar', {
		class: {
			toggled: open
		},
		style: {
			width: `${resolvedWidth}px`,
			minWidth: open ? '140px' : '0px',
			maxWidth: open ? '480px' : '0px'
		}
	}, [].concat(
		header([
			span({
				class: {
					placeholder: !state.project || state.project.id === 'demo'
				}
			}, title),
			button('.open-folder', {
				attrs: {
					title: 'Open folder (Ctrl+O)',
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
		ul('.file-list', fileTree),
		recent.length
			? div('.recent-roots', [
				span('.label', 'Recent'),
				ul(recent.map(root =>
					li([
						a({
							attrs: {title: root.path || root.name, href: '#'},
							on: {
								click: ev => {
									ev.preventDefault();
									actions.openRecent(root);
								}
							}
						}, [span([String(root.name)])])
					])
				))
			])
			: []
	))
)();
