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
const vm = require('../../util/vm');
const caret = require('../../util/caret');

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
	tDiv.innerHTML = html
		.replace(/<\/?ol[^>]*>/g, '')
		.replace(/<li[^>]*>/g, '')
		.replace(/<\/li>/g, '^^nl^^')
		.replace('<br>', '');
	// console.log(tDiv.innerHTML);
	const text = tDiv.textContent
		.replace(/\^\^nl\^\^/g, '\n');
	// console.log(text);
	// tDiv.innerHTML = html;
	// const text = tDiv.textContent;
	return text;
};

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

const createBefore = (type, el) => {
	removeChildren(el.parentNode, 'iframe');
	let newEl = document.createElement(type);
	el.parentNode.insertBefore(newEl, el);
	return newEl;
};

	// clear and prep output and console
const prepOutput = parentNode => {
	removeChildren(parentNode, 'iframe');
	let iframe = createBefore('IFRAME', parentNode.querySelector('.console'));
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
			if (log) log.map(l => prettify.prettyPrintOne(JSON.stringify(l)))
				.forEach(l => console$.next(`${l}\n`));
		});
	}
	return console$;
};

// ui
module.exports = ({
	source, pos, type,
	change = code => {},
	updatePos = pos => {},
	undo = () => {},
	redo = () => {}
}) => span('.codebin', [
	code(`.source[type="${type}"][contenteditable="true"][spellcheck="false"]`, {
		hook: {
			insert: ({elm}) => {
				elm.innerHTML = prettify.prettyPrintOne(source || '', type, true);
				caret.set(elm, pos);
			},
			update: (oldVnode, vnode) => {
				const elm = vnode.elm;
				const prev = oldVnode.data && oldVnode.data.dataset
					? oldVnode.data.dataset.source
					: null;
				const next = source || '';
				if (prev !== next) {
					elm.innerHTML = prettify.prettyPrintOne(next, type, true);
				}
				caret.set(elm, pos);
			}
		},
		dataset: {
			source: source || ''
		},
		props: {
			spellcheck: false
		},
		on: {
			keydown: ev => {
				if (ev.key === 'Tab') {
					ev.preventDefault();
					caret.indent(ev.target, ev.shiftKey === true ? 'left' : 'right');
					ev.target.dispatchEvent(new Event('input'));
					// document.execCommand('insertHTML', false, '&#009');
					// document.execCommand('indent');
				} else if (ev.key === 'z' && ev.ctrlKey) {
					undo();
				} else if (ev.key === 'y' && ev.ctrlKey) {
					redo();
				}
			},
			focus: ({target}) => [fromEvent(target, 'input')
				.pipe(
					map(ev => ev.target),
					takeUntil(fromEvent(target, 'blur')),
					share()
				)
			].map(inputs$ => merge(
				inputs$.pipe(
					debounceTime(200),
					map(el => {
						const pos = caret.get(el);
						const sourceCode = unprettify(el.innerHTML);
						el.innerHTML = prettify.prettyPrintOne(sourceCode, type, true);
						caret.set(el, pos);
						return 1;
					})
				),
				inputs$.pipe(
					debounceTime(500),
					map(el => {
						const pos = caret.get(el);
						console.log(pos);
						let sourceCode = unprettify(el.innerHTML);
						change(sourceCode, pos);
						// setTimeout(() => caret.set(el, pos));
						/*
						sourceCode = cleanupCode(sourceCode);
						// clear and prep output and console
						let iframe = prepOutput(el.parentNode.querySelector('.output'));

						// process code
						process(type, sourceCode, iframe)
							.pipe(catchError(err => {
								console.log(err);
								return [];
							}))
							.subscribe(l => {
								console.log(l);
								el.parentNode.querySelector('.console').innerHTML += l;
							});
						*/

						return 1;
					})
				)
			)).pop().subscribe(),
			keyup: ev => {
				const pos = caret.get(ev.target);
				console.log(pos);
			}
		}
	}),
	span('.output', [
		h('iframe.sandbox', {
			hook: {
				insert: ({elm}) => {
					elm.contentWindow.document.body.innerHTML = '<section id="ui"></section>';
				}
			}
		}),
		code('.console', {
			hook: {
				insert: ({elm}) => {
					// clear and prep output and console
					let iframe = prepOutput(elm.parentNode);

					// process code
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
				update: ({elm}) => {
					// clear and prep output and console
					let iframe = prepOutput(elm.parentNode);

					// process code
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
			}
		})
	])
]);
