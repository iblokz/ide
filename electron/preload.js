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
	listDir: dirPath => ipcRenderer.invoke('listDir', dirPath),
	readFile: filePath => ipcRenderer.invoke('readFile', filePath),
	readFileDataUrl: filePath => ipcRenderer.invoke('readFileDataUrl', filePath),
	writeFile: (filePath, content) => ipcRenderer.invoke('writeFile', filePath, content),
	minimize: () => ipcRenderer.invoke('minimize'),
	toggleMaximize: () => ipcRenderer.invoke('toggleMaximize'),
	close: () => ipcRenderer.invoke('close')
});
