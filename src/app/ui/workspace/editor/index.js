/**
 * Workspace editor column: toolbox (find/save) + single surface or stack.
 */
import {section, header, span, button, i, p} from 'iblokz-snabbdom-helpers';
import {clamp} from '../../../util/split-drag.js';
import splitGutter from '../../comp/split-gutter.js';
import {editor} from '../../codebin/index.js';
import imageViewer from '../../image-viewer.js';
import findBar from '../../comp/find-bar.js';
import {canSave, saveHint} from '../../../util/save.js';
import {triggerSave} from '../../../util/trigger-save.js';

const gutter = splitGutter.default ?? splitGutter;

const MIN_PANE_PX = 72;

/**
 * Flex-grow weights for expanded panes.
 * After a gutter drag we store pixel heights — new tabs must inherit the
 * average of those, not `1`, or they collapse to a sliver / get clipped.
 */
const stackWeights = (tabs, collapsedIds, stored) => {
	const expanded = (tabs || []).filter(t => collapsedIds.indexOf(t.id) < 0);
	const known = expanded
		.map(t => (stored && stored[t.id]))
		.filter(w => typeof w === 'number' && w > 0);
	const avg = known.length
		? known.reduce((sum, w) => sum + w, 0) / known.length
		: 1;
	return expanded.reduce((acc, t) => {
		const w = stored && stored[t.id];
		acc[t.id] = typeof w === 'number' && w > 0 ? w : avg;
		return acc;
	}, {});
};

const escapeAttr = value => {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
		return CSS.escape(value);
	}
	return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

/** Find + save chrome for the focused text editor (column or active stack pane). */
const toolbox = ({state, actions}) => {
	if (!(state.file && state.file.name) || state.type === 'image' || state.type === 'pdf') {
		return null;
	}
	return section('.editor-toolbox', [
		findBar({state, actions}),
		button('.save-file', {
			attrs: {
				'aria-label': 'Save file',
				title: state.saveError || saveHint(state),
				type: 'button'
			},
			props: {
				disabled: !canSave(state)
			},
			on: {
				click: ev => {
					ev.preventDefault();
					triggerSave({state, actions});
				}
			}
		}, [i('.fa.fa-save')])
	]);
};

const textSurface = ({tab, state, actions}) => {
	const projectPath = state.project && state.project.path;
	const filePath = tab.file && tab.file.path;
	const gitOff = state.git && state.git.available === false;
	return editor({
		source: tab.source || '',
		pos: tab.pos,
		scroll: tab.scroll || {top: 0, left: 0},
		tabId: tab.id,
		type: tab.type || 'js',
		indent: tab.indent,
		gitContext: !gitOff && projectPath && filePath
			? {
				projectPath,
				filePath,
				stamp: (state.git && state.git.stamp) || 0
			}
			: null,
		change: (source, pos) => actions.editor.updateSource(source, pos, tab.id),
		updatePos: pos => actions.editor.updatePos(pos, tab.id),
		updateScroll: (scroll, tabId) => actions.editor.updateScroll(scroll, tabId),
		undo: () => {
			actions.setActiveTab(tab.id);
			actions.editor.undo();
		},
		redo: () => {
			actions.setActiveTab(tab.id);
			actions.editor.redo();
		}
	});
};

const surfaceForTab = ({tab, state, actions}) => {
	if (!(tab.file && tab.file.name)) {
		return section('.empty-editor', [
			p(['Select a file from the sidebar to open it.'])
		]);
	}
	if (tab.type === 'image') {
		return imageViewer({file: tab.file});
	}
	if (tab.type === 'pdf') {
		return section('.empty-editor', [
			p(['PDF opens in the preview pane.'])
		]);
	}
	return textSurface({tab, state, actions});
};

/** Single-surface mode: project active tab fields onto the column. */
const surface = ({state, actions}) => {
	if (!(state.file && state.file.name)) {
		return section('.empty-editor', [
			p(['Select a file from the sidebar to open it.'])
		]);
	}
	const tab = {
		id: state.activeTabId,
		file: state.file,
		source: state.source,
		type: state.type,
		indent: state.indent,
		pos: state.pos,
		scroll: state.scroll
	};
	return surfaceForTab({tab, state, actions});
};

const paneLabel = tab => {
	const name = (tab.file && tab.file.name) || 'untitled';
	return tab.dirty ? `${name} •` : name;
};

const stackPane = ({tab, state, actions, collapsed, weight}) => {
	const active = tab.id === state.activeTabId;
	const title = (tab.file && (tab.file.path || tab.file.name)) || tab.id;
	return section(`.editor-pane${active ? '.is-active' : ''}${collapsed ? '.is-collapsed' : ''}`, {
		attrs: {'data-tab-id': tab.id},
		style: collapsed
			? {flex: '0 0 auto'}
			: {flex: `${weight} 1 0`, minHeight: MIN_PANE_PX},
		on: {
			mousedown: () => {
				if (state.activeTabId !== tab.id) actions.setActiveTab(tab.id);
			}
		}
	}, [].concat(
		header('.editor-pane-header', {
			attrs: {title},
			on: {
				click: ev => {
					if (ev.target.closest && ev.target.closest('.editor-pane-close')) return;
					if (ev.target.closest && ev.target.closest('.editor-pane-toggle')) return;
					actions.setActiveTab(tab.id);
				},
				dblclick: ev => {
					ev.preventDefault();
					actions.layout.toggleEditorCollapsed(tab.id);
				}
			}
		}, [
			button('.editor-pane-toggle', {
				attrs: {
					type: 'button',
					title: collapsed ? 'Expand' : 'Collapse',
					'aria-label': collapsed ? 'Expand pane' : 'Collapse pane',
					'aria-expanded': collapsed ? 'false' : 'true'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						actions.layout.toggleEditorCollapsed(tab.id);
					}
				}
			}, [i(`.fa.${collapsed ? 'fa-caret-right' : 'fa-caret-down'}`)]),
			span('.editor-pane-label', [paneLabel(tab)]),
			button('.editor-pane-close', {
				attrs: {
					type: 'button',
					title: 'Close',
					'aria-label': `Close ${tab.file && tab.file.name || 'tab'}`
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						if (tab.dirty) {
							const ok = window.confirm(
								`Discard unsaved changes to ${tab.file && tab.file.name}?`
							);
							if (!ok) return;
						}
						actions.closeTab(tab.id);
					}
				}
			}, [i('.fa.fa-times')])
		]),
		collapsed
			? []
			: section('.editor-pane-body', [].concat(
				active ? (toolbox({state, actions}) || []) : [],
				surfaceForTab({tab, state, actions})
			))
	));
};

