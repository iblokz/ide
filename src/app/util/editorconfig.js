/**
 * EditorConfig subset for indent: indent_style, indent_size, tab_width.
 * Resolution stays inside the opened project root (no parent-of-project files).
 */
import {hashPath} from './file-tree.js';

export const DEFAULT_INDENT = {
	style: 'tab',
	size: 2,
	tabWidth: 2
};

const cache = new Map();

export const clearEditorconfigCache = () => cache.clear();

export const indentInsert = indent => {
	const cfg = indent && indent.style ? indent : DEFAULT_INDENT;
	if (cfg.style === 'space') {
		const n = Math.max(1, Math.min(16, cfg.size || 2));
		return ' '.repeat(n);
	}
	return '\t';
};

const posix = p => String(p || '').replace(/\\/g, '/');

const basename = p => {
	const s = posix(p).replace(/\/+$/, '');
	const i = s.lastIndexOf('/');
	return i < 0 ? s : s.slice(i + 1);
};

const dirname = p => {
	const s = posix(p).replace(/\/+$/, '');
	const i = s.lastIndexOf('/');
	if (i <= 0) return i === 0 ? '/' : '';
	return s.slice(0, i);
};

const joinPath = (dir, name) => {
	const d = posix(dir).replace(/\/+$/, '');
	if (!d) return name;
	return `${d}/${name}`;
};

const isInsideRoot = (path, rootPath) => {
	if (!rootPath) return false;
	const p = posix(path);
	const r = posix(rootPath).replace(/\/+$/, '');
	return p === r || p.startsWith(`${r}/`);
};

const relativeTo = (dir, filePath) => {
	const d = posix(dir).replace(/\/+$/, '');
	const f = posix(filePath);
	if (f === d) return basename(f);
	if (d && f.startsWith(`${d}/`)) return f.slice(d.length + 1);
	return f;
};

const stripQuotes = v => {
	const s = String(v || '').trim();
	if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
		return s.slice(1, -1);
	}
	return s;
};

const expandBraces = pattern => {
	const m = /\{([^{}]+)\}/.exec(pattern);
	if (!m) return [pattern];
	const inner = m[1];
	const range = /^(-?\d+)\.\.(-?\d+)$/.exec(inner);
	let parts;
	if (range) {
		const a = Number(range[1]);
		const b = Number(range[2]);
		const step = a <= b ? 1 : -1;
		parts = [];
		for (let n = a; step > 0 ? n <= b : n >= b; n += step) parts.push(String(n));
	} else {
		parts = inner.split(',');
	}
	const out = [];
	parts.forEach(part => {
		expandBraces(pattern.slice(0, m.index) + part + pattern.slice(m.index + m[0].length))
			.forEach(p => out.push(p));
	});
	return out;
};

const globToRegExp = pattern => {
	let i = 0;
	let out = '^';
	const p = pattern.startsWith('/') ? pattern.slice(1) : pattern;
	while (i < p.length) {
		if (p.startsWith('**/', i) || (p.startsWith('**', i) && i + 2 === p.length)) {
			out += '.*';
			i += p[i + 2] === '/' ? 3 : 2;
			continue;
		}
		const ch = p[i];
		if (ch === '*') {
			out += '[^/]*';
			i += 1;
			continue;
		}
		if (ch === '?') {
			out += '[^/]';
			i += 1;
			continue;
		}
		if (ch === '[') {
			const close = p.indexOf(']', i + 1);
			if (close > i) {
				out += p.slice(i, close + 1);
				i = close + 1;
				continue;
			}
		}
		if ('\\^$.+()|{}'.includes(ch)) out += `\\${ch}`;
		else out += ch;
		i += 1;
	}
	out += '$';
	return new RegExp(out);
};

export const matchGlob = (pattern, relPath) => {
	const rel = posix(relPath);
	const name = basename(rel);
	return expandBraces(String(pattern || '').trim()).some(raw => {
		const p = raw.startsWith('./') ? raw.slice(2) : raw;
		if (!p) return false;
		try {
			const re = globToRegExp(p);
			if (p.includes('/')) return re.test(rel);
			return re.test(name) || globToRegExp(`**/${p}`).test(rel);
		} catch (_) {
			return false;
		}
	});
};

