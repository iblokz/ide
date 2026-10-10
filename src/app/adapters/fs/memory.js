'use strict';

/**
 * Last-resort stub when no window / native FS is available (e.g. non-browser eval).
 * Not used for a product demo project.
 */

const create = () => ({
	id: 'memory',
	canOpenFolder: false,
	canWrite: false,
	async openFolder() {
		return null;
	},
	async readFile() {
		throw new Error('No filesystem backend available');
	},
	async writeFile() {
		throw new Error('No filesystem backend available');
	}
});

module.exports = {
	create
};
