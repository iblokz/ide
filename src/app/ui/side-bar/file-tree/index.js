/**
 * Explorer sidebar section: file tree + recent roots panel.
 */
import {div, a, span, ul, li} from 'iblokz-snabbdom-helpers';
import {obj} from 'iblokz-data';
import {buildGitChangeIndex} from '../../../util/git-status.js';
import sideBarPanel from '../panel.js';
import {fileLeafNode} from './node.js';
import {sortedWithIndex} from './sort.js';

export {fileSort, sortedWithIndex} from './sort.js';

export default ({state, actions}) => {
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
	const git = state.git || {};
	const gitIndex = buildGitChangeIndex(git.files || [], rootPath || null);
	const treeOpts = {
		selectedPath,
		pendingDeletePath,
		treeEdit,
		canWrite,
		isRootItem,
		gitIndex,
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

	const fileTree = [].concat(...sortedWithIndex(tree.nodes || [])
		.map(({item, index}) => fileLeafNode(item, [index], 0, treeOpts)));
	const recent = (state.recentRoots || []).filter(root => root && root.name);
	const recentOpen = obj.sub(state, ['layout', 'toggles', 'recentRoots']) !== false;
	const recentHeight = obj.sub(state, ['layout', 'dim', 'recentRoots']) || 120;

	return [].concat(
		ul('.file-list', fileTree),
		recent.length
			? sideBarPanel({
				title: 'Recent',
				open: recentOpen,
				height: recentHeight,
				onToggle: () => actions.layout.toggle('recentRoots'),
				onResize: h => actions.layout.set({recentRoots: h}),
				children: [
					ul('.recent-roots-list', recent.map(root =>
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
				]
			})
			: []
	);
};
