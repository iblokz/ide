import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {fetchGitStatus} from '../../util/git-status.js';
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
	commitDetails: {}
};

export const slice = state => (state && state.git) || initial;

export const patch = (state, partial) => obj.patch(
	state,
	'git',
	Object.assign({}, slice(state), partial)
);

export const reset = () => state => obj.patch(state, 'git', Object.assign({}, initial));

let refreshSeq = 0;

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

/** Refresh git status for the current project (Electron bridge). */
export const refresh = () => state => {
	const projectPath = state.project && state.project.path;
	if (!projectPath) {
		clearCommitDetailCache();
		return obj.patch(state, 'git', Object.assign({}, initial));
	}

	const seq = ++refreshSeq;
	clearCommitDetailCache();
	fetchGitStatus(projectPath).then(result => {
		clearGitBaselineCache();
		dispatch(next => {
			if (seq !== refreshSeq) return next;
			const curPath = next.project && next.project.path;
			if (curPath !== projectPath) return next;
			return patch(next, {
				available: result.available,
				loading: false,
				error: result.error,
				branch: result.branch,
				ahead: result.ahead || 0,
				behind: result.behind || 0,
				files: result.files || [],
				commits: result.commits || [],
				projectPath,
				stamp: Date.now(),
				selectedHash: null,
				commitDetails: {}
			});
		});
	});

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

export default {
	initial,
	reset,
	refresh,
	selectCommit
};
