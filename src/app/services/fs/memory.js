'use strict';

/**
 * In-memory demo project (fallback when no native FS / FSA).
 */

const DEMO_TREE = [{
	id: 'demo-src',
	name: 'src',
	path: 'src',
	isDir: true,
	ext: false,
	expanded: false,
	files: [
		{
			id: 'demo-src-index',
			name: 'index.js',
			path: 'src/index.js',
			isDir: false,
			ext: 'js',
			source: `
const foo = bar => bar + 1;

function xyz () {
	console.log('abc')
}

const zyn = foo(3);
`
		},
		{
			id: 'demo-src-ui',
			name: 'ui',
			path: 'src/ui',
			isDir: true,
			expanded: true,
			ext: false,
			files: [
				{
					id: 'demo-src-ui-index',
					name: 'index.js',
					path: 'src/ui/index.js',
					isDir: false,
					ext: 'js',
					source: `
const bar = baz => baz * 2;

function jcl () {
	const bob = bar(3);
	console.log('bob', bob)
}

jcl(3);
		`
				}
			]
		}
	]
}];

const create = () => ({
	id: 'memory',
	canOpenFolder: false,
	canWrite: false,
	async openFolder() {
		return null;
	},
	async readFile(node) {
		if (node && typeof node.source === 'string') return node.source;
		throw new Error('File not found in demo tree');
	},
	async writeFile() {
		throw new Error('Demo project is read-only');
	},
	getDemoTree: () => DEMO_TREE
});

module.exports = {
	create,
	DEMO_TREE
};
