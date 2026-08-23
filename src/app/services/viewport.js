import {fromEvent} from 'rxjs';
import {startWith} from 'rxjs/operators';
import {dispatch} from 'iblokz-state';
import {obj} from 'iblokz-data';

export const screenSize = width => width >= 1200
	? 'xl'
	: width >= 992
		? 'lg'
		: width >= 768
			? 'md'
			: width >= 576
				? 'sm'
				: 'xs';

export const patchScreen = () => dispatch(state => obj.patch(state, 'viewport.screen', {
	width: window.innerWidth,
	height: window.innerHeight,
	size: screenSize(window.innerWidth)
}));

export let stop = () => {};

export const start = () => {
	const sub = fromEvent(window, 'resize')
		.pipe(startWith(null))
		.subscribe(patchScreen);
	stop = () => sub.unsubscribe();
};

export default {
	start,
	stop
};
