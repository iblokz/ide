/**
 * Commits graph panel: SVG lanes, subject + branch/tag badges,
 * select-to-expand, delayed hover card (no hover state → no preview flicker).
 */
import {div, span, ul, li, h} from 'iblokz-snabbdom-helpers';
import {layoutGitGraph} from '../../../util/git-graph-layout.js';
import {prioritizeRefs, rowRefChips} from '../../../util/git-status.js';
import {
	scheduleCommitHover,
	scheduleHideCommitHover,
	hideCommitHover
} from './commit-hover.js';

/** Match subject row; keep in sync with `.git-log-row` height. */
const SUBJECT_H = 28;
const FILE_ROW_H = 18;
const EXPAND_PAD = 28;

const expandHeight = (entry, selected) => {
	if (!selected) return 0;
	const files = (entry && entry.files) || [];
	if (entry && entry.loading && !files.length) return EXPAND_PAD + FILE_ROW_H;
	if (entry && entry.error && !files.length) return EXPAND_PAD;
	const n = Math.min(files.length, 24);
	return EXPAND_PAD + Math.max(n, 0) * FILE_ROW_H;
};

const graphSvg = (geometry, headHashes, selectedHash) => {
	if (!geometry || !geometry.dots || !geometry.dots.length) return [];
	const {width, height, edges, dots, dotRadius, strokeWidth} = geometry;
	const heads = headHashes || new Set();
	return [h('svg.git-log-graph-svg', {
		attrs: {
			width,
			height,
			viewBox: `0 0 ${width} ${height}`,
			'aria-hidden': 'true'
		}
	}, [].concat(
		(edges || []).map((edge, i) =>
			h('path', {
				key: `e${i}`,
				class: {
					'git-log-edge': true,
					[`is-${edge.kind || 'vert'}`]: true
				},
				attrs: {
					d: edge.d,
					fill: 'none',
					'stroke-width': strokeWidth,
					'stroke-linecap': 'round',
					'stroke-linejoin': 'round'
				}
			})
		),
		dots.map(dot => {
			const isHead = heads.has(dot.hash);
			const isSelected = selectedHash && dot.hash === selectedHash;
			return h('circle', {
				key: `d${dot.hash}`,
				class: {
					'git-log-dot': true,
					'is-head': isHead,
					'is-selected': !!isSelected
				},
				attrs: {
					cx: dot.cx,
					cy: dot.cy,
					r: isHead || isSelected ? dotRadius + 0.75 : dotRadius
				}
			});
		})
	))];
};

const refChips = chips =>
	span('.git-log-refs', chips.map(chip =>
		span('.git-log-ref', {
			class: {
				[`is-${chip.kind}`]: true,
				'is-current': !!chip.current
			},
			attrs: {title: chip.raw || chip.label}
		}, [chip.display || chip.label || ''])
	));

const expandChg = f => {
	if (f.additions == null && f.deletions == null) {
		return [span('.bin', ['bin'])];
	}
	return [
		span('.ins', [`+${f.additions || 0}`]),
		span('.del', [`−${f.deletions || 0}`])
	];
};

const expandBlock = detailState => {
	if (!detailState) {
		return div('.git-log-expand', [
			span('.git-log-expand-empty', ['Loading…'])
		]);
	}
	if (detailState.loading && !(detailState.detail && detailState.detail.files)) {
		return div('.git-log-expand', [
			span('.git-log-expand-empty', ['Loading…'])
		]);
	}
	if (detailState.error && !detailState.detail) {
		return div('.git-log-expand', [
			span('.git-log-expand-empty', [String(detailState.error)])
		]);
	}
	const detail = detailState.detail || {};
	const files = detail.files || [];
	return div('.git-log-expand', [].concat(
		[div('.git-log-expand-summary', [
			span('.git-log-expand-files',
				[`${files.length} file${files.length === 1 ? '' : 's'}`]),
			span('.git-log-expand-ins', [`+${detail.insertions || 0}`]),
			span('.git-log-expand-del', [`−${detail.deletions || 0}`])
		])],
		files.length
			? [ul('.git-log-expand-list', files.slice(0, 24).map(f =>
				li('.git-log-expand-file', [
					span('.git-log-expand-path', [f.path]),
					span('.git-log-expand-chg', expandChg(f))
				])
			))]
			: [span('.git-log-expand-empty', ['No file changes'])]
	));
};

export default ({
	commits,
	loading,
	branch,
	selectedHash,
	commitDetails,
	projectPath,
	actions
}) => {
	const list = Array.isArray(commits) ? commits : [];
	if (!list.length) {
		hideCommitHover();
		return span('.git-status-empty',
			[loading ? 'Loading…' : 'No commits']);
	}

	const details = commitDetails || {};
	const headHashes = new Set();
	const rows = list.map(entry => {
		const hoverChips = prioritizeRefs(entry.refs, branch);
		const chips = rowRefChips(entry.refs, branch);
		const isHead = hoverChips.some(c => c.kind === 'head');
		const isCurrent = isHead || hoverChips.some(c => c.current);
		const selected = selectedHash === entry.hash;
		const detailState = details[entry.hash] || null;
		const detail = detailState && detailState.detail;
		if (isHead) headHashes.add(entry.hash);
		return {
			entry,
			chips,
			hoverChips,
			isHead,
			isCurrent,
			selected,
			detailState,
			rowHeight: SUBJECT_H + expandHeight(
				detail
					? {files: detail.files, loading: false}
					: {
						files: [],
						loading: !!(detailState && detailState.loading),
						error: detailState && detailState.error
					},
				selected
			)
		};
	});

	const rowHeights = rows.map(r => r.rowHeight);
	const geometry = layoutGitGraph(list, {
		rowHeight: SUBJECT_H,
		subjectHeight: SUBJECT_H,
		rowHeights
	});
	const gutterWidth = Math.max(geometry.width, 16);

	return div('.git-log-graph', {
		hook: {
			destroy: () => hideCommitHover()
		}
	}, [
		div('.git-log-graph-gutter', {
			style: {width: `${gutterWidth}px`}
		}, graphSvg(geometry, headHashes, selectedHash)),
		ul('.git-log-list', rows.map(({
			entry, chips, hoverChips, isHead, isCurrent, selected, detailState, rowHeight
		}) =>
			li('.git-log-item', {
				class: {
					'is-head': isHead,
					'is-current': isCurrent,
					'is-selected': selected
				},
				attrs: {'data-hash': entry.hash},
				style: {minHeight: `${rowHeight}px`}
			}, [].concat(
				[div('.git-log-row', {
					attrs: {
						role: 'button',
						tabindex: '0'
					},
					on: {
						click: ev => {
							ev.preventDefault();
							actions.git.selectCommit(entry.hash);
						},
						keydown: ev => {
							if (ev.key === 'Enter' || ev.key === ' ') {
								ev.preventDefault();
								actions.git.selectCommit(entry.hash);
							}
						},
						mouseenter: ev => {
							const detailStateNow = details[entry.hash] || null;
							scheduleCommitHover({
								anchorEl: ev.currentTarget,
								commit: entry,
								chips: hoverChips,
								projectPath: projectPath || null,
								detail: detailStateNow && detailStateNow.detail
							});
						},
						mouseleave: () => {
							scheduleHideCommitHover();
						}
					}
				}, [].concat(
					[span('.git-log-subject', [entry.subject || '(no subject)'])],
					chips.length ? [refChips(chips)] : []
				))],
				selected ? [expandBlock(detailState)] : []
			))
		))
	]);
};
