'use strict';

const {h} = require('iblokz-snabbdom-helpers');

/** Animated hamburger ↔ X (classic iblokz/ide). */
module.exports = ({
	state = 0,
	stroke = 'currentColor',
	strokeWidth = '3px',
	size = 22
} = {}) => h('svg', {
	attrs: {
		width: size,
		height: size,
		viewBox: '0 0 64 64',
		'aria-hidden': 'true'
	}
}, [
	h('g', [
		h('path', {
			attrs: {
				fill: 'none',
				stroke,
				'stroke-width': strokeWidth,
				'stroke-linejoin': 'bevel',
				d: state === 0
					? 'm 5.0916789,20.818994 53.8166421,0'
					: 'M 12.972944,50.936147 51.027056,12.882035'
			}
		}),
		h('path', {
			attrs: {
				fill: 'none',
				stroke,
				'stroke-width': state === 0 ? strokeWidth : '0px',
				'stroke-linejoin': 'bevel',
				d: 'm 5.1969746,31.909063 53.8166424,0'
			}
		}),
		h('path', {
			attrs: {
				fill: 'none',
				stroke,
				'stroke-width': strokeWidth,
				'stroke-linejoin': 'bevel',
				d: state === 0
					? 'm 5.0916788,42.95698 53.8166422,0'
					: 'M 12.972944,12.882035 51.027056,50.936147'
			}
		})
	])
]);