const stackGutter = ({aboveId, belowId, actions}) => gutter({
	axis: 'y',
	onStart: () => {
		const stackEl = document.querySelector('.editor-stack');
		const above = stackEl
			&& stackEl.querySelector(`.editor-pane[data-tab-id="${escapeAttr(aboveId)}"]`);
		const below = stackEl
			&& stackEl.querySelector(`.editor-pane[data-tab-id="${escapeAttr(belowId)}"]`);
		const aboveH = above ? above.getBoundingClientRect().height : 0;
		const belowH = below ? below.getBoundingClientRect().height : 0;
		return {
			stackEl,
			above,
			below,
			aboveH,
			belowH,
			pairH: aboveH + belowH
		};
	},
	onMove: (delta, ev, ctx) => {
		if (!ctx || !ctx.above || !ctx.below || !ctx.pairH) return;
		const nextAbove = clamp(ctx.aboveH + delta, MIN_PANE_PX, ctx.pairH - MIN_PANE_PX);
		const nextBelow = ctx.pairH - nextAbove;
		ctx.above.style.flex = `0 0 ${nextAbove}px`;
		ctx.below.style.flex = `0 0 ${nextBelow}px`;
		ctx.pendingAbove = nextAbove;
		ctx.pendingBelow = nextBelow;
	},
	onEnd: (delta, ev, ctx) => {
		if (!ctx || !ctx.stackEl) return;
		const nextAbove = ctx.pendingAbove != null
			? ctx.pendingAbove
			: clamp(ctx.aboveH + delta, MIN_PANE_PX, (ctx.pairH || 0) - MIN_PANE_PX);
		const nextBelow = ctx.pendingBelow != null
			? ctx.pendingBelow
			: (ctx.pairH || 0) - nextAbove;
		if (ctx.above) ctx.above.style.flex = `0 0 ${nextAbove}px`;
		if (ctx.below) ctx.below.style.flex = `0 0 ${nextBelow}px`;

		const panes = Array.from(
			ctx.stackEl.querySelectorAll('.editor-pane:not(.is-collapsed)[data-tab-id]')
		);
		const shares = {};
		panes.forEach(el => {
			const id = el.getAttribute('data-tab-id');
			if (!id) return;
			shares[id] = el.getBoundingClientRect().height || 1;
		});
		if (Object.keys(shares).length) {
			actions.layout.set({editorStack: shares});
		}
	}
});

const stack = ({state, actions}) => {
	const tabs = state.tabs || [];
	if (!tabs.length) {
		return section('.empty-editor', [
			p(['Select a file from the sidebar to open it.'])
		]);
	}
	const collapsedIds = (state.layout && state.layout.editorCollapsed) || [];
	const dim = (state.layout && state.layout.dim) || {};
	const weights = stackWeights(tabs, collapsedIds, dim.editorStack);
	const nodes = [];
	tabs.forEach((tab, i) => {
		const collapsed = collapsedIds.indexOf(tab.id) >= 0;
		nodes.push(stackPane({
			tab,
			state,
			actions,
			collapsed,
			weight: collapsed ? 0 : (weights[tab.id] || 1)
		}));
		if (collapsed) return;
		// Gutter under this expanded pane when another expanded pane exists below
		// (adjacent, or after a mid-stack collapsed group).
		let belowId = null;
		for (let j = i + 1; j < tabs.length; j++) {
			if (collapsedIds.indexOf(tabs[j].id) < 0) {
				belowId = tabs[j].id;
				break;
			}
		}
		if (belowId) {
			nodes.push(stackGutter({
				aboveId: tab.id,
				belowId,
				actions
			}));
		}
	});
	return section('.editor-stack', nodes);
};

export default ({state, actions, flex = '1 1 auto', flexGrow, flexShrink, flexBasis}) => {
	const arrangement = (state.layout && state.layout.editorArrangement) === 'stack'
		? 'stack'
		: 'tabs';
	return section(`.editor${arrangement === 'stack' ? '.editor--stack' : ''}`, {
		style: flexGrow != null
			? {flexGrow, flexShrink: flexShrink != null ? flexShrink : 0, flexBasis: flexBasis || 'auto'}
			: {flex}
	}, [].concat(
		arrangement === 'stack' ? [] : (toolbox({state, actions}) || []),
		arrangement === 'stack'
			? stack({state, actions})
			: surface({state, actions})
	));
};
