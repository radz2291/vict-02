const focusable =
  'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function trapFocus(event: KeyboardEvent, panel: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(focusable)).filter(isFocusable);
  const first = items[0],
    last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const active = panel.ownerDocument.activeElement;
  if (event.shiftKey && (active === first || !panel.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}
/** Focus identity belongs to the application's document, possibly an iframe. */
export function isFocusable(item: Element): item is HTMLElement {
  const constructor = item.ownerDocument.defaultView?.HTMLElement;
  if (!constructor || !(item instanceof constructor) || !item.isConnected) return false;
  if (item.matches(':disabled,[aria-disabled="true"]')) return false;
  for (let ancestor: Element | null = item; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'FIELDSET' && ancestor.hasAttribute('disabled')) {
      const legend = Array.from(ancestor.children).find(child => child.tagName === 'LEGEND');
      if (!legend?.contains(item)) return false;
    }
    const style = item.ownerDocument.defaultView!.getComputedStyle(ancestor);
    if (ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}
export function restoreFocus(original: Element | null, fallback?: HTMLElement | null): void {
  const target = original && isFocusable(original) ? original : fallback && isFocusable(fallback) ? fallback : undefined;
  target?.focus({preventScroll: true});
}
const locks = new WeakMap<HTMLElement, { count: number; overflow: string }>();
/** Lock only the owned application viewport, never the Studio/document body. */
export function lockViewport(panel: HTMLElement): () => void {
  const viewport = panel.closest<HTMLElement>('[data-ui-application-viewport]');
  if (!viewport) return () => {};
  const lock = locks.get(viewport) ?? { count: 0, overflow: viewport.style.overflow };
  lock.count++;
  locks.set(viewport, lock);
  viewport.style.overflow = 'hidden';
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count === 0) {
      viewport.style.overflow = lock.overflow;
      locks.delete(viewport);
    }
  };
}
