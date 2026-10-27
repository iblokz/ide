/**
 * Explorer tree row / leaf rendering.
 */
import {
	div, span, ul, li, i, button, input
} from 'iblokz-snabbdom-helpers';
import {fileIcon} from '../../../util/file-tree';
import {sortedWithIndex} from './sort.js';

/** Map porcelain letter → CSS modifier (file rows). */
const gitStatusClass = letter => {
	if (!letter || letter === ' ') return null;
	if (letter === '?') return 'untracked';
	if (letter === 'A') return 'added';
	if (letter === 'D') return 'deleted';
	if (letter === 'U') return 'conflict';
	return 'modified';
};

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

export const fileLeafNode = (item, path = [], level = 0, opts) => {
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
		isRootItem,
		gitIndex
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
	// Direct status (file or untracked dir `?? foo/`); folders also tint via dirChanged.
	const fileGitLetter = gitIndex ? gitIndex.fileStatus(item.path) : null;
	const dirGitChanged = !!(item.isDir && gitIndex && (
		gitIndex.dirChanged(item.path) || !!fileGitLetter
	));
	const gitMod = gitStatusClass(fileGitLetter);

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
				'tree-root': isRoot,
				'git-changed': !!fileGitLetter || dirGitChanged,
				[`git-${gitMod}`]: !!gitMod
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
				: [],
			// Rightmost: always reserve badge width (letter or empty placeholder).
			span('.tree-git-badge', {
				class: {empty: !fileGitLetter},
				attrs: fileGitLetter
					? {title: `Git: ${fileGitLetter}`}
					: {'aria-hidden': 'true'}
			}, [fileGitLetter || '\u00a0'])
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
		(item.isDir && item.expanded && Array.isArray(item.files) && item.files.length)
			? ul([].concat(...sortedWithIndex(item.files).map(({item: child, index}) =>
				fileLeafNode(child, [].concat(path, index), level + 1, opts)
			)))
			: []
	));
};

export default {fileLeafNode};
