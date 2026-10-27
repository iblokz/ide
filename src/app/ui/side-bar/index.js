/**
 * Left sidebar shell: project header, section switcher, active section body.
 */
import {aside, span, button, header, nav, i} from 'iblokz-snabbdom-helpers';
import {fn, obj} from 'iblokz-data';
import fileTreeSection from './file-tree/index.js';
import searchSection from './search/index.js';
import gitSection from './git/index.js';

const SECTIONS = [
	{id: 'fileTree', title: 'Explorer', icon: 'fa-files-o'},
	{id: 'search', title: 'Search', icon: 'fa-search'},
	{id: 'git', title: 'Source Control', icon: 'fa-code-fork'}
];

const sectionBody = ({section, state, actions}) => {
	if (section === 'fileTree') return fileTreeSection({state, actions});
	if (section === 'git') return gitSection({state, actions});
	return searchSection({state, actions});
};

export default ({state, actions, width}) => fn.pipe(
	() => {
		const section = obj.sub(state, ['layout', 'sideBarSection']) || 'fileTree';
		return {
			section,
			title: !(state.project && state.project.path)
				? 'Open Project'
				: (state.project.name || 'Project'),
			open: !!obj.sub(state, ['layout', 'toggles', 'leftSideBar']),
			dim: obj.sub(state, ['layout', 'dim', 'leftSideBar']) || 260
		};
	},
	({open, dim, ...rest}) => ({
		...rest,
		open,
		resolvedWidth: open
			? (typeof width === 'number' ? width : dim)
			: 0
	}),
	({title, open, resolvedWidth, section}) => aside('.left-pane', {
		class: {
			toggled: open
		},
		style: {
			width: `${resolvedWidth}px`,
			// Keep min/max stable so width can animate open/close
			minWidth: '0px',
			maxWidth: '480px'
		}
	}, [].concat(
		header([
			span({
				class: {
					placeholder: !(state.project && state.project.path)
				}
			}, title),
			button('.open-folder', {
				attrs: {
					title: 'Open folder (Ctrl+O)',
					'aria-label': 'Open folder',
					type: 'button'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						actions.project.openFolder();
					}
				}
			}, [i('.fa.fa-folder-open-o')])
		]),
		nav('.side-bar-sections', {
			attrs: {'aria-label': 'Sidebar section'}
		}, SECTIONS.map(tab =>
			button('.side-bar-section', {
				class: {active: section === tab.id},
				attrs: {
					type: 'button',
					title: tab.title,
					'aria-label': tab.title,
					'aria-pressed': section === tab.id ? 'true' : 'false'
				},
				on: {
					click: ev => {
						ev.preventDefault();
						ev.stopPropagation();
						actions.layout.setSideBarSection(tab.id);
						if (tab.id === 'git') actions.git.refresh();
					}
				}
			}, [i(`.fa.${tab.icon}`)])
		)),
		sectionBody({section, state, actions})
	))
)();
