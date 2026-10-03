import {obj} from 'iblokz-data';
import {getInitialThemeMode, persistThemeMode, readHostTheme} from '../../util/theme';

export const initial = {
	mode: getInitialThemeMode(),
	host: readHostTheme()
};

export const setMode = mode => state => obj.patch(state, ['theme', 'mode'], mode);

export const setHost = host => state => obj.patch(state, ['theme', 'host'], host || null);

export const toggle = () => state => {
	const mode = (state.theme && state.theme.mode) === 'dark' ? 'light' : 'dark';
	persistThemeMode(mode);
	return obj.patch(state, ['theme', 'mode'], mode);
};

export default {
	initial,
	setMode,
	setHost,
	toggle
};
