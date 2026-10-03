/**
 * Run source in a preview iframe and stream console lines.
 * Kept free of IDE chrome so slides / embed can reuse it.
 */
import * as Rx from 'rxjs';
import {ReplaySubject} from 'rxjs';
import * as vdom from 'iblokz-snabbdom-helpers';
import infer from 'tern/lib/infer.js';
import * as vmApi from '../../util/vm.js';
import {prettify, prettifyJson} from './prettify.js';

const $ = Rx;
const vm = vmApi;

export const cleanupCode = code => String(code || '')
	.split('\n')
	.map(s => s.trimRight())
	.map(s => s.replace(new RegExp('&nbps;', 'ig'), ''))
	.filter(s => s !== '' && s !== ' ')
	.join('\n');

export const resetIframe = iframe => {
	if (!iframe || !iframe.contentWindow || !iframe.contentWindow.document) return;
	iframe.contentWindow.document.body.innerHTML =
		'<style>* {font-size: 24px;}</style><section id="ui"></section>';
};

const sandbox = (source, iframe, context = {}, cb) => {
	let log = [];
	let err = null;
	let res = null;
	infer.parse(source);
	try {
		res = vm.runInIFrame(source, iframe, Object.assign(context, {
			console: {log: (...args) => {
				console.log(args);
				log.push(args);
			}},
			Rx,
			$,
			vdom
		}));
	} catch (e) {
		err = e;
	}
	cb({res, log, err});
};

/**
 * @returns {import('rxjs').ReplaySubject<string>} HTML log chunks
 */
export const process = (type, sourceCode, iframe) => {
	const console$ = new ReplaySubject();
	if (type === 'js') {
		sandbox(sourceCode, iframe, {}, ({log, err}) => {
			if (err) console$.next(`<p class="err">${err}</p>\n`);
			if (log) {
				log.map(l => prettify.prettyPrintOne(JSON.stringify(l), prettifyJson.LANG_ID))
					.forEach(l => console$.next(`${l}\n`));
			}
		});
	}
	return console$;
};

/**
 * Reset preview iframe + clear console, then run.
 * @param {{iframe: HTMLIFrameElement, consoleEl?: HTMLElement, type: string, source: string}} opts
 * @returns {import('rxjs').Subscription | null}
 */
export const runPreview = ({iframe, consoleEl, type, source}) => {
	if (!iframe) return null;
	resetIframe(iframe);
	if (consoleEl) consoleEl.innerHTML = '';
	const console$ = process(type, cleanupCode(source), iframe);
	return console$.subscribe(chunk => {
		if (consoleEl) consoleEl.innerHTML += chunk;
	});
};

export default {
	cleanupCode,
	resetIframe,
	process,
	runPreview
};
