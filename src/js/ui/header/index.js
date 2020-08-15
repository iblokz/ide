'use strict';

const {obj} = require('iblokz-data');

// dom
const {
	h1, a, div, label, img,
	section, button, span, i,
	select, option, header
} = require('iblokz-snabbdom-helpers');
// components
// const dropdown = require('../comp/dropdown');
const svgHamburger = require('../comp/svg/hamburger');

const langTypes = {
	js: 'JavaScript',
	py: 'Python',
	java: 'Java'
};

module.exports = ({state, actions}) => header([
	button({on: {click: () => actions.toggle('sideBar')}}, [
		svgHamburger(({state: state.sideBar ? 1 : 0, stroke: '#777', strokeWidth: '3px', size: 24}))
		// i('.fa.fa-bars')
	]),
	h1('iBloKz IDE')
	// label('Lang: '),
	// dropdown('#change-lang', langTypes, state.type, ev => actions.changeLanguage(ev.target.value)),
	// label('Examples: '),
	// dropdown('#load-example',
	// 	Object.assign({'': 'Load ...'}, obj.map(state.examples[state.type], (k, v) => k)), '',
	// 	ev => {
	// 		actions.loadExample(ev.target.value);
	// 		ev.target.value = '';
	// 	})
]);
