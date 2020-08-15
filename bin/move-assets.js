'use strict';

const fse = require('fs-extra');
const path = require('path');

const paths = {
	'dist/fonts': 'node_modules/font-awesome/fonts',
	'dist/css/ttf': 'node_modules/firacode/distr/ttf',
	'dist/css/woff': 'node_modules/firacode/distr/woff',
	'dist/css/woff2': 'node_modules/firacode/distr/woff2',
	'dist/assets': 'src/assets'
};

Object.keys(paths).forEach(
	p => fse.copySync(
		path.resolve(__dirname, '..', paths[p]),
		path.resolve(__dirname, '..', p)
	)
);
