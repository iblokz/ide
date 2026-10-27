/**
 * Collapsible + vertically resizable bottom panel (VS Code-style view).
 * Chevron on the left of the header toggles collapse; gutter above resizes height.
 */
import {div, span, button, i} from 'iblokz-snabbdom-helpers';
import {clamp} from '../../util/split-drag.js';
import splitGutter from '../comp/split-gutter.js';

const gutter = splitGutter.default ?? splitGutter;

const DEFAULT_MIN = 72;
const DEFAULT_MAX = 320;

/**
 * @param {{
 *   title: string,
 *   open: boolean,
 *   height: number,
 *   onToggle: function,
 *   onResize: function,
 *   minHeight?: number,
 *   maxHeight?: number,
 *   children: *
 * }} props
 */
export default ({
	title,
	open,
	height,
	onToggle,
	onResize,
	minHeight = DEFAULT_MIN,
	maxHeight = DEFAULT_MAX,
	children
}) => {
	const h = Math.round(clamp(
		typeof height === 'number' ? height : 120,
		minHeight,
		maxHeight
	));
	const panelKey = String(title || 'panel');

	return [].concat(
		open
			? gutter({
				axis: 'y',
				onStart: () => ({start: h}),
				onMove: (delta, _ev, ctx) => {
					const el = document.querySelector(
						`.side-bar-panel-body[data-panel="${panelKey}"]`
					);
					if (!el) return;
					const next = clamp((ctx && ctx.start || h) - delta, minHeight, maxHeight);
					el.style.height = `${next}px`;
					el.style.flexBasis = `${next}px`;
					ctx.pending = next;
				},
				onEnd: (delta, _ev, ctx) => {
					const next = typeof ctx.pending === 'number'
						? ctx.pending
						: clamp((ctx && ctx.start || h) - delta, minHeight, maxHeight);
					if (typeof onResize === 'function') onResize(next);
				}
			})
			: [],
		div('.side-bar-panel', {
			class: {collapsed: !open}
		}, [].concat(
			div('.side-bar-panel-header', {
				on: {
					click: ev => {
						ev.preventDefault();
						if (typeof onToggle === 'function') onToggle();
					}
				}
			}, [
				button('.side-bar-panel-toggle', {
					attrs: {
						type: 'button',
						title: open ? 'Collapse' : 'Expand',
						'aria-label': open ? 'Collapse' : 'Expand',
						'aria-expanded': open ? 'true' : 'false'
					},
					on: {
						click: ev => {
							ev.preventDefault();
							ev.stopPropagation();
							if (typeof onToggle === 'function') onToggle();
						}
					}
				}, [i(`.fa.${open ? 'fa-chevron-down' : 'fa-chevron-right'}`)]),
				span('.side-bar-panel-title', title)
			]),
			open
				? div('.side-bar-panel-body', {
					attrs: {'data-panel': panelKey},
					style: {
						height: `${h}px`,
						flexBasis: `${h}px`
					}
				}, [].concat(children || []))
				: []
		))
	);
};
