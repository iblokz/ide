'use strict';

const {obj, arr, fn} = require('iblokz-data');

// namespaces=
const counter = require('./counter');

// initial
const initial = {
	sideBar: false,
	type: 'js',
	example: false,
	index: 0,
	maxIndex: 0,
	source: 'console.log("Hello World!")',
	pos: {
		start: {row: 0, col: 0},
		end: {row: 0, col: 0}
	},
	history: [
		{
			type: 'js',
			source: 'console.log("Hello World!")',
			pos: {
				start: {row: 0, col: 0},
				end: {row: 0, col: 0}
			}
		}
	],
	filesTree: [{
		name: 'src',
		isDir: true,
		ext: false,
		expanded: false,
		files: [
			{
				name: 'index.js',
				ext: 'js'
			},
			{
				name: 'ui',
				isDir: true,
				expanded: true,
				files: [
					{
						name: 'index.js',
						ext: 'js'
					}
				]
			}
		]
	}]
};

// actions
const set = (key, value) => state => obj.patch(state, key, value);
const toggle = key => state => obj.patch(state, key, !obj.sub(state, key));
const arrToggle = (key, value) => state =>
	obj.patch(state, key,
		arr.toggle(obj.sub(state, key), value)
	);

const updateSource = (source, pos = initial.pos) => state => Object.assign({}, state, {
	source,
	index: state.index + 1,
	maxIndex: state.index + 1,
	pos,
	history: [].concat(
		state.history.slice(0, state.index + 1),
		[{type: state.type, source, pos}]
	)
});

const updatePos = pos => state => Object.assign({}, state, {
	pos,
	history: [].concat(
		state.history.slice(0, state.history.length - 1),
		[obj.patch(state.history[state.history.length - 1], 'pos', pos)]
	)
});

const undo = () => state => Object.assign({}, state, {
	index: state.index > 0 ? state.index - 1 : 0
}, state.history[state.index > 0 ? state.index - 1 : 0]);

const redo = () => state => Object.assign({}, state, {
	index: state.index < state.maxIndex ? state.index + 1 : state.index
}, state.history[state.index < state.maxIndex ? state.index + 1 : state.index]);

const treePatchAt = ({list = [], path = [], nodesProp = 'nodes', key, value}) => path.length > 0 ? fn.pipe(
	() => path instanceof Array ? path.slice(0, 1).pop() : path,
	index => [].concat(
		list.slice(0, index),
		[{...list[index], [
			path.length > 1 ? nodesProp : key
		]: path.length > 1
			? treePatchAt({list: list[index][nodesProp], path: path.slice(1), nodesProp, key, value})
			: value
		}],
		(index < list.length - 1) ? list.slice(index + 1) : []
	)
)() : list;

const toggleFolder = (path = [], expanded = false) => state => obj.patch(state, 'filesTree', treePatchAt({
	list: obj.sub(state, 'filesTree') || [],
	path,
	nodesProp: 'files',
	key: 'expanded',
	value: !expanded
}));

module.exports = {
	initial,
	counter,
	set,
	toggle,
	arrToggle,
	updateSource,
	updatePos,
	undo,
	redo,
	toggleFolder
};
