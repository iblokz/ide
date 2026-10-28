/**
 * Module-level commit detail cache — hover can prefetch without app-state churn
 * (avoids re-rendering markdown preview on every commit mouseenter).
 */
import {fetchCommitDetail} from './git-commit-detail.js';

/** @type {Map<string, {loading: boolean, error: string|null, detail: object|null, waiters: Function[]}>} */
const cache = new Map();

const keyOf = (projectPath, hash) => `${projectPath || ''}::${hash || ''}`;

export const peekCommitDetail = (projectPath, hash) => {
	if (!projectPath || !hash) return null;
	return cache.get(keyOf(projectPath, hash)) || null;
};

/**
 * @param {string} projectPath
 * @param {string} hash
 * @param {(entry: {loading: boolean, error: string|null, detail: object|null}) => void} [onUpdate]
 */
export const prefetchCommitDetail = (projectPath, hash, onUpdate) => {
	if (!projectPath || !hash) return;
	const key = keyOf(projectPath, hash);
	const existing = cache.get(key);
	if (existing && existing.detail) {
		if (typeof onUpdate === 'function') onUpdate(existing);
		return;
	}
	if (existing && existing.loading) {
		if (typeof onUpdate === 'function') existing.waiters.push(onUpdate);
		return;
	}
	// Failed prior attempt: drop so we can retry.
	const entry = {
		loading: true,
		error: null,
		detail: null,
		waiters: typeof onUpdate === 'function' ? [onUpdate] : []
	};
	cache.set(key, entry);
	fetchCommitDetail(projectPath, hash).then(result => {
		entry.loading = false;
		entry.error = result.ok ? null : (result.error || 'Failed');
		entry.detail = result.ok ? result.detail : null;
		const waiters = entry.waiters.slice();
		entry.waiters = [];
		for (let i = 0; i < waiters.length; i++) {
			try {
				waiters[i](entry);
			} catch {
				// ignore subscriber errors
			}
		}
	});
};

export const clearCommitDetailCache = () => {
	cache.clear();
};

export default {
	peekCommitDetail,
	prefetchCommitDetail,
	clearCommitDetailCache
};
