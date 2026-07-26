'use strict';

const {hashPath, extOf, SKIP_NAMES, fileKind} = require('../../util/file-tree');

const getSession = () => {
	if (typeof window === 'undefined') {
		return {handles: new Map(), fileBlobs: new Map()};
	}
	if (!window.__iblokzFsSession) {
		window.__iblokzFsSession = {
			handles: new Map(),
			fileBlobs: new Map()
		};
	}
	return window.__iblokzFsSession;
};

const remember = (id, handle) => {
	getSession().handles.set(id, handle);
	return id;
};

const rememberBlob = (id, file) => {
	getSession().fileBlobs.set(id, file);
	return id;
};

const getHandle = id => getSession().handles.get(id);
const getBlob = id => getSession().fileBlobs.get(id);

const hasDirectoryPicker = () =>
	typeof window !== 'undefined'
	&& typeof window.showDirectoryPicker === 'function';

const hasSavePicker = () =>
	typeof window !== 'undefined'
	&& typeof window.showSaveFilePicker === 'function';

const isBrave = () => {
	if (typeof navigator === 'undefined') return false;
	return !!(navigator.brave)
		|| /Brave/i.test(navigator.userAgent || '');
};

const fsaMissingHint = () => {
	if (isBrave()) {
		return 'Brave disables File System Access by default — enable brave://flags/#file-system-access-api and relaunch for native folder/save pickers.';
	}
	return 'This browser has no showDirectoryPicker/showSaveFilePicker (use Chrome/Edge, or enable FSA if available).';
};

