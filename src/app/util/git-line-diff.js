/**
 * Minimal dirty-diff for the contenteditable linenum editor:
 * HEAD baseline → line LCS → classes on real lis + ghost removed rows.
 */
import {normalizePathKey} from './git-status.js';
import {GHOST_LINE_CLASS, lineElements} from './caret.js';

const GIT_LINE_CLASSES = [
	'git-line-added',
	'git-line-modified',
	'git-line-deleted-before',
	'git-line-deleted-after'
];

const baselineCache = new Map();
const MAX_DP_CELLS = 1_500_000;

export const clearGitBaselineCache = () => {
	baselineCache.clear();
};

/** Project-relative posix path, or null if outside root. */
export const projectRelativePath = (projectPath, filePath) => {
	const root = normalizePathKey(projectPath);
	const abs = normalizePathKey(filePath);
	if (!root || !abs) return null;
	if (abs === root) return '';
	if (abs.startsWith(`${root}/`)) return abs.slice(root.length + 1);
	return null;
};

let warnedNoGitShow = false;

/** Cached miss: file not in HEAD — skip in-editor gutter (Explorer `?` is enough). */
const UNTRACKED = Object.freeze({untracked: true});

/**
 * @returns {Promise<string|null|{untracked: true}>}
 *   HEAD blob text, `UNTRACKED` if not in HEAD, null if bridge unavailable
 */
export const fetchGitBaseline = async (projectPath, filePath) => {
	const bridge = typeof window !== 'undefined' ? window.app : null;
	if (!bridge || !projectPath || !filePath) {
		return null;
	}
	if (typeof bridge.gitShow !== 'function') {
		// AppImage/HMR: renderer can update without preload — need Electron restart.
		if (!warnedNoGitShow) {
			warnedNoGitShow = true;
			console.warn(
				'[git gutter] window.app.gitShow missing — restart Electron from this repo '
				+ '(e.g. ELECTRON_START_URL=http://127.0.0.1:1234 pnpm exec electron .) '
				+ 'so preload picks up the bridge'
			);
		}
		return null;
	}
	const rel = projectRelativePath(projectPath, filePath);
	if (rel == null || rel === '') return null;
	const key = `${normalizePathKey(projectPath)}\0${rel}`;
	if (baselineCache.has(key)) return baselineCache.get(key);

	try {
		const result = await bridge.gitShow(projectPath, rel);
		let content = null;
		if (result && result.ok) {
			content = String(result.stdout || '');
		} else {
			// Untracked / not in HEAD — no full-file green wash.
			content = UNTRACKED;
		}
		baselineCache.set(key, content);
		return content;
	} catch {
		return null;
	}
};

/**
 * Line marks for the current (after) buffer vs HEAD (before).
 * `removed` entries are ghost rows inserted before `before` (or after EOF if before === m).
 * @returns {{
 *   kinds: Array<'added'|'modified'|null>,
 *   removed: Array<{before: number, text: string}>
 * }}
 */
export const computeGitLineKinds = (beforeText, afterText) => {
	const a = String(beforeText ?? '').split('\n');
	const b = String(afterText ?? '').split('\n');
	const n = a.length;
	const m = b.length;
	const kinds = new Array(m).fill(null);
	const removed = [];

	if (beforeText === afterText) {
		return {kinds, removed};
	}
	if (n * m > MAX_DP_CELLS) {
		return {kinds, removed};
	}

	const cols = m + 1;
	const len = new Int16Array((n + 1) * cols);
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			len[i * cols + j] = a[i] === b[j]
				? len[(i + 1) * cols + (j + 1)] + 1
				: Math.max(len[(i + 1) * cols + j], len[i * cols + (j + 1)]);
		}
	}

	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			i += 1;
			j += 1;
		} else if (len[(i + 1) * cols + j] >= len[i * cols + (j + 1)]) {
			removed.push({before: j, text: a[i]});
			i += 1;
		} else {
			kinds[j] = 'added';
			j += 1;
		}
	}
	while (i < n) {
		removed.push({before: j, text: a[i]});
		i += 1;
	}
	while (j < m) {
		kinds[j] = 'added';
		j += 1;
	}

	// delete+add at same slot → modified (no deletion rule; wash covers it).
	const consumed = new Set();
	for (let k = 0; k < m; k++) {
		if (kinds[k] !== 'added') continue;
		for (let r = 0; r < removed.length; r++) {
			if (consumed.has(r)) continue;
			if (removed[r].before === k) {
				kinds[k] = 'modified';
				consumed.add(r);
				break;
			}
		}
	}

	// Pure deletions only — one HR slot per insert point (collapse runs).
	const slots = [];
	const seen = new Set();
	for (let r = 0; r < removed.length; r++) {
		if (consumed.has(r)) continue;
		const before = removed[r].before;
		if (seen.has(before)) continue;
		seen.add(before);
		slots.push({before});
	}

	return {kinds, removed: slots};
};

export const clearGitLineMarkup = el => {
	if (!el) return;
	// Legacy ghost rows from earlier iterations.
	el.querySelectorAll(`li.${GHOST_LINE_CLASS}`).forEach(li => {
		li.remove();
	});
	el.querySelectorAll('li').forEach(li => {
		for (let c = 0; c < GIT_LINE_CLASSES.length; c++) {
			li.classList.remove(GIT_LINE_CLASSES[c]);
		}
	});
};

export const applyGitLineMarkup = (el, marks) => {
	clearGitLineMarkup(el);
	if (!el || !marks) return;
	const list = lineElements(el);
	const {kinds, removed} = marks;
	const n = Math.min(list.length, kinds.length);
	for (let idx = 0; idx < n; idx++) {
		const kind = kinds[idx];
		if (kind === 'added') list[idx].classList.add('git-line-added');
		else if (kind === 'modified') list[idx].classList.add('git-line-modified');
	}

	// Deletion = hairline on the adjacent real line (no extra rows / text).
	if (!removed || !removed.length || !list.length) return;
	for (let r = 0; r < removed.length; r++) {
		const before = removed[r].before;
		if (before < list.length) {
			list[before].classList.add('git-line-deleted-before');
		} else {
			list[list.length - 1].classList.add('git-line-deleted-after');
		}
	}
};

let gutterSeq = 0;

/** Fetch baseline (cached), diff, paint. No-op without Electron gitShow. */
export const refreshGitLineGutter = async (el, source, gitContext) => {
	const seq = ++gutterSeq;
	if (!el || !gitContext || !gitContext.projectPath || !gitContext.filePath) {
		clearGitLineMarkup(el);
		return;
	}
	const baseline = await fetchGitBaseline(gitContext.projectPath, gitContext.filePath);
	if (seq !== gutterSeq) return;
	if (baseline == null || (baseline && baseline.untracked)) {
		clearGitLineMarkup(el);
		return;
	}
	if (!el.isConnected) return;
	applyGitLineMarkup(el, computeGitLineKinds(baseline, source || ''));
};

export default {
	clearGitBaselineCache,
	projectRelativePath,
	fetchGitBaseline,
	computeGitLineKinds,
	clearGitLineMarkup,
	applyGitLineMarkup,
	refreshGitLineGutter
};
