/**
 * Display URLs for binary previews (PDF).
 * Chromium’s PDF viewer is unreliable with large `data:` URLs — use `blob:`
 * with an explicit `application/pdf` type.
 */

/** Revoke blob: URLs (no-op for data: / http). */
export const revokeDisplayUrl = url => {
	if (!url || String(url).indexOf('blob:') !== 0) return;
	try {
		URL.revokeObjectURL(url);
	} catch (_err) {
		/* ignore */
	}
};

/**
 * Normalize a data:/blob: URL to a blob: URL typed as application/pdf.
 * Revokes the input blob: URL when a new one is created.
 */
export const asPdfDisplayUrl = async url => {
	const raw = String(url || '');
	if (!raw) return '';
	if (raw.indexOf('blob:') !== 0 && raw.indexOf('data:') !== 0) return raw;
	try {
		const res = await fetch(raw);
		const buf = await res.arrayBuffer();
		const displayUrl = URL.createObjectURL(
			new Blob([buf], {type: 'application/pdf'})
		);
		if (raw.indexOf('blob:') === 0 && displayUrl !== raw) {
			revokeDisplayUrl(raw);
		}
		return displayUrl;
	} catch (err) {
		console.error('asPdfDisplayUrl failed', err);
		return raw;
	}
};

export default {asPdfDisplayUrl, revokeDisplayUrl};
