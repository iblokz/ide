'use strict';

const memory = require('./memory');
const web = require('./web');
const electron = require('./electron');
const capacitor = require('./capacitor');

const detect = () => {
	const electronFs = electron.create();
	if (electronFs.canOpenFolder) return electronFs;

	const capFs = capacitor.create();
	if (capFs.canOpenFolder) return capFs;

	if (typeof window !== 'undefined') return web.create();

	return memory.create();
};

let backend = null;

const getFs = () => {
	if (!backend) backend = detect();
	return backend;
};

const resetFs = () => {
	backend = detect();
	return backend;
};

const probeCapabilities = () => {
	const fs = getFs();
	if (typeof fs.logCapabilities === 'function') {
		fs.logCapabilities();
	}
	return {
		fsBackend: fs.id,
		canOpenFolder: !!fs.canOpenFolder
		// canWrite is project-scoped (set by openFolder), not a backend capability
	};
};

module.exports = {
	getFs,
	resetFs,
	detect,
	probeCapabilities,
	DEMO_TREE: memory.DEMO_TREE
};
