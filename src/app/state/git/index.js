import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {fetchGitStatus, fetchGitFiles} from '../../util/git-status.js';
import {
	gitAdd,
	gitUnstage,
	gitCommit,
	gitPull,
	gitPush,
	gitFetch,
	optimisticStageFiles,
	optimisticUnstageFiles
} from '../../util/git-write.js';
import {
	peekCommitDetail,
	prefetchCommitDetail,
	clearCommitDetailCache
} from '../../util/git-commit-cache.js';
import {clearGitBaselineCache} from '../../util/git-line-diff.js';

export const initial = {
	available: null,
	loading: false,
	error: null,
	branch: null,
	ahead: 0,
	behind: 0,
	files: [],
	commits: [],
	projectPath: null,
	/** Bumps on each successful refresh so editor gutters refetch HEAD. */
	stamp: 0,
	selectedHash: null,
	/** @type {Record<string, {loading?: boolean, error?: string|null, detail?: object|null}>} */
	commitDetails: {},
	commitMessage: '',
	/** Active write/sync op label, or null. */
	busy: null,
	/** Last stage/commit/sync failure (does not replace status `error`). */
	actionError: null,
	/** Error banner expanded past the clamped preview. */
	actionErrorExpanded: false
};

export const slice = state => (state && state.git) || initial;

export const patch = (state, partial) => obj.patch(
	state,
	'git',
	Object.assign({}, slice(state), partial)
);

export const reset = () => state => obj.patch(state, 'git', Object.assign({}, initial));

let refreshSeq = 0;
let filesSeq = 0;
/** In-flight stage/unstage count — keeps full refresh from clobbering optimistic files. */
let pendingFileOps = 0;
/** Resolvers waiting for stage/unstage IPC to finish (commit must not race add). */
let fileOpIdleWaiters = [];

const afterPaint = fn => {
	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(() => setTimeout(fn, 0));
	} else {
		setTimeout(fn, 0);
	}
};

const notifyFileOpsIdle = () => {
	if (pendingFileOps > 0) return;
	const waiters = fileOpIdleWaiters.splice(0);
	for (let i = 0; i < waiters.length; i++) waiters[i]();
};

const whenFileOpsIdle = () => {
	if (pendingFileOps <= 0) return Promise.resolve();
	return new Promise(resolve => {
		fileOpIdleWaiters.push(resolve);
	});
};

const writeDetail = (state, hash, entry) => {
	const git = slice(state);
	return patch(state, {
		commitDetails: Object.assign({}, git.commitDetails, {
			[hash]: {
				loading: !!entry.loading,
				error: entry.error || null,
				detail: entry.detail || null
			}
		})
	});
};

/** After fetch: merge detail into state (safe to call from prefetch waiters). */
const applyFetchedDetail = (projectPath, hash) => entry => {
	dispatch(next => {
		const git = slice(next);
		if (git.projectPath !== projectPath) return next;
		return writeDetail(next, hash, entry);
	});
};

const projectPathOf = state => {
	const git = slice(state);
	return git.projectPath || (state.project && state.project.path) || null;
};

/** Push/pull/fetch/commit — skip background refresh so status doesn't race locks. */
const isSyncBusy = state => {
	const busy = slice(state).busy;
	return busy === 'push' || busy === 'pull' || busy === 'fetch' || busy === 'commit';
};

/**
 * Quiet files-only refresh: no loading flash, keeps commits / selection.
 * Used after stage / unstage. Does not touch `actionError` (write-op only).
 */
export const refreshFiles = () => state => {
	const projectPath = projectPathOf(state);
	if (!projectPath) return state;
	if (isSyncBusy(state)) return state;

	const seq = ++filesSeq;
	const prevFiles = slice(state).files || [];
	fetchGitFiles(projectPath, prevFiles).then(result => {
		dispatch(next => {
			if (seq !== filesSeq) return next;
			if (projectPathOf(next) !== projectPath) return next;
			if (isSyncBusy(next)) return next;
			if (!result || result.available === false) return next;
			// Status failures stay silent — never steal the write-op error banner.
			if (result.error) return next;
			const branchPatch = {
				branch: result.branch,
				ahead: result.ahead || 0,
				behind: result.behind || 0
			};
			// Another stage/unstage is still painting optimistically — don't snap back.
			if (pendingFileOps > 0) {
				return patch(next, branchPatch);
			}
			return patch(next, Object.assign({}, branchPatch, {
				files: result.files || []
			}));
		});
	});

	return state;
};

