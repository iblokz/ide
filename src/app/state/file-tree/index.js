import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {
	mergeAt,
	findIndexPathByFilePath,
	nodeAtIndexPath
} from '../../util/file-tree';
import {
	fileStubFromPath,
	resolveFileInTree
} from '../../util/session.js';
import {getFs} from '../../adapters/fs';

/**
 * Sidebar file tree slice.
 * Nested at `state.fileTree`. Project root row is chrome only — never selectable.
 */
export const initial = {
	nodes: [],
	selectedPath: null,
	pendingDeletePath: null,
	treeEdit: null
};

export const slice = state => (state && state.fileTree) || initial;

export const patch = (state, partial) => obj.patch(
	state,
	'fileTree',
	Object.assign({}, slice(state), partial)
);

/** Project root tree node path(s) — never a selection / delete target. */
export const isRootPath = (state, path) => {
	if (!path) return false;
	const projectPath = state.project && state.project.path;
	if (projectPath && path === projectPath) return true;
	const top = slice(state).nodes[0];
	return !!(top && top.isDir && top.path === path);
};

/** Normalize selection path (empty → null). Root may be selected. */
export const safeSelectedPath = (_state, path) => path || null;

const dirnameOf = filePath => {
	const s = String(filePath || '');
	const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
	if (i <= 0) return null;
	return s.slice(0, i);
};

const patchNodesAt = (state, indexPath, nodePatch) => {
	const nodes = slice(state).nodes || [];
	return patch(state, {
		nodes: mergeAt({
			list: nodes,
			path: indexPath,
			nodesProp: 'files',
			patch: nodePatch
		})
	});
};

/** Replace tree nodes (open project / refresh). Clears edit chrome. */
export const setNodes = nodes => state => patch(state, {
	nodes: nodes || [],
	pendingDeletePath: null,
	treeEdit: null,
	selectedPath: safeSelectedPath(state, slice(state).selectedPath)
});

/** Reset slice (close / switch project). */
export const reset = () => state => obj.patch(state, 'fileTree', Object.assign({}, initial));

/** Select a tree item (including project root). */
export const select = item => {
	const path = (item && item.path) || null;
	return state => {
		if (!path) return state;
		const edit = slice(state).treeEdit;
		const keepRename = edit
			&& edit.mode === 'rename'
			&& edit.path === path;
		return patch(state, {
			selectedPath: path,
			pendingDeletePath: slice(state).pendingDeletePath === path
				? slice(state).pendingDeletePath
				: null,
			treeEdit: keepRename ? edit : null
		});
	};
};

/** Point selection at a file path (e.g. after open). */
export const selectPath = path => state => {
	const tree = slice(state);
	const nextPath = path || null;
	return patch(state, {
		selectedPath: nextPath,
		pendingDeletePath: tree.pendingDeletePath === nextPath
			? tree.pendingDeletePath
			: null
	});
};

export const clearEdit = () => state => patch(state, {treeEdit: null});

/** Inline rename for a non-root tree node. */
export const startRename = item => state => {
	if (!state.canWrite || !item || !item.path) return state;
	if (isRootPath(state, item.path)) return state;
	return patch(state, {
		selectedPath: item.path,
		pendingDeletePath: null,
		treeEdit: {
			mode: 'rename',
			path: item.path,
			name: item.name || ''
		}
	});
};

/** Hotkey (F2): rename selected tree item or active file tab. */
export const renameSelected = () => state => {
	const tree = slice(state);
	if (!state.canWrite || tree.treeEdit) return state;
	const path = tree.selectedPath
		|| (state.file && state.file.path)
		|| null;
	if (!path || isRootPath(state, path)) return state;
	const item = resolveFileInTree(tree.nodes, path)
		|| fileStubFromPath(path);
	if (!item || !item.path) return state;
	return startRename(item)(state);
};

/** Any tree node by path (files and folders). `resolveFileInTree` is files-only. */
const resolveNodeInTree = (nodes, path) => {
	if (!path) return null;
	const indexPath = findIndexPathByFilePath(nodes || [], path);
	if (!indexPath) return null;
	return nodeAtIndexPath(nodes || [], indexPath);
};

