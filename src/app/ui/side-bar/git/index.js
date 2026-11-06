/**
 * Source Control sidebar section: stage / commit / sync + commits graph.
 */
import {div, span, ul, li, i, button, textarea, pre} from 'iblokz-snabbdom-helpers';
import {obj} from 'iblokz-data';
import {joinProjectPath} from '../../../util/git-status.js';
import {partitionChangeFiles} from '../../../util/git-write.js';
import {fileStubFromPath} from '../../../util/session.js';
import sideBarPanel from '../panel.js';
import graphPanel from './graph-panel.js';

/** Single-line start; grow with content up to a soft max. */
const COMMIT_MSG_MIN = 28;
const COMMIT_MSG_MAX = 140;

const fitCommitMessage = el => {
	if (!el) return;
	el.style.height = '0px';
	const next = Math.max(COMMIT_MSG_MIN, Math.min(el.scrollHeight, COMMIT_MSG_MAX));
	el.style.height = `${next}px`;
	el.style.overflowY = el.scrollHeight > COMMIT_MSG_MAX ? 'auto' : 'hidden';
};

const branchLabel = git => {
	const branch = git.branch || 'HEAD';
	const bits = [];
	if (git.ahead) bits.push(`↑${git.ahead}`);
	if (git.behind) bits.push(`↓${git.behind}`);
	return bits.length ? `${branch} ${bits.join(' ')}` : branch;
};

const iconBtn = ({title, icon, disabled, loading, onClick}) =>
	button('.git-status-icon-btn', {
		attrs: {
			type: 'button',
			title,
			'aria-label': title
		},
		props: {disabled: !!disabled},
		class: {loading: !!loading},
		on: {
			click: ev => {
				ev.preventDefault();
				ev.stopPropagation();
				if (!disabled && typeof onClick === 'function') onClick();
			}
		}
	}, [i(`.fa.${icon}`)]);

const fileRow = ({entry, projectPath, letter, action, actions, key}) => {
	const abs = joinProjectPath(projectPath, entry.path);
	return li('.git-status-item', {
		key: key || entry.path,
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
	}, [].concat(
		span('.git-status-code', letter || entry.status || ' '),
		span('.git-status-path', entry.path),
		action
			? button('.git-status-row-action', {
				attrs: {
					type: 'button',
					title: action.title,
					'aria-label': action.title
				},
				props: {disabled: !!action.disabled},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						if (!action.disabled && typeof action.onClick === 'function') {
							action.onClick();
						}
					}
				}
			}, [i(`.fa.${action.icon}`)])
			: []
	));
};

const changesList = ({
	title,
	files,
	projectPath,
	loading,
	emptyLabel,
	headerAction,
	rowAction,
	actions,
	busy,
	keyPrefix
}) =>
	div('.git-status-section', [
		div('.git-status-section-head', [].concat(
			span('.git-status-section-title',
				files.length ? `${title} (${files.length})` : title),
			headerAction && files.length
				? iconBtn({
					title: headerAction.title,
					icon: headerAction.icon,
					disabled: busy || headerAction.disabled,
					onClick: headerAction.onClick
				})
				: []
		)),
		files.length
			? ul('.git-status-list', files.map(entry =>
				fileRow({
					entry,
					projectPath,
					letter: entry.status,
					key: `${keyPrefix || 'f'}:${entry.path}`,
					action: rowAction
						? {
							title: rowAction.title,
							icon: rowAction.icon,
							disabled: busy || rowAction.disabled,
							onClick: () => rowAction.onClick(entry)
						}
						: null,
					actions
				})))
			: span('.git-status-empty',
				loading ? 'Loading…' : emptyLabel)
	]);

