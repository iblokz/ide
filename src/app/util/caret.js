export const getParent = (el, tagName) => {
	if (!el || !el.parentNode || el.parentNode.nodeType !== 1) return null;
	return (el.parentNode.tagName === tagName)
		? el.parentNode
		: getParent(el.parentNode, tagName);
};

export const getElIndex = el => Array.from(el.parentNode.children).indexOf(el);

export const getRangePoint = (el, offset) =>
	(el.nodeType === 3 || el.childNodes.length === 0)
		? ({el, offset: (el.textContent.length < offset) ? el.textContent.length : offset})
		: Array.from(el.childNodes).reduce(
			(rp, child) => (rp.el !== el)
				? rp
				: (child.textContent.length >= rp.offset)
					? getRangePoint(child, rp.offset)
					: {el, offset: rp.offset - child.textContent.length},
			{el, offset}
		);

export const lineLen = li =>
	((li && li.textContent) || '').replace(/\u00a0/g, '').length;

export const endOfLastLine = el => {
	const lis = el.querySelectorAll('li');
	if (!lis.length) {
		return {
			start: {row: 0, col: 0},
			end: {row: 0, col: 0}
		};
	}
	const row = lis.length - 1;
	const col = lineLen(lis[row]);
	return {
		start: {row, col},
		end: {row, col}
	};
};

export const get = el => {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount < 1) {
		throw new Error('No selection');
	}
	let range = sel.getRangeAt(0);
	// start
	let startLi = (range.startContainer.tagName === 'LI')
		? range.startContainer : getParent(range.startContainer, 'LI');
	let endLi = (range.endContainer.tagName === 'LI')
		? range.endContainer : getParent(range.endContainer, 'LI');

	// At EOF / after last character, browsers often park the caret on the
	// OL/CODE instead of the last LI — treat that as end of the last line.
	if (!startLi || !endLi) {
		if (el.contains(range.startContainer) || el === range.startContainer) {
			return endOfLastLine(el);
		}
		throw new Error('Caret not inside LI');
	}

	let startColRange = document.createRange();
	startColRange.setStart(startLi, 0);
	startColRange.setEnd(range.startContainer, range.startOffset);
	let endColRange = document.createRange();
	endColRange.setStart(endLi, 0);
	endColRange.setEnd(range.endContainer, range.endOffset);

	let startCol = startColRange.toString().replace(/\u00a0/g, '').length;
	let endCol = endColRange.toString().replace(/\u00a0/g, '').length;

	// If the range claims the end of an LI but offset sits past content
	// (or on the padded \xA0), clamp to the real line length.
	startCol = Math.min(startCol, lineLen(startLi));
	endCol = Math.min(endCol, lineLen(endLi));

	return {
		start: {
			row: getElIndex(startLi),
			col: startCol
		},
		end: {
			row: getElIndex(endLi),
			col: endCol
		}
	};
};

export const rangeForPos = (el, pos) => {
	if (!pos || !pos.start || !el) return null;
	const lis = Array.from(el.querySelectorAll('li'));
	const startLi = lis[pos.start.row];
	const endLi = lis[pos.end.row] || startLi;
	if (!startLi) return null;

	const range = document.createRange();
	try {
		// Blank lines use <br> (no \xA0) — only col 0 is valid
		if (lineLen(startLi) === 0) {
			range.setStart(startLi, 0);
			range.collapse(true);
		} else {
			const startRp = getRangePoint(startLi, pos.start.col);
			const endRp = getRangePoint(endLi, (pos.end && pos.end.col) || 0);
			range.setStart(startRp.el, startRp.offset);
			range.setEnd(endRp.el, endRp.offset);
		}
	} catch (e) {
		console.log(e);
		range.selectNodeContents(startLi);
		range.collapse(true);
	}
	return range;
};

export const set = (el, pos) => {
	const range = rangeForPos(el, pos);
	if (!range) return;
	const sel = window.getSelection();
	sel.removeAllRanges();
	sel.addRange(range);
};

export const indent = (el, direction = 'right') => {
	let range = window.getSelection().getRangeAt(0);
	let startLi = (range.startContainer.tagName === 'LI')
		? range.startContainer : getParent(range.startContainer, 'LI');
	let startIndex = getElIndex(startLi);
	let endLi = (range.endContainer.tagName === 'LI')
		? range.endContainer : getParent(range.endContainer, 'LI');
	let endIndex = getElIndex(endLi);
	if (startIndex === endIndex && direction === 'right') {
		document.execCommand('insertHTML', false, '&#009');
	} else {
		Array.from(startLi.parentNode.children)
			.filter((li, i) => i >= startIndex && i <= endIndex)
			.forEach(li => {
				if (direction === 'right') {
					let tabSpan = document.createElement('span');
					tabSpan.innerHTML = '\t';
					li.prepend(tabSpan);
				} else {
					console.log(`>${li.children[0].innerHTML}<`);
					Array.from(li.children).forEach(spEl => spEl.innerHTML === '' && spEl.remove());
					li.children[0].innerHTML = li.children[0].innerHTML.replace(/^\t/, '');
				}
			});
	}
};

export default {
	get,
	rangeForPos,
	set,
	indent
};
