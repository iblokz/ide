/**
 * Source Control sidebar section.
 */
import {div, span, ul, li, i, button} from 'iblokz-snabbdom-helpers';
import {obj} from 'iblokz-data';
import {joinProjectPath} from '../../../util/git-status.js';
import {fileStubFromPath} from '../../../util/session.js';
import sideBarPanel from '../panel.js';

const branchLabel = git => {
	const branch = git.branch || 'HEAD';
	const bits = [];
	if (git.ahead) bits.push(`↑${git.ahead}`);
	if (git.behind) bits.push(`↓${git.behind}`);
	return bits.length ? `${branch} ${bits.join(' ')}` : branch;
};

const changesSection = ({files, projectPath, loading, actions}) =>
	div('.git-status-section.git-status-changes', [
		span('.git-status-section-title', 'Changes'),
		files.length
			? ul('.git-status-list', files.map(entry => {
				const abs = joinProjectPath(projectPath, entry.path);
				const letter = entry.status || ' ';
				return li('.git-status-item', {
					attrs: {title: abs},
					on: {
						click: ev => {
							ev.preventDefault();
							actions.project.openFile(
								fileStubFromPath(abs),
								{source: 'tree'}
							);
						}
					}
				}, [
					span('.git-status-code', letter),
					span('.git-status-path', entry.path)
				]);
			}))
			: span('.git-status-empty',
				loading ? 'Loading…' : 'No changes')
	]);

export default ({state, actions}) => {
	const git = state.git || {};
	const projectPath = (state.project && state.project.path) || null;

	if (!projectPath) {
		return div('.side-bar-placeholder', [
			span('.side-bar-placeholder-title', 'Source Control'),
			span('.side-bar-placeholder-body', 'Open a folder to see git status')
		]);
	}
	if (git.available === false) {
		return div('.side-bar-placeholder', [
			span('.side-bar-placeholder-title', 'Source Control'),
			span('.side-bar-placeholder-body', 'Git status requires the desktop app')
		]);
	}
	if (git.error) {
		return div('.git-status', [
			div('.git-status-header', [
				span('.git-status-branch', 'Source Control'),
				button('.git-status-refresh', {
					attrs: {type: 'button', title: 'Refresh', 'aria-label': 'Refresh'},
					on: {
						click: ev => {
							ev.preventDefault();
							actions.git.refresh();
						}
					}
				}, [i('.fa.fa-refresh')])
			]),
			div('.side-bar-placeholder', [
				span('.side-bar-placeholder-body', String(git.error))
			])
		]);
	}

	const files = git.files || [];
	const commits = git.commits || [];
	const loading = git.loading || git.available == null;
	const commitsOpen = obj.sub(state, ['layout', 'toggles', 'gitCommits']) !== false;
	const commitsHeight = obj.sub(state, ['layout', 'dim', 'gitCommits']) || 140;

	return div('.git-status', [
		div('.git-status-header', [
			span('.git-status-branch', {
				attrs: {title: branchLabel(git)}
			}, [
				i('.fa.fa-code-fork'),
				span(branchLabel(git))
			]),
			button('.git-status-refresh', {
				attrs: {
					type: 'button',
					title: 'Refresh',
					'aria-label': 'Refresh'
				},
				props: {disabled: !!git.loading},
				class: {loading: !!git.loading},
				on: {
					click: ev => {
						ev.preventDefault();
						actions.git.refresh();
					}
				}
			}, [i('.fa.fa-refresh')])
		]),
		div('.git-status-body', [].concat(
			changesSection({files, projectPath, loading, actions}),
			sideBarPanel({
				title: 'Commits',
				open: commitsOpen,
				height: commitsHeight,
				maxHeight: 560,
				onToggle: () => actions.layout.toggle('gitCommits'),
				onResize: h => actions.layout.set({gitCommits: h}),
				children: [
					commits.length
						? ul('.git-log-list', commits.map(entry =>
							li('.git-log-item', {
								attrs: {title: `${entry.hash} ${entry.subject}`}
							}, [
								span('.git-log-hash', entry.hash),
								span('.git-log-subject', entry.subject)
							])
						))
						: span('.git-status-empty',
							loading ? 'Loading…' : 'No commits')
				]
			})
		))
	]);
};
