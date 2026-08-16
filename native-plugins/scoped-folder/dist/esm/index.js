import { registerPlugin as coreRegisterPlugin } from '@capacitor/core';

const register =
	typeof window !== 'undefined'
	&& window.Capacitor
	&& typeof window.Capacitor.registerPlugin === 'function'
		? window.Capacitor.registerPlugin.bind(window.Capacitor)
		: coreRegisterPlugin;

const ScopedFolder = register('ScopedFolder');

export { ScopedFolder };
