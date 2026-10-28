/**
 * Pack topo-ordered commits into lanes and drawable SVG geometry.
 * Commits: `{hash, parents: string[]}` newest-first (`git log --topo-order`).
 */

const DEFAULTS = {
	laneWidth: 12,
	rowHeight: 28,
	subjectHeight: 28,
	padX: 7,
	dotRadius: 3,
	strokeWidth: 1.5
};

const trimTrailingNull = lanes => {
	const next = lanes.slice();
	while (next.length && next[next.length - 1] == null) next.pop();
	return next;
};

const allocLane = (lanes, hash) => {
	const existing = lanes.indexOf(hash);
	if (existing !== -1) return existing;
	const empty = lanes.indexOf(null);
	if (empty !== -1) {
		lanes[empty] = hash;
		return empty;
	}
	lanes.push(hash);
	return lanes.length - 1;
};

/**
 * @param {Array<{hash: string, parents?: string[]}>} commits
 * @returns {Array<{
 *   hash: string,
 *   lane: number,
 *   mergeLanes: number[],
 *   parentLanes: number[],
 *   open: Array<string|null>,
 *   next: Array<string|null>
 * }>}
 */
export const packLanes = commits => {
	const list = Array.isArray(commits) ? commits : [];
	let open = [];
	const rows = [];

	for (let i = 0; i < list.length; i++) {
		const commit = list[i] || {};
		const hash = commit.hash;
		const parents = Array.isArray(commit.parents) ? commit.parents.filter(Boolean) : [];
		if (!hash) continue;

		let lane = open.indexOf(hash);
		const mergeLanes = [];
		if (lane === -1) {
			lane = allocLane(open, hash);
		} else {
			for (let L = 0; L < open.length; L++) {
				if (L !== lane && open[L] === hash) mergeLanes.push(L);
			}
		}

		const snapshot = open.slice();
		const next = open.slice();
		for (let m = 0; m < mergeLanes.length; m++) {
			next[mergeLanes[m]] = null;
		}

		const parentLanes = [];
		if (parents.length === 0) {
			next[lane] = null;
		} else {
			next[lane] = parents[0];
			parentLanes.push(lane);
			for (let p = 1; p < parents.length; p++) {
				const ph = parents[p];
				let pl = next.indexOf(ph);
				if (pl === -1) pl = allocLane(next, ph);
				parentLanes.push(pl);
			}
		}

		rows.push({
			hash,
			lane,
			mergeLanes,
			parentLanes,
			open: snapshot,
			next: trimTrailingNull(next)
		});
		open = trimTrailingNull(next);
	}

	return rows;
};

const laneX = (lane, {padX, laneWidth}) => padX + lane * laneWidth + laneWidth / 2;

/**
 * Build SVG path segments + dots for a packed lane graph.
 * Optional `rowHeights` (full row incl. expansion) + `subjectHeight` (dot mid on subject).
 * @param {ReturnType<typeof packLanes>} rows
 * @param {Partial<typeof DEFAULTS> & {rowHeights?: number[]}} [opts]
 */
export const buildGraphGeometry = (rows, opts = {}) => {
	const cfg = Object.assign({}, DEFAULTS, opts);
	const list = Array.isArray(rows) ? rows : [];
	const subjectH = cfg.subjectHeight || cfg.rowHeight;
	const heights = Array.isArray(cfg.rowHeights) ? cfg.rowHeights : null;

	let maxLanes = 1;
	for (let i = 0; i < list.length; i++) {
		const r = list[i];
		maxLanes = Math.max(
			maxLanes,
			(r.open && r.open.length) || 0,
			(r.next && r.next.length) || 0,
			(r.lane || 0) + 1
		);
	}

	const rowHeightAt = i => {
		if (heights && typeof heights[i] === 'number') return Math.max(heights[i], subjectH);
		return cfg.rowHeight;
	};

	const yOffsets = [];
	let acc = 0;
	for (let i = 0; i < list.length; i++) {
		yOffsets.push(acc);
		acc += rowHeightAt(i);
	}
	const totalHeight = Math.max(acc, subjectH);
	const midY = i => yOffsets[i] + subjectH / 2;

	const width = cfg.padX * 2 + maxLanes * cfg.laneWidth;
	const edges = [];
	const dots = [];

	for (let i = 0; i < list.length; i++) {
		const r = list[i];
		const cy = midY(i);
		const cx = laneX(r.lane, cfg);
		dots.push({cx, cy, hash: r.hash, lane: r.lane});

		for (let m = 0; m < (r.mergeLanes || []).length; m++) {
			const fromLane = r.mergeLanes[m];
			const x0 = laneX(fromLane, cfg);
			edges.push({
				d: `M ${x0} ${cy} L ${cx} ${cy}`,
				kind: 'merge'
			});
		}

		for (let p = 1; p < (r.parentLanes || []).length; p++) {
			const pl = r.parentLanes[p];
			if (pl === r.lane) continue;
			const x1 = laneX(pl, cfg);
			edges.push({
				d: `M ${cx} ${cy} L ${x1} ${cy}`,
				kind: 'parent'
			});
		}

		if (i >= list.length - 1) {
			if ((r.next || []).some(Boolean)) {
				const y1 = cy + subjectH * 0.35;
				edges.push({
					d: `M ${cx} ${cy} L ${cx} ${y1}`,
					kind: 'stub'
				});
			}
			continue;
		}

		const nextRow = list[i + 1];
		const y1 = midY(i + 1);
		const nextTips = r.next || [];
		for (let L = 0; L < nextTips.length; L++) {
			const tip = nextTips[L];
			if (!tip) continue;
			const x0 = laneX(L, cfg);
			let L2 = -1;
			if (nextRow.open && nextRow.open[L] === tip) {
				L2 = L;
			} else if (nextRow.open) {
				L2 = nextRow.open.indexOf(tip);
			}
			if (L2 === -1) L2 = L;
			const x1 = laneX(L2, cfg);
			if (x0 === x1) {
				edges.push({d: `M ${x0} ${cy} L ${x1} ${y1}`, kind: 'vert'});
			} else {
				const mid = (cy + y1) / 2;
				edges.push({
					d: `M ${x0} ${cy} L ${x0} ${mid} L ${x1} ${mid} L ${x1} ${y1}`,
					kind: 'fork'
				});
			}
		}
	}

	return {
		width,
		height: totalHeight,
		rowHeight: cfg.rowHeight,
		subjectHeight: subjectH,
		dotRadius: cfg.dotRadius,
		strokeWidth: cfg.strokeWidth,
		maxLanes,
		edges,
		dots
	};
};

/**
 * @param {Array<{hash: string, parents?: string[]}>} commits
 * @param {Partial<typeof DEFAULTS> & {rowHeights?: number[]}} [opts]
 */
export const layoutGitGraph = (commits, opts = {}) =>
	buildGraphGeometry(packLanes(commits), opts);

export default {
	packLanes,
	buildGraphGeometry,
	layoutGitGraph
};
