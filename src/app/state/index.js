'use strict';

const {obj, arr} = require('iblokz-data');
const {getInitialThemeMode} = require('../util/theme');
const {mergeAt, isImageFile, fileKind} = require('../util/file-tree');
const {loadRecent, pushRecent} = require('../util/recent');
const {loadLayout, saveLayout, clampLayout, nextPanes} = require('../util/layout');
const {isDemoFile} = require('../util/save');
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
	// project-scoped: true only after opening a writable folder
	canWrite: false,
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
	saveError: null,
	sideBar: false,
	layout: loadLayout(),
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

const revokeFileUrl = file => {
	if (!file || !file.url) return;
	const fs = getFs();
	if (typeof fs.revokeObjectUrl === 'function') {
		fs.revokeObjectUrl(file.url);
	}
};

const loadFile = file => state => {
	if (state.file && state.file !== file) revokeFileUrl(state.file);
	return Object.assign({}, state, {
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
};

const loadImage = file => state => {
	if (state.file && state.file !== file) revokeFileUrl(state.file);
	return Object.assign({}, state, {
		file,
		source: '',
		type: 'image',
		dirty: false,
		saveError: null,
		index: state.index + 1,
		maxIndex: state.index + 1,
		pos: emptyPos,
		history: [].concat(
			state.history.slice(0, state.index + 1),
			[{
				type: 'image',
				source: '',
				pos: emptyPos
			}]
		)
	});
};

const openImage = file => {
	if (typeof file.url === 'string' && file.url) {
		return loadImage(file);
	}
	const fs = getFs();
	if (typeof fs.getObjectUrl !== 'function') {
		console.error('getObjectUrl not available on FS backend', fs.id);
		return state => state;
	}
	return fs.getObjectUrl(file)
		.then(url => loadImage(Object.assign({}, file, {url, kind: 'image'})))
		.catch(err => {
			console.error('openImage failed', file && file.path, err);
			return state => state;
		});
};

const openFile = file => {
	if (!file || file.isDir) return state => state;

	const kind = file.kind || fileKind(file.name, file.ext);
	if (kind === 'image' || isImageFile(file.name, file.ext)) {
		return openImage(file);
	}
	if (kind === 'binary' || file.readable === false) {
		return state => state;
	}
	if (typeof file.source === 'string') return loadFile(file);

	const fs = getFs();
	return fs.readFile(file)
		.then(source => {
			if (typeof source !== 'string') {
				throw new Error('File read did not return text');
			}
			return loadFile(Object.assign({}, file, {source, kind: 'text'}));
		})
		.catch(err => {
			console.error('openFile failed', file && file.path, err);
			return state => state;
		});
};

const updateSource = (source, pos) => state => Object.assign({}, state, {
	source,
	dirty: true,
	saveError: null,
	index: state.index + 1,
	maxIndex: state.index + 1,
	pos: pos || state.pos || emptyPos,
	history: [].concat(
		state.history.slice(0, state.index + 1),
		[{type: state.type, source, pos: pos || state.pos || emptyPos}]
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

const toggleFolder = (path = [], item) => {
	if (!item || !item.isDir) return state => state;

	const patchTree = (state, patch) => obj.patch(
		state,
		'filesTree',
		mergeAt({
			list: obj.sub(state, 'filesTree') || [],
			path,
			nodesProp: 'files',
			patch
		})
	);

	if (item.expanded) {
		return state => patchTree(state, {expanded: false});
	}

	if (item.childrenLoaded) {
		return state => patchTree(state, {expanded: true});
	}

	const fs = getFs();
	if (typeof fs.listDir !== 'function') {
		return state => patchTree(state, {expanded: true, childrenLoaded: true});
	}

	return fs.listDir(item)
		.then(files => state => patchTree(state, {
			expanded: true,
			childrenLoaded: true,
			files: files || []
		}))
		.catch(err => {
			console.error('listDir failed', item && item.path, err);
			return state => state;
		});
};

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
				canWrite: result.writable === true,
				projectAccess: result.access || (result.writable ? 'fsa-rw' : 'input'),
				project: {
					id: result.id,
					name: result.name,
					path: result.path
				},
				filesTree: result.filesTree,
				recentRoots,
				sideBar: true,
				dirty: false,
				saveError: null
			});
		})
		.catch(err => {
			console.error(err);
			return state => Object.assign({}, state, probeCapabilities());
		});
};

const refreshFsCapabilities = () => state => Object.assign({}, state, probeCapabilities());

const setLayout = patch => state => {
	const layout = saveLayout(clampLayout(Object.assign({}, state.layout, patch)));
	return Object.assign({}, state, {layout});
};

const cyclePanes = () => state => {
	const layout = saveLayout(clampLayout(Object.assign({}, state.layout, {
		panes: nextPanes(state.layout && state.layout.panes)
	})));
	return Object.assign({}, state, {layout});
};

const saveFile = (file, source, pickedHandle) => {
	const fs = getFs();
	if (!file || isDemoFile(file) || fs.id === 'memory') {
		return Promise.resolve(state => state);
	}
	return fs.writeFile(file, source, pickedHandle)
		.then(result => state => Object.assign({}, state, {
			dirty: false,
			saveError: null,
			canWrite: state.canWrite || (result && result.method === 'handle'),
			file: Object.assign({}, file, {source})
		}))
		.catch(err => {
			console.error('saveFile failed', file && file.path, err);
			const message = (err && err.message) || 'Save failed';
			return state => Object.assign({}, state, {saveError: message});
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
	refreshFsCapabilities,
	setLayout,
	cyclePanes
};
