'use strict';

const memory = require('./memory');
const web = require('./web');
const electron = require('./electron');

const detect = () => {
	const electronFs = electron.create();
	if (electronFs.canOpenFolder) return electronFs;

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
	const fs = resetFs();
	return {
		fsBackend: fs.id,
		canOpenFolder: !!fs.canOpenFolder,
		canWrite: !!fs.canWrite
	};
};

module.exports = {
	getFs,
	resetFs,
	detect,
	probeCapabilities,
	DEMO_TREE: memory.DEMO_TREE
};
