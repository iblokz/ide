'use strict';

// dom
const {section, img} = require('iblokz-snabbdom-helpers');

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const wheelHandler = ev => {
	ev.preventDefault();
	const el = ev.currentTarget;
	const zoom = Number(el.style.getPropertyValue('--img-zoom')) || 1;
	const offset = {
		x: Number(el.style.getPropertyValue('--img-offset-x')),
		y: Number(el.style.getPropertyValue('--img-offset-y'))
	};
	if (!Number.isFinite(offset.x)) offset.x = -50;
	if (!Number.isFinite(offset.y)) offset.y = -50;

	let newZoom = zoom;
	const newOffset = Object.assign({}, offset);

	if (ev.ctrlKey) {
		newZoom = clamp(zoom - (ev.deltaY / 500), 1, 5);
	} else {
		newOffset.x -= (ev.shiftKey ? ev.deltaY : ev.deltaX) / (newZoom * 20);
		newOffset.y -= (!ev.shiftKey ? ev.deltaY : ev.deltaX) / (newZoom * 20);
	}

	const max = -50 + ((newZoom - 1) * 50);
	const min = -50 - ((newZoom - 1) * 50);
	newOffset.x = clamp(newOffset.x, min, max);
	newOffset.y = clamp(newOffset.y, min, max);

	el.style.setProperty('--img-zoom', String(newZoom));
	el.style.setProperty('--img-offset-x', String(newOffset.x));
	el.style.setProperty('--img-offset-y', String(newOffset.y));
};

module.exports = ({file}) => section('.image-viewer', {
	key: (file && (file.url || file.path || file.id)) || 'image',
	hook: {
		insert: vnode => {
			const el = vnode.elm;
			el.style.setProperty('--img-zoom', '1');
			el.style.setProperty('--img-offset-x', '-50');
			el.style.setProperty('--img-offset-y', '-50');
		}
	},
	on: {
		wheel: wheelHandler
	}
}, [
	img({
		props: {
			src: (file && file.url) || '',
			alt: (file && file.name) || 'image',
			draggable: false
		}
	})
]);
