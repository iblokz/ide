'use strict';

const {SKIP_NAMES} = require('./file-tree');

const MAX_RESULTS = 40;

/** Collect readable files from the in-memory tree (loaded nodes only). */
const flattenFiles = (nodes = [], out = []) => {
	(nodes || []).forEach(node => {
		if (!node || !node.name) return;
		if (SKIP_NAMES && SKIP_NAMES.has(node.name)) return;
		if (node.isDir) {
			if (Array.isArray(node.files) && node.files.length) {
				flattenFiles(node.files, out);
			}
			return;
		}
		if (node.readable === false) return;
		out.push(node);
	});
	return out;
};

const relPath = (filePath, rootPath) => {
	const full = String(filePath || '');
	const root = String(rootPath || '');
	if (root && full.startsWith(root)) {
		const trimmed = full.slice(root.length).replace(/^[/\\]/, '');
		return trimmed || full;
	}
	return full;
};

/** Simple case-insensitive subsequence / includes score (higher is better). */
const scoreMatch = (text, query) => {
	const hay = String(text || '').toLowerCase();
	const needle = String(query || '').toLowerCase().trim();
	if (!needle) return 1;
	if (hay === needle) return 1000;
	if (hay.startsWith(needle)) return 500;
	const idx = hay.indexOf(needle);
	if (idx >= 0) return 300 - Math.min(idx, 200);
	// subsequence
	let hi = 0;
	for (let i = 0; i < needle.length; i++) {
		hi = hay.indexOf(needle[i], hi);
		if (hi < 0) return 0;
		hi += 1;
	}
	return 50;
};

const filterFiles = (files, query, rootPath) => {
	const list = (files || []).map(file => {
		const path = relPath(file.path, rootPath);
		const name = file.name || '';
		const byName = scoreMatch(name, query);
		const byPath = scoreMatch(path, query);
		const score = Math.max(byName * 2, byPath);
		return {file, name, path, score};
	}).filter(item => item.score > 0);

	list.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
	return list.slice(0, MAX_RESULTS);
};

module.exports = {
	MAX_RESULTS,
	flattenFiles,
	relPath,
	scoreMatch,
	filterFiles
};
