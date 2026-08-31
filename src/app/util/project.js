'use strict';

/** No real project yet — welcome / start screen. */
const isStartView = state =>
	!state || state.view === 'start' || state.view == null;

module.exports = {
	isStartView
};
