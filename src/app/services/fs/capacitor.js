'use strict';

/**
 * Capacitor FS backend — app Documents workspace (scoped storage).
 * Open/create Documents/iblokz-ide and read/write relative to it.
 */

const {hashPath, extOf, SKIP_NAMES, fileKind} = require('../../util/file-tree');

const WORKSPACE = 'iblokz-ide';

const loadCap = () => {
	try {
		const core = require('@capacitor/core');
		const fsMod = require('@capacitor/filesystem');
		return {
			Capacitor: core.Capacitor,
			Filesystem: fsMod.Filesystem,
			Directory: fsMod.Directory,
			Encoding: fsMod.Encoding
		};
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
	id: hashPath(dirPath),
	name,
	path: dirPath,
	isDir: true,
	ext: false,
	expanded: false,
	childrenLoaded: false,
	files: []
});

const create = () => {
	const cap = loadCap();
	const native = !!(cap && cap.Capacitor && cap.Capacitor.isNativePlatform());
	const {Filesystem, Directory, Encoding} = cap || {};
	const directory = Directory && Directory.Documents;

	const ensureDir = async (relPath) => {
		try {
			await Filesystem.mkdir({
				path: relPath,
				directory,
				recursive: true
			});
		} catch (err) {
			// Exists is fine
			const msg = String((err && err.message) || err || '');
			if (!/exist/i.test(msg)) throw err;
		}
	};

	const listChildren = async (relPath) => {
		const result = await Filesystem.readdir({
			path: relPath || '',
			directory
		});
		const entries = (result && result.files) || [];
		const files = [];
		for (const entry of entries) {
			const name = entry.name;
			if (!name || SKIP_NAMES.has(name)) continue;
			const childPath = joinPath(relPath, name);
			const isDir = entry.type === 'directory'
				|| entry.type === 'Directory'
				|| (typeof entry.type === 'string' && entry.type.toLowerCase() === 'directory');
			if (isDir) {
				files.push(toDirStub(name, childPath));
			} else {
				files.push(toFileNode(name, childPath));
			}
		}
		return files;
	};

	return {
		id: 'capacitor',
		canOpenFolder: native,
		canWrite: native,
		logCapabilities() {
			if (typeof window !== 'undefined' && window.__iblokzFsCapsLogged) return;
			if (typeof window !== 'undefined') window.__iblokzFsCapsLogged = true;
			console.info('[fs] capabilities', {
				backend: 'capacitor',
				platform: cap && cap.Capacitor ? cap.Capacitor.getPlatform() : null,
				workspace: WORKSPACE,
				directory: 'Documents'
			});
		},
		async openFolder() {
			if (!native) return null;
			await ensureDir(WORKSPACE);
			let children = await listChildren(WORKSPACE);
			if (!children.length) {
				const welcomePath = joinPath(WORKSPACE, 'welcome.js');
				await Filesystem.writeFile({
					path: welcomePath,
					directory,
					data: [
						'// iBloKz IDE — Documents/' + WORKSPACE,
						'// Scoped mobile workspace (Capacitor Filesystem).',
						'',
						'console.log(\'hello from Android\');',
						''
					].join('\n'),
					encoding: Encoding.UTF8,
					recursive: true
				});
				children = await listChildren(WORKSPACE);
			}
			const rootId = hashPath(WORKSPACE);
			return {
				id: rootId,
				name: WORKSPACE,
				path: WORKSPACE,
				filesTree: [{
					id: rootId,
					name: WORKSPACE,
					path: WORKSPACE,
					isDir: true,
					ext: false,
					expanded: true,
					childrenLoaded: true,
					files: children
				}],
				writable: true,
				access: 'capacitor-documents'
			};
		},
		async listDir(node) {
			if (!native) throw new Error('Capacitor listDir not available');
			return listChildren(node.path || WORKSPACE);
		},
		async readFile(node) {
			if (!native) throw new Error('Capacitor readFile not available');
			const result = await Filesystem.readFile({
				path: node.path,
				directory,
				encoding: Encoding.UTF8
			});
			return result.data;
		},
		async getObjectUrl(node) {
			if (!native) throw new Error('Capacitor getObjectUrl not available');
			const result = await Filesystem.readFile({
				path: node.path,
				directory
			});
			const data = result.data;
			if (typeof data === 'string' && data.indexOf('data:') === 0) return data;
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
			return `data:${mime};base64,${data}`;
		},
		async writeFile(node, content) {
			if (!native) throw new Error('Capacitor writeFile not available');
			const dir = parentPath(node.path);
			if (dir) await ensureDir(dir);
			await Filesystem.writeFile({
				path: node.path,
				directory,
				data: String(content == null ? '' : content),
				encoding: Encoding.UTF8,
				recursive: true
			});
			return {method: 'handle'};
		}
	};
};

module.exports = {
	create,
	WORKSPACE
};
