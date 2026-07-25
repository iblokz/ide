'use strict';

const {getFs} = require('../services/fs');
const {canSave, canUseSavePicker, hasWritableHandle} = require('./save');

/**
 * Run save from a user gesture (click / Ctrl+S).
 * Opens showSaveFilePicker BEFORE any other await when no write handle exists,
 * so the browser keeps transient user activation.
 * When FSA is missing (e.g. Brave default), downloads synchronously in-gesture.
 */
const triggerSave = async ({state, actions}) => {
	if (!canSave(state)) {
		console.warn('Save skipped', {
			canWrite: state.canWrite,
			dirty: state.dirty,
			fileId: state.file && state.file.id,
			projectId: state.project && state.project.id,
			hasHandle: !!(state.file && hasWritableHandle(state.file)),
			hasSavePicker: canUseSavePicker()
		});
		return;
	}

	const fs = getFs();
	const file = state.file;
	const source = state.source;
	let pickedHandle = null;

	const existing = fs.getHandle && fs.getHandle(file.id);
	const hasFileHandle = !!(existing && existing.kind === 'file');

	if (!hasFileHandle && canUseSavePicker()) {
		try {
			// First await must be the picker itself (user gesture).
			pickedHandle = await window.showSaveFilePicker({
				suggestedName: file.name || 'untitled.txt'
			});
			if (fs.rememberHandle) fs.rememberHandle(file.id, pickedHandle);
		} catch (err) {
			if (err && err.name === 'AbortError') return;
			console.warn('[fs] showSaveFilePicker failed; will download', err);
		}
	}

	// No FSA handle/picker: download now, still inside the user gesture.
	if (!hasFileHandle && !pickedHandle && typeof fs.downloadText === 'function') {
		console.info('[fs] saving via download (no writable handle / save picker)');
		fs.downloadText(file.name || 'untitled.txt', source);
		actions.saveFile(file, source, {__downloadDone: true});
		return;
	}

	actions.saveFile(file, source, pickedHandle);
};

module.exports = {
	triggerSave
};
