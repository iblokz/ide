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
	const i = name.lastIndexOf('.');
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

const SKIP_NAMES = new Set([
	'node_modules', '.git', '.parcel-cache', 'dist', '.pnpm-store',
	'coverage', '.next', '.cache'
]);

const TEXT_EXTS = new Set([
	'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'md', 'txt', 'css', 'sass', 'scss',
	'html', 'htm', 'pug', 'svg', 'yml', 'yaml', 'sh', 'bash', 'zsh', 'env', 'xml',
	'csv', 'toml', 'ini', 'cfg', 'conf', 'gitignore', 'npmrc', 'editorconfig'
]);

const isTextFile = (name, ext) => {
	if (TEXT_EXTS.has(ext)) return true;
	if (!ext && name.startsWith('.')) return true;
	return false;
};

module.exports = {
	hashPath,
	extOf,
	patchAt,
	SKIP_NAMES,
	TEXT_EXTS,
	isTextFile
};
