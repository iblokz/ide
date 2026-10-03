/** Preview iframe surface — optional `src` for URL mode, empty host for sandbox. */
import {h} from 'iblokz-snabbdom-helpers';

export default ({
	src = null,
	reloadToken = 0,
	hidden = false,
	flex = '1 1 auto'
} = {}) => h('iframe.sandbox', {
	class: {
		hidden: !!hidden
	},
	style: {
		flex,
		display: hidden ? 'none' : 'block'
	},
	attrs: src ? {src: String(src)} : {},
	props: src ? {src: String(src)} : {},
	dataset: {
		src: src ? String(src) : '',
		reloadToken: String(reloadToken || 0)
	},
	hook: {
		insert: ({elm}) => {
			if (src) return;
			try {
				elm.contentWindow.document.body.innerHTML = '<section id="ui"></section>';
			} catch (err) { /* ignore */ }
		},
		update: (oldVnode, vnode) => {
			const elm = vnode.elm;
			const prevSrc = oldVnode.data && oldVnode.data.dataset
				? oldVnode.data.dataset.src
				: '';
			const nextSrc = vnode.data && vnode.data.dataset
				? vnode.data.dataset.src
				: '';
			const prevTok = oldVnode.data && oldVnode.data.dataset
				? oldVnode.data.dataset.reloadToken
				: '0';
			const nextTok = vnode.data && vnode.data.dataset
				? vnode.data.dataset.reloadToken
				: '0';
			if (!nextSrc) return;
			if (prevSrc !== nextSrc) {
				elm.src = nextSrc;
				return;
			}
			if (prevTok !== nextTok) {
				elm.src = nextSrc;
			}
		}
	}
});
