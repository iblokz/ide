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

const buildNode = async (entry, depth) => {
	const id = hashPath(entry.path);
	if (entry.isDir) {
		const files = depth > 0
			? await mapAsync(await listEntries(entry.path), child => buildNode(child, depth - 1))
			: [];
		return {
			id,
			name: entry.name,
			path: entry.path,
			isDir: true,
			ext: false,
			expanded: depth >= 2,
			files
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

const openRoot = async (rootPath, depth = 3) => {
	if (!rootPath) return null;
	const name = path.basename(rootPath);
	const root = await buildNode({name, path: rootPath, isDir: true}, depth);
	root.expanded = true;
	return {
		id: root.id,
		name: root.name,
		path: root.path,
		filesTree: [root],
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
	read,
	readDataUrl,
	write,
	listEntries,
	buildNode
};
