/**
 * Custom JS/TS handler for code-prettify.
 * Stock `js` cannot be overridden (registerLangHandler skips existing ids),
 * so we register `iblokz-js` and map file types to it from codebin.
 *
 * Improvements over stock:
 * - multiLineStrings (template literals / backticks)
 * - modern JS + common TS keywords (extends, super, finally, as, type, …)
 * - drops C leftovers (char, sizeof, …) that false-highlight in JS
 * - post-pass: plain/type idents followed by `(` → `.fun` (calls / methods)
 * - post-pass: destructured bindings in const/let/var / import { } / arrow params → `.var`
 */

export const LANG_ID = 'iblokz-js';
export const STYLE_FUN = 'fun';
export const STYLE_VAR = 'var';

const STYLE_PLAIN = 'pln';
const STYLE_TYPE = 'typ';

export const KEYWORDS = [
	'break,continue,do,else,for,if,return,while,switch,case,default',
	'const,let,var,function,class,extends,super,static,constructor',
	'async,await,yield,new,delete,typeof,instanceof,void,in,of',
	'import,export,from,as,default',
	'try,catch,finally,throw',
	'true,false,null,undefined,Infinity,NaN',
	'this,debugger,with,eval',
	'get,set',
	// TypeScript-oriented (same lexer; best-effort)
	'type,interface,implements,enum,namespace,module,declare,readonly',
	'keyof,infer,asserts,satisfies,override,abstract',
	'private,protected,public'
].join(',');

/** Exts we treat as JS/TS in codebin → LANG_ID. */
export const JS_FAMILY = new Set([
	'js', 'mjs', 'cjs', 'jsx',
	'ts', 'tsx', 'mts', 'cts',
	'javascript', 'typescript'
]);

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const DECL_KW = new Set(['const', 'let', 'var']);
const IS_WS = c => c === ' ' || c === '\t' || c === '\n' || c === '\r';

const skipWs = (src, j, len) => {
	while (j < len && IS_WS(src[j])) j += 1;
	return j;
};

/** Balanced `{…}` or `[…]` starting at `openIdx` (must be { or [). Returns end index after closer, or -1. */
const scanBalanced = (src, openIdx) => {
	const open = src[openIdx];
	const close = open === '{' ? '}' : open === '[' ? ']' : null;
	if (!close) return -1;
	let depth = 0;
	for (let j = openIdx; j < src.length; j += 1) {
		const c = src[j];
		// crude string skip so braces in strings don't count
		if (c === '"' || c === "'" || c === '`') {
			const q = c;
			j += 1;
			while (j < src.length) {
				if (src[j] === '\\') {
					j += 2;
					continue;
				}
				if (src[j] === q) break;
				if (q === '`' && src[j] === '$' && src[j + 1] === '{') {
					// template interpolation — skip until matching }
					j += 2;
					let d = 1;
					while (j < src.length && d > 0) {
						if (src[j] === '{') d += 1;
						else if (src[j] === '}') d -= 1;
						j += 1;
					}
					j -= 1;
					continue;
				}
				j += 1;
			}
			continue;
		}
		if (c === open) depth += 1;
		else if (c === close) {
			depth -= 1;
			if (depth === 0) return j + 1;
		}
	}
	return -1;
};

/**
 * Collect [start, end) ranges (source-relative) of destructuring patterns.
 * - const/let/var {…}|[…] before assignment `=`
 * - import {…}
 * - arrow params: ({…}) =>  /  ([…]) =>
 */
export const collectDestructureRanges = (src) => {
	const ranges = [];
	const len = src.length;
	let i = 0;
	while (i < len) {
		if (!/[A-Za-z_$]/.test(src[i])) {
			i += 1;
			continue;
		}
		let k = i + 1;
		while (k < len && /[\w$]/.test(src[k])) k += 1;
		const word = src.slice(i, k);

		if (DECL_KW.has(word)) {
			let j = skipWs(src, k, len);
			if (src[j] === '{' || src[j] === '[') {
				const end = scanBalanced(src, j);
				if (end > j) ranges.push([j, end]);
			}
			i = k;
			continue;
		}

		if (word === 'import') {
			let j = skipWs(src, k, len);
			// import type { … } / import { … }
			if (src.slice(j, j + 4) === 'type' && /\W/.test(src[j + 4] || ' ')) {
				j = skipWs(src, j + 4, len);
			}
			if (src[j] === '{') {
				const end = scanBalanced(src, j);
				if (end > j) ranges.push([j, end]);
			}
			i = k;
			continue;
		}

		i = k;
	}

	// Arrow param destructuring: ) => with a { or [ pattern in the preceding (...)
	for (let p = 0; p < len - 1; p += 1) {
		if (src[p] !== '=' || src[p + 1] !== '>') continue;
		let r = p - 1;
		while (r >= 0 && IS_WS(src[r])) r -= 1;
		if (r < 0 || src[r] !== ')') continue;
		let depth = 0;
		let L = r;
		for (; L >= 0; L -= 1) {
			const c = src[L];
			if (c === ')') depth += 1;
			else if (c === '(') {
				depth -= 1;
				if (depth === 0) break;
			}
		}
		if (L < 0) continue;
		let j = skipWs(src, L + 1, len);
		if (src[j] === '{' || src[j] === '[') {
			const end = scanBalanced(src, j);
			if (end > j && end <= r) ranges.push([j, end]);
		}
	}

	return ranges;
};

