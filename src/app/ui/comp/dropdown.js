import { a, span, ul, li, i } from 'iblokz-snabbdom-helpers';

/**
 * Hover dropdown (optional forced open via `open`)
 * Keep the sel string stable — dynamic mods go on `class` so CSS
 * transitions (e.g. file-search width) are not killed by remounts.
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
  const sel = ['.dropdown', className].filter(Boolean).join('');
  const data = {
    class: {
      'to-left': !!toLeft,
      flags: !!flags,
      'is-open': !!open
    }
  };
  if (hook) data.hook = hook;

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

  return a(sel, data, [
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