/**
 * Run a write/sync bridge call, then refresh.
 * @param {string} label busy key for UI (null = no busy chrome)
 * @param {(cwd: string) => Promise<{ok: boolean, error?: string}>} run
 * @param {{clearMessage?: boolean, refresh?: 'full'|'files', busy?: boolean}} [opts]
 */
const runOp = (label, run, opts = {}) => state => {
	const projectPath = projectPathOf(state);
	if (!projectPath) return state;
	if (opts.busy !== false && slice(state).busy) return state;

	const useBusy = opts.busy !== false;
	run(projectPath).then(result => {
		dispatch(next => {
			if (projectPathOf(next) !== projectPath) return next;
			if (!result || !result.ok) {
				const failed = patch(next, {
					busy: useBusy ? null : slice(next).busy,
					actionError: (result && result.error) || `${label || 'git'} failed`,
					actionErrorExpanded: false
				});
				// Reconcile optimistic stage/unstage on failure.
				if (opts.refresh === 'files') return refreshFiles()(failed);
				return failed;
			}
			const cleared = patch(next, {
				busy: useBusy ? null : slice(next).busy,
				actionError: null,
				actionErrorExpanded: false,
				commitMessage: opts.clearMessage ? '' : slice(next).commitMessage
			});
			if (opts.refresh === 'files') {
				return refreshFiles()(cleared);
			}
			return refresh()(cleared);
		});
	});

	if (!useBusy) return state;
	return patch(state, {
		busy: label,
		actionError: null,
		actionErrorExpanded: false
	});
};

/** Refresh git status for the current project (Electron bridge). */
export const refresh = () => state => {
	const projectPath = state.project && state.project.path;
	if (!projectPath) {
		clearCommitDetailCache();
		return obj.patch(state, 'git', Object.assign({}, initial));
	}
	// Don't fight push/pull/fetch/commit for the repo lock (avoids error flicker).
	if (isSyncBusy(state)) return state;

	const seq = ++refreshSeq;
	clearCommitDetailCache();
	fetchGitStatus(projectPath).then(result => {
		clearGitBaselineCache();
		dispatch(next => {
			if (seq !== refreshSeq) return next;
			const curPath = next.project && next.project.path;
			if (curPath !== projectPath) return next;
			if (isSyncBusy(next)) return next;
			const prev = slice(next);
			return patch(next, {
				available: result.available,
				loading: false,
				error: result.error,
				branch: result.branch,
				ahead: result.ahead || 0,
				behind: result.behind || 0,
				// Keep optimistic stage/unstage while IPC is in flight.
				files: pendingFileOps > 0 ? prev.files : (result.files || []),
				commits: result.commits || [],
				projectPath,
				stamp: Date.now(),
				selectedHash: pendingFileOps > 0 ? prev.selectedHash : null,
				commitDetails: pendingFileOps > 0 ? prev.commitDetails : {},
				// Preserve composer / action chrome across refreshes.
				commitMessage: prev.commitMessage || '',
				busy: prev.busy,
				actionError: prev.actionError
			});
		});
	});

	// Don't clear commit selection / flash loading during a stage click.
	if (pendingFileOps > 0) {
		return patch(state, {projectPath});
	}

	return patch(state, {
		loading: true,
		error: null,
		projectPath,
		selectedHash: null,
		commitDetails: {}
	});
};

/**
 * Toggle commit selection; loads detail for expand.
 * Loading/cached detail is applied in the same state transition (no nested
 * dispatch) so a stale patch cannot wipe commitDetails back to empty.
 */
export const selectCommit = hash => state => {
	const git = slice(state);
	const projectPath = git.projectPath || (state.project && state.project.path);
	const nextHash = git.selectedHash === hash ? null : hash;
	let next = patch(state, {selectedHash: nextHash});
	if (!nextHash || !projectPath) return next;

	const cached = peekCommitDetail(projectPath, nextHash);
	if (cached && cached.detail) {
		return writeDetail(next, nextHash, cached);
	}

	next = writeDetail(next, nextHash, {loading: true, error: null, detail: null});
	prefetchCommitDetail(projectPath, nextHash, applyFetchedDetail(projectPath, nextHash));
	return next;
};

export const setCommitMessage = message => state =>
	patch(state, {commitMessage: String(message || '')});

export const clearActionError = () => state =>
	patch(state, {actionError: null, actionErrorExpanded: false});

export const toggleActionErrorExpanded = () => state =>
	patch(state, {actionErrorExpanded: !slice(state).actionErrorExpanded});

const normalizePaths = paths => (Array.isArray(paths) ? paths : [paths]).filter(Boolean);

