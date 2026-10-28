/**
 * Parse `git status --porcelain=v1 -b` and fetch via Electron bridge.
 */

const unquotePath = raw => {
	const s = String(raw || '').trim();
	if (s.length >= 2 && s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') {
		return s.slice(1, -1).replace(/\\([\\"ntr])/g, (_, c) => {
			if (c === 'n') return '\n';
			if (c === 't') return '\t';
			if (c === 'r') return '\r';
			return c;
		});
	}
	return s;
};

/** Prefer worktree letter, else index; `?` for untracked, `U` for unmerged. */
export const statusLetter = (index, worktree) => {
	const x = index || ' ';
	const y = worktree || ' ';
	if (x === '?' || y === '?') return '?';
	if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
		return 'U';
	}
	if (y !== ' ') return y === '!' ? '!' : y;
	if (x !== ' ') return x;
	return ' ';
};

const parseBranchHeader = line => {
	// ## main...origin/main [ahead 1, behind 2]
	// ## HEAD (no branch)
	const rest = line.slice(3).trim();
	let ahead = 0;
	let behind = 0;
	const track = rest.match(/\[([^\]]+)\]\s*$/);
	if (track) {
		const bits = track[1];
		const a = bits.match(/ahead\s+(\d+)/);
		const b = bits.match(/behind\s+(\d+)/);
		if (a) ahead = parseInt(a[1], 10) || 0;
		if (b) behind = parseInt(b[1], 10) || 0;
	}
	const withoutTrack = track ? rest.slice(0, track.index).trim() : rest;
	const branch = withoutTrack.split('...')[0].trim() || withoutTrack || 'HEAD';
	return {branch, ahead, behind};
};

const parseEntryLine = line => {
	if (line.length < 3) return null;
	const index = line.charAt(0);
	const worktree = line.charAt(1);
	let rest = line.slice(3);
	// rename/copy: "R  old -> new" or quoted forms
	const arrow = rest.includes(' -> ') ? ' -> ' : (rest.includes('->') ? '->' : null);
	let path = rest;
	if (arrow) {
		const parts = rest.split(arrow);
		path = parts[parts.length - 1];
	}
	path = unquotePath(path);
	if (!path) return null;
	return {
		path,
		index,
		worktree,
		status: statusLetter(index, worktree)
	};
};

export const parsePorcelain = stdout => {
	const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
	let branch = null;
	let ahead = 0;
	let behind = 0;
	const files = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.indexOf('## ') === 0) {
			const hdr = parseBranchHeader(line);
			branch = hdr.branch;
			ahead = hdr.ahead;
			behind = hdr.behind;
			continue;
		}
		const entry = parseEntryLine(line);
		if (entry) files.push(entry);
	}
	return {branch, ahead, behind, files};
};

/**
 * Join project root + porcelain-relative path using the root's path separator.
 */
