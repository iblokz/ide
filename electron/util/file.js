'use strict';

const fsp = require('fs').promises;
const path = require('path');
const {
	hashPath,
	extOf,
	SKIP_NAMES,
	fileKind,
	mimeOf,
	BINARY_SAMPLE_BYTES
} = require('../../src/app/util/file-tree');

const mapAsync = (list, fn) => Promise.all(list.map(fn));

const listEntries = async dirPath => {
	const names = await fsp.readdir(dirPath);
	const entries = await mapAsync(names, async name => {
		if (SKIP_NAMES.has(name)) return null;
		const full = path.join(dirPath, name);
		const stats = await fsp.stat(full);
		return {
			name,
			path: full,
			isDir: stats.isDirectory()
		};
	});
	return entries.filter(Boolean);
};

/** One level only — directories are stubs until expand loads them. */
const buildNodeShallow = entry => {
	const id = hashPath(entry.path);
	if (entry.isDir) {
		return {
			id,
			name: entry.name,
			path: entry.path,
			isDir: true,
			ext: false,
			expanded: false,
			childrenLoaded: false,
			files: []
		};
	}
	const ext = extOf(entry.name);
	const kind = fileKind(entry.name, ext);
	return {
		id,
		name: entry.name,
		path: entry.path,
		isDir: false,
		ext,
		kind,
		readable: kind !== 'binary'
	};
};

const listDir = async dirPath => {
	const entries = await listEntries(dirPath);
	return entries.map(buildNodeShallow);
};

const openRoot = async rootPath => {
	if (!rootPath) return null;
	const name = path.basename(rootPath);
	const id = hashPath(rootPath);
	const files = await listDir(rootPath);
	return {
		id,
		name,
		path: rootPath,
		filesTree: [{
			id,
			name,
			path: rootPath,
			isDir: true,
			ext: false,
			expanded: true,
			childrenLoaded: true,
			files
		}],
		writable: true,
		access: 'electron'
	};
};

const read = (filePath, enc = 'utf-8') => fsp.readFile(filePath, enc);

/** First N raw bytes for text/binary sniff (does not load the whole file). */
const readSample = async (filePath, maxBytes = BINARY_SAMPLE_BYTES) => {
	const fh = await fsp.open(filePath, 'r');
	try {
		const {size} = await fh.stat();
		const n = Math.min(Math.max(0, maxBytes | 0) || BINARY_SAMPLE_BYTES, size);
		if (n === 0) return Buffer.alloc(0);
		const buf = Buffer.alloc(n);
		const {bytesRead} = await fh.read(buf, 0, n, 0);
		return bytesRead === n ? buf : buf.subarray(0, bytesRead);
	} finally {
		await fh.close();
	}
};

const readDataUrl = async filePath => {
	const buf = await fsp.readFile(filePath);
	const mime = mimeOf(path.basename(filePath));
	return `data:${mime};base64,${buf.toString('base64')}`;
};

const write = async (filePath, content, enc = 'utf-8') => {
	await fsp.mkdir(path.dirname(filePath), {recursive: true});
	await fsp.writeFile(filePath, content, enc);
};

const assertSafeName = name => {
	const n = String(name || '').trim();
	if (!n || n === '.' || n === '..' || /[/\\]/.test(n)) {
		throw new Error('Invalid name');
	}
	return n;
};

const mkdir = async (dirPath, name) => {
	const safe = assertSafeName(name);
	const full = path.join(dirPath, safe);
	await fsp.mkdir(full, {recursive: false});
	return full;
};

const createFile = async (dirPath, name, content = '') => {
	const safe = assertSafeName(name);
	const full = path.join(dirPath, safe);
	await fsp.mkdir(path.dirname(full), {recursive: true});
	await fsp.writeFile(full, content, 'utf-8');
	return full;
};

const rename = async (oldPath, newName) => {
	const safe = assertSafeName(newName);
	const next = path.join(path.dirname(oldPath), safe);
	await fsp.rename(oldPath, next);
	return next;
};

const remove = async (targetPath, {recursive = true} = {}) => {
	await fsp.rm(targetPath, {recursive: !!recursive, force: false});
};

module.exports = {
	openRoot,
	listDir,
	read,
	readSample,
	readDataUrl,
	write,
	mkdir,
	createFile,
	rename,
	remove,
	listEntries,
	buildNodeShallow
};
