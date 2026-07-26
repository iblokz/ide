'use strict';

const {fn} = require('iblokz-data');

const hashPath = path => {
	let h = 2166136261;
	const s = String(path || '');
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return 'n' + (h >>> 0).toString(36);
};

const extOf = name => {
	const i = String(name || '').lastIndexOf('.');
	return i > 0 ? name.slice(i + 1).toLowerCase() : false;
};

const patchAt = ({list = [], path = [], nodesProp = 'nodes', key, value}) => path.length > 0 ? fn.pipe(
	() => path instanceof Array ? path.slice(0, 1).pop() : path,
	index => [].concat(
		list.slice(0, index),
		[{...list[index], [
			path.length > 1 ? nodesProp : key
		]: path.length > 1
			? patchAt({list: list[index][nodesProp], path: path.slice(1), nodesProp, key, value})
			: value
		}],
		(index < list.length - 1) ? list.slice(index + 1) : []
	)
)() : list;

/** Merge props onto the tree node at `path` (indices into nested `nodesProp` arrays). */
const mergeAt = ({list = [], path = [], nodesProp = 'files', patch = {}}) => {
	if (!path.length) return list;
	const index = path[0];
	if (index < 0 || index >= list.length || !list[index]) return list;
	if (path.length === 1) {
		return [].concat(
			list.slice(0, index),
			[Object.assign({}, list[index], patch)],
			list.slice(index + 1)
		);
	}
	const node = list[index];
	return [].concat(
		list.slice(0, index),
		[Object.assign({}, node, {
			[nodesProp]: mergeAt({
				list: node[nodesProp] || [],
				path: path.slice(1),
				nodesProp,
				patch
			})
		})],
		list.slice(index + 1)
	);
};

const SKIP_NAMES = new Set([
	'node_modules', '.git', '.parcel-cache', 'dist', '.pnpm-store',
	'coverage', '.next', '.cache'
]);

/** Raster / display images (opened in the image viewer). SVG stays editable text. */
const IMAGE_EXTS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tif', 'tiff'
]);

/** Known non-text blobs we don't try to open as source. */
const BINARY_EXTS = new Set([
	'pdf', 'zip', 'gz', 'tgz', 'tar', '7z', 'rar', 'bz2',
	'woff', 'woff2', 'ttf', 'otf', 'eot',
	'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
	'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v',
	'exe', 'dll', 'so', 'dylib', 'bin', 'wasm',
	'sqlite', 'db', 'dat', 'class', 'o', 'a'
]);

const CODE_EXTS = new Set([
	'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'css', 'sass', 'scss',
	'html', 'htm', 'pug', 'svg', 'yml', 'yaml', 'xml', 'sh', 'bash', 'zsh',
	'toml', 'ini', 'cfg', 'conf', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h',
	'cpp', 'hpp', 'cs', 'php', 'sql', 'graphql', 'vue', 'svelte'
]);

const TEXT_ICON_EXTS = new Set([
	'md', 'txt', 'log', 'csv', 'rst', 'rtf', 'env', 'gitignore', 'npmrc',
	'editorconfig', 'dockerignore', 'lock'
]);

const ARCHIVE_EXTS = new Set(['zip', 'gz', 'tgz', 'tar', '7z', 'rar', 'bz2']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v']);

const isImageFile = (name, ext) => IMAGE_EXTS.has(ext || extOf(name));

const isBinaryFile = (name, ext) => {
	const e = ext || extOf(name);
	if (!e) return false;
	return BINARY_EXTS.has(e) || IMAGE_EXTS.has(e);
};

/** Open in the editor as text — anything that isn't a known binary/image. */
const isTextFile = (name, ext) => !isBinaryFile(name, ext);

const fileKind = (name, ext) => {
	const e = ext || extOf(name);
	if (IMAGE_EXTS.has(e)) return 'image';
	if (BINARY_EXTS.has(e)) return 'binary';
	return 'text';
};

const MIME_BY_EXT = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	bmp: 'image/bmp',
	ico: 'image/x-icon',
	avif: 'image/avif',
	tif: 'image/tiff',
	tiff: 'image/tiff'
};

const mimeOf = (name, ext) => MIME_BY_EXT[ext || extOf(name)] || 'application/octet-stream';

const fileIcon = (item = {}) => {
	if (item.isDir) return item.expanded ? 'fa-folder-open-o' : 'fa-folder-o';
	const ext = item.ext || extOf(item.name);
	if (IMAGE_EXTS.has(ext)) return 'fa-file-image-o';
	if (CODE_EXTS.has(ext)) return 'fa-file-code-o';
	if (TEXT_ICON_EXTS.has(ext) || (!ext && String(item.name || '').startsWith('.'))) {
		return 'fa-file-text-o';
	}
	if (ext === 'pdf') return 'fa-file-pdf-o';
	if (ARCHIVE_EXTS.has(ext)) return 'fa-file-archive-o';
	if (AUDIO_EXTS.has(ext)) return 'fa-file-audio-o';
	if (VIDEO_EXTS.has(ext)) return 'fa-file-video-o';
	return 'fa-file-o';
};

module.exports = {
	hashPath,
	extOf,
	patchAt,
	mergeAt,
	SKIP_NAMES,
	IMAGE_EXTS,
	BINARY_EXTS,
	isImageFile,
	isBinaryFile,
	isTextFile,
	fileKind,
	mimeOf,
	fileIcon
};
