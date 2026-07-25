'use strict';

const {fromEvent} = require('rxjs');
const {startWith} = require('rxjs/operators');
const {dispatch} = require('iblokz-state');
const {obj} = require('iblokz-data');

const screenSize = width => width >= 1200
	? 'xl'
	: width >= 992
		? 'lg'
		: width >= 768
			? 'md'
			: width >= 576
				? 'sm'
				: 'xs';

const patchScreen = () => dispatch(state => obj.patch(state, 'viewport.screen', {
	width: window.innerWidth,
	height: window.innerHeight,
	size: screenSize(window.innerWidth)
}));

let stop = () => {};

const start = () => {
	const sub = fromEvent(window, 'resize')
		.pipe(startWith(null))
		.subscribe(patchScreen);
	stop = () => sub.unsubscribe();
};

module.exports = {
	start,
	stop
};
