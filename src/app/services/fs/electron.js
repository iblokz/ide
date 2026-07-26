'use strict';

/**
 * Electron FS backend — used when preload exposes window.app.
 */

const create = () => {
	const bridge = typeof window !== 'undefined' ? window.app : null;
	const canOpen = !!(bridge && typeof bridge.selectRootFolder === 'function');

	return {
		id: 'electron',
		canOpenFolder: canOpen,
		canWrite: !!(bridge && typeof bridge.writeFile === 'function'),
		async openFolder() {
			if (!canOpen) return null;
			const result = await bridge.selectRootFolder();
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
			if (!bridge || typeof bridge.listDir !== 'function') {
				throw new Error('Electron listDir not available');
			}
			return bridge.listDir(node.path);
		},
		async readFile(node) {
			if (!bridge || typeof bridge.readFile !== 'function') {
				throw new Error('Electron readFile not available');
			}
			return bridge.readFile(node.path);
		},
		async getObjectUrl(node) {
			if (!bridge || typeof bridge.readFileDataUrl !== 'function') {
				throw new Error('Electron readFileDataUrl not available');
			}
			return bridge.readFileDataUrl(node.path);
		},
		async writeFile(node, content) {
			if (!bridge || typeof bridge.writeFile !== 'function') {
				throw new Error('Electron writeFile not available');
			}
			await bridge.writeFile(node.path, content);
			return {method: 'handle'};
		}
	};
};

module.exports = {
	create
};
