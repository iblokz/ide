'use strict';

const {getFs} = require('../services/fs');
const {isStartView} = require('./project');

const isDemoFile = file =>
	!file
	|| file.id === 'untitled'
	|| file.id === 'demo'
	|| String(file.id || '').startsWith('demo-');

const hasWritableHandle = file => {
	if (!file || !file.id) return false;
	try {
		const fs = getFs();
		const handle = fs.getHandle && fs.getHandle(file.id);
		return !!(handle && handle.kind === 'file');
	} catch (err) {
		return false;
	}
};

const canUseSavePicker = () =>
	typeof window !== 'undefined'
	&& typeof window.showSaveFilePicker === 'function';

const canSave = state => {
	if (!state || isStartView(state) || !state.dirty || !state.file || isDemoFile(state.file)) {
		return false;
	}
	if (state.type === 'image') return false;
	if (state.project && state.project.id === 'demo') return false;
	return true;
};

const saveHint = state => {
	if (!state || isStartView(state)) return 'Open a project to save';
	if (!state.dirty) return 'No changes';
	if (!state.file || isDemoFile(state.file) || (state.project && state.project.id === 'demo')) {
		return 'Open a project file before saving';
	}
	if (state.canWrite || hasWritableHandle(state.file)) {
		return 'Save (Ctrl+S)';
	}
	try {
		const fs = getFs();
		if (fs.id === 'electron' && state.file && state.file.path) {
			return 'Save (Ctrl+S)';
		}
	} catch (err) {
		/* ignore */
	}
	if (canUseSavePicker()) {
		return 'Save via file picker (Ctrl+S)';
	}
	return 'Download file (Ctrl+S) — enable File System Access for in-place save';
};

module.exports = {
	isDemoFile,
	hasWritableHandle,
	canUseSavePicker,
	canSave,
	saveHint
};
