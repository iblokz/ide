import { a, span, ul, li, i } from 'iblokz-snabbdom-helpers';

/**
 * Hover dropdown (optional forced open via `open`)
 */
export default (className, {
  handle,
  handleClick,
  renderItem = item => item.content ?? (item.label && span(item.label)) ?? '',
  itemSelect = (ev, item) => ev.preventDefault() && item?.onSelect(),
  items = [],
  toLeft = false,
  flags = false,
  open = false,
  hook,
}) => {
  let mods = ['.dropdown', className];
  if (toLeft) mods = mods.concat(['.to-left']);
  if (flags) mods = mods.concat(['.flags']);
  if (open) mods = mods.concat(['.is-open']);

  const handleNode = flags
    ? span('.flag-handle', handle)
    : span('.handle', {
      on: handleClick ? {
        click: ev => {
          ev.preventDefault();
          handleClick();
        },
      } : {},
    }, handle);

  return a(mods.filter(Boolean).join(''), hook ? {hook} : {}, [
    handleNode,
    items.length ? ul(items.map(item => li({
      class: {
        active: !!item.active,
        disabled: !!item.disabled,
      },
      on: item.disabled ? {} : {
        click: ev => itemSelect(ev, item)
      },
    }, renderItem(item)))) : null,
  ]);
};

export const caret = () => i('.fa.fa-caret-down');