const spanInRanges = (start, end, ranges) => {
	for (let i = 0; i < ranges.length; i += 1) {
		const a = ranges[i][0];
		const b = ranges[i][1];
		if (start >= a && end <= b) return true;
	}
	return false;
};

/**
 * Reclassify `.pln` / `.typ` spans that are call callees: `foo(`, `Foo(`, `foo?.(`.
 * Operates on prettify's decorations array: [pos, style, pos, style, …].
 */
export const markCallIdents = (job) => {
	const src = job && job.sourceCode;
	const d = job && job.decorations;
	if (!src || !d || d.length < 2) return;

	const basePos = job.basePos || 0;
	const srcLen = src.length;

	for (let i = 0; i < d.length; i += 2) {
		const style = d[i + 1];
		if (style !== STYLE_PLAIN && style !== STYLE_TYPE) continue;

		const absStart = d[i];
		const absEnd = i + 2 < d.length ? d[i + 2] : basePos + srcLen;
		const start = absStart - basePos;
		const end = absEnd - basePos;
		if (start < 0 || end > srcLen || start >= end) continue;

		const ident = src.slice(start, end);
		if (!IDENT_RE.test(ident)) continue;

		let j = end;
		while (j < srcLen && IS_WS(src[j])) j += 1;
		// Optional chaining / TS non-null before call: foo?.( / foo!(
		if (src[j] === '!' && src[j + 1] !== '=') j += 1;
		if (src[j] === '?' && src[j + 1] === '.') j += 2;
		while (j < srcLen && IS_WS(src[j])) j += 1;
		if (src[j] === '(') d[i + 1] = STYLE_FUN;
	}
};

/**
 * Reclassify `.pln` idents inside destructuring patterns as `.var`.
 * Runs after markCallIdents so call names already marked `.fun` are left alone.
 */
export const markDestructuredBindings = (job) => {
	const src = job && job.sourceCode;
	const d = job && job.decorations;
	if (!src || !d || d.length < 2) return;

	const ranges = collectDestructureRanges(src);
	if (!ranges.length) return;

	const basePos = job.basePos || 0;
	const srcLen = src.length;

	for (let i = 0; i < d.length; i += 2) {
		if (d[i + 1] !== STYLE_PLAIN) continue;

		const absStart = d[i];
		const absEnd = i + 2 < d.length ? d[i + 2] : basePos + srcLen;
		const start = absStart - basePos;
		const end = absEnd - basePos;
		if (start < 0 || end > srcLen || start >= end) continue;

		const ident = src.slice(start, end);
		if (!IDENT_RE.test(ident)) continue;
		if (spanInRanges(start, end, ranges)) d[i + 1] = STYLE_VAR;
	}
};

export const withCallMarks = decorate => job => {
	decorate(job);
	markCallIdents(job);
	markDestructuredBindings(job);
};

export const register = () => {
	const PR = typeof window !== 'undefined' ? window.PR : null;
	if (!PR || typeof PR.registerLangHandler !== 'function' || typeof PR.sourceDecorator !== 'function') {
		return false;
	}
	const base = PR.sourceDecorator({
		keywords: KEYWORDS,
		cStyleComments: true,
		multiLineStrings: true,
		regexLiterals: true
	});
	PR.registerLangHandler(withCallMarks(base), [LANG_ID]);
	return true;
};

export default {
	LANG_ID,
	JS_FAMILY,
	KEYWORDS,
	STYLE_FUN,
	STYLE_VAR,
	markCallIdents,
	markDestructuredBindings,
	collectDestructureRanges,
	withCallMarks,
	register
};
