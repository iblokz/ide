import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {fetchGitStatus} from '../../util/git-status.js';
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
	stamp: 0
};

export const slice = state => (state && state.git) || initial;

export const patch = (state, partial) => obj.patch(
	state,
	'git',
	Object.assign({}, slice(state), partial)
);

export const reset = () => state => obj.patch(state, 'git', Object.assign({}, initial));

let refreshSeq = 0;

/** Refresh git status for the current project (Electron bridge). */
export const refresh = () => state => {
	const projectPath = state.project && state.project.path;
	if (!projectPath) {
		return obj.patch(state, 'git', Object.assign({}, initial));
	}

	const seq = ++refreshSeq;
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
				stamp: Date.now()
			});
		});
	});

	return patch(state, {
		loading: true,
		error: null,
		projectPath
	});
};

export default {
	initial,
	reset,
	refresh
};