export const parseEditorConfig = text => {
	const sections = [];
	let glob = null;
	let props = {};
	let root = false;

	const flush = () => {
		if (glob != null) sections.push({glob, props});
		props = {};
	};

	String(text || '').split(/\r?\n/).forEach(raw => {
		const line = raw.replace(/[;#].*$/, '').trim();
		if (!line) return;
		const sec = /^\[(.+)\]$/.exec(line);
		if (sec) {
			flush();
			glob = sec[1].trim();
			props = {};
			return;
		}
		const kv = /^([^=]+)=(.*)$/.exec(line);
		if (!kv) return;
		const key = kv[1].trim().toLowerCase();
		const value = stripQuotes(kv[2]).toLowerCase();
		if (glob == null && key === 'root') {
			root = value === 'true';
			return;
		}
		if (glob != null) props[key] = value;
	});
	flush();
	return {root, sections};
};

const clampSize = n => Math.max(1, Math.min(16, n));

export const indentFromProps = (props = {}, fallback = DEFAULT_INDENT) => {
	let style = fallback.style;
	let size = fallback.size;
	let tabWidth = fallback.tabWidth;
	const p = props || {};

	if (p.indent_style === 'space' || p.indent_style === 'tab') {
		style = p.indent_style;
	}
	if (p.indent_size && p.indent_size !== 'unset' && p.indent_size !== 'tab') {
		const n = parseInt(p.indent_size, 10);
		if (n > 0) size = clampSize(n);
	}
	if (p.tab_width && p.tab_width !== 'unset') {
		const n = parseInt(p.tab_width, 10);
		if (n > 0) tabWidth = clampSize(n);
	} else if (p.indent_size && p.indent_size !== 'unset' && p.indent_size !== 'tab') {
		tabWidth = size;
	}
	if (p.indent_size === 'tab') {
		size = tabWidth;
	}
	if (style === 'space' && !(p.tab_width && p.tab_width !== 'unset')) {
		tabWidth = size;
	}
	return {style, size, tabWidth};
};

const mergeProps = (acc, next) => {
	const out = Object.assign({}, acc);
	Object.keys(next || {}).forEach(key => {
		if (next[key] === 'unset') delete out[key];
		else out[key] = next[key];
	});
	return out;
};

const configNode = (dirPath) => {
	const path = joinPath(dirPath, '.editorconfig');
	return {
		id: hashPath(path),
		name: '.editorconfig',
		path,
		isDir: false
	};
};

const dirNode = (dirPath) => ({
	id: hashPath(dirPath),
	name: basename(dirPath) || dirPath,
	path: dirPath,
	isDir: true
});

const readConfigAt = async (fs, dirPath) => {
	if (cache.has(dirPath)) return cache.get(dirPath);
	let text = null;
	try {
		const raw = await fs.readFile(configNode(dirPath));
		if (typeof raw === 'string' && raw.length) text = raw;
	} catch (_) { /* try listDir */ }
	if (text == null && typeof fs.listDir === 'function') {
		try {
			const kids = await fs.listDir(dirNode(dirPath));
			const node = (kids || []).find(n => n && !n.isDir && n.name === '.editorconfig');
			if (node) {
				const raw = await fs.readFile(node);
				if (typeof raw === 'string' && raw.length) text = raw;
			}
		} catch (_) { /* missing */ }
	}
	const parsed = text != null ? parseEditorConfig(text) : null;
	cache.set(dirPath, parsed);
	return parsed;
};

/**
 * Resolve indent for `filePath` using `.editorconfig` files from the file’s
 * directory up to `rootPath` (inclusive). Does not read outside the project.
 */
export const resolveIndent = async (fs, filePath, rootPath) => {
	if (!fs || typeof fs.readFile !== 'function' || !filePath || !rootPath) {
		return DEFAULT_INDENT;
	}
	if (!isInsideRoot(filePath, rootPath)) {
		return DEFAULT_INDENT;
	}

	const found = [];
	let dir = dirname(filePath);
	if (!dir) dir = posix(rootPath);
	const seen = new Set();
	const root = posix(rootPath).replace(/\/+$/, '');

	while (dir && !seen.has(dir) && isInsideRoot(dir, root)) {
		seen.add(dir);
		const parsed = await readConfigAt(fs, dir);
		if (parsed) {
			found.push({dir, parsed});
			if (parsed.root) break;
		}
		if (posix(dir).replace(/\/+$/, '') === root) break;
		const parent = dirname(dir);
		if (!parent || parent === dir) break;
		dir = parent;
	}

	let props = {};
	found.slice().reverse().forEach(({dir: cfgDir, parsed}) => {
		const rel = relativeTo(cfgDir, filePath);
		(parsed.sections || []).forEach(section => {
			if (matchGlob(section.glob, rel)) {
				props = mergeProps(props, section.props);
			}
		});
	});
	return indentFromProps(props);
};

export default {
	DEFAULT_INDENT,
	indentInsert,
	clearEditorconfigCache,
	matchGlob,
	parseEditorConfig,
	indentFromProps,
	resolveIndent
};
