import {
	aside, div, a, span, ul, li, i, button, header, input, nav
} from 'iblokz-snabbdom-helpers';
import {fn, obj} from 'iblokz-data';
import {fileIcon} from '../util/file-tree';
import {joinProjectPath} from '../util/git-status.js';
import {fileStubFromPath} from '../util/session.js';

export const fileSort = (a, b) => !a.isDir && b.isDir ? 1 : -1;

/** Sort for display but keep each node's index in the unsorted state array. */
export const sortedWithIndex = (list = []) => list
	.map((item, index) => ({item, index}))
	.sort((a, b) => fileSort(a.item, b.item));

const LONG_PRESS_MS = 500;

let longPressTimer = null;
let longPressFired = false;
/** Prevent Enter+blur double-commit on the same input. */
let treeEditDone = false;

const clearLongPress = () => {
	if (longPressTimer) {
		clearTimeout(longPressTimer);
		longPressTimer = null;
	}
};

const stop = ev => {
	ev.preventDefault();
	ev.stopPropagation();
};

const treeAction = ({className, title, icon, onClick, holdFocus}) =>
	button(`.tree-action${className ? '.' + className : ''}`, {
		attrs: {
			title,
			'aria-label': title,
			type: 'button'
		},
		on: {
			// Always stop the row from activating (select / toggle) when a tree action is used.
			// holdFocus + preventDefault also keeps rename/create input focused on mobile.
			pointerdown: ev => {
				stop(ev);
			},
			click: ev => {
				stop(ev);
				if (typeof onClick === 'function') onClick(ev);
			}
		}
	}, [i(`.fa.${icon}`)]);

const treeNameEdit = ({value, ariaLabel, onCommit, onCancel}) => {
	treeEditDone = false;
	let inputElm = null;
	const finish = (raw, commit) => {
		if (treeEditDone) return;
		treeEditDone = true;
		const next = String(raw == null ? '' : raw).trim();
		if (commit && next) onCommit(next);
		else onCancel();
	};
	const readValue = () => (inputElm && inputElm.value) || '';
	return span('.tree-name-edit', [
		input('.tree-name-input', {
			attrs: {
				type: 'text',
				spellcheck: 'false',
				'aria-label': ariaLabel || 'Name'
			},
			props: {
				value: value || ''
			},
			hook: {
				insert: ({elm}) => {
					inputElm = elm;
					queueMicrotask(() => {
						if (!elm || typeof elm.focus !== 'function') return;
						elm.focus();
						elm.select();
					});
				},
				update: (_old, {elm}) => {
					inputElm = elm;
				}
			},
			on: {
				click: stop,
				pointerdown: stop,
				keydown: ev => {
					if (ev.key === 'Enter') {
						stop(ev);
						finish(ev.target.value, true);
					} else if (ev.key === 'Escape') {
						stop(ev);
						finish('', false);
					}
				},
				blur: ev => {
					const val = ev.target.value;
					setTimeout(() => finish(val, true), 0);
				}
			}
		}),
		span('.tree-actions.tree-edit-actions', [
			treeAction({
				className: 'confirm',
				title: 'Confirm',
				icon: 'fa-check',
				holdFocus: true,
				onClick: () => finish(readValue(), true)
			}),
			treeAction({
				className: 'cancel',
				title: 'Cancel',
				icon: 'fa-times',
				holdFocus: true,
				onClick: () => finish('', false)
			})
		])
	]);
};

