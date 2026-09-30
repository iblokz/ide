'use strict';

const {SKIP_NAMES} = require('./file-tree');

const MAX_RESULTS = 40;
const MAX_INDEX_FILES = 10000;
/** Max chars for the directory prefix before middle-ellipsis. */
const MAX_DIR_DISPLAY = 42;

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

/**
 * Walk the project tree, listing unloaded directories via `listDir`.
 * Does not mutate the sidebar tree — builds a flat file list for search.
 */
const indexFilesDeep = async (nodes = [], listDir, out = []) => {
	if (out.length >= MAX_INDEX_FILES) return out;

	const dirs = [];
	for (let i = 0; i < (nodes || []).length; i++) {
		const node = nodes[i];
		if (!node || !node.name) continue;
		if (SKIP_NAMES && SKIP_NAMES.has(node.name)) continue;
		if (node.isDir) {
			dirs.push(node);
			continue;
		}
		if (node.readable === false) continue;
		out.push(node);
		if (out.length >= MAX_INDEX_FILES) return out;
	}

	if (!dirs.length) return out;

	const childrenLists = await Promise.all(dirs.map(async dir => {
		if (dir.childrenLoaded && Array.isArray(dir.files)) {
			return dir.files;
		}
		if (typeof listDir !== 'function') {
			return Array.isArray(dir.files) ? dir.files : [];
		}
		try {
			return (await listDir(dir)) || [];
		} catch (err) {
			console.error('file search listDir failed', dir && dir.path, err);
			return [];
		}
	}));

	for (let i = 0; i < childrenLists.length; i++) {
		if (out.length >= MAX_INDEX_FILES) break;
		await indexFilesDeep(childrenLists[i], listDir, out);
	}
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

const normalizePath = path => String(path || '').replace(/\\/g, '/');

/** Split query into path chunks (spaces / slashes). */
const queryTokens = query =>
	String(query || '')
		.toLowerCase()
		.trim()
		.split(/[\s/\\]+/)
		.filter(Boolean);

const mergeRanges = ranges => {
	if (!ranges || !ranges.length) return [];
	const sorted = ranges.slice().sort((a, b) => a.start - b.start || a.end - b.end);
	const out = [Object.assign({}, sorted[0])];
	for (let i = 1; i < sorted.length; i++) {
		const cur = sorted[i];
		const prev = out[out.length - 1];
		if (cur.start <= prev.end) {
			prev.end = Math.max(prev.end, cur.end);
		} else {
			out.push(Object.assign({}, cur));
		}
	}
	return out;
};

/** Contiguous token matches in order along `path` (indices into original path). */
const locateTokenRanges = (path, tokens) => {
	if (!tokens.length) return [];
	const hay = String(path || '').toLowerCase();
	const ranges = [];
	let cursor = 0;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const idx = hay.indexOf(token, cursor);
		if (idx < 0) return null;
		ranges.push({start: idx, end: idx + token.length});
		cursor = idx + token.length;
	}
	return ranges;
};

/**
 * Ranges for highlighting. Multi-token: ordered path chunks.
 * Single token: best contiguous hit in path (or basename).
 */
const locateMatches = (path, name, tokens) => {
	if (!tokens.length) return [];
	const full = normalizePath(path);
	if (tokens.length > 1) {
		return locateTokenRanges(full, tokens) || [];
	}
	const token = tokens[0];
	const hay = full.toLowerCase();
	let idx = hay.indexOf(token);
	if (idx < 0) {
		const base = String(name || '').toLowerCase();
		const ni = base.indexOf(token);
		if (ni < 0) return [];
		const nameStart = full.length - String(name || '').length;
		idx = nameStart + ni;
	}
	return [{start: idx, end: idx + token.length}];
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

/**
 * Multi-word / multi-chunk match against a relative path.
 * Tokens must appear in order (e.g. "src util search" → src/.../util/.../file-search.js).
 */
const scorePathChunks = (path, name, tokens) => {
	if (!tokens.length) return 1;
	if (tokens.length === 1) {
		return Math.max(scoreMatch(name, tokens[0]) * 2, scoreMatch(path, tokens[0]));
	}

	const hay = normalizePath(path).toLowerCase();
	const base = String(name || '').toLowerCase();
	let cursor = 0;
	let score = 0;

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const idx = hay.indexOf(token, cursor);
		if (idx < 0) return 0;

		const atSeg = idx === 0 || hay[idx - 1] === '/' || hay[idx - 1] === '-'
			|| hay[idx - 1] === '_' || hay[idx - 1] === '.';
		score += atSeg ? 140 : 70;

		if (i === tokens.length - 1) {
			if (base === token) score += 500;
			else if (base.startsWith(token)) score += 250;
			else if (base.indexOf(token) >= 0) score += 100;
		}

		cursor = idx + token.length;
	}

	score += Math.max(0, 80 - Math.min(cursor, 80));
	score += Math.max(0, 40 - Math.min(hay.length, 40));
	return score;
};

