/**
 * Electron bridge helpers for git write / sync ops.
 * Paths are project-relative porcelain paths (as in state.git.files).
 */

import {statusLetter} from './git-status.js';

const bridge = () => (typeof window !== 'undefined' ? window.app : null);

const unavailable = () => ({ok: false, error: 'Git write requires the desktop app'});

const invoke = async (name, ...args) => {
	const app = bridge();
	if (!app || typeof app[name] !== 'function') return unavailable();
	try {
		const result = await app[name](...args);
		if (!result || result.ok === false) {
			return {
				ok: false,
				error: (result && result.error) || `${name} failed`
			};
		}
		return {ok: true, stdout: result.stdout || ''};
	} catch (err) {
		return {ok: false, error: (err && err.message) || `${name} failed`};
	}
};

/** Stage paths, or all when `paths` is null/omitted. */
export const gitAdd = (projectPath, paths) =>
	invoke('gitAdd', projectPath, paths == null ? null : paths);

/** Unstage paths, or all when `paths` is null/omitted. */
export const gitUnstage = (projectPath, paths) =>
	invoke('gitUnstage', projectPath, paths == null ? null : paths);

export const gitCommit = (projectPath, message) =>
	invoke('gitCommit', projectPath, message);

export const gitPull = projectPath => invoke('gitPull', projectPath);

export const gitPush = projectPath => invoke('gitPush', projectPath);

export const gitFetch = projectPath => invoke('gitFetch', projectPath);

/**
 * Split porcelain entries into staged / unstaged lists (ignored excluded).
 * Dual-changed (`MM`) appear in both; letter is the relevant side.
 *
 * @param {Array<{path: string, index?: string, worktree?: string, status?: string}>} files
 * @returns {{
 *   staged: Array<{path: string, index: string, worktree: string, status: string}>,
 *   unstaged: Array<{path: string, index: string, worktree: string, status: string}>
 * }}
 */
export const partitionChangeFiles = files => {
	const list = Array.isArray(files) ? files : [];
	const staged = [];
	const unstaged = [];
	for (let i = 0; i < list.length; i++) {
		const entry = list[i];
		if (!entry || !entry.path) continue;
		if (entry.status === '!') continue;
		const index = entry.index || ' ';
		const worktree = entry.worktree || ' ';
		const untracked = index === '?' || worktree === '?';
		if (!untracked && index !== ' ') {
			staged.push({
				path: entry.path,
				index,
				worktree,
				status: index
			});
		}
		if (untracked || worktree !== ' ') {
			unstaged.push({
				path: entry.path,
				index,
				worktree,
				status: untracked ? '?' : worktree
			});
		}
	}
	return {staged, unstaged};
};

/** `paths == null` → all matching files; else only listed paths. */
const matchesPath = (paths, path) => {
	if (paths == null) return true;
	const list = Array.isArray(paths) ? paths : [paths];
	for (let i = 0; i < list.length; i++) {
		if (list[i] === path) return true;
	}
	return false;
};

const stageEntry = entry => {
	const index = entry.index || ' ';
	const worktree = entry.worktree || ' ';
	if (index === '?' || worktree === '?') {
		return {path: entry.path, index: 'A', worktree: ' ', status: 'A'};
	}
	if (worktree === ' ') return entry;
	return {
		path: entry.path,
		index: worktree,
		worktree: ' ',
		status: statusLetter(worktree, ' ')
	};
};

const unstageEntry = entry => {
	const index = entry.index || ' ';
	const worktree = entry.worktree || ' ';
	if (index === ' ' || index === '?') return entry;
	if (index === 'A' && worktree === ' ') {
		return {path: entry.path, index: '?', worktree: '?', status: '?'};
	}
	const nextWorktree = worktree !== ' ' ? worktree : index;
	return {
		path: entry.path,
		index: ' ',
		worktree: nextWorktree,
		status: statusLetter(' ', nextWorktree)
	};
};

/**
 * Optimistic porcelain tweak after stage (reconciled by quiet refresh).
 * @param {unknown} paths path, path[], or null for all
 */
export const optimisticStageFiles = (files, paths) => {
	const list = Array.isArray(files) ? files : [];
	if (paths != null) {
		const listPaths = Array.isArray(paths) ? paths : [paths];
		if (!listPaths.length) return list;
	}
	return list.map(entry => {
		if (!entry || !entry.path || entry.status === '!') return entry;
		if (!matchesPath(paths, entry.path)) return entry;
		return stageEntry(entry);
	});
};

/**
 * Optimistic porcelain tweak after unstage.
 * @param {unknown} paths path, path[], or null for all
 */
export const optimisticUnstageFiles = (files, paths) => {
	const list = Array.isArray(files) ? files : [];
	if (paths != null) {
		const listPaths = Array.isArray(paths) ? paths : [paths];
		if (!listPaths.length) return list;
	}
	return list.map(entry => {
		if (!entry || !entry.path || entry.status === '!') return entry;
		if (!matchesPath(paths, entry.path)) return entry;
		return unstageEntry(entry);
	});
};

export default {
	gitAdd,
	gitUnstage,
	gitCommit,
	gitPull,
	gitPush,
	gitFetch,
	partitionChangeFiles,
	optimisticStageFiles,
	optimisticUnstageFiles
};