export const joinProjectPath = (root, rel) => {
	const base = String(root || '').replace(/[/\\]+$/, '');
	const part = String(rel || '').replace(/^[/\\]+/, '');
	if (!base) return part;
	if (!part) return base;
	const sep = base.indexOf('\\') >= 0 && base.indexOf('/') < 0 ? '\\' : '/';
	const normalized = sep === '\\' ? part.replace(/\//g, '\\') : part.replace(/\\/g, '/');
	return base + sep + normalized;
};

/** Canonical path key for Set/Map lookup (posix, no trailing slash). */
export const normalizePathKey = p => String(p || '')
	.replace(/\\/g, '/')
	.replace(/\/+$/, '');

/**
 * Map porcelain file entries → lookup for Explorer decorations.
 * Dirty files get a status letter; ancestor dirs are marked changed.
 * Ignored (`!!`) paths are muted via `isIgnored` (exact or under an ignored dir).
 *
 * @param {Array<{path: string, status?: string}>} files
 * @param {string|null} projectPath
 * @returns {{
 *   fileStatus: (absOrRel: string) => string|null,
 *   dirChanged: (absOrRel: string) => boolean,
 *   isIgnored: (absOrRel: string) => boolean
 * }}
 */
export const buildGitChangeIndex = (files, projectPath) => {
	const fileStatus = new Map();
	const dirs = new Set();
	const ignoredExact = new Set();
	const ignoredDirs = [];
	const list = Array.isArray(files) ? files : [];
	for (let i = 0; i < list.length; i++) {
		const entry = list[i];
		if (!entry || !entry.path) continue;
		const letter = (entry.status && entry.status !== ' ') ? entry.status : 'M';
		const rawPath = String(entry.path);
		// Porcelain marks untracked/ignored dirs as `path/` — treat as a directory entry.
		const isDirEntry = /[/\\]$/.test(rawPath);
		const abs = joinProjectPath(projectPath, rawPath);
		const absKey = normalizePathKey(abs);
		const relKey = normalizePathKey(rawPath);

		if (letter === '!') {
			if (absKey) ignoredExact.add(absKey);
			if (relKey) ignoredExact.add(relKey);
			if (isDirEntry) {
				if (absKey) ignoredDirs.push(absKey);
				if (relKey && relKey !== absKey) ignoredDirs.push(relKey);
			}
			continue;
		}

		fileStatus.set(absKey, letter);
		if (relKey) fileStatus.set(relKey, letter);

		if (isDirEntry && relKey) {
			dirs.add(relKey);
			dirs.add(absKey);
		}

		const parts = relKey.split('/').filter(Boolean);
		let acc = '';
		for (let j = 0; j < parts.length - 1; j++) {
			acc = acc ? `${acc}/${parts[j]}` : parts[j];
			dirs.add(acc);
			dirs.add(normalizePathKey(joinProjectPath(projectPath, acc)));
		}
	}
	return {
		fileStatus: path => fileStatus.get(normalizePathKey(path)) || null,
		dirChanged: path => dirs.has(normalizePathKey(path)),
		isIgnored: path => {
			const key = normalizePathKey(path);
			if (!key) return false;
			if (ignoredExact.has(key)) return true;
			for (let i = 0; i < ignoredDirs.length; i++) {
				const dir = ignoredDirs[i];
				if (key === dir || key.startsWith(`${dir}/`)) return true;
			}
			return false;
		}
	};
};

/**
 * Split `git log --decorate` `%D` into ref labels.
 * Keeps compact tokens: `HEAD`, branch names, `tag: …`, remotes.
 */
export const parseDecorations = raw => {
	const s = String(raw || '').trim();
	if (!s) return [];
	const refs = [];
	const parts = s.split(',').map(p => p.trim()).filter(Boolean);
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const headBranch = /^HEAD\s*->\s*(.+)$/.exec(part);
		if (headBranch) {
			refs.push('HEAD');
			refs.push(headBranch[1].trim());
			continue;
		}
		if (part === 'HEAD') {
			refs.push('HEAD');
			continue;
		}
		refs.push(part);
	}
	return refs;
};

/**
 * Classify a decoration token for chips.
 * @returns {{raw: string, label: string, kind: 'head'|'branch'|'tag'|'remote', current: boolean}}
 */
export const classifyRef = (ref, branch) => {
	const raw = String(ref || '');
	if (raw === 'HEAD') {
		return {raw, label: 'HEAD', kind: 'head', current: false};
	}
	const tag = /^tag:\s*(.+)$/i.exec(raw);
	if (tag) {
		return {raw, label: tag[1].trim(), kind: 'tag', current: false};
	}
	if (raw.includes('/')) {
		return {raw, label: raw, kind: 'remote', current: false};
	}
	const current = !!(branch && raw === branch);
	return {raw, label: raw, kind: 'branch', current};
};

/**
 * Drop noisy refs, dedupe, prioritize HEAD → current branch → locals → tags → remotes.
 * @param {string[]} refs
 * @param {string|null|undefined} branch current branch short name
 */
