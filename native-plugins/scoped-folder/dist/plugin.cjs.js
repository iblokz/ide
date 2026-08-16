'use strict';

const getRegisterPlugin = () => {
	if (
		typeof window !== 'undefined'
		&& window.Capacitor
		&& typeof window.Capacitor.registerPlugin === 'function'
	) {
		return window.Capacitor.registerPlugin.bind(window.Capacitor);
	}
	return require('@capacitor/core').registerPlugin;
};

const ScopedFolder = getRegisterPlugin()('ScopedFolder');

module.exports = {ScopedFolder};
