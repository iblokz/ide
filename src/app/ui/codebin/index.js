'use strict';

// lib
const Rx = require('rxjs');
const {
	ReplaySubject,
	fromEvent,
	merge
} = Rx;
const {
	map,
	takeUntil,
	share,
	debounceTime,
	catchError
} = require('rxjs/operators');

const {str, obj} = require('iblokz-data');

const prettify = require('code-prettify');
// Extra handlers live in lang-*.js and register on global PR (set by the core).
require('code-prettify/src/lang-css.js');
require('code-prettify/src/lang-yaml.js');
const prettifyJs = require('../../ext/prettify-js').default ?? require('../../ext/prettify-js');
prettifyJs.register();
const vm = require('../../util/vm');
const caret = require('../../util/caret');
const {clamp} = require('../../util/split-drag');
const splitGutter = require('../comp/split-gutter');

const acorn = require('acorn');
const infer = require('tern/lib/infer.js');

// const libs = require('../../libs');

// Python
// let Sk = require('../../util/sk');
// let Sk = require('skulpt');
// let Sk = require('skulptjs');
// window.Sk = Sk;
// Sk = require('../../util/skulpt-stdin-node')(Sk);
// skulpt experiment

// console.log(Sk.builtinFiles);
// Object.keys(skulptExtensions)
// 	.forEach(ext => {
// 		const pyExt = str.fromCamelCase(ext, '_');
// 		Sk.builtin[pyExt] = skulptExtensions[ext];
// 		Sk.builtins[pyExt] = Sk.builtin[pyExt];
// 	});

// build libs as Sk modules
// Object.keys(libs)
// 	.forEach(name => pyMod.build(Sk, name, libs[name]));

const throwError = msg => {
	throw new Error(msg);
};

// const builtinRead = x => obj.sub(Sk, ['builtinFiles', 'files', x]) || throwError(`File not found: '${x}'`);

// Sk.builtin['test_func'] = function(test_arg) {
// 	console.log({test_arg});
// };
// Sk.builtins['test_func'] = Sk.builtin['test_func'];

// Java
// const javaconves6func = require('esjava');

// components
const vdom = require('iblokz-snabbdom-helpers');
const {section, button, span, code, h} = vdom;

// Playground global: RxJS namespace (replaces classic `rx` Observable ctor)
const $ = Rx;

const unprettify = html => {
	const tDiv = document.createElement('div');
	tDiv.innerHTML = html;
	const lis = tDiv.querySelectorAll('li');
	// Prefer LI text so we don't add a trailing newline per </li>
	// (that drifted row/col after Enter + re-prettify).
	if (lis.length) {
		return Array.from(lis)
			.map(li => {
				const raw = li.textContent || '';
				// Empty / br-only / leftover nbsp pads → blank line
				if (!raw || raw === '\xA0' || raw === '\u00a0') return '';
				return raw.replace(/\u00a0/g, ' ');
			})
			.join('\n');
	}
	return (tDiv.textContent || '')
		.replace(/\u00a0/g, ' ');
};

