import {body, main} from 'iblokz-snabbdom-helpers';
import {fn} from 'iblokz-data';
import {themeClass, hostStyleProps} from '../util/theme';
import {isStartView} from '../util/project';
import {clamp} from '../util/split-drag';
import header from './header';
import sideBar from './side-bar';
import workspace from './workspace';
import startScreen from './start-screen';
import splitGutter from './comp/split-gutter';

const gutter = splitGutter.default ?? splitGutter;

export default ({state, actions}) => fn.pipe(
	() => ({
		toggles: state.layout.toggles,
		dim: state.layout.dim,
		hostStyle: hostStyleProps(state.theme && state.theme.host)
	}),
	({toggles, dim, hostStyle}) => body(
		`.app.${themeClass((state.theme && state.theme.mode) || 'dark')}${isStartView(state) ? '.start' : ''}`,
		hostStyle ? {style: hostStyle} : {},
		isStartView(state)
			? [
				header({state, actions}),
				startScreen({state, actions})
			] : [
				sideBar({
					state,
					actions,
					width: toggles.leftSideBar ? dim.leftSideBar : 0
				}),
				gutter({
					axis: 'x',
					hidden: !toggles.leftSideBar,
					onStart: () => {
						const el = document.querySelector('.left-pane');
						return {
							el,
							start: el ? el.getBoundingClientRect().width : dim.leftSideBar
						};
					},
					onMove: (delta, ev, ctx) => {
						if (!ctx || !ctx.el) return;
						ctx.el.style.width = `${clamp(ctx.start + delta, 140, 480)}px`;
					},
					onEnd: (delta, ev, ctx) => {
						const next = clamp((ctx && ctx.start || dim.leftSideBar) + delta, 140, 480);
						if (ctx && ctx.el) ctx.el.style.width = `${next}px`;
						actions.layout.set({leftSideBar: next});
					}
				}),
				main('.layout', [
					header({state, actions}),
					workspace({state, actions})
				])
			]
	)
)();
