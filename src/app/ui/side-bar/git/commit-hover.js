/**
 * Floating commit hover card (body portal — avoids sidebar overflow clipping).
 * Show/hide are delayed and animated; no app-state updates.
 * Right-click pins the card so the Electron context menu can copy selected text.
 */
import {
	peekCommitDetail,
	prefetchCommitDetail
} from '../../../util/git-commit-cache.js';

const CARD_ID = 'iblokz-git-commit-hover';
const SHOW_DELAY_MS = 320;
/** Long enough to move from the commit row into the card across the gap. */
const HIDE_DELAY_MS = 360;

let showTimer = null;
let hideTimer = null;
let activeHash = null;
let activeModel = null;
let cardBound = false;
/** Stay visible while native context menu is used for copy. */
let pinnedByMenu = false;
let outsidePointerBound = false;

const el = (tag, className, text) => {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text != null) node.textContent = String(text);
	return node;
};

const formatDate = iso => {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return String(iso);
		return d.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} catch {
		return String(iso);
	}
};

const pinForMenu = () => {
	pinnedByMenu = true;
	clearHideTimer();
	bindOutsidePointer();
};

const bindOutsidePointer = () => {
	if (outsidePointerBound || typeof document === 'undefined') return;
	outsidePointerBound = true;
	document.addEventListener('pointerdown', onOutsidePointerDown, true);
};

const unbindOutsidePointer = () => {
	if (!outsidePointerBound || typeof document === 'undefined') return;
	outsidePointerBound = false;
	document.removeEventListener('pointerdown', onOutsidePointerDown, true);
};

const onOutsidePointerDown = ev => {
	if (!pinnedByMenu) return;
	const card = document.getElementById(CARD_ID);
	if (card && ev.target && card.contains(ev.target)) return;
	// Native menu click lands outside the card — unpin after a tick so Copy can run.
	pinnedByMenu = false;
	unbindOutsidePointer();
	scheduleHideCommitHover();
};

const ensureCard = () => {
	let node = document.getElementById(CARD_ID);
	if (!node) {
		node = el('div', 'git-commit-hover-card');
		node.id = CARD_ID;
		node.setAttribute('role', 'dialog');
		document.body.appendChild(node);
	}
	if (!cardBound) {
		cardBound = true;
		node.addEventListener('mouseenter', () => {
			clearHideTimer();
		});
		node.addEventListener('mouseleave', () => {
			// Context menu steals hover — keep card up while pinned.
			if (pinnedByMenu) return;
			scheduleHideCommitHover();
		});
		// mousedown button 2 fires before menu-driven mouseleave
		node.addEventListener('mousedown', ev => {
			if (ev.button === 2) pinForMenu();
		});
		node.addEventListener('contextmenu', () => {
			pinForMenu();
		});
	}
	return node;
};

const positionCard = (card, anchorRect) => {
	if (!anchorRect) return;
	const margin = 8;
	const gap = 10;
	const cw = card.offsetWidth || 280;
	const ch = card.offsetHeight || 160;
	let left = anchorRect.right + gap;
	let top = anchorRect.top + anchorRect.height / 2 - ch / 2;
	if (left + cw > window.innerWidth - margin) {
		left = Math.max(margin, anchorRect.left - cw - gap);
	}
	top = Math.max(margin, Math.min(top, window.innerHeight - ch - margin));
	card.style.left = `${Math.round(left)}px`;
	card.style.top = `${Math.round(top)}px`;
};