const fileLeafNode = (item, path = [], level = 0, opts) => {
	if (!item || !item.name) return [];

	const {
		onActivate,
		onPinActivate,
		onLongPress,
		selectedPath,
		pendingDeletePath,
		treeEdit,
		canWrite,
		onNewFile,
		onNewFolder,
		onStartRename,
		onCommitRename,
		onCommitCreate,
		onCancelEdit,
		onDelete,
		isRootItem
	} = opts;

	const isRoot = level === 0 || !!(isRootItem && isRootItem(item));
	const selected = !!selectedPath && item.path === selectedPath;
	const showDelete = !isRoot && !!pendingDeletePath && item.path === pendingDeletePath;
	const isRenaming = !!(treeEdit
		&& treeEdit.mode === 'rename'
		&& treeEdit.path === item.path);
	const isCreatingHere = !!(treeEdit
		&& (treeEdit.mode === 'create-file' || treeEdit.mode === 'create-folder')
		&& treeEdit.path === item.path);
	const showActions = canWrite && !isRenaming && (isRoot || selected || showDelete);

	return li([].concat(
		div('.tree-row', {
			style: {
				paddingLeft: `${(4 + 16 * level)}px`
			},
			class: {
				expanded: !!item.expanded,
				disabled: item.readable === false,
				active: selected,
				'pending-delete': showDelete,
				editing: isRenaming,
				'tree-root': isRoot
			},
			attrs: {
				title: item.path || item.name,
				role: 'treeitem',
				tabindex: '0'
			},
			on: {
				pointerdown: ev => {
					if (isRenaming || isRoot) return;
					if (ev.pointerType === 'mouse' && ev.button !== 0) return;
					clearLongPress();
					longPressFired = false;
					longPressTimer = setTimeout(() => {
						longPressTimer = null;
						longPressFired = true;
						onLongPress(item);
					}, LONG_PRESS_MS);
				},
				pointerup: clearLongPress,
				pointerleave: clearLongPress,
				pointercancel: clearLongPress,
				contextmenu: ev => {
					if (longPressFired || longPressTimer) stop(ev);
				},
				click: ev => {
					if (isRenaming) {
						stop(ev);
						return;
					}
					clearLongPress();
					if (longPressFired) {
						longPressFired = false;
						stop(ev);
						return;
					}
					onActivate(item, path, level, ev);
				},
				dblclick: ev => {
					if (isRenaming || item.isDir) return;
					stop(ev);
					clearLongPress();
					if (typeof onPinActivate === 'function') {
						onPinActivate(item, path, level, ev);
					}
				}
			}
		}, [].concat(
			item.isDir ? i(`.fa.${item.expanded ? 'fa-caret-down' : 'fa-caret-right'}`) : [],
			i(`.fa.${fileIcon(item)}`, {
				style: {
					marginLeft: item.isDir ? '0px' : '16px'
				}
			}),
			isRenaming
				? treeNameEdit({
					value: treeEdit.name || item.name,
					ariaLabel: 'Rename',
					onCommit: name => onCommitRename(item, name),
					onCancel: onCancelEdit
				})
				: span('.name', [String(item.name)]),
			showActions
				? span('.tree-actions', [].concat(
					isRoot
						? [
							treeAction({
								className: 'new-file',
								title: 'New file',
								icon: 'fa-file-o',
								onClick: () => onNewFile(item)
							}),
							treeAction({
								className: 'new-folder',
								title: 'New folder',
								icon: 'fa-folder-o',
								onClick: () => onNewFolder(item)
							})
						]
						: [],
					selected && !isRoot
						? treeAction({
							className: 'edit',
							title: 'Rename',
							icon: 'fa-pencil',
							onClick: () => onStartRename(item)
						})
						: [],
					showDelete && !isRoot
						? treeAction({
							className: 'delete',
							title: 'Delete',
							icon: 'fa-trash-o',
							onClick: () => onDelete(item)
						})
						: []
				))
				: []
		)),
		isCreatingHere
			? div('.tree-create-row', {
				style: {
					paddingLeft: `${(4 + 16 * (level + 1))}px`
				},
				on: {
					click: stop,
					pointerdown: stop
				}
			}, [
				i(`.fa.${treeEdit.mode === 'create-folder' ? 'fa-folder-o' : 'fa-file-o'}`),
				treeNameEdit({
					value: treeEdit.name,
					ariaLabel: treeEdit.mode === 'create-folder' ? 'New folder' : 'New file',
					onCommit: name => onCommitCreate(item, treeEdit.mode, name),
					onCancel: onCancelEdit
				})
			])
			: [],
		// children nodes
		(item.isDir && item.expanded && Array.isArray(item.files) && item.files.length)
		? ul([].concat(...sortedWithIndex(item.files).map(({item: child, index}) =>
			fileLeafNode(child, [].concat(path, index), level + 1, opts)
		)))
		: []
	));
};

