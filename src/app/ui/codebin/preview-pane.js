/**
 * Preview column body: iframe + optional nested console.
 * Owns the run hook so editor stays free of sandbox DOM.
 */
import {section} from 'iblokz-snabbdom-helpers';
import {clamp} from '../../util/split-drag.js';
import splitGutter from '../comp/split-gutter.js';
import previewFrame from './preview.js';
import consoleView from './console.js';
import {runPreview} from './vm.js';

const gutterMod = splitGutter.default ?? splitGutter;

let runSub = null;

const stopRun = () => {
	if (runSub) {
		runSub.unsubscribe();
		runSub = null;
	}
};

const startRun = (elm, source, type) => {
	stopRun();
	const iframe = elm.querySelector('iframe.sandbox');
	const consoleEl = elm.querySelector('code.console');
	if (!iframe) return;
	try {
		runSub = runPreview({iframe, consoleEl, type, source});
	} catch (err) {
		console.warn('[codebin/preview-pane] run failed', err);
	}
};

export default ({
	source,
	type,
	showPreview = true,
	showConsole = false,
	dim = {},
	setLayout = () => {}
}) => {
	const previewPct = Math.round(((dim.preview != null ? dim.preview : 0.5) * 1000)) / 10;
	const iframeFlex = showConsole && showPreview
		? `0 0 ${previewPct}%`
		: '1 1 auto';

	return section('.preview-body', {
		hook: {
			insert: ({elm}) => {
				startRun(elm, source || '', type);
			},
			update: (oldVnode, vnode) => {
				const elm = vnode.elm;
				const prev = oldVnode.data && oldVnode.data.dataset
					? oldVnode.data.dataset.source
					: null;
				const next = source || '';
				const prevType = oldVnode.data && oldVnode.data.dataset
					? oldVnode.data.dataset.type
					: null;
				if (prev === next && prevType === (type || '')) return;
				startRun(elm, next, type);
			},
			destroy: () => stopRun()
		},
		dataset: {
			source: source || '',
			type: type || ''
		}
	}, [
		previewFrame({
			hidden: !showPreview,
			flex: iframeFlex
		}),
		gutterMod({
			axis: 'y',
			hidden: !(showConsole && showPreview),
			onStart: () => {
				const out = document.querySelector('.preview-body');
				const iframe = document.querySelector('.preview-body iframe.sandbox');
				const outH = out ? out.getBoundingClientRect().height : 1;
				const startPct = iframe
					? iframe.getBoundingClientRect().height / outH
					: (dim.preview != null ? dim.preview : 0.5);
				return {out, iframe, outH, startPct};
			},
			onMove: (delta, ev, ctx) => {
				if (!ctx || !ctx.iframe || !ctx.outH) return;
				const next = clamp(ctx.startPct + (delta / ctx.outH), 0.2, 0.8);
				ctx.iframe.style.flex = `0 0 ${next * 100}%`;
				ctx.pending = next;
			},
			onEnd: (delta, ev, ctx) => {
				const next = clamp(
					(ctx && ctx.pending != null)
						? ctx.pending
						: (ctx.startPct + (delta / (ctx.outH || 1))),
					0.2,
					0.8
				);
				if (ctx && ctx.iframe) ctx.iframe.style.flex = `0 0 ${next * 100}%`;
				setLayout({preview: next});
			}
		}),
		consoleView({
			hidden: !showConsole,
			flex: '1 1 auto'
		})
	].filter(Boolean));
};
