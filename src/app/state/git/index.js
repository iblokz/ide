import {obj} from 'iblokz-data';
import {dispatch} from 'iblokz-state';
import {fetchGitStatus} from '../../util/git-status.js';

export const initial = {
	available: null,
	loading: false,
	error: null,
	branch: null,
	ahead: 0,
	behind: 0,
	files: [],
	commits: [],
	projectPath: null
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
				projectPath
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