const branchLabel = git => {
	const branch = git.branch || 'HEAD';
	const bits = [];
	if (git.ahead) bits.push(`↑${git.ahead}`);
	if (git.behind) bits.push(`↓${git.behind}`);
	return bits.length ? `${branch} ${bits.join(' ')}` : branch;
};

const gitPanel = ({git, projectPath, actions}) => {
	if (!projectPath) {
		return div('.side-bar-placeholder', [
			span('.side-bar-placeholder-title', 'Source Control'),
			span('.side-bar-placeholder-body', 'Open a folder to see git status')
		]);
	}
	if (git.available === false) {
		return div('.side-bar-placeholder', [
			span('.side-bar-placeholder-title', 'Source Control'),
			span('.side-bar-placeholder-body', 'Git status requires the desktop app')
		]);
	}
	if (git.error) {
		return div('.git-status', [
			div('.git-status-header', [
				span('.git-status-branch', 'Source Control'),
				button('.git-status-refresh', {
					attrs: {type: 'button', title: 'Refresh', 'aria-label': 'Refresh'},
					on: {
						click: ev => {
							ev.preventDefault();
							actions.git.refresh();
						}
					}
				}, [i('.fa.fa-refresh')])
			]),
			div('.side-bar-placeholder', [
				span('.side-bar-placeholder-body', String(git.error))
			])
		]);
	}
	const files = git.files || [];
	const commits = git.commits || [];
	const loading = git.loading || git.available == null;
	return div('.git-status', [
		div('.git-status-header', [
			span('.git-status-branch', {
				attrs: {title: branchLabel(git)}
			}, [
				i('.fa.fa-code-fork'),
				span(branchLabel(git))
			]),
			button('.git-status-refresh', {
				attrs: {
					type: 'button',
					title: 'Refresh',
					'aria-label': 'Refresh'
				},
				props: {disabled: !!git.loading},
				class: {loading: !!git.loading},
				on: {
					click: ev => {
						ev.preventDefault();
						actions.git.refresh();
					}
				}
			}, [i('.fa.fa-refresh')])
		]),
		div('.git-status-body', [
			div('.git-status-section', [
				span('.git-status-section-title', 'Changes'),
				files.length
					? ul('.git-status-list', files.map(entry => {
						const abs = joinProjectPath(projectPath, entry.path);
						const letter = entry.status || ' ';
						return li('.git-status-item', {
							attrs: {title: abs},
							on: {
								click: ev => {
									ev.preventDefault();
									actions.project.openFile(
										fileStubFromPath(abs),
										{source: 'tree'}
									);
								}
							}
						}, [
							span('.git-status-code', letter),
							span('.git-status-path', entry.path)
						]);
					}))
					: span('.git-status-empty',
						loading ? 'Loading…' : 'No changes')
			]),
			div('.git-status-section', [
				span('.git-status-section-title', 'Commits'),
				commits.length
					? ul('.git-log-list', commits.map(entry =>
						li('.git-log-item', {
							attrs: {title: `${entry.hash} ${entry.subject}`}
						}, [
							span('.git-log-hash', entry.hash),
							span('.git-log-subject', entry.subject)
						])
					))
					: span('.git-status-empty',
						loading ? 'Loading…' : 'No commits')
			])
		])
	]);
};