const renderCard = model => {
	if (typeof document === 'undefined' || !model || !model.anchorRect) return;
	const card = ensureCard();
	const commit = model.commit || {};
	const detail = model.detail;
	const chips = Array.isArray(model.chips) ? model.chips : [];

	card.replaceChildren();

	const head = el('div', 'git-commit-hover-head');
	head.appendChild(el('span', 'git-commit-hover-hash',
		(detail && detail.fullHash) || commit.hash || ''));
	card.appendChild(head);

	if (chips.length) {
		const refs = el('div', 'git-commit-hover-refs');
		for (let i = 0; i < chips.length; i++) {
			const chip = chips[i];
			const node = el('span', `git-log-ref is-${chip.kind}${chip.current ? ' is-current' : ''}`,
				chip.label);
			refs.appendChild(node);
		}
		card.appendChild(refs);
	}

	const subject = (detail && detail.subject) || commit.subject || '';
	card.appendChild(el('div', 'git-commit-hover-subject', subject));

	const body = detail && detail.body;
	if (body) {
		card.appendChild(el('div', 'git-commit-hover-body', body));
	}

	const meta = el('div', 'git-commit-hover-meta');
	const author = (detail && detail.author) || commit.author || '';
	const date = formatDate((detail && detail.date) || commit.date || '');
	if (author) meta.appendChild(el('span', 'git-commit-hover-author', author));
	if (date) meta.appendChild(el('span', 'git-commit-hover-date', date));
	if (meta.childNodes.length) card.appendChild(meta);

	const stats = el('div', 'git-commit-hover-stats');
	if (model.loading && !detail) {
		stats.appendChild(el('span', 'git-commit-hover-loading', 'Loading changes…'));
	} else if (detail) {
		const fileCount = (detail.files || []).length;
		stats.appendChild(el('span', 'git-commit-hover-files',
			`${fileCount} file${fileCount === 1 ? '' : 's'}`));
		stats.appendChild(el('span', 'git-commit-hover-ins', `+${detail.insertions || 0}`));
		stats.appendChild(el('span', 'git-commit-hover-del', `−${detail.deletions || 0}`));
	}
	if (stats.childNodes.length) card.appendChild(stats);

	if (detail && detail.files && detail.files.length) {
		const list = el('ul', 'git-commit-hover-files-list');
		const max = Math.min(detail.files.length, 8);
		for (let i = 0; i < max; i++) {
			const f = detail.files[i];
			const li = el('li', 'git-commit-hover-file');
			li.appendChild(el('span', 'git-commit-hover-file-path', f.path));
			const ch = el('span', 'git-commit-hover-file-chg');
			if (f.additions == null && f.deletions == null) {
				ch.textContent = 'bin';
			} else {
				ch.appendChild(el('span', 'ins', `+${f.additions || 0}`));
				ch.appendChild(document.createTextNode(' '));
				ch.appendChild(el('span', 'del', `−${f.deletions || 0}`));
			}
			li.appendChild(ch);
			list.appendChild(li);
		}
		if (detail.files.length > max) {
			list.appendChild(el('li', 'git-commit-hover-more',
				`+${detail.files.length - max} more`));
		}
		card.appendChild(list);
	}

	card.classList.add('is-visible');
	positionCard(card, model.anchorRect);
	requestAnimationFrame(() => positionCard(card, model.anchorRect));
};

const clearShowTimer = () => {
	if (showTimer) {
		clearTimeout(showTimer);
		showTimer = null;
	}
};

const clearHideTimer = () => {
	if (hideTimer) {
		clearTimeout(hideTimer);
		hideTimer = null;
	}
};

const openWithModel = model => {
	activeHash = model.commit && model.commit.hash;
	activeModel = model;
	renderCard(model);

	const projectPath = model.projectPath;
	const hash = activeHash;
	if (!projectPath || !hash) return;

	prefetchCommitDetail(projectPath, hash, entry => {
		if (activeHash !== hash || !activeModel) return;
		activeModel = Object.assign({}, activeModel, {
			detail: entry.detail,
			loading: !!entry.loading
		});
		if (activeModel.anchorEl) {
			activeModel.anchorRect = activeModel.anchorEl.getBoundingClientRect();
		}
		renderCard(activeModel);
	});
};

/**
 * Schedule fade-in hover card (delayed). Prefetches detail without app state.
 * @param {{
 *   anchorEl: Element,
 *   commit: object,
 *   chips: Array,
 *   projectPath: string|null,
 *   detail?: object|null
 * }} opts
 */
export const scheduleCommitHover = opts => {
	if (typeof document === 'undefined' || !opts || !opts.anchorEl || !opts.commit) return;
	clearHideTimer();

	const hash = opts.commit.hash;
	const cached = peekCommitDetail(opts.projectPath, hash);
	const stateDetail = opts.detail || null;
	const model = {
		anchorEl: opts.anchorEl,
		anchorRect: opts.anchorEl.getBoundingClientRect(),
		commit: opts.commit,
		chips: opts.chips || [],
		projectPath: opts.projectPath || null,
		detail: stateDetail || (cached && cached.detail) || null,
		loading: !!(cached && cached.loading && !(cached && cached.detail))
	};

	// Already showing this commit — refresh position/content immediately.
	if (activeHash === hash) {
		clearShowTimer();
		openWithModel(model);
		return;
	}

	pinnedByMenu = false;
	clearShowTimer();
	showTimer = setTimeout(() => {
		showTimer = null;
		openWithModel(model);
	}, SHOW_DELAY_MS);

	// Warm cache during the delay so the card often opens complete.
	if (opts.projectPath && hash) {
		prefetchCommitDetail(opts.projectPath, hash);
	}
};

/** Schedule fade-out (short delay so moving between rows can cancel). */
export const scheduleHideCommitHover = () => {
	if (pinnedByMenu) return;
	clearShowTimer();
	clearHideTimer();
	hideTimer = setTimeout(() => {
		hideTimer = null;
		if (pinnedByMenu) return;
		hideCommitHover();
	}, HIDE_DELAY_MS);
};

export const hideCommitHover = () => {
	clearShowTimer();
	clearHideTimer();
	pinnedByMenu = false;
	unbindOutsidePointer();
	activeHash = null;
	activeModel = null;
	if (typeof document === 'undefined') return;
	const card = document.getElementById(CARD_ID);
	if (!card) return;
	card.classList.remove('is-visible');
};

/** @deprecated use scheduleCommitHover */
export const showCommitHover = model => {
	if (!model) return;
	openWithModel(Object.assign({}, model, {
		anchorEl: model.anchorEl || null
	}));
};

export default {
	scheduleCommitHover,
	scheduleHideCommitHover,
	hideCommitHover,
	showCommitHover
};
