/**
 * IDE workspace: editor column | preview column (always mounted for open/close anim).
 */
import {section} from 'iblokz-snabbdom-helpers';
import {clamp} from '../../util/split-drag.js';
import splitGutter from '../comp/split-gutter.js';
import editorColumn from './editor/index.js';
import previewColumn from './preview/index.js';

const gutter = splitGutter.default ?? splitGutter;

const pct = n => `${Math.round(n * 1000) / 10}%`;

export default ({state, actions}) => {
	const toggles = state.layout.toggles || {};
	const dim = state.layout.dim || {};
	const showPreview = !!toggles.preview;
	const showConsole = !!toggles.previewConsole;
	const previewOpen = showPreview || showConsole;
	const editorShare = dim.editor != null ? dim.editor : 0.5;
	const editorBasis = previewOpen ? pct(editorShare) : '100%';
	const previewBasis = previewOpen ? pct(1 - editorShare) : '0%';

	return section('.workspace', [
		editorColumn({
			state,
			actions,
			flexGrow: 0,
			flexShrink: 0,
			flexBasis: editorBasis
		}),
		gutter({
			axis: 'x',
			hidden: !previewOpen,
			onStart: () => {
				const ws = document.querySelector('.workspace');
				const ed = document.querySelector('.workspace > .editor');
				const prev = document.querySelector('.workspace > .preview');
				const binW = ws ? ws.getBoundingClientRect().width : 1;
				const startPct = ed
					? ed.getBoundingClientRect().width / binW
					: editorShare;
				return {ws, editor: ed, preview: prev, binW, startPct};
			},
			onMove: (delta, ev, ctx) => {
				if (!ctx || !ctx.editor || !ctx.binW) return;
				const next = clamp(ctx.startPct + (delta / ctx.binW), 0.2, 0.8);
				ctx.editor.style.flexBasis = pct(next);
				if (ctx.preview) ctx.preview.style.flexBasis = pct(1 - next);
				ctx.pending = next;
			},
			onEnd: (delta, ev, ctx) => {
				const next = clamp(
					(ctx && ctx.pending != null)
						? ctx.pending
						: (ctx.startPct + (delta / (ctx.binW || 1))),
					0.2,
					0.8
				);
				if (ctx && ctx.editor) ctx.editor.style.flexBasis = pct(next);
				if (ctx && ctx.preview) ctx.preview.style.flexBasis = pct(1 - next);
				actions.layout.set({editor: next});
			}
		}),
		previewColumn({
			state,
			actions,
			open: previewOpen,
			flexGrow: 0,
			flexShrink: 0,
			flexBasis: previewBasis
		})
	]);
};