export default ({state, actions, width}) => fn.pipe(
	// prep vars
	() => {
		const tree = state.fileTree || {};
		const rootPath = state.project && state.project.path;
		const treeRootPath = tree.nodes && tree.nodes[0] && tree.nodes[0].path;
		const isRootPath = p => !!(p && (p === rootPath || p === treeRootPath));
		const isRootItem = item => !!(item && isRootPath(item.path));
		const selectedPath = tree.selectedPath
			|| (state.file && state.file.path)
			|| null;
		const pendingDeletePath = isRootPath(tree.pendingDeletePath)
			? null
			: (tree.pendingDeletePath || null);
		const treeEdit = tree.treeEdit || null;
		const canWrite = !!state.canWrite;
		const treeOpts = {
			selectedPath,
			pendingDeletePath,
			treeEdit,
			canWrite,
			isRootItem,
			onActivate: (item, path) => {
				actions.fileTree.select(item);
				if (item.isDir) actions.fileTree.toggleFolder(path, item);
				else actions.project.openFile(item, {source: 'tree'});
			},
			onPinActivate: item => {
				actions.fileTree.select(item);
				if (!item.isDir) {
					actions.project.openFile(item, {source: 'pin'});
				}
			},
			onLongPress: item => {
				if (!canWrite) return;
				if (isRootItem(item)) return;
				actions.fileTree.toggleDeleteReveal(item);
			},
			onNewFile: parent => actions.fileTree.startCreate(parent, 'file'),
			onNewFolder: parent => actions.fileTree.startCreate(parent, 'folder'),
			onStartRename: item => actions.fileTree.startRename(item),
			onCommitRename: (item, name) => {
				if (!name || name === item.name) {
					actions.fileTree.clearEdit();
					return;
				}
				actions.project.renameItem(item, name);
			},
			onCommitCreate: (parent, mode, name) => {
				if (!name) {
					actions.fileTree.clearEdit();
					return;
				}
				if (mode === 'create-folder') actions.project.createFolder(parent, name);
				else actions.project.createFile(parent, name);
			},
			onCancelEdit: () => actions.fileTree.clearEdit(),
			// Long-press already revealed the trash control — no window.confirm (broken on mobile).
			onDelete: item => actions.project.deleteItem(item)
		};
		const section = obj.sub(state, ['layout', 'sideBarSection']) || 'fileTree';
		const git = state.git || {};
		return {
			section,
			git,
			projectPath: rootPath || null,
			recent: (state.recentRoots || []).filter(root => root && root.name),
			fileTree: [].concat(...sortedWithIndex(tree.nodes || [])
				.map(({item, index}) => fileLeafNode(item, [index], 0, treeOpts))),
			title: !(state.project && state.project.path)
				? 'Open Project'
				: (state.project.name || 'Project'),
			open: !!obj.sub(state, ['layout', 'toggles', 'leftSideBar']),
			dim: obj.sub(state, ['layout', 'dim', 'leftSideBar']) || 260
		};
	},
	({open, dim, ...rest}) => ({
		...rest,
		open,
		resolvedWidth: open
			? (typeof width === 'number' ? width : dim)
			: 0
	}),
	// render
	({recent, fileTree, title, open, resolvedWidth, section, git, projectPath}) => aside('.left-pane', {
		class: {
			toggled: open
		},
		style: {
			width: `${resolvedWidth}px`,
			// Keep min/max stable so width can animate open/close
			minWidth: '0px',
			maxWidth: '480px'
		}
	}, [].concat(
		header([
			span({
				class: {
					placeholder: !(state.project && state.project.path)
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
						actions.project.openFolder();
					}
				}
			}, [i('.fa.fa-folder-open-o')])
		]),
		nav('.side-bar-sections', {
			attrs: {'aria-label': 'Sidebar section'}
		}, [
			{
				id: 'fileTree',
				title: 'Explorer',
				icon: 'fa-files-o'
			},
			{
				id: 'search',
				title: 'Search',
				icon: 'fa-search'
			},
			{
				id: 'git',
				title: 'Source Control',
				icon: 'fa-code-fork'
			}
		].map(tab =>
			button('.side-bar-section', {
				class: {active: section === tab.id},
				attrs: {
					type: 'button',
					title: tab.title,
					'aria-label': tab.title,
					'aria-pressed': section === tab.id ? 'true' : 'false'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						actions.layout.setSideBarSection(tab.id);
						if (tab.id === 'git') actions.git.refresh();
					}
				}
			}, [i(`.fa.${tab.icon}`)])
		)),
		section === 'fileTree'
			? [].concat(
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
											actions.project.openRecent(root);
										}
									}
								}, [span([String(root.name)])])
							])
						))
					])
					: []
			)
			: section === 'git'
				? gitPanel({git, projectPath, actions})
				: div('.side-bar-placeholder', [
					span('.side-bar-placeholder-title', 'Search'),
					span('.side-bar-placeholder-body', 'Coming soon')
				])
	))
)();
