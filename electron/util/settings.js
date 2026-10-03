'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/** Fallback if bundled config/settings.yml is missing from the package. */
const DEFAULTS = {
	windows: {
		singleInstance: false
	}
};

const SETTINGS_FILE = 'settings.yml';

const isPlainObject = value =>
	value != null && typeof value === 'object' && !Array.isArray(value);

/** Shallow-per-level merge; arrays / scalars from `over` replace. */
const deepMerge = (base, over) => {
	if (!isPlainObject(base)) return over != null ? over : base;
	if (!isPlainObject(over)) return base;
	const out = Object.assign({}, base);
	Object.keys(over).forEach(key => {
		out[key] = isPlainObject(base[key]) && isPlainObject(over[key])
			? deepMerge(base[key], over[key])
			: over[key];
	});
	return out;
};

const bundledPath = () => path.join(__dirname, '..', '..', 'config', 'settings.yml');

const userSettingsPath = userData => path.join(userData, SETTINGS_FILE);

const readYamlObject = filePath => {
	try {
		if (!fs.existsSync(filePath)) return null;
		const data = yaml.load(fs.readFileSync(filePath, 'utf8'));
		return isPlainObject(data) ? data : null;
	} catch (err) {
		return null;
	}
};

const dumpSettings = data => yaml.dump(data, {
	indent: 2,
	lineWidth: 88,
	noRefs: true,
	sortingKeys: false
});

/**
 * Load bundled defaults, ensure a userData copy exists, merge user over defaults.
 * @param {string} userData Electron `app.getPath('userData')`
 * @returns {{windows: {singleInstance: boolean}}}
 */
const loadSettings = userData => {
	const bundled = readYamlObject(bundledPath()) || {};
	const defaults = deepMerge(DEFAULTS, bundled);
	const userFile = userSettingsPath(userData);

	if (!fs.existsSync(userFile)) {
		try {
			fs.mkdirSync(userData, {recursive: true});
			const bundledFile = bundledPath();
			if (fs.existsSync(bundledFile)) {
				fs.copyFileSync(bundledFile, userFile);
			} else {
				fs.writeFileSync(userFile, dumpSettings(defaults), 'utf8');
			}
		} catch (err) {
			return defaults;
		}
		return defaults;
	}

	const user = readYamlObject(userFile);
	if (!user) return defaults;
	return deepMerge(defaults, user);
};

module.exports = {
	DEFAULTS,
	SETTINGS_FILE,
	bundledPath,
	userSettingsPath,
	loadSettings,
	deepMerge
};
