'use strict';

/** No real project yet — welcome / start screen. */
const isStartView = state =>
	!state || state.view === 'start' || state.view == null;

const isDemoProject = state =>
	!!(state && state.project && state.project.id === 'demo');

module.exports = {
	isStartView,
	isDemoProject
};
