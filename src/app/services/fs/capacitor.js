'use strict';

/**
 * Capacitor FS backend — user-picked folder via SAF (Android) /
 * security-scoped bookmarks (iOS). Cancel leaves no project open.
 */

const {hashPath, extOf, SKIP_NAMES, fileKind} = require('../../util/file-tree');

const loadScopedFolder = () => {
	try {
		const mod = require('@iblokz/scoped-folder');
		return mod && mod.ScopedFolder;
	} catch (err) {
		return null;
	}
};

const getCapacitor = () => {
	if (typeof window !== 'undefined' && window.Capacitor) {
		return window.Capacitor;
	}
	try {
		return require('@capacitor/core').Capacitor;
	} catch (err) {
		return null;
	}
};

const joinPath = (...parts) =>
	parts
		.filter(p => p != null && String(p).length)
		.map(p => String(p).replace(/^\/+|\/+$/g, ''))
		.filter(Boolean)
		.join('/');

const parentPath = path => {
	const parts = String(path || '').split('/').filter(Boolean);
	parts.pop();
	return parts.join('/');
};

const isCancelled = err => {
	const msg = String((err && err.message) || err || '');
	return /cancel/i.test(msg);
};

const toFileNode = (name, filePath) => {
	const ext = extOf(name);
	const kind = fileKind(name, ext);
	return {
		id: hashPath(filePath),
		name,
		path: filePath,
		isDir: false,
		ext,
		kind,
		readable: kind !== 'binary'
	};
};

const toDirStub = (name, dirPath) => ({
	id: hashPath(dirPath || name),
	name,
	path: dirPath,
	isDir: true,
	ext: false,
	expanded: false,
	childrenLoaded: false,
	files: []
});

const create = () => {
	const ScopedFolder = loadScopedFolder();
	let activeFolder = null;

	// Prefer native signals over bundled Cap stubs (Parcel can evaluate early).
	const isNative = () => {
		if (typeof window === 'undefined') return false;
		if (window.androidBridge) return true;
		if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bridge) {
			return true;
		}
		const Cap = getCapacitor();
		return !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
	};

	const resolvePlugin = () => {
		const Cap = getCapacitor();
		if (Cap && Cap.Plugins && Cap.Plugins.ScopedFolder) {
			return Cap.Plugins.ScopedFolder;
		}
		return ScopedFolder;
	};

	const requirePlugin = () => {
		const plugin = resolvePlugin();
		if (!isNative() || !plugin) {
			throw new Error('ScopedFolder plugin not available');
		}
		return plugin;
	};

	const requireFolder = () => {
		if (!activeFolder || !activeFolder.id) {
			throw new Error('No scoped folder open');
		}
		return activeFolder;
	};

	const relativePath = nodePath => {
		const folder = requireFolder();
		const p = nodePath == null ? '' : String(nodePath);
		if (!p || p === folder.id || p === folder.name) return '';
		return p.replace(/^\/+|\/+$/g, '');
	};

	const listChildren = async (relPath) => {
		const plugin = requirePlugin();
		const folder = requireFolder();
		const result = await plugin.readdir({
			folder,
			path: relPath || ''
		});
		const entries = (result && result.entries) || [];
		const files = [];
		for (const entry of entries) {
			const name = entry && entry.name;
			if (!name || SKIP_NAMES.has(name)) continue;
			const childPath = joinPath(relPath, name);
			if (entry.isDir) {
				files.push(toDirStub(name, childPath));
			} else {
				files.push(toFileNode(name, childPath));
			}
		}
		return files;
	};

	const projectFromFolder = async (folder) => {
		activeFolder = {
			id: folder.id,
			name: folder.name || 'folder'
		};
		const children = await listChildren('');
		const rootId = hashPath(folder.id);
		const rootName = activeFolder.name;
		return {
			id: rootId,
			name: rootName,
			path: folder.id,
			filesTree: [{
				id: rootId,
				name: rootName,
				path: folder.id,
				isDir: true,
				ext: false,
				expanded: true,
				childrenLoaded: true,
				files: children
			}],
			writable: true,
			access: 'capacitor-scoped'
		};
	};

	return {
		id: 'capacitor',
		get canOpenFolder() {
			return isNative();
		},
		get canWrite() {
			return isNative();
		},
		logCapabilities() {
			if (typeof window !== 'undefined' && window.__iblokzFsCapsLogged) return;
			if (typeof window !== 'undefined') window.__iblokzFsCapsLogged = true;
			const Cap = getCapacitor();
			console.info('[fs] capabilities', {
				backend: 'capacitor',
				platform: Cap && typeof Cap.getPlatform === 'function' ? Cap.getPlatform() : null,
				native: isNative(),
				hasAndroidBridge: !!(typeof window !== 'undefined' && window.androidBridge),
				hasScopedFolder: !!resolvePlugin(),
				access: 'scoped-folder'
			});
		},
		async openFolder() {
			if (!isNative()) {
				console.warn('[fs] openFolder: not native Cap');
				return null;
			}
			const plugin = requirePlugin();
			console.info('[fs] capacitor pickFolder');
			try {
				const picked = await plugin.pickFolder();
				const folder = picked && picked.folder;
				if (!folder || !folder.id) return null;
				return projectFromFolder(folder);
			} catch (err) {
				console.error('[fs] pickFolder failed', err);
				if (isCancelled(err)) return null;
				throw err;
			}
		},
		async openFolderByPath(token, meta) {
			if (!isNative() || !token) return null;
			requirePlugin();
			try {
				return await projectFromFolder({
					id: token,
					name: (meta && meta.name) || 'folder'
				});
			} catch (err) {
				console.error('openFolderByPath failed', err);
				activeFolder = null;
				return null;
			}
		},
		async listDir(node) {
			return listChildren(relativePath(node && node.path));
		},
		async readFile(node) {
			const plugin = requirePlugin();
			const folder = requireFolder();
			const path = relativePath(node && node.path);
			if (!path) throw new Error('Missing file path');
			const result = await plugin.readFile({
				folder,
				path,
				encoding: 'utf8'
			});
			return result.data;
		},
		async getObjectUrl(node) {
			const plugin = requirePlugin();
			const folder = requireFolder();
			const path = relativePath(node && node.path);
			if (!path) throw new Error('Missing file path');
			const result = await plugin.readFile({
				folder,
				path,
				encoding: 'base64'
			});
			const ext = (node.ext || extOf(node.name) || 'bin').toLowerCase();
			const mime = ({
				png: 'image/png',
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				gif: 'image/gif',
				webp: 'image/webp',
				bmp: 'image/bmp',
				ico: 'image/x-icon',
				svg: 'image/svg+xml'
			})[ext] || 'application/octet-stream';
			return `data:${mime};base64,${result.data}`;
		},
		async writeFile(node, content) {
			const plugin = requirePlugin();
			const folder = requireFolder();
			const path = relativePath(node && node.path);
			if (!path) throw new Error('Missing file path');
			const dir = parentPath(path);
			if (dir) {
				await plugin.mkdir({
					folder,
					path: dir,
					recursive: true
				});
			}
			await plugin.writeFile({
				folder,
				path,
				data: String(content == null ? '' : content),
				encoding: 'utf8',
				mimeType: 'text/plain'
			});
			return {method: 'handle'};
		}
	};
};

module.exports = {
	create
};
