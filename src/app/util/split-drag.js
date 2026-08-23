'use strict';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Pointer drag for split gutters. Updates live via onMove; commit in onEnd.
 * Avoids full UI re-renders mid-drag.
 *
 * Touch-friendly: ignore non-primary mouse only; track lastDelta so
 * pointercancel (common when the WebView steals a scroll) still commits
 * what the user saw. Pair with `touch-action: none` on the gutter.
 */
const startSplitDrag = ({
	event,
	axis = 'x',
	onMove,
	onEnd
}) => {
	if (!event) return;
	// Touch/pen: button is 0 on pointerdown; only reject non-primary mouse.
	if (event.pointerType === 'mouse' && event.button !== 0) return;
	event.preventDefault();
	event.stopPropagation();

	const start = axis === 'x' ? event.clientX : event.clientY;
	let lastDelta = 0;
	const target = event.currentTarget;
	if (target && target.setPointerCapture) {
		try {
			target.setPointerCapture(event.pointerId);
		} catch (err) {
			// ignore capture failures
		}
	}

	document.body.classList.add(axis === 'x' ? 'is-resizing-x' : 'is-resizing-y');

	const onPointerMove = ev => {
		ev.preventDefault();
		const current = axis === 'x' ? ev.clientX : ev.clientY;
		lastDelta = current - start;
		onMove(lastDelta, ev);
	};

	const onPointerUp = ev => {
		document.removeEventListener('pointermove', onPointerMove);
		document.removeEventListener('pointerup', onPointerUp);
		document.removeEventListener('pointercancel', onPointerUp);
		document.body.classList.remove('is-resizing-x', 'is-resizing-y');
		if (target && target.releasePointerCapture) {
			try {
				if (target.hasPointerCapture && target.hasPointerCapture(event.pointerId)) {
					target.releasePointerCapture(event.pointerId);
				}
			} catch (err) {
				// ignore
			}
		}
		// Always commit last seen delta — pointercancel clientX/Y are often wrong.
		if (typeof onEnd === 'function') onEnd(lastDelta, ev);
	};

	document.addEventListener('pointermove', onPointerMove, {passive: false});
	document.addEventListener('pointerup', onPointerUp);
	document.addEventListener('pointercancel', onPointerUp);
};

module.exports = {
	clamp,
	startSplitDrag
};