/** Replace code-prettify's \\xA0 empty-line pad with <br> so col stays 0-only. */
const clearEmptyLinePads = html => {
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

/** Escape raw source before prettyPrintOne — it injects via innerHTML
 *  (`'<pre>' + source + '</pre>'`), so unescaped SVG/HTML/XML tags become DOM. */
const escapeHtml = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

/** File ext → code-prettify lang id (core + lang-css / lang-yaml + iblokz-js). */
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

const prettifyLang = type => {
	const key = type || 'js';
	if (prettifyJs.JS_FAMILY.has(key) || key === prettifyJs.LANG_ID) {
		return prettifyJs.LANG_ID;
	}
	return PRETTIFY_LANG[key] || key;
};

/**
 * code-prettify numberLines() drops a single trailing \\n, so "hello\\n"
 * renders as one line. Pad so EOF Enter can create a visible blank line.
 * Also strip \\xA0 empty pads (those create a bogus col 1 on blank lines).
 */
const prettifySource = (source, type) => {
	const src = source || '';
	const padded = src.endsWith('\n') ? `${src}\n` : src;
	return clearEmptyLinePads(prettify.prettyPrintOne(escapeHtml(padded), prettifyLang(type), true));
};

const insertNewlineAtPos = (source, pos) => {
	const lines = String(source || '').split('\n');
	const maxRow = Math.max(0, lines.length - 1);
	const startRow = Math.max(0, Math.min(pos.start.row, maxRow));
	const endRow = Math.max(0, Math.min(pos.end.row, maxRow));

	const startLine = lines[startRow] || '';
	const endLine = lines[endRow] || '';
	const startCol = Math.max(0, Math.min(pos.start.col, startLine.length));
	const endCol = Math.max(0, Math.min(pos.end.col, endLine.length));

	const head = lines.slice(0, startRow);
	const tail = lines.slice(endRow + 1);
	const before = startLine.slice(0, startCol);
	const after = endLine.slice(endCol);
	const nextSource = [].concat(head, [before, after], tail).join('\n');
	const nextPos = {
		start: {row: startRow + 1, col: 0},
		end: {row: startRow + 1, col: 0}
	};
	return {source: nextSource, pos: nextPos};
};

// Debounced input sync must not overwrite structural edits (Enter) —
// especially right after Backspace, when state.source can still equal the
// post-Enter string while the live DOM has not been rewritten yet.
let inputSyncGen = 0;

const sandbox = (source, iframe, context = {}, cb) => {
	let log = [];
	let err = null;
	let res = null;
	const ast = infer.parse(source);
	// const inf = infer.analyze(ast);
	// log.push(ast);
	// log.push(inf);
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

const cleanupCode = code => code
	.split('\n')
	.map(s => s.trimRight())
	.map(s => s.replace(new RegExp('&nbps;', 'ig'), ''))
	.filter(s => s !== '' && s !== ' ')
	.join('\n');

const removeChildren = (el, selector = '*') => Array.from(el.querySelectorAll(selector)).forEach(child => {
	el.removeChild(child);
});

	// clear and prep output and console
const prepOutput = parentNode => {
	removeChildren(parentNode, 'iframe');
	let iframe = document.createElement('IFRAME');
	iframe.className = 'sandbox';
	// Keep split gutters after the preview: insert as first child
	parentNode.insertBefore(iframe, parentNode.firstChild);
	iframe.contentWindow.document.body.innerHTML =
		'<style>* {font-size: 24px;}</style><section id="ui"></section>';
	parentNode.querySelector('.console').innerHTML = '';
	return iframe;
};

const process = (type, sourceCode, iframe) => {
	const console$ = new ReplaySubject();
	if (type === 'js') {
		sandbox(sourceCode, iframe, {}, ({res, log, err}) => {
			if (err) console$.next(`<p class="err">${err}</p>\n`);
			if (log) log.map(l => prettify.prettyPrintOne(JSON.stringify(l), 'json'))
				.forEach(l => console$.next(`${l}\n`));
		});
	}
	return console$;
};

// ui
module.exports = ({
	source, pos, type,
	layout = {},
	setLayout = () => {},
	change = code => {},
	updatePos = pos => {},
	undo = () => {},
	redo = () => {}
}) => {
	const toggles = layout.toggles || {};
	const dim = layout.dim || {};
	const showPreview = !!toggles.preview;
	const showConsole = !!toggles.previewConsole;
	const editorOnly = !showPreview && !showConsole;
	const consoleOnly = showConsole && !showPreview;
	const panes = editorOnly
		? 'editor'
		: consoleOnly
			? 'console'
			: showPreview && !showConsole
				? 'preview'
				: 'full';
	const editorPct = Math.round(((dim.editor != null ? dim.editor : 0.5) * 1000)) / 10;
	const previewPct = Math.round(((dim.preview != null ? dim.preview : 0.5) * 1000)) / 10;
	// Horizontal modes: editor width. Console mode: editor height within the column.
	const editorFlex = editorOnly
		? '1 1 auto'
		: `0 0 ${editorPct}%`;
	const iframeFlex = showConsole && showPreview
		? `0 0 ${previewPct}%`
		: '1 1 auto';

	return span(`.codebin.panes-${panes}`, [
		code(`.source[type="${type}"][contenteditable="true"][spellcheck="false"]`, {
			style: {
				flex: editorFlex
			},
			attrs: {
				spellcheck: 'false',
				autocorrect: 'off',
				autocapitalize: 'off',
				autocomplete: 'off'
			},
			props: {
				spellcheck: false
			},
			hook: {
				insert: ({elm}) => {
					elm.spellcheck = false;
					elm.innerHTML = prettifySource(source || '', type);
					caret.set(elm, pos);
				},
				update: (oldVnode, vnode) => {
					const elm = vnode.elm;
					elm.spellcheck = false;
					const prev = oldVnode.data && oldVnode.data.dataset
						? oldVnode.data.dataset.source
						: null;
					const next = source || '';
					// Only rewrite + restore caret when source changed.
					// Always calling caret.set fights live typing / Enter.
					if (prev === next) return;
					elm.innerHTML = prettifySource(next, type);
					caret.set(elm, pos);
				}
			},
			dataset: {
				source: source || ''
			},
			on: {
				keydown: ev => {
					if (ev.key === 'Tab') {
						ev.preventDefault();
						inputSyncGen += 1;
						caret.indent(ev.target, ev.shiftKey === true ? 'left' : 'right');
						ev.target.dispatchEvent(new Event('input'));
					} else if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
						// Avoid contenteditable's unpredictable Enter (breaks LI structure /
						// caret.get). Insert newline via source+pos and re-render.
						ev.preventDefault();
						inputSyncGen += 1;
						try {
							const el = ev.target;
							const curSource = unprettify(el.innerHTML) || source || '';
							let cur;
							try {
								cur = caret.get(el);
							} catch (err) {
								// EOF caret often isn't inside an LI — append after last line
								const lines = curSource.split('\n');
								const row = Math.max(0, lines.length - 1);
								const col = (lines[row] || '').length;
								cur = {
									start: {row, col},
									end: {row, col}
								};
							}
							const next = insertNewlineAtPos(curSource, cur);
							// Apply DOM immediately: after Backspace, state may already
							// equal next.source (stale trailing \\n), so the snabbdom
							// update hook would skip and Enter would look like a no-op.
							el.innerHTML = prettifySource(next.source, type);
							caret.set(el, next.pos);
							change(next.source, next.pos);
						} catch (err) {
							console.warn('[codebin] Enter failed', err);
						}
					} else if (ev.key === 'z' && ev.ctrlKey) {
						undo();
					} else if (ev.key === 'y' && ev.ctrlKey) {
						redo();
					}
				},
				focus: ({target}) => [fromEvent(target, 'input')
					.pipe(
						map(ev => ({el: ev.target, gen: inputSyncGen})),
						takeUntil(fromEvent(target, 'blur')),
						share()
					)
				].map(inputs$ => merge(
					inputs$.pipe(
						debounceTime(200),
						map(({el, gen}) => {
							if (gen !== inputSyncGen) return 0;
							if (!el || !el.isConnected) return 0;
							let nextPos;
							try {
								nextPos = caret.get(el);
							} catch (err) {
								return 0;
							}
							if (gen !== inputSyncGen) return 0;
							const sourceCode = unprettify(el.innerHTML);
							el.innerHTML = prettifySource(sourceCode, type);
							if (gen !== inputSyncGen) return 0;
							caret.set(el, nextPos);
							return 1;
						})
					),
					inputs$.pipe(
						debounceTime(500),
						map(({el, gen}) => {
							if (gen !== inputSyncGen) return 0;
							if (!el || !el.isConnected) return 0;
							let nextPos;
							try {
								nextPos = caret.get(el);
							} catch (err) {
								return 0;
							}
							if (gen !== inputSyncGen) return 0;
							change(unprettify(el.innerHTML), nextPos);
							return 1;
						})
					)
				)).pop().subscribe()
			}
		}),
		splitGutter({
			axis: consoleOnly ? 'y' : 'x',
			hidden: editorOnly,
			onStart: () => {
				const bin = document.querySelector('.codebin');
				const editor = document.querySelector('code.source');
				if (consoleOnly) {
					const binH = bin ? bin.getBoundingClientRect().height : 1;
					const startPct = editor
						? editor.getBoundingClientRect().height / binH
						: (dim.editor != null ? dim.editor : 0.5);
					return {bin, editor, binH, startPct, vertical: true};
				}
				const binW = bin ? bin.getBoundingClientRect().width : 1;
				const startPct = editor
					? editor.getBoundingClientRect().width / binW
					: (dim.editor != null ? dim.editor : 0.5);
				return {bin, editor, binW, startPct, vertical: false};
			},
			onMove: (delta, ev, ctx) => {
				if (!ctx || !ctx.editor) return;
				const size = ctx.vertical ? ctx.binH : ctx.binW;
				if (!size) return;
				const next = clamp(ctx.startPct + (delta / size), 0.2, 0.8);
				ctx.editor.style.flex = `0 0 ${next * 100}%`;
				ctx.pending = next;
			},
			onEnd: (delta, ev, ctx) => {
				const size = ctx && (ctx.vertical ? ctx.binH : ctx.binW);
				const next = clamp(
					(ctx && ctx.pending != null)
						? ctx.pending
						: (ctx.startPct + (delta / (size || 1))),
					0.2,
					0.8
				);
				if (ctx && ctx.editor) ctx.editor.style.flex = `0 0 ${next * 100}%`;
				setLayout({editor: next});
			}
		}),
		span('.output', {
			class: {
				hidden: editorOnly
			}
		}, [
			h('iframe.sandbox', {
				class: {
					hidden: !showPreview
				},
				style: {
					flex: iframeFlex,
					display: showPreview ? 'block' : 'none'
				},
				hook: {
					insert: ({elm}) => {
						elm.contentWindow.document.body.innerHTML = '<section id="ui"></section>';
					}
				}
			}),
			splitGutter({
				axis: 'y',
				hidden: !(showConsole && showPreview),
				onStart: () => {
					const out = document.querySelector('.codebin .output');
					const iframe = document.querySelector('.codebin iframe.sandbox');
					const outH = out ? out.getBoundingClientRect().height : 1;
					const startPct = iframe
						? iframe.getBoundingClientRect().height / outH
						: (dim.preview != null ? dim.preview : 0.5);
					return {out, iframe, outH, startPct};
				},
				onMove: (delta, ev, ctx) => {
					if (!ctx || !ctx.iframe || !ctx.outH) return;
					const next = clamp(ctx.startPct + (delta / ctx.outH), 0.2, 0.8);
					ctx.iframe.style.flex = `0 0 ${next * 100}%`;
					ctx.pending = next;
				},
				onEnd: (delta, ev, ctx) => {
					const next = clamp(
						(ctx && ctx.pending != null)
							? ctx.pending
							: (ctx.startPct + (delta / (ctx.outH || 1))),
						0.2,
						0.8
					);
					if (ctx && ctx.iframe) ctx.iframe.style.flex = `0 0 ${next * 100}%`;
					setLayout({preview: next});
				}
			}),
			code('.console', {
				class: {
					hidden: !showConsole
				},
				style: {
					flex: '1 1 auto'
				},
				hook: {
					insert: ({elm}) => {
						let iframe = prepOutput(elm.parentNode);
						iframe.style.flex = iframeFlex;

						process(type, cleanupCode(source), iframe)
							.pipe(catchError(err => {
								console.log(err);
								return [];
							}))
							.subscribe(l => {
								console.log(l);
								elm.innerHTML += l;
							});
					},
					update: (oldVnode, vnode) => {
						const elm = vnode.elm;
						const prev = oldVnode.data && oldVnode.data.dataset
							? oldVnode.data.dataset.source
							: null;
						const next = source || '';
						let iframe = elm.parentNode.querySelector('iframe');
						if (!iframe) {
							iframe = prepOutput(elm.parentNode);
						}
						iframe.style.flex = iframeFlex;
						if (prev === next) return;

						iframe = prepOutput(elm.parentNode);
						iframe.style.flex = iframeFlex;

						process(type, cleanupCode(source), iframe)
							.pipe(catchError(err => {
								console.log(err);
								return [];
							}))
							.subscribe(l => {
								console.log(l);
								elm.innerHTML += l;
							});
					}
				},
				dataset: {
					source: source || ''
				}
			})
		])
	]);
};
