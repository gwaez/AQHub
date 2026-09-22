/** Place a fixed menu so the full box stays inside the viewport. Prefer up/left near edges. */

export function placeFixedMenu(
  click: { x: number; y: number },
  menu: { width: number; height: number },
  view: { width: number; height: number },
  margin = 8,
): { left: number; top: number } {
  const w = Math.max(1, menu.width);
  const h = Math.max(1, menu.height);
  const maxLeft = Math.max(margin, view.width - w - margin);
  const maxTop = Math.max(margin, view.height - h - margin);
  let left = click.x;
  let top = click.y;
  if (left + w + margin > view.width) left = click.x - w;
  if (top + h + margin > view.height) top = click.y - h;
  left = Math.min(Math.max(margin, left), maxLeft);
  top = Math.min(Math.max(margin, top), maxTop);
  return { left, top };
}

export function measureAndPlaceMenu(
  el: HTMLElement,
  clickX: number,
  clickY: number,
  viewW: number,
  viewH: number,
  minHeight = 320,
): { left: number; top: number } {
  const w = Math.max(el.offsetWidth || 0, el.getBoundingClientRect().width || 0, 180);
  const h = Math.max(el.offsetHeight || 0, el.getBoundingClientRect().height || 0, minHeight);
  const pos = placeFixedMenu({ x: clickX, y: clickY }, { width: w, height: h }, { width: viewW, height: viewH });
  el.style.left = `${Math.round(pos.left)}px`;
  el.style.top = `${Math.round(pos.top)}px`;
  return pos;
}
