/**
 * Custom JSON handler for code-prettify.
 * Stock `json` cannot be overridden (registerLangHandler skips existing ids),
 * so we register `iblokz-json` and map file types to it from codebin.
 *
 * Improvement over stock: object keys (".str" before ":") → `.atn`.
 */

import {registerLang, skipWs, forEachSpan} from './prettify-util';

export const LANG_ID = 'iblokz-json';
export const STYLE_STR = 'str';
export const STYLE_KEY = 'atn';

/** Exts we treat as JSON in codebin → LANG_ID. */
export const JSON_FAMILY = new Set(['json', 'jsonc', 'json5']);

/**
 * Reclassify `.str` spans that are object keys: `"key"` followed by `:`.
 */
export const markJsonKeys = (job) => {
	forEachSpan(job, ({i, style, start, end, decorations, source, srcLen}) => {
		if (style !== STYLE_STR) return;
		// JSON strings are double-quoted
		if (source[start] !== '"') return;
		const j = skipWs(source, end, srcLen);
		if (source[j] === ':') decorations[i + 1] = STYLE_KEY;
	});
};

export const register = () => registerLang(
	LANG_ID,
	{keywords: 'null,true,false'},
	[markJsonKeys]
);

export default {
	LANG_ID,
	JSON_FAMILY,
	STYLE_STR,
	STYLE_KEY,
	markJsonKeys,
	register
};