/** Synchronous download — must run inside a user gesture when FSA is unavailable. */
const downloadText = (filename, content) => {
	const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename || 'untitled.txt';
	a.rel = 'noopener';
	const mount = document.body
		|| document.querySelector('#ui')
		|| document.documentElement;
	mount.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const buildNode = async (handle, parentPath = '', depth = 3) => {
	const path = parentPath ? `${parentPath}/${handle.name}` : handle.name;
	const id = hashPath(path);
	remember(id, handle);

	if (handle.kind === 'directory') {
		const files = [];
		if (depth > 0) {
			for await (const entry of handle.values()) {
				if (SKIP_NAMES.has(entry.name)) continue;
				files.push(await buildNode(entry, path, depth - 1));
			}
		}
		return {
			id,
			name: handle.name,
			path,
			isDir: true,
			ext: false,
			expanded: depth >= 2,
			files
		};
	}

	const ext = extOf(handle.name);
	const kind = fileKind(handle.name, ext);
	return {
		id,
		name: handle.name,
		path,
		isDir: false,
		ext,
		kind,
		readable: kind !== 'binary'
	};
};

const buildTreeFromFileList = (fileList) => {
	const rootName = (fileList[0] && fileList[0].webkitRelativePath.split('/')[0]) || 'Project';
	const rootId = hashPath(rootName);
	const root = {
		id: rootId,
		name: rootName,
		path: rootName,
		isDir: true,
		ext: false,
		expanded: true,
		files: []
	};

	const dirMap = new Map([[rootName, root]]);

	const ensureDir = (dirPath) => {
		if (dirMap.has(dirPath)) return dirMap.get(dirPath);
		const parts = dirPath.split('/');
		const name = parts[parts.length - 1];
		const parentPath = parts.slice(0, -1).join('/');
		const parent = ensureDir(parentPath || rootName);
		const id = hashPath(dirPath);
		const node = {
			id,
			name,
			path: dirPath,
			isDir: true,
			ext: false,
			expanded: parts.length < 3,
			files: []
		};
		parent.files.push(node);
		dirMap.set(dirPath, node);
		return node;
	};

	Array.from(fileList).forEach(file => {
		const rel = file.webkitRelativePath || file.name;
		const parts = rel.split('/');
		if (parts.some(part => SKIP_NAMES.has(part))) return;

		const fileName = parts[parts.length - 1];
		const dirPath = parts.slice(0, -1).join('/') || rootName;
		const parent = ensureDir(dirPath);
		const path = rel;
		const id = hashPath(path);
		const ext = extOf(fileName);
		rememberBlob(id, file);
		const kind = fileKind(fileName, ext);
		parent.files.push({
			id,
			name: fileName,
			path,
			isDir: false,
			ext,
			kind,
			readable: kind !== 'binary'
		});
	});

	return {
		id: rootId,
		name: rootName,
		path: rootName,
		filesTree: [root],
		writable: false,
		access: 'input'
	};
};

const pickWithInput = () => new Promise(resolve => {
	const input = document.createElement('input');
	input.type = 'file';
	input.setAttribute('webkitdirectory', '');
	input.setAttribute('directory', '');
	input.multiple = true;
	input.style.display = 'none';

	const mount = document.body
		|| document.querySelector('#ui')
		|| document.documentElement;
	if (!mount) {
		resolve(null);
		return;
	}
	mount.appendChild(input);

	const cleanup = () => {
		input.remove();
	};

	input.addEventListener('change', () => {
		const files = input.files;
		cleanup();
		if (!files || !files.length) {
			resolve(null);
			return;
		}
		resolve(buildTreeFromFileList(files));
	}, {once: true});

	input.addEventListener('cancel', () => {
		cleanup();
		resolve(null);
	}, {once: true});

	input.click();
});

const writeToHandle = async (handle, content) => {
	const writable = await handle.createWritable();
	await writable.write(content);
	await writable.close();
};

const pickWithFsa = async () => {
	if (!hasDirectoryPicker()) return null;

	const openPicker = async (options) => {
		try {
			const handle = await window.showDirectoryPicker(options || {});
			return {handle};
		} catch (err) {
			if (err && err.name === 'AbortError') return {aborted: true};
			return {error: err};
		}
	};

	// Prefer read+write. If mode is rejected, retry with default options (still FSA UI).
	let picked = await openPicker({mode: 'readwrite'});
	let writable = true;

	if (picked.aborted) return {aborted: true};

	if (!picked.handle) {
		console.warn('[fs] showDirectoryPicker({mode:"readwrite"}) failed', picked.error);
		picked = await openPicker({});
		writable = false;
		if (picked.aborted) return {aborted: true};
		if (!picked.handle) {
			console.warn('[fs] showDirectoryPicker() failed', picked.error);
			return null;
		}
		// Ask for write access on the chosen directory when possible
		if (typeof picked.handle.requestPermission === 'function') {
			try {
				const perm = await picked.handle.requestPermission({mode: 'readwrite'});
				writable = perm === 'granted';
			} catch (err) {
				writable = false;
			}
		}
	}

	const rootHandle = picked.handle;
	const rootId = hashPath(rootHandle.name);
	remember(rootId, rootHandle);
	const files = [];
	for await (const entry of rootHandle.values()) {
		if (SKIP_NAMES.has(entry.name)) continue;
		files.push(await buildNode(entry, rootHandle.name, 3));
	}

	return {
		id: rootId,
		name: rootHandle.name,
		path: rootHandle.name,
		filesTree: [{
			id: rootId,
			name: rootHandle.name,
			path: rootHandle.name,
			isDir: true,
			ext: false,
			expanded: true,
			files
		}],
		writable,
		access: writable ? 'fsa-rw' : 'fsa-ro'
	};
};

const create = () => ({
	id: 'web',
	canOpenFolder: true,
	// Capability probe — project writability is set after openFolder
	get canWrite() {
		return hasDirectoryPicker() || hasSavePicker();
	},
	hasDirectoryPicker,
	hasSavePicker,
	getHandle,
	rememberHandle: remember,
	downloadText,
	logCapabilities() {
		if (typeof window !== 'undefined' && window.__iblokzFsCapsLogged) return;
		if (typeof window !== 'undefined') window.__iblokzFsCapsLogged = true;
		console.info('[fs] capabilities', {
			showDirectoryPicker: hasDirectoryPicker(),
			showSaveFilePicker: hasSavePicker(),
			secureContext: typeof window !== 'undefined' && window.isSecureContext,
			brave: isBrave()
		});
		if (!hasDirectoryPicker() || !hasSavePicker()) {
			console.warn('[fs]', fsaMissingHint());
		}
	},
	async openFolder() {
		if (typeof window === 'undefined') return null;

		if (hasDirectoryPicker()) {
			console.info('[fs] opening via showDirectoryPicker');
			const fsaResult = await pickWithFsa();
			if (fsaResult && fsaResult.aborted) return null;
			if (fsaResult) return fsaResult;
			console.warn('[fs] directory picker unavailable/failed; using read-only input');
		} else {
			console.warn(
				'[fs] showDirectoryPicker missing — using <input webkitdirectory> (read-only).',
				fsaMissingHint()
			);
		}

		return pickWithInput();
	},
	async readFile(node) {
		const handle = getHandle(node.id);
		if (handle && handle.kind === 'file') {
			const file = await handle.getFile();
			return file.text();
		}
		const blob = getBlob(node.id);
		if (blob) return blob.text();
		throw new Error(`No file handle for ${node.path || node.name} (${node.id})`);
	},
	async getObjectUrl(node) {
		const handle = getHandle(node.id);
		let file = null;
		if (handle && handle.kind === 'file') {
			file = await handle.getFile();
		} else {
			file = getBlob(node.id);
		}
		if (!file) {
			throw new Error(`No file blob for ${node.path || node.name} (${node.id})`);
		}
		const url = URL.createObjectURL(file);
		const session = getSession();
		if (!session.objectUrls) session.objectUrls = new Set();
		session.objectUrls.add(url);
		return url;
	},
	revokeObjectUrl(url) {
		if (!url || String(url).indexOf('blob:') !== 0) return;
		try {
			URL.revokeObjectURL(url);
		} catch (err) {
			/* ignore */
		}
		const session = getSession();
		if (session.objectUrls) session.objectUrls.delete(url);
	},
	/**
	 * Write file contents. Prefer an existing FSA handle.
	 * Optional `pickedHandle` must be obtained in the same user gesture
	 * (see util/trigger-save.js) — do not await before opening the picker.
	 */
	async writeFile(node, content, pickedHandle) {
		// Already downloaded in the user gesture (trigger-save)
		if (pickedHandle && pickedHandle.__downloadDone) {
			return {method: 'download'};
		}

		const handle = (pickedHandle && pickedHandle.kind === 'file')
			? pickedHandle
			: getHandle(node.id);

		if (handle && handle.kind === 'file') {
			try {
				await writeToHandle(handle, content);
				remember(node.id, handle);
				return {method: 'handle'};
			} catch (err) {
				if (typeof handle.requestPermission === 'function') {
					const perm = await handle.requestPermission({mode: 'readwrite'});
					if (perm === 'granted') {
						await writeToHandle(handle, content);
						remember(node.id, handle);
						return {method: 'handle'};
					}
				}
				console.warn('[fs] handle write failed', err);
			}
		}

		// Last resort: download (always available)
		downloadText((node && node.name) || 'untitled.txt', content);
		return {method: 'download'};
	}
});

module.exports = {
	create,
	hasDirectoryPicker,
	hasSavePicker,
	downloadText,
	fsaMissingHint
};