/**
 * Middle-ellipsis a string, remapping highlight ranges into the shortened text.
 */
const ellipsizeMiddle = (text, maxLen, ranges = []) => {
	const src = String(text || '');
	if (src.length <= maxLen) {
		return {text: src, ranges: mergeRanges(ranges)};
	}
	const ellipsis = '...';
	const keep = Math.max(maxLen - ellipsis.length, 2);
	const headLen = Math.ceil(keep / 2);
	const tailLen = Math.floor(keep / 2);
	const headEnd = headLen;
	const tailStart = src.length - tailLen;
	const out = src.slice(0, headEnd) + ellipsis + src.slice(tailStart);
	const mapped = [];

	(ranges || []).forEach(r => {
		const start = Math.max(0, r.start);
		const end = Math.min(src.length, r.end);
		if (end <= start) return;
		if (end <= headEnd) {
			mapped.push({start, end});
			return;
		}
		if (start >= tailStart) {
			mapped.push({
				start: headEnd + ellipsis.length + (start - tailStart),
				end: headEnd + ellipsis.length + (end - tailStart)
			});
			return;
		}
		if (start < headEnd) {
			mapped.push({start, end: headEnd});
		}
		if (end > tailStart) {
			mapped.push({
				start: headEnd + ellipsis.length,
				end: headEnd + ellipsis.length + (end - tailStart)
			});
		}
	});

	return {text: out, ranges: mergeRanges(mapped)};
};

/**
 * Split relative path into shortened dir (before name) + filename, with
 * highlight ranges remapped to each part.
 */
const formatSearchLabel = (path, name, matches, maxDirLen = MAX_DIR_DISPLAY) => {
	const full = normalizePath(path);
	const base = String(name || '');
	const slash = full.lastIndexOf('/');
	const dirRaw = slash >= 0 ? full.slice(0, slash) : '';
	const fileName = slash >= 0 ? full.slice(slash + 1) : (base || full);
	const ranges = mergeRanges(matches || []);

	const dirRanges = [];
	const nameRanges = [];
	ranges.forEach(r => {
		if (slash < 0) {
			nameRanges.push(r);
			return;
		}
		if (r.start < slash) {
			dirRanges.push({
				start: r.start,
				end: Math.min(r.end, slash)
			});
		}
		if (r.end > slash + 1) {
			nameRanges.push({
				start: Math.max(r.start, slash + 1) - (slash + 1),
				end: r.end - (slash + 1)
			});
		}
	});

	const shortened = ellipsizeMiddle(dirRaw, maxDirLen, dirRanges);
	return {
		dir: shortened.text,
		dirRanges: shortened.ranges,
		name: fileName,
		nameRanges: mergeRanges(nameRanges),
		full
	};
};

const filterFiles = (files, query, rootPath) => {
	const tokens = queryTokens(query);
	const list = (files || []).map(file => {
		const path = normalizePath(relPath(file.path, rootPath));
		const name = file.name || '';
		const score = scorePathChunks(path, name, tokens);
		const matches = score > 0 ? locateMatches(path, name, tokens) : [];
		const label = formatSearchLabel(path, name, matches);
		return {file, name, path, score, matches, label};
	}).filter(item => item.score > 0);

	list.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
	return list.slice(0, MAX_RESULTS);
};

module.exports = {
	MAX_RESULTS,
	MAX_INDEX_FILES,
	MAX_DIR_DISPLAY,
	flattenFiles,
	indexFilesDeep,
	relPath,
	queryTokens,
	scoreMatch,
	scorePathChunks,
	locateMatches,
	ellipsizeMiddle,
	formatSearchLabel,
	filterFiles
};