const commitComposer = ({git, busy, canCommit, actions}) =>
	div('.git-commit-composer', [
		textarea('.git-commit-message', {
			attrs: {
				rows: 1,
				placeholder: 'Message (Ctrl+Enter to commit)',
				'aria-label': 'Commit message'
			},
			props: {
				value: git.commitMessage || '',
				disabled: !!busy
			},
			hook: {
				insert: vnode => fitCommitMessage(vnode.elm),
				postpatch: (_old, vnode) => fitCommitMessage(vnode.elm)
			},
			on: {
				input: ev => {
					fitCommitMessage(ev.target);
					actions.git.setCommitMessage(ev.target.value);
				},
				keydown: ev => {
					if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
						ev.preventDefault();
						if (canCommit) actions.git.commit();
					}
				}
			}
		}),
		button('.git-commit-btn', {
			attrs: {type: 'button'},
			props: {disabled: !canCommit || !!busy},
			on: {
				click: ev => {
					ev.preventDefault();
					if (canCommit && !busy) actions.git.commit();
				}
			}
		}, busy === 'commit' ? '…' : 'Commit')
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
				iconBtn({
					title: 'Refresh',
					icon: 'fa-refresh',
					onClick: () => actions.git.refresh()
				})
			]),
			div('.side-bar-placeholder', [
				span('.side-bar-placeholder-body', String(git.error))
			])
		]);
	}

	const {staged, unstaged} = partitionChangeFiles(git.files || []);
	const commits = git.commits || [];
	const loading = git.loading || git.available == null;
	const busy = git.busy || null;
	const commitsOpen = obj.sub(state, ['layout', 'toggles', 'gitCommits']) !== false;
	const commitsHeight = obj.sub(state, ['layout', 'dim', 'gitCommits']) || 140;
	const message = (git.commitMessage || '').trim();
	const canCommit = staged.length > 0 && !!message;
	const syncing = busy === 'pull' || busy === 'push' || busy === 'fetch';

	return div('.git-status', [].concat(
		div('.git-status-header', [
			span('.git-status-branch', {
				attrs: {title: branchLabel(git)}
			}, [
				i('.fa.fa-code-fork'),
				span(branchLabel(git))
			]),
			div('.git-status-actions', [
				iconBtn({
					title: 'Refresh',
					icon: 'fa-refresh',
					disabled: !!git.loading && !busy,
					loading: !!git.loading && !busy,
					onClick: () => actions.git.refresh()
				}),
				iconBtn({
					title: git.behind
						? `Pull (${git.behind} behind)`
						: 'Nothing to pull',
					icon: 'fa-cloud-download',
					disabled: !!busy || !(git.behind > 0),
					loading: busy === 'pull',
					onClick: () => actions.git.pull()
				}),
				iconBtn({
					title: git.ahead
						? `Push (${git.ahead} ahead)`
						: 'Nothing to push',
					icon: 'fa-cloud-upload',
					disabled: !!busy || !(git.ahead > 0),
					loading: busy === 'push',
					onClick: () => actions.git.push()
				}),
				iconBtn({
					title: 'Fetch',
					icon: 'fa-exchange',
					disabled: !!busy,
					loading: busy === 'fetch',
					onClick: () => actions.git.fetch()
				})
			])
		]),
		git.actionError
			? (() => {
				const actionError = String(git.actionError);
				const expanded = !!git.actionErrorExpanded;
				const copyError = text => {
					if (!text) return;
					if (navigator.clipboard && navigator.clipboard.writeText) {
						navigator.clipboard.writeText(text).catch(() => {});
						return;
					}
					try {
						const ta = document.createElement('textarea');
						ta.value = text;
						document.body.appendChild(ta);
						ta.select();
						document.execCommand('copy');
						document.body.removeChild(ta);
					} catch {
						// ignore
					}
				};
				return div('.git-status-action-error', {
					class: {expanded}
				}, [
					pre('.git-status-action-error-text', {
						attrs: {title: actionError}
					}, actionError),
					div('.git-status-action-error-float.is-top', [
						button('.git-status-action-error-btn', {
							attrs: {
								type: 'button',
								title: 'Copy',
								'aria-label': 'Copy error'
							},
							on: {
								click: ev => {
									ev.preventDefault();
									ev.stopPropagation();
									copyError(actionError);
								}
							}
						}, [i('.fa.fa-clipboard')]),
						button('.git-status-action-error-btn', {
							attrs: {
								type: 'button',
								title: 'Dismiss',
								'aria-label': 'Dismiss'
							},
							on: {
								click: ev => {
									ev.preventDefault();
									ev.stopPropagation();
									actions.git.clearActionError();
								}
							}
						}, [i('.fa.fa-times')])
					]),
					div('.git-status-action-error-float.is-bottom', [
						button('.git-status-action-error-btn.is-expand', {
							attrs: {
								type: 'button',
								title: expanded ? 'Collapse' : 'Expand',
								'aria-label': expanded ? 'Collapse' : 'Expand',
								'aria-expanded': expanded ? 'true' : 'false'
							},
							on: {
								click: ev => {
									ev.preventDefault();
									ev.stopPropagation();
									actions.git.toggleActionErrorExpanded();
								}
							}
						}, [i(`.fa.${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`)])
					])
				]);
			})()
			: [],
		div('.git-status-body', [].concat(
			staged.length
				? commitComposer({git, busy, canCommit, actions})
				: [],
			div('.git-status-changes', [].concat(
				staged.length
					? changesList({
						title: 'Staged Changes',
						files: staged,
						projectPath,
						loading: false,
						emptyLabel: 'No staged changes',
						busy: !!busy,
						keyPrefix: 'staged',
						headerAction: {
							title: 'Unstage All Changes',
							icon: 'fa-minus',
							onClick: () => actions.git.unstageAll()
						},
						rowAction: {
							title: 'Unstage',
							icon: 'fa-minus',
							onClick: entry => actions.git.unstage(entry.path)
						},
						actions
					})
					: [],
				changesList({
					title: 'Changes',
					files: unstaged,
					projectPath,
					loading,
					emptyLabel: 'No changes',
					busy: !!busy,
					keyPrefix: 'changes',
					headerAction: {
						title: 'Stage All Changes',
						icon: 'fa-plus',
						onClick: () => actions.git.stageAll()
					},
					rowAction: {
						title: 'Stage',
						icon: 'fa-plus',
						disabled: false,
						onClick: entry => actions.git.stage(entry.path)
					},
					actions
				})
			)),
			sideBarPanel({
				title: 'Commits',
				open: commitsOpen,
				height: commitsHeight,
				maxHeight: 560,
				onToggle: () => actions.layout.toggle('gitCommits'),
				onResize: h => actions.layout.set({gitCommits: h}),
				children: [
					graphPanel({
						commits,
						loading: loading && !syncing,
						branch: git.branch,
						ahead: git.ahead || 0,
						behind: git.behind || 0,
						selectedHash: git.selectedHash || null,
						commitDetails: git.commitDetails || {},
						projectPath: git.projectPath || projectPath,
						actions
					})
				]
			})
		))
	));
};
