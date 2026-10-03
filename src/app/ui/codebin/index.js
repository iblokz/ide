/**
 * Codebin kit — reusable editor / preview / console pieces.
 * IDE workspace picks what it needs; `embed` composes all three.
 */
export {default as editor} from './editor.js';
export {default as preview} from './preview.js';
export {default as consoleView} from './console.js';
export {default as previewPane} from './preview-pane.js';
export {default as embed} from './embed.js';
export * as vm from './vm.js';
export * as prettify from './prettify.js';

export {default} from './embed.js';
