/**
 * All-in-one codebin compose (slides / demos): editor | preview[+console].
 * IDE prefers picking editor + preview-pane separately under workspace.
 */
import {span} from 'iblokz-snabbdom-helpers';
import {clamp} from '../../util/split-drag.js';
import splitGutter from '../comp/split-gutter.js';
import editor from './editor.js';
import previewPane from './preview-pane.js';

const gutter = splitGutter.default ?? splitGutter;

export default ({
	source,
	pos,
	type,
	scroll,
	tabId = null,
	layout = {},
	setLayout = () => {},
	change = () => {},
	updateScroll = () => {},
	undo = () => {},
	redo = () => {}
}) => {
	const toggles = layout.toggles || {};
	const dim = layout.dim || {};
	const showPreview = !!toggles.preview;
	const showConsole = !!toggles.previewConsole;
	const editorOnly = !showPreview && !showConsole;
	const consoleOnly = showConsole && !showPreview;
	const editorPct = Math.round(((dim.editor != null ? dim.editor : 0.5) * 1000)) / 10;
	const editorFlex = editorOnly
		? '1 1 auto'
		: `0 0 ${editorPct}%`;

	return span('.codebin.embed', [
		span('.codebin-editor', {
			style: {flex: editorFlex, minWidth: 0, minHeight: 0, display: 'flex'}
		}, [
			editor({
				source,
				pos,
				type,
				scroll,
				tabId,
				change,
				updateScroll,
				undo,
				redo
			})
		]),
		gutter({
			axis: consoleOnly ? 'y' : 'x',
			hidden: editorOnly,
			onStart: () => {
				const bin = document.querySelector('.codebin.embed');
				const ed = bin && bin.querySelector('.codebin-editor');
				if (consoleOnly) {
					const binH = bin ? bin.getBoundingClientRect().height : 1;
					const startPct = ed
						? ed.getBoundingClientRect().height / binH
						: (dim.editor != null ? dim.editor : 0.5);
					return {bin, editor: ed, binH, startPct, vertical: true};
				}
				const binW = bin ? bin.getBoundingClientRect().width : 1;
				const startPct = ed
					? ed.getBoundingClientRect().width / binW
					: (dim.editor != null ? dim.editor : 0.5);
				return {bin, editor: ed, binW, startPct, vertical: false};
			},
			onMove: (delta, ev, ctx) => {
				if (!ctx || !ctx.editor) return;
				const size = ctx.vertical ? ctx.binH : ctx.binW;
				if (!size) return;
				const next = clamp(ctx.startPct + (delta / size), 0.2, 0.8);
				ctx.editor.style.flex = `0 0 ${next * 100}%`;
				ctx.pending = next;
			},
			onEnd: (delta, ev, ctx) => {
				const size = ctx && (ctx.vertical ? ctx.binH : ctx.binW);
				const next = clamp(
					(ctx && ctx.pending != null)
						? ctx.pending
						: (ctx.startPct + (delta / (size || 1))),
					0.2,
					0.8
				);
				if (ctx && ctx.editor) ctx.editor.style.flex = `0 0 ${next * 100}%`;
				setLayout({editor: next});
			}
		}),
		editorOnly
			? null
			: span('.codebin-preview', {
				style: {flex: '1 1 auto', minWidth: 0, minHeight: 0, display: 'flex'}
			}, [
				previewPane({
					source,
					type,
					showPreview,
					showConsole,
					dim,
					setLayout
				})
			])
	].filter(v => v != null));
};
