/**
 * Fetch + parse `git show --numstat` for a single commit (hover / expand).
 */

const isCommitHash = hash =>
	typeof hash === 'string' && /^[0-9a-f]{4,40}$/i.test(hash);

/**
 * @param {string} stdout
 * @returns {{
 *   fullHash: string,
 *   hash: string,
 *   author: string,
 *   email: string,
 *   date: string,
 *   subject: string,
 *   body: string,
 *   files: Array<{path: string, additions: number|null, deletions: number|null}>,
 *   insertions: number,
 *   deletions: number
 * }|null}
 */
export const parseCommitDetail = stdout => {
	const raw = String(stdout || '');
	if (!raw.trim()) return null;

	// Header ends at the second NUL after `%s%x00%b%x00`; numstat follows.
	const firstNul = raw.indexOf('\0');
	if (firstNul < 0) return null;
	const header = raw.slice(0, firstNul);
	const secondNul = raw.indexOf('\0', firstNul + 1);
	const body = secondNul < 0
		? raw.slice(firstNul + 1).replace(/\nnumstat[\s\S]*$/i, '').trim()
		: raw.slice(firstNul + 1, secondNul).trim();
	const rest = secondNul < 0 ? '' : raw.slice(secondNul + 1);

	const parts = header.split('\t');
	if (parts.length < 6) return null;
	const fullHash = (parts[0] || '').trim();
	const hash = (parts[1] || '').trim() || fullHash.slice(0, 7);
	const author = (parts[2] || '').trim();
	const email = (parts[3] || '').trim();
	const date = (parts[4] || '').trim();
	const subject = parts.slice(5).join('\t').trim() || '(no subject)';

	const files = [];
	let insertions = 0;
	let deletions = 0;
	const lines = rest.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// numstat: additions \t deletions \t path (binary: - \t - \t path)
		const m = /^([0-9]+|-)\t([0-9]+|-)\t(.+)$/.exec(line);
		if (!m) continue;
		const add = m[1] === '-' ? null : parseInt(m[1], 10);
		const del = m[2] === '-' ? null : parseInt(m[2], 10);
		const path = m[3];
		if (typeof add === 'number') insertions += add;
		if (typeof del === 'number') deletions += del;
		files.push({path, additions: add, deletions: del});
	}

	return {
		fullHash,
		hash,
		author,
		email,
		date,
		subject,
		body,
		files,
		insertions,
		deletions
	};
};

/**
 * @param {string} projectPath
 * @param {string} hash
 */
export const fetchCommitDetail = async (projectPath, hash) => {
	const bridge = typeof window !== 'undefined' ? window.app : null;
	if (!bridge || typeof bridge.gitCommitDetail !== 'function') {
		return {ok: false, error: 'Commit detail requires the desktop app', detail: null};
	}
	if (!projectPath) {
		return {ok: false, error: 'No project open', detail: null};
	}
	if (!isCommitHash(hash)) {
		return {ok: false, error: 'Invalid commit', detail: null};
	}
	try {
		const result = await bridge.gitCommitDetail(projectPath, hash);
		if (!result || !result.ok) {
			return {
				ok: false,
				error: (result && result.error) || 'git show failed',
				detail: null
			};
		}
		const detail = parseCommitDetail(result.stdout);
		if (!detail) {
			return {ok: false, error: 'Could not parse commit', detail: null};
		}
		return {ok: true, error: null, detail};
	} catch (err) {
		return {
			ok: false,
			error: (err && err.message) || 'git show failed',
			detail: null
		};
	}
};

export default {
	parseCommitDetail,
	fetchCommitDetail
};
