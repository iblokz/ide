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

/** Parse `git log --format=%h%x09%s` lines into `{hash, subject}`. */
export const parseLog = stdout => {
	const lines = String(stdout || '').split(/\r?\n/).filter(Boolean);
	const commits = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const tab = line.indexOf('\t');
		if (tab <= 0) continue;
		const hash = line.slice(0, tab).trim();
		const subject = line.slice(tab + 1).trim();
		if (!hash) continue;
		commits.push({hash, subject: subject || '(no subject)'});
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
 *   commits: Array<{hash: string, subject: string}>
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
			files: parsed.files,
			commits
		};
	} catch (err) {
		return emptySnapshot(true, (err && err.message) || 'git status failed');
	}
};

export default {
	statusLetter,
	parsePorcelain,
	parseLog,
	joinProjectPath,
	fetchGitStatus
};
