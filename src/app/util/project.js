'use strict';

/** No real project yet — welcome / start screen. */
const isStartView = state =>
	!state || state.view === 'start' || state.view == null;

/** Open folder pointer (`state.project`) has a path. */
const hasOpenProject = state => !!(state && state.project && state.project.path);

module.exports = {
	isStartView,
	hasOpenProject
};
