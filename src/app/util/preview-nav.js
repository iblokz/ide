/**
 * Preview navigation: breadcrumbs + open file/dir (README / index.md).
 */
import {getFs} from '../adapters/fs';
import {
	DIR_INDEX_NAMES,
	joinDirFile,
	pickDirIndexFromChildren
} from './preview-file.js';
import {resolveNodeInTree, fileStubFromPath} from './session.js';

const posix = p => String(p || '').replace(/\\/g, '/');

const basename = p => {
	const s = posix(p).replace(/\/+$/, '');
	const i = s.lastIndexOf('/');
	return i < 0 ? s : s.slice(i + 1);
};

/**
 * Breadcrumb crumbs for a file under the project root.
 * Includes the project folder name as the first crumb when possible.
 * @returns {{label: string, path: string, kind: 'dir'|'file'}[]}
 */
export const buildPreviewBreadcrumbs = (filePath, projectPath) => {
	const full = posix(filePath);
	if (!full) return [];

	const root = posix(projectPath).replace(/\/+$/, '');
	const crumbs = [];

	if (root && (full === root || full.startsWith(`${root}/`))) {
		crumbs.push({label: basename(root), path: root, kind: 'dir'});
		const rel = full === root ? '' : full.slice(root.length + 1);
		const parts = rel.split('/').filter(Boolean);
		let acc = root;
		for (let i = 0; i < parts.length; i++) {
			acc = `${acc}/${parts[i]}`;
			crumbs.push({
				label: parts[i],
				path: acc,
				kind: i === parts.length - 1 ? 'file' : 'dir'
			});
		}
		return crumbs;
	}

	const win = /^([a-zA-Z]:)(\/.*)?$/.exec(full);
	const parts = (win ? (win[2] || '/') : full).split('/').filter(Boolean);
	let acc = win ? win[1] : (full.startsWith('/') ? '' : null);
	for (let i = 0; i < parts.length; i++) {
		if (acc === null) acc = parts[i];
		else if (acc === '') acc = `/${parts[i]}`;
		else if (win && acc === win[1]) acc = `${win[1]}/${parts[i]}`;
		else acc = `${acc}/${parts[i]}`;
		crumbs.push({
			label: parts[i],
			path: acc,
			kind: i === parts.length - 1 ? 'file' : 'dir'
		});
	}
	return crumbs;
};

const revealDir = (actions, hit) => {
	const node = hit && hit.node;
	if (!node) return;
	actions.fileTree.select(node);
	if (!node.expanded && hit.indexPath) {
		actions.fileTree.toggleFolder(hit.indexPath, node);
	}
};

/** Resolve README.md / readme.md / index.md under a directory, if present. */
export const resolveDirIndexFile = async (dirPath, dirNode) => {
	let kids = (dirNode && dirNode.files) || null;
	if ((!kids || !kids.length) && dirNode) {
		const fs = getFs();
		if (typeof fs.listDir === 'function') {
			try {
				kids = await fs.listDir(dirNode);
			} catch (_err) {
				kids = null;
			}
		}
	}
	const fromListing = pickDirIndexFromChildren(kids || []);
	if (fromListing) return fromListing;

	const fs = getFs();
	for (let i = 0; i < DIR_INDEX_NAMES.length; i++) {
		const stub = fileStubFromPath(joinDirFile(dirPath, DIR_INDEX_NAMES[i]));
		try {
			if (typeof fs.readFileSample === 'function') {
				await fs.readFileSample(stub, 1);
			} else if (typeof fs.readFile === 'function') {
				await fs.readFile(stub);
			} else {
				break;
			}
			return stub;
		} catch (_err) {
			/* try next name */
		}
	}
	return null;
};

const openDir = (path, hit, actions) => {
	const dirNode = (hit && hit.node) || {
		path,
		name: basename(path),
		isDir: true
	};
	resolveDirIndexFile(path, dirNode).then(indexFile => {
		if (indexFile) {
			actions.project.openFile(indexFile, {source: 'tree'});
			return;
		}
		if (hit) revealDir(actions, hit);
	});
};

/**
 * Open a preview path: files open directly; directories open README/index or reveal.
 * @param {{path: string, kind?: 'dir'|'file', treeNodes?: array, actions: object, currentPath?: string}} opts
 */
export const openPreviewPath = ({path, kind, treeNodes, actions, currentPath}) => {
	if (!path || !actions || !actions.project) return;
	if (currentPath && path === currentPath) return;

	const hit = resolveNodeInTree(treeNodes || [], path);
	const node = hit && hit.node;

	if (kind === 'dir' || (node && node.isDir)) {
		openDir(path, hit, actions);
		return;
	}

	actions.project.openFile(
		node || fileStubFromPath(path),
		{source: 'tree'}
	);
};

export default {
	buildPreviewBreadcrumbs,
	resolveDirIndexFile,
	openPreviewPath
};
