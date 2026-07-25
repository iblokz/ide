'use strict';

const STORAGE_KEY = 'iblokz-ide-recent-roots';
const MAX_RECENT = 8;

const sanitizeEntry = entry => {
	if (!entry || typeof entry !== 'object') return null;
	const name = entry.name || entry.path;
	if (!name || typeof name !== 'string') return null;
	return {
		id: entry.id || name,
		name,
		path: entry.path || name
	};
};

const loadRecent = () => {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const list = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(list)) return [];
		return list.map(sanitizeEntry).filter(Boolean);
	} catch (_) {
		return [];
	}
};

const saveRecent = list => {
	const clean = list.map(sanitizeEntry).filter(Boolean).slice(0, MAX_RECENT);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
};

const pushRecent = (entry, list = loadRecent()) => {
	const clean = sanitizeEntry(entry);
	if (!clean) return list;
	const next = [
		clean,
		...list.filter(item => item.id !== clean.id)
	].slice(0, MAX_RECENT);
	saveRecent(next);
	return next;
};

module.exports = {
	STORAGE_KEY,
	loadRecent,
	saveRecent,
	pushRecent,
	sanitizeEntry
};
