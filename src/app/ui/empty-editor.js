'use strict';

const {section, p} = require('iblokz-snabbdom-helpers');

module.exports = () => section('.empty-editor', [
	p(['Select a file from the sidebar to open it.'])
]);
