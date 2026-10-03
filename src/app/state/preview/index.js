import {obj} from 'iblokz-data';
import {filePreviewKind} from '../../util/preview-file.js';

export const DEFAULT_URL = 'about:blank';

export {filePreviewKind};

export const initial = {
	/**
	 * `url` | `file` | `sandbox` (sandbox reserved).
	 * `null` = auto: file when the active buffer is md/svg, else url.
	 */
	mode: null,
	url: DEFAULT_URL,
	/** Address-bar draft (committed on navigate). */
	input: DEFAULT_URL,
	reloadToken: 0
};

const previewOf = state => Object.assign({}, initial, state.preview || {});

const normalizeMode = mode => {
	if (mode === 'file' || mode === 'sandbox' || mode === 'url') return mode;
	return null;
};

export const setMode = mode => state =>
	obj.patch(state, ['preview', 'mode'], normalizeMode(mode));

export const setInput = input => state =>
	obj.patch(state, ['preview', 'input'], String(input == null ? '' : input));

/** Commit address bar (or explicit url) into `preview.url`. */
export const navigate = (url) => state => {
	const cur = previewOf(state);
	let next = url != null ? String(url) : String(cur.input || '');
	next = next.trim();
	if (next && next !== 'about:blank' && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) {
		next = `http://${next}`;
	}
	if (!next) next = DEFAULT_URL;
	return obj.patch(state, 'preview', Object.assign({}, cur, {
		url: next,
		input: next,
		mode: 'url'
	}));
};

export const reload = () => state => {
	const cur = previewOf(state);
	return obj.patch(state, 'preview', Object.assign({}, cur, {
		reloadToken: (cur.reloadToken || 0) + 1
	}));
};

export default {
	initial,
	filePreviewKind,
	setMode,
	setInput,
	navigate,
	reload
};
