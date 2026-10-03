/**
 * Preview chrome: mode toggle (file | url) + address bar when URL.
 */
import {header, span, i, input, button} from 'iblokz-snabbdom-helpers';
import {filePreviewKind} from '../../../util/preview-file.js';

const modeButton = ({id, label, active, disabled, onClick}) => button(`.preview-mode-btn${active ? '.is-active' : ''}`, {
	attrs: {
		type: 'button',
		title: label,
		'aria-label': label,
		'aria-pressed': active ? 'true' : 'false'
	},
	// props only — attrs.disabled can stick across patches in snabbdom
	props: {disabled: !!disabled},
	on: {
		click: ev => {
			ev.preventDefault();
			if (!disabled) onClick();
		}
	}
}, [label]);

export default ({state, actions}) => {
	const preview = state.preview || {};
	const canFile = !!filePreviewKind(state.type, state.file);
	let mode = preview.mode === 'file' || preview.mode === 'sandbox'
		? preview.mode
		: 'url';
	if (canFile && mode !== 'sandbox') {
		mode = preview.mode === 'url' ? 'url' : 'file';
	} else if (mode === 'file') {
		mode = 'url';
	}
	const value = preview.input != null ? preview.input : (preview.url || '');

	return header('.preview-chrome', [
		span('.preview-mode-group', {
			attrs: {role: 'group', 'aria-label': 'Preview mode'}
		}, [
			modeButton({
				id: 'file',
				label: 'File',
				active: mode === 'file',
				disabled: !canFile,
				onClick: () => actions.preview.setMode('file')
			}),
			modeButton({
				id: 'url',
				label: 'URL',
				active: mode === 'url',
				disabled: false,
				onClick: () => actions.preview.setMode('url')
			})
		]),
		mode === 'url'
			? button('.preview-reload', {
				attrs: {
					type: 'button',
					title: 'Reload',
					'aria-label': 'Reload preview'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						actions.preview.reload();
					}
				}
			}, [i('.fa.fa-refresh')])
			: null,
		mode === 'url'
			? span('.preview-address', [
				i('.fa.fa-globe'),
				input('.preview-address-input', {
					attrs: {
						type: 'text',
						spellcheck: 'false',
						autocomplete: 'off',
						placeholder: 'about:blank',
						'aria-label': 'Preview URL'
					},
					props: {value},
					on: {
						input: ev => actions.preview.setInput(ev.target.value),
						keydown: ev => {
							if (ev.key === 'Enter') {
								ev.preventDefault();
								actions.preview.navigate(ev.target.value);
							}
						}
					}
				})
			])
			: span('.preview-file-label', [
				i('.fa.fa-file-o'),
				span([(state.file && state.file.name) || 'File preview'])
			]),
		mode === 'url'
			? button('.preview-go', {
				attrs: {
					type: 'button',
					title: 'Go',
					'aria-label': 'Navigate'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						actions.preview.navigate();
					}
				}
			}, [i('.fa.fa-arrow-right')])
			: null
	].filter(Boolean));
};
