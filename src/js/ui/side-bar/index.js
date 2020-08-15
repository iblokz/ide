'use strict';

const {obj} = require('iblokz-data');

// dom
const {
	h1, a, div, label, img,
	section, button, span,
	select, option, header,
	ul, li, h3, i
} = require('iblokz-snabbdom-helpers');

const filesTree = [{
	name: 'src',
	isDir: true,
	ext: false,
	expanded: false,
	files: [
		{
			name: 'index.js',
			type: 'file',
			ext: 'js'
		}
	]
}];

const fileSort = (a, b) => !a.isDir && b.isDir ? 1 : -1;

const levelUp = fn => (path = [], level, cb) => (item, index) => fn(...[item, [].concat(path, index), level + 1, cb]);

const treeMap = (item, path = [], level = 0, cb) => li([].concat(
	a({
		style: {
			paddingLeft: `${(4 + 16 * level)}px`
		},
		class: {
			expanded: item.expanded
		},
		on: {
			click: ev => cb(item, path, level)
		}
	}, [].concat(
		item.isDir ? i(`.fa.${item.expanded ? 'fa-caret-down' : 'fa-caret-right'}`) : [],
		i(`.fa.${item.isDir ? 'fa-folder-o' : obj.switch(item.ext, {
			default: 'fa-file-o'
		})}`, {
			style: {
				marginLeft: item.isDir ? '0px' : '16px'
			}
		}),
		span(item.name)
	)),
	item.files && item.expanded ? ul(item.files.sort(fileSort).map(levelUp(treeMap)(path, level, cb))) : []
));

module.exports = ({state, actions}) => div('.side-bar', {
	class: {
		toggled: state.sideBar
	}
}, [
	// h3('File List'),
	ul('.file-list',
		state.filesTree.sort(fileSort).map((item, index) => treeMap(item, [index], 0,
			(item, path, level) => item.isDir ? actions.toggleFolder(path, item.expanded) : actions.loadFile(item)
		))
	)
]);