/**
 * Folder to create under: selected dir, else parent of selected file, else `fallback`
 * (root-row buttons pass the project root).
 */
const resolveCreateParent = (state, fallback) => {
	const tree = slice(state);
	const sel = tree.selectedPath
		|| (state.file && state.file.path)
		|| null;
	if (!sel || isRootPath(state, sel)) return fallback;

	const node = resolveNodeInTree(tree.nodes, sel);
	if (node && node.isDir) return node;

	const parentPath = dirnameOf((node && node.path) || sel);
	if (!parentPath) return fallback;
	if (isRootPath(state, parentPath)) return fallback;

	const parent = resolveNodeInTree(tree.nodes, parentPath);
	if (parent && parent.isDir) return parent;

	return {
		path: parentPath,
		name: parentPath.split(/[/\\]/).pop(),
		isDir: true
	};
};

/** Expand a dir so the create row / new item is visible. */
const ensureDirExpanded = (state, dir) => {
	if (!dir || !dir.isDir || !dir.path) return state;
	const nodes = slice(state).nodes || [];
	const indexPath = findIndexPathByFilePath(nodes, dir.path);
	if (!indexPath) return state;
	const node = resolveNodeInTree(nodes, dir.path) || dir;
	if (node.expanded && node.childrenLoaded) return state;

	if (node.childrenLoaded || (Array.isArray(node.files) && node.files.length)) {
		return patchNodesAt(state, indexPath, {expanded: true, childrenLoaded: true});
	}

	const fs = getFs();
	if (typeof fs.listDir !== 'function') {
		return patchNodesAt(state, indexPath, {expanded: true, childrenLoaded: true});
	}

	const dirPath = dir.path;
	fs.listDir(node)
		.then(files => {
			dispatch(s => {
				const path = findIndexPathByFilePath(slice(s).nodes || [], dirPath);
				if (!path) return s;
				return patchNodesAt(s, path, {
					expanded: true,
					childrenLoaded: true,
					files: files || []
				});
			});
		})
		.catch(err => {
			console.error('listDir failed', dirPath, err);
		});

	return patchNodesAt(state, indexPath, {expanded: true});
};

/**
 * Inline create under the selected folder (or file’s parent).
 * Leaves selection unchanged (root new-file/folder buttons must not select root).
 */
export const startCreate = (parent, kind) => state => {
	if (!state.canWrite || !parent || !parent.path) return state;
	const target = resolveCreateParent(state, parent);
	if (!target || !target.path) return state;
	const folder = kind === 'folder';
	const next = patch(state, {
		pendingDeletePath: null,
		treeEdit: {
			mode: folder ? 'create-folder' : 'create-file',
			path: target.path,
			name: folder ? 'New Folder' : 'untitled'
		}
	});
	return ensureDirExpanded(next, target);
};

/** Long-press toggles the delete affordance. Root rejected. */
export const toggleDeleteReveal = item => {
	const path = (item && item.path) || null;
	if (!path) return state => state;
	return state => {
		if (isRootPath(state, path)) return state;
		const tree = slice(state);
		return patch(state, {
			selectedPath: path,
			pendingDeletePath: tree.pendingDeletePath === path ? null : path
		});
	};
};

/** Expand / collapse a folder; lazy-load children when needed. */
export const toggleFolder = (path = [], item) => {
	if (!item || !item.isDir) return state => state;

	if (item.expanded) {
		return state => patchNodesAt(state, path, {expanded: false});
	}

	if (item.childrenLoaded) {
		return state => patchNodesAt(state, path, {expanded: true});
	}

	const fs = getFs();
	if (typeof fs.listDir !== 'function') {
		return state => patchNodesAt(state, path, {expanded: true, childrenLoaded: true});
	}

	return fs.listDir(item)
		.then(files => state => patchNodesAt(state, path, {
			expanded: true,
			childrenLoaded: true,
			files: files || []
		}))
		.catch(err => {
			console.error('listDir failed', item && item.path, err);
			return state => state;
		});
};

export default {
	initial,
	setNodes,
	reset,
	select,
	selectPath,
	clearEdit,
	startRename,
	renameSelected,
	startCreate,
	toggleDeleteReveal,
	toggleFolder
};