export const prioritizeRefs = (refs, branch) => {
	const list = Array.isArray(refs) ? refs : [];
	const out = [];
	const seen = new Set();
	for (let i = 0; i < list.length; i++) {
		const item = classifyRef(list[i], branch);
		if (!item.label) continue;
		// `origin/HEAD` is noise next to real branch tips
		if (item.kind === 'remote' && /\/HEAD$/i.test(item.label)) continue;
		const key = `${item.kind}:${item.label}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(item);
	}
	const rank = {head: 0, branch: 1, tag: 2, remote: 3};
	out.sort((a, b) => {
		if (a.kind === 'branch' && b.kind === 'branch' && a.current !== b.current) {
			return a.current ? -1 : 1;
		}
		const ra = rank[a.kind] != null ? rank[a.kind] : 9;
		const rb = rank[b.kind] != null ? rank[b.kind] : 9;
		if (ra !== rb) return ra - rb;
		return a.label.localeCompare(b.label);
	});
	return out;
};

/**
 * Compact row chips: local branches + tags only (no HEAD / remotes), readable labels.
 * @param {string[]} refs
 * @param {string|null|undefined} branch
 * @param {number} [limit=3]
 */
export const rowRefChips = (refs, branch, limit = 3) => {
	const all = prioritizeRefs(refs, branch).filter(c =>
		c.kind === 'branch' || c.kind === 'tag'
	);
	const max = typeof limit === 'number' && limit > 0 ? limit : 3;
	return all.slice(0, max).map(c => Object.assign({}, c, {
		display: c.label
	}));
};

/**
 * Parse `git log --format=%h%x09%p%x09%D%x09%an%x09%aI%x09%s`
 * (also accepts older `%h…%D…%s` and legacy `%h%x09%s`).
 * @returns {Array<{
 *   hash: string,
 *   parents: string[],
 *   refs: string[],
 *   author: string,
 *   date: string,
 *   subject: string
 * }>}
 */
export const parseLog = stdout => {
	const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
	const commits = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const parts = line.split('\t');
		if (parts.length < 2) continue;
		const hash = (parts[0] || '').trim();
		if (!hash) continue;
		// Current: hash, parents, decorations, author, date, subject
		if (parts.length >= 6) {
			const parents = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
			const refs = parseDecorations(parts[2]);
			const author = (parts[3] || '').trim();
			const date = (parts[4] || '').trim();
			const subject = parts.slice(5).join('\t').trim() || '(no subject)';
			commits.push({hash, parents, refs, author, date, subject});
			continue;
		}
		// Phase 1–2: hash, parents, decorations, subject
		if (parts.length >= 4) {
			const parents = (parts[1] || '').trim().split(/\s+/).filter(Boolean);
			const refs = parseDecorations(parts[2]);
			const subject = parts.slice(3).join('\t').trim() || '(no subject)';
			commits.push({hash, parents, refs, author: '', date: '', subject});
			continue;
		}
		// Legacy: hash, subject
		const subject = parts.slice(1).join('\t').trim() || '(no subject)';
		commits.push({hash, parents: [], refs: [], author: '', date: '', subject});
	}
	return commits;
};

const emptySnapshot = (available, error) => ({
	available,
	error: error || null,
	branch: null,
	ahead: 0,
	behind: 0,
	files: [],
	commits: []
});

/**
 * @returns {Promise<{
 *   available: boolean,
 *   error: string|null,
 *   branch: string|null,
 *   ahead: number,
 *   behind: number,
 *   files: Array<{path: string, index: string, worktree: string, status: string}>,
 *   commits: Array<{hash: string, parents: string[], refs: string[], author: string, date: string, subject: string}>
 * }>}
 */
export const fetchGitStatus = async projectPath => {
	const bridge = typeof window !== 'undefined' ? window.app : null;
	if (!bridge || typeof bridge.gitStatus !== 'function') {
		return emptySnapshot(false);
	}
	if (!projectPath) {
		return emptySnapshot(true, 'No project open');
	}
	try {
		const statusResult = await bridge.gitStatus(projectPath);
		if (!statusResult || !statusResult.ok) {
			return emptySnapshot(true, (statusResult && statusResult.error) || 'git status failed');
		}
		const parsed = parsePorcelain(statusResult.stdout);
		const files = parsed.files.slice();
		// Compact ignored stubs (e.g. node_modules/) — not full trees.
		if (typeof bridge.gitLsIgnored === 'function') {
			try {
				const ignoredResult = await bridge.gitLsIgnored(projectPath);
				if (ignoredResult && ignoredResult.ok) {
					const lines = String(ignoredResult.stdout || '')
						.split(/\r?\n/)
						.filter(Boolean);
					for (let i = 0; i < lines.length; i++) {
						const path = lines[i];
						if (!path) continue;
						files.push({
							path,
							index: '!',
							worktree: '!',
							status: '!'
						});
					}
				}
			} catch {
				// ignore helper failures; status still usable
			}
		}
		let commits = [];
		if (typeof bridge.gitLog === 'function') {
			try {
				const logResult = await bridge.gitLog(projectPath);
				if (logResult && logResult.ok) {
					commits = parseLog(logResult.stdout);
				}
			} catch {
				commits = [];
			}
		}
		return {
			available: true,
			error: null,
			branch: parsed.branch,
			ahead: parsed.ahead,
			behind: parsed.behind,
			files,
			commits
		};
	} catch (err) {
		return emptySnapshot(true, (err && err.message) || 'git status failed');
	}
};

export default {
	statusLetter,
	parsePorcelain,
	parseDecorations,
	classifyRef,
	prioritizeRefs,
	rowRefChips,
	parseLog,
	joinProjectPath,
	normalizePathKey,
	buildGitChangeIndex,
	fetchGitStatus
};
