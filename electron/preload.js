'use strict';

const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('app', {
	platform: 'electron',
	versions: {
		node: process.versions.node,
		chrome: process.versions.chrome,
		electron: process.versions.electron
	},
	selectRootFolder: () => ipcRenderer.invoke('selectRootFolder'),
	openRootFolder: dirPath => ipcRenderer.invoke('openRootFolder', dirPath),
	listDir: dirPath => ipcRenderer.invoke('listDir', dirPath),
	readFile: filePath => ipcRenderer.invoke('readFile', filePath),
	readFileDataUrl: filePath => ipcRenderer.invoke('readFileDataUrl', filePath),
	writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
	setDirty: value => ipcRenderer.invoke('setDirty', value),
	onFsChange: callback => {
		const handler = (_event, payload) => callback(payload);
		ipcRenderer.on('fs-change', handler);
		return () => ipcRenderer.removeListener('fs-change', handler);
	},
	minimize: () => ipcRenderer.invoke('minimize'),
	toggleMaximize: () => ipcRenderer.invoke('toggleMaximize'),
	close: () => ipcRenderer.invoke('close')
});
