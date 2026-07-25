'use strict';

const {div} = require('iblokz-snabbdom-helpers');
const {startSplitDrag} = require('../../util/split-drag');

module.exports = ({
	axis = 'x',
	hidden = false,
	onStart,
	onMove,
	onEnd
}) => div(`.split-gutter.split-gutter--${axis}`, {
	class: {
		hidden: !!hidden
	},
	attrs: {
		role: 'separator',
		'aria-orientation': axis === 'x' ? 'vertical' : 'horizontal',
		title: 'Drag to resize'
	},
	on: {
		pointerdown: ev => {
			if (hidden) return;
			const ctx = typeof onStart === 'function' ? onStart(ev) : {};
			startSplitDrag({
				event: ev,
				axis,
				onMove: (delta, moveEv) => {
					if (typeof onMove === 'function') onMove(delta, moveEv, ctx);
				},
				onEnd: (delta, endEv) => {
					if (typeof onEnd === 'function') onEnd(delta, endEv, ctx);
				}
			});
		}
	}
});
