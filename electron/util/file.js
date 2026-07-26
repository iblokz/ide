'use strict';

const fsp = require('node:fs').promises;
const path = require('node:path');
const {
	hashPath,
	extOf,
	SKIP_NAMES,
	fileKind,
	mimeOf
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

const readDataUrl = async filePath => {
	const buf = await fsp.readFile(filePath);
	const mime = mimeOf(path.basename(filePath));
	return `data:${mime};base64,${buf.toString('base64')}`;
};

const write = async (filePath, content, enc = 'utf-8') => {
	await fsp.mkdir(path.dirname(filePath), {recursive: true});
	await fsp.writeFile(filePath, content, enc);
};

module.exports = {
	openRoot,
	listDir,
	read,
	readDataUrl,
	write,
	listEntries,
	buildNodeShallow
};
