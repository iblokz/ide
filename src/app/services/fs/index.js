'use strict';

const memory = require('./memory');
const web = require('./web');
const electron = require('./electron');
const capacitor = require('./capacitor');

/**
 * Keep one instance per backend so Cap scoped-folder session state survives
 * re-detection. Prefer Electron → Capacitor (native) → web → memory, and
 * re-check Cap on every getFs(): the bridge may not be ready at first module eval.
 */
const backends = {
	electron: null,
	capacitor: null,
	web: null,
	memory: null
};

const detect = () => {
	if (!backends.electron) backends.electron = electron.create();
	if (backends.electron.canOpenFolder) return backends.electron;

	if (!backends.capacitor) backends.capacitor = capacitor.create();
	if (backends.capacitor.canOpenFolder) return backends.capacitor;

	if (typeof window !== 'undefined') {
		if (!backends.web) backends.web = web.create();
		return backends.web;
	}

	if (!backends.memory) backends.memory = memory.create();
	return backends.memory;
};

const getFs = () => detect();

const resetFs = () => {
	backends.electron = null;
	backends.web = null;
	backends.memory = null;
	// Keep capacitor instance (active folder session); canOpenFolder is live.
	return detect();
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
