/**
 * code-prettify helpers shared by the editor (and any consumer that needs
 * source ↔ highlighted HTML).
 */
import prettify from 'code-prettify';
import 'code-prettify/src/lang-css.js';
import 'code-prettify/src/lang-yaml.js';
import prettifyJsMod from '../../ext/prettify-js.js';
import prettifyJsonMod from '../../ext/prettify-json.js';

const prettifyJs = prettifyJsMod.default ?? prettifyJsMod;
const prettifyJson = prettifyJsonMod.default ?? prettifyJsonMod;
prettifyJs.register();
prettifyJson.register();

const PRETTIFY_LANG = {
	htm: 'html',
	svg: 'xml',
	yml: 'yaml',
	sass: 'css',
	scss: 'css',
	less: 'css',
	vue: 'html',
	svelte: 'html'
};

export const unprettify = html => {
	const tDiv = document.createElement('div');
	tDiv.innerHTML = html;
	const lis = tDiv.querySelectorAll('li');
	if (lis.length) {
		return Array.from(lis)
			.map(li => {
				const raw = li.textContent || '';
				if (!raw || raw === '\xA0' || raw === '\u00a0') return '';
				return raw.replace(/\u00a0/g, ' ');
			})
			.join('\n');
	}
	return (tDiv.textContent || '')
		.replace(/\u00a0/g, ' ');
};

/** Replace code-prettify's \\xA0 empty-line pad with <br> so col stays 0-only. */
export const clearEmptyLinePads = html => {
	const wrap = document.createElement('div');
	wrap.innerHTML = html;
	Array.from(wrap.querySelectorAll('li')).forEach(li => {
		const raw = li.textContent || '';
		if (!raw || raw === '\xA0' || raw === '\u00a0') {
			li.innerHTML = '<br>';
		}
	});
	return wrap.innerHTML;
};

export const escapeHtml = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

export const prettifyLang = type => {
	const key = type || 'js';
	if (prettifyJs.JS_FAMILY.has(key) || key === prettifyJs.LANG_ID) {
		return prettifyJs.LANG_ID;
	}
	if (prettifyJson.JSON_FAMILY.has(key) || key === prettifyJson.LANG_ID) {
		return prettifyJson.LANG_ID;
	}
	return PRETTIFY_LANG[key] || key;
};

/**
 * code-prettify numberLines() drops a single trailing \\n, so "hello\\n"
 * renders as one line. Pad so EOF Enter can create a visible blank line.
 */
export const prettifySource = (source, type) => {
	const src = source || '';
	const padded = src.endsWith('\n') ? `${src}\n` : src;
	return clearEmptyLinePads(prettify.prettyPrintOne(escapeHtml(padded), prettifyLang(type), true));
};

export {prettify, prettifyJson};
