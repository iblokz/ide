/**
 * Shared helpers for code-prettify language handlers (JS, JSON, …).
 * Post-passes walk the decorations array: [pos, style, pos, style, …].
 */

export const IS_WS = c => c === ' ' || c === '\t' || c === '\n' || c === '\r';

export const skipWs = (src, j, len = src.length) => {
	while (j < len && IS_WS(src[j])) j += 1;
	return j;
};

/** Absolute PR (browser). */
export const getPR = () => (typeof window !== 'undefined' ? window.PR : null);

/**
 * Run base decorator, then each post-pass on the same job.
 * @param {(job: object) => void} decorate
 * @param {...(job: object) => void} passes
 */
export const withPostPasses = (decorate, ...passes) => job => {
	decorate(job);
	for (let i = 0; i < passes.length; i += 1) passes[i](job);
};

/**
 * Register a lang handler: sourceDecorator(options) + optional post-passes.
 * @returns {boolean} whether registration succeeded
 */
export const registerLang = (langId, options, postPasses = []) => {
	const PR = getPR();
	if (!PR || typeof PR.registerLangHandler !== 'function' || typeof PR.sourceDecorator !== 'function') {
		return false;
	}
	const base = PR.sourceDecorator(options);
	const handler = postPasses.length
		? withPostPasses(base, ...postPasses)
		: base;
	PR.registerLangHandler(handler, Array.isArray(langId) ? langId : [langId]);
	return true;
};

/**
 * Iterate decoration spans with source-relative [start, end).
 * fn({ i, style, start, end }) — mutate job.decorations[i + 1] to reclassify.
 */
export const forEachSpan = (job, fn) => {
	const src = job && job.sourceCode;
	const d = job && job.decorations;
	if (!src || !d || d.length < 2) return;

	const basePos = job.basePos || 0;
	const srcLen = src.length;

	for (let i = 0; i < d.length; i += 2) {
		const absStart = d[i];
		const absEnd = i + 2 < d.length ? d[i + 2] : basePos + srcLen;
		const start = absStart - basePos;
		const end = absEnd - basePos;
		if (start < 0 || end > srcLen || start >= end) continue;
		fn({i, style: d[i + 1], start, end, decorations: d, source: src, srcLen});
	}
};
