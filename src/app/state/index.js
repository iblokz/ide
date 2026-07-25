'use strict';

const {obj, arr} = require('iblokz-data');
const {getInitialThemeMode} = require('../util/theme');
const {patchAt, isTextFile} = require('../util/file-tree');
const {loadRecent, pushRecent} = require('../util/recent');
const {getFs, DEMO_TREE, probeCapabilities, resetFs} = require('../services/fs');

const emptyPos = {
	start: {row: 0, col: 0},
	end: {row: 0, col: 0}
};

const demoSource = 'console.log("Hello World!")';

const initial = {
	themeMode: getInitialThemeMode(),
	fsBackend: getFs().id,
	canOpenFolder: getFs().canOpenFolder,
	canWrite: getFs().canWrite,
	project: {
		id: 'demo',
		name: 'Demo',
		path: 'demo'
	},
	recentRoots: loadRecent(),
	file: {
		id: 'untitled',
		name: 'Untitled.js',
		path: 'Untitled.js',
		ext: 'js',
		source: demoSource
	},
	dirty: false,
	sideBar: false,
	type: 'js',
	example: false,
	index: 0,
	maxIndex: 0,
	source: demoSource,
	pos: emptyPos,
	history: [
		{
			type: 'js',
			source: demoSource,
			pos: emptyPos
		}
	],
	filesTree: DEMO_TREE
};

const set = (key, value) => state => obj.patch(state, key, value);
const toggle = key => state => obj.patch(state, key, !obj.sub(state, key));
const arrToggle = (key, value) => state =>
	obj.patch(state, key,
		arr.toggle(obj.sub(state, key), value)
	);

const loadFile = file => state => Object.assign({}, state, {
	file,
	source: file.source,
	type: file.ext || 'js',
	dirty: false,
	index: state.index + 1,
	maxIndex: state.index + 1,
	pos: emptyPos,
	history: [].concat(
		state.history.slice(0, state.index + 1),
		[{
			type: file.ext || 'js',
			source: file.source,
			pos: emptyPos
		}]
	)
});

const openFile = file => {
	if (!file || file.isDir) return state => state;
	if (typeof file.source === 'string') return loadFile(file);
	if (file.readable === false) return state => state;
	if (file.ext && !isTextFile(file.name, file.ext)) return state => state;

	const fs = getFs();
	return fs.readFile(file)
		.then(source => {
			if (typeof source !== 'string') {
				throw new Error('File read did not return text');
			}
			return loadFile(Object.assign({}, file, {source}));
		})
		.catch(err => {
			console.error('openFile failed', file && file.path, err);
			return state => state;
		});
};

const updateSource = (source, pos = emptyPos) => state => Object.assign({}, state, {
	source,
	dirty: true,
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
	index: state.index > 0 ? state.index - 1 : 0,
	dirty: true
}, state.history[state.index > 0 ? state.index - 1 : 0]);

const redo = () => state => Object.assign({}, state, {
	index: state.index < state.maxIndex ? state.index + 1 : state.index,
	dirty: true
}, state.history[state.index < state.maxIndex ? state.index + 1 : state.index]);

const toggleFolder = (path = [], expanded = false) => state => obj.patch(state, 'filesTree', patchAt({
	list: obj.sub(state, 'filesTree') || [],
	path,
	nodesProp: 'files',
	key: 'expanded',
	value: !expanded
}));

const setThemeMode = mode => state => obj.patch(state, 'themeMode', mode);
const toggleTheme = () => state => obj.patch(
	state,
	'themeMode',
	state.themeMode === 'dark' ? 'light' : 'dark'
);

const openFolder = () => {
	const fs = getFs();
	if (!fs.canOpenFolder) {
		return Promise.resolve(state => Object.assign({}, state, probeCapabilities()));
	}
	return fs.openFolder()
		.then(result => {
			if (!result) return state => Object.assign({}, state, probeCapabilities());
			const recentRoots = pushRecent({
				id: result.id,
				name: result.name,
				path: result.path
			});
			return state => Object.assign({}, state, {
				fsBackend: fs.id,
				canOpenFolder: true,
				canWrite: result.writable !== false && !!fs.canWrite,
				project: {
					id: result.id,
					name: result.name,
					path: result.path
				},
				filesTree: result.filesTree,
				recentRoots,
				sideBar: true,
				dirty: false
			});
		})
		.catch(err => {
			console.error(err);
			return state => Object.assign({}, state, probeCapabilities());
		});
};

const refreshFsCapabilities = () => state => Object.assign({}, state, probeCapabilities());

const saveFile = (file, source) => {
	const fs = getFs();
	if (!file || !fs.canWrite || file.id === 'untitled' || file.id === 'demo') {
		return Promise.resolve(state => state);
	}
	if (fs.id === 'memory') {
		return Promise.resolve(state => state);
	}
	return fs.writeFile(file, source)
		.then(() => state => Object.assign({}, state, {
			dirty: false,
			file: Object.assign({}, file, {source})
		}))
		.catch(err => {
			console.error(err);
			return state => state;
		});
};

module.exports = {
	initial,
	set,
	toggle,
	arrToggle,
	loadFile,
	openFile,
	updateSource,
	updatePos,
	undo,
	redo,
	toggleFolder,
	setThemeMode,
	toggleTheme,
	openFolder,
	saveFile,
	refreshFsCapabilities
};
