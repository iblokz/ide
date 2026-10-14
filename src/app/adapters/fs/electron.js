'use strict';

/**
 * Electron FS backend — used when preload exposes window.app.
 */

const getBridge = () => (typeof window !== 'undefined' ? window.app : null);

const create = () => ({
	id: 'electron',
	// Live check — do not freeze at first module eval (preload timing / HMR).
	get canOpenFolder() {
		const bridge = getBridge();
		return !!(bridge && typeof bridge.selectRootFolder === 'function');
	},
	get canWrite() {
		const bridge = getBridge();
		return !!(bridge && typeof bridge.writeFile === 'function');
	},
	async openFolder() {
		const bridge = getBridge();
		if (!bridge || typeof bridge.selectRootFolder !== 'function') {
			console.error('[fs/electron] selectRootFolder missing');
			return null;
		}
		console.info('[fs/electron] selectRootFolder…');
		let result;
		try {
			result = await bridge.selectRootFolder();
		} catch (err) {
			console.error('[fs/electron] selectRootFolder failed', err);
			throw err;
		}
		if (!result) {
			console.info('[fs/electron] canceled or empty');
			return null;
		}
		console.info('[fs/electron] opened', result.path || result.name);
		if (result.filesTree) {
			return Object.assign({
				writable: result.writable !== false,
				access: result.access || 'electron'
			}, result);
		}
		return {
			id: result.path || result.name,
			name: result.name,
			path: result.path || result.name,
			filesTree: result.tree || result.files || [],
			writable: true,
			access: 'electron'
		};
	},
	async openFolderByPath(dirPath) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.openRootFolder !== 'function') {
			return null;
		}
		const result = await bridge.openRootFolder(dirPath);
		if (!result) return null;
		if (result.filesTree) {
			return Object.assign({
				writable: result.writable !== false,
				access: result.access || 'electron'
			}, result);
		}
		return {
			id: result.path || result.name,
			name: result.name,
			path: result.path || result.name,
			filesTree: result.tree || result.files || [],
			writable: true,
			access: 'electron'
		};
	},
	async listDir(node) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.listDir !== 'function') {
			throw new Error('Electron listDir not available');
		}
		return bridge.listDir(node.path);
	},
	async readFile(node) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.readFile !== 'function') {
			throw new Error('Electron readFile not available');
		}
		return bridge.readFile(node.path);
	},
	async readFileSample(node, maxBytes) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.readFileSample !== 'function') {
			throw new Error('Electron readFileSample not available');
		}
		return bridge.readFileSample(node.path, maxBytes);
	},
	async getObjectUrl(node) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.readFileDataUrl !== 'function') {
			throw new Error('Electron readFileDataUrl not available');
		}
		return bridge.readFileDataUrl(node.path);
	},
	async writeFile(node, content) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.writeFile !== 'function') {
			throw new Error('Electron writeFile not available');
		}
		await bridge.writeFile(node.path, content);
		return {method: 'handle'};
	},
	async createFile(parentNode, name) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.createFile !== 'function') {
			throw new Error('Electron createFile not available');
		}
		const full = await bridge.createFile(parentNode.path, name, '');
		const base = String(name || '').split(/[/\\]/).pop();
		return {
			path: full,
			name: base,
			isDir: false,
			method: 'handle'
		};
	},
	async mkdir(parentNode, name) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.mkdir !== 'function') {
			throw new Error('Electron mkdir not available');
		}
		const full = await bridge.mkdir(parentNode.path, name);
		const base = String(name || '').split(/[/\\]/).pop();
		return {
			path: full,
			name: base,
			isDir: true,
			method: 'handle'
		};
	},
	async rename(node, newName) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.renamePath !== 'function') {
			throw new Error('Electron rename not available');
		}
		const full = await bridge.renamePath(node.path, newName);
		return {
			path: full,
			name: String(newName || '').trim(),
			isDir: !!node.isDir,
			oldPath: node.path,
			method: 'handle'
		};
	},
	async remove(node) {
		const bridge = getBridge();
		if (!bridge || typeof bridge.removePath !== 'function') {
			throw new Error('Electron remove not available');
		}
		await bridge.removePath(node.path, {recursive: !!node.isDir});
		return {
			path: node.path,
			isDir: !!node.isDir,
			method: 'handle'
		};
	}
});

module.exports = {
	create
};
