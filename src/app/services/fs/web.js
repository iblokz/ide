'use strict';

const {hashPath, extOf, SKIP_NAMES, isTextFile} = require('../../util/file-tree');

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
	return {
		id,
		name: handle.name,
		path,
		isDir: false,
		ext,
		readable: isTextFile(handle.name, ext)
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
		parent.files.push({
			id,
			name: fileName,
			path,
			isDir: false,
			ext,
			readable: isTextFile(fileName, ext)
		});
	});

	return {
		id: rootId,
		name: rootName,
		path: rootName,
		filesTree: [root],
		writable: false
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

const pickWithFsa = async () => {
	if (typeof window.showDirectoryPicker !== 'function') return null;

	const pick = async mode => {
		try {
			return {handle: await window.showDirectoryPicker({mode})};
		} catch (err) {
			if (err && err.name === 'AbortError') return {aborted: true};
			return {error: err};
		}
	};

	let picked = await pick('readwrite');
	if (picked.aborted) return {aborted: true};
	if (!picked.handle) {
		picked = await pick('read');
		if (picked.aborted) return {aborted: true};
		if (!picked.handle) return null;
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
		writable: true
	};
};

const create = () => {
	const canFsa = typeof window !== 'undefined'
		&& typeof window.showDirectoryPicker === 'function';

	return {
		id: 'web',
		// input fallback means we can always open a folder in modern browsers
		canOpenFolder: true,
		canWrite: canFsa,
		async openFolder() {
			if (typeof window === 'undefined') return null;

			if (canFsa) {
				const fsaResult = await pickWithFsa();
				if (fsaResult && fsaResult.aborted) return null;
				if (fsaResult) return fsaResult;
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
		async writeFile(node, content) {
			const handle = getHandle(node.id);
			if (!handle || handle.kind !== 'file') {
				throw new Error(`No writable file handle for ${node.path || node.name}`);
			}
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
		},
		getHandle
	};
};

module.exports = {
	create
};
