'use strict';

const {app, dialog, BrowserWindow, ipcMain} = require('electron');
const path = require('node:path');
const fileUtil = require('./util/file');

const DEV_URL = process.env.ELECTRON_START_URL || 'http://127.0.0.1:1234';

const selectRootFolder = async () => {
	const result = await dialog.showOpenDialog({
		title: 'Open Project Folder',
		properties: ['openDirectory']
	});
	if (result.canceled || !result.filePaths || !result.filePaths[0]) {
		return null;
	}
	return fileUtil.openRoot(result.filePaths[0]);
};

const createWindow = () => {
	const win = new BrowserWindow({
		width: 1280,
		height: 800,
		show: false,
		frame: false,
		webPreferences: {
			devTools: true,
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			webSecurity: true
		}
	});

	win.once('ready-to-show', () => win.show());
	win.loadURL(DEV_URL).catch(err => {
		console.error('Failed to load', DEV_URL, err);
	});
	return win;
};

app.whenReady().then(() => {
	let win;

	ipcMain.handle('selectRootFolder', () => selectRootFolder());
	ipcMain.handle('listDir', (_ev, dirPath) => fileUtil.listDir(dirPath));
	ipcMain.handle('readFile', (_ev, filePath) => fileUtil.read(filePath));
	ipcMain.handle('readFileDataUrl', (_ev, filePath) => fileUtil.readDataUrl(filePath));
	ipcMain.handle('writeFile', (_ev, filePath, content) => fileUtil.write(filePath, content));
	ipcMain.handle('minimize', () => {
		if (win) win.minimize();
	});
	ipcMain.handle('close', () => {
		if (win) win.close();
		app.quit();
	});

	win = createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			win = createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
