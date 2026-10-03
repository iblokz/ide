/** Console log surface (receives HTML chunks from vm.runPreview). */
import {code} from 'iblokz-snabbdom-helpers';

export default ({
	hidden = false,
	flex = '1 1 auto'
} = {}) => code('.console', {
	class: {
		hidden: !!hidden
	},
	style: {
		flex
	}
});
