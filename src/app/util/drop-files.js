'use strict';

const {
	extOf,
	fileKind,
	hashPath,
	isImageFile,
	looksBinary,
	BINARY_SAMPLE_BYTES
} = require('./file-tree');
const {isElectronBridge} = require('./platform');

const nodeFromPath = filePath => {
	const name = filePath.split(/[/\\]/).pop() || filePath;
	const ext = extOf(name);
	const kind = fileKind(name, ext);
	return {
		id: hashPath(filePath),
		name,
		path: filePath,
		isDir: false,
		ext,
		kind,
		readable: kind !== 'binary'
	};
};

const readBrowserFile = file => {
	const name = file.name;
	const ext = extOf(name);
	const kind = fileKind(name, ext);
	if (kind === 'binary') return Promise.resolve(null);
	if (kind === 'image' || isImageFile(name, ext)) {
		const url = URL.createObjectURL(file);
		return Promise.resolve({
			id: hashPath(name + ':' + file.size),
			name,
			path: name,
			isDir: false,
			ext,
			kind: 'image',
			url,
			readable: true
		});
	}
	return file.slice(0, BINARY_SAMPLE_BYTES).arrayBuffer()
		.then(buf => {
			if (looksBinary(buf)) return null;
			return file.text().then(source => {
				if (looksBinary(source)) return null;
				return {
					id: hashPath(name + ':' + file.size),
					name,
					path: name,
					isDir: false,
					ext,
					kind: 'text',
					source,
					readable: true
				};
			});
		});
};

/**
 * Open dropped FileList / File[] via Electron paths or browser FileReader.
 * @returns {Promise<Array>} list of openable file nodes (may be empty)
 */
const filesFromDrop = dataTransfer => {
	const list = dataTransfer && dataTransfer.files
		? Array.from(dataTransfer.files)
		: [];
	if (!list.length) return Promise.resolve([]);

	if (isElectronBridge()) {
		return Promise.all(list.map(file => {
			const filePath = file.path;
			if (!filePath) return readBrowserFile(file);
			return Promise.resolve(nodeFromPath(filePath));
		})).then(nodes => nodes.filter(Boolean));
	}

	return Promise.all(list.map(readBrowserFile)).then(nodes => nodes.filter(Boolean));
};

module.exports = {
	filesFromDrop,
	isElectronBridge
};
