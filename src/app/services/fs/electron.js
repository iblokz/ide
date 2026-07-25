'use strict';

/**
 * Electron bridge stub (Stage 4 fills window.app IPC).
 * Preferred when preload exposes selectRootFolder / readFile / writeFile.
 */

const create = () => {
	const app = typeof window !== 'undefined' ? window.app : null;
	const canOpen = !!(app && typeof app.selectRootFolder === 'function');

	return {
		id: 'electron',
		canOpenFolder: canOpen,
		canWrite: !!(app && typeof app.writeFile === 'function'),
		async openFolder() {
			if (!canOpen) return null;
			const result = await app.selectRootFolder();
			if (!result) return null;
			// Stage 4 shapes this; accept { name, path, filesTree } or tree array
			if (result.filesTree) return result;
			return {
				id: result.path || result.name,
				name: result.name,
				path: result.path || result.name,
				filesTree: result.tree || result.files || []
			};
		},
		async readFile(node) {
			if (!app || typeof app.readFile !== 'function') {
				throw new Error('Electron readFile not available');
			}
			return app.readFile(node.path);
		},
		async writeFile(node, content) {
			if (!app || typeof app.writeFile !== 'function') {
				throw new Error('Electron writeFile not available');
			}
			return app.writeFile(node.path, content);
		}
	};
};

module.exports = {
	create
};
