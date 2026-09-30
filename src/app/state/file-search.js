export const initial = {
	open: false,
	query: '',
	activeIndex: 0,
	/** Flat file list for project search (includes unloaded subdirs). */
	index: null,
	/** `project.path` the index was built for. */
	indexPath: null,
	indexing: false
};

export default {
	initial
};
