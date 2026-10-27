export const fileSort = (a, b) => (!a.isDir && b.isDir ? 1 : -1);

/** Sort for display but keep each node's index in the unsorted state array. */
export const sortedWithIndex = (list = []) => list
	.map((item, index) => ({item, index}))
	.sort((a, b) => fileSort(a.item, b.item));