/**
 * Paint optimistic file list first; run git IPC after the frame, then quiet reconcile.
 * @param {object} state
 * @param {{
 *   files: Array,
 *   label: string,
 *   run: (cwd: string) => Promise<{ok: boolean, error?: string}>
 * }} opts
 */
const runOptimisticFileOp = (state, {files, label, run}) => {
	const projectPath = projectPathOf(state);
	if (!projectPath) return state;

	pendingFileOps++;
	afterPaint(() => {
		run(projectPath).then(result => {
			pendingFileOps = Math.max(0, pendingFileOps - 1);
			notifyFileOpsIdle();
			dispatch(next => {
				if (projectPathOf(next) !== projectPath) return next;
				if (!result || !result.ok) {
					return refreshFiles()(patch(next, {
						actionError: (result && result.error) || `${label} failed`,
						actionErrorExpanded: false
					}));
				}
				if (pendingFileOps > 0) {
					return patch(next, {actionError: null, actionErrorExpanded: false});
				}
				return refreshFiles()(patch(next, {
					actionError: null,
					actionErrorExpanded: false
				}));
			});
		}, () => {
			pendingFileOps = Math.max(0, pendingFileOps - 1);
			notifyFileOpsIdle();
		});
	});

	return patch(state, {
		files,
		actionError: null,
		actionErrorExpanded: false
	});
};

/** Stage paths — UI updates synchronously; git add runs after paint. */
export const stage = paths => state => {
	const list = normalizePaths(paths);
	if (!list.length) return state;
	return runOptimisticFileOp(state, {
		files: optimisticStageFiles(slice(state).files, list),
		label: 'stage',
		run: cwd => gitAdd(cwd, list)
	});
};

export const stageAll = () => state =>
	runOptimisticFileOp(state, {
		files: optimisticStageFiles(slice(state).files, null),
		label: 'stage',
		run: cwd => gitAdd(cwd, null)
	});

export const unstage = paths => state => {
	const list = normalizePaths(paths);
	if (!list.length) return state;
	return runOptimisticFileOp(state, {
		files: optimisticUnstageFiles(slice(state).files, list),
		label: 'unstage',
		run: cwd => gitUnstage(cwd, list)
	});
};

export const unstageAll = () => state =>
	runOptimisticFileOp(state, {
		files: optimisticUnstageFiles(slice(state).files, null),
		label: 'unstage',
		run: cwd => gitUnstage(cwd, null)
	});

export const commit = () => state => {
	const git = slice(state);
	const message = (git.commitMessage || '').trim();
	if (!message) {
		return patch(state, {
			actionError: 'Empty commit message',
			actionErrorExpanded: false
		});
	}
	const projectPath = projectPathOf(state);
	if (!projectPath) return state;
	if (git.busy) return state;

	// Wait for optimistic stage/unstage IPC — otherwise commit races an empty index.
	whenFileOpsIdle()
		.then(() => gitCommit(projectPath, message))
		.then(result => {
			dispatch(next => {
				if (projectPathOf(next) !== projectPath) return next;
				if (!result || !result.ok) {
					return patch(next, {
						busy: null,
						actionError: (result && result.error) || 'commit failed',
						actionErrorExpanded: false
					});
				}
				return refresh()(patch(next, {
					busy: null,
					actionError: null,
					actionErrorExpanded: false,
					commitMessage: ''
				}));
			});
		});

	return patch(state, {
		busy: 'commit',
		actionError: null,
		actionErrorExpanded: false
	});
};

export const pull = () => runOp('pull', gitPull, {refresh: 'full'});

export const push = () => runOp('push', gitPush, {refresh: 'full'});

export const fetch = () => runOp('fetch', gitFetch, {refresh: 'full'});

/**
 * Background fetch (VS Code–style autofetch): no busy chrome, silent on error,
 * then quiet status refresh so ahead/behind update.
 */
export const autoFetch = () => state => {
	const projectPath = projectPathOf(state);
	if (!projectPath) return state;
	const git = slice(state);
	if (git.busy || git.available === false) return state;

	gitFetch(projectPath).then(result => {
		if (!result || !result.ok) return;
		dispatch(next => {
			if (projectPathOf(next) !== projectPath) return next;
			if (isSyncBusy(next) || slice(next).busy) return next;
			return refreshFiles()(next);
		});
	});

	return state;
};

export default {
	initial,
	reset,
	refresh,
	refreshFiles,
	selectCommit,
	setCommitMessage,
	clearActionError,
	toggleActionErrorExpanded,
	stage,
	stageAll,
	unstage,
	unstageAll,
	commit,
	pull,
	push,
	fetch,
	autoFetch
};
