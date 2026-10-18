/**
 * Preview chrome: mode toggle (file | url) + address / breadcrumbs + pane actions.
 */
import {header, span, i, input, button, a} from 'iblokz-snabbdom-helpers';
import {filePreviewKind} from '../../../util/preview-file.js';
import {
	buildPreviewBreadcrumbs,
	openPreviewPath
} from '../../../util/preview-nav.js';

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

const iconButton = ({className, title, icon, onClick}) => button(className, {
	attrs: {
		type: 'button',
		title,
		'aria-label': title
	},
	on: {
		click: ev => {
			ev.preventDefault();
			onClick();
		}
	}
}, [i(`.fa.${icon}`)]);

const fileBreadcrumbs = ({state, actions}) => {
	const filePath = state.file && state.file.path;
	const projectPath = state.project && state.project.path;
	const crumbs = buildPreviewBreadcrumbs(filePath, projectPath);
	const treeNodes = (state.fileTree && state.fileTree.nodes) || [];

	if (!crumbs.length) {
		return span('.preview-file-label', [
			i('.fa.fa-file-o'),
			span([(state.file && state.file.name) || 'File preview'])
		]);
	}

	return span('.preview-breadcrumbs', {
		attrs: {
			role: 'navigation',
			'aria-label': 'Preview path'
		}
	}, crumbs.reduce((nodes, crumb, index) => {
		const isLast = index === crumbs.length - 1;
		if (index > 0) {
			nodes.push(span('.preview-breadcrumb-sep', ['/']));
		}
		nodes.push(
			isLast
				? span('.preview-breadcrumb.is-current', {
					attrs: {title: crumb.path}
				}, [crumb.label])
				: a('.preview-breadcrumb', {
					attrs: {
						href: '#',
						title: crumb.path
					},
					on: {
						click: ev => {
							ev.preventDefault();
							openPreviewPath({
								path: crumb.path,
								kind: crumb.kind,
								treeNodes,
								actions,
								currentPath: filePath
							});
						}
					}
				}, [crumb.label])
		);
		return nodes;
	}, []));
};

export default ({state, actions}) => {
	const preview = state.preview || {};
	const toggles = (state.layout && state.layout.toggles) || {};
	const maximized = !!toggles.previewMaximized;
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
			? iconButton({
				className: '.preview-reload',
				title: 'Reload',
				icon: 'fa-refresh',
				onClick: () => actions.preview.reload()
			})
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
			: fileBreadcrumbs({state, actions}),
		mode === 'url'
			? iconButton({
				className: '.preview-go',
				title: 'Go',
				icon: 'fa-arrow-right',
				onClick: () => actions.preview.navigate()
			})
			: null,
		span('.preview-chrome-actions', [
			iconButton({
				className: '.preview-expand',
				title: maximized ? 'Restore preview size' : 'Expand preview',
				icon: maximized ? 'fa-compress' : 'fa-expand',
				onClick: () => actions.layout.toggle('previewMaximized')
			}),
			iconButton({
				className: '.preview-close',
				title: 'Close preview',
				icon: 'fa-times',
				onClick: () => actions.layout.closePreview()
			})
		])
	].filter(Boolean));
};
