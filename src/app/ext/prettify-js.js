'use strict';

/**
 * Custom JS/TS handler for code-prettify.
 * Stock `js` cannot be overridden (registerLangHandler skips existing ids),
 * so we register `iblokz-js` and map file types to it from codebin.
 *
 * Improvements over stock:
 * - multiLineStrings (template literals / backticks)
 * - modern JS + common TS keywords (extends, super, finally, as, type, …)
 * - drops C leftovers (char, sizeof, …) that false-highlight in JS
 */

const LANG_ID = 'iblokz-js';

const KEYWORDS = [
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
const JS_FAMILY = new Set([
	'js', 'mjs', 'cjs', 'jsx',
	'ts', 'tsx', 'mts', 'cts',
	'javascript', 'typescript'
]);

const register = () => {
	const PR = typeof window !== 'undefined' ? window.PR : null;
	if (!PR || typeof PR.registerLangHandler !== 'function' || typeof PR.sourceDecorator !== 'function') {
		return false;
	}
	PR.registerLangHandler(
		PR.sourceDecorator({
			keywords: KEYWORDS,
			cStyleComments: true,
			multiLineStrings: true,
			regexLiterals: true
		}),
		[LANG_ID]
	);
	return true;
};

module.exports = {
	LANG_ID,
	JS_FAMILY,
	KEYWORDS,
	register
};
