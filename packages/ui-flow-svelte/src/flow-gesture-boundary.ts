/** Adapt public XYFlow class guards to the nearest owning VICT flow surface. */
export function flowGestureClasses(id: string) {
  const token = Array.from(id, char => char.codePointAt(0)!.toString(16)).join('-');
  return { noPanClass: `vict-graph-pan-guard-${token}`, noWheelClass: `vict-graph-wheel-guard-${token}` };
}

/** No global listeners, private stores, event cancellation or authored-source changes. */
export function guardFlowGestures(root: HTMLElement, classes: ReturnType<typeof flowGestureClasses>) {
  root.setAttribute('data-vict-flow-gesture-boundary', '');
  function capture(event: Event) {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1) return;
    // Upstream closest() crosses flow roots. Its per-instance public class props
    // must see local guards only; a deeper flow always owns its own gesture.
    let noPan = target.closest('[data-vict-flow-gesture-boundary]') !== root;
    let noWheel = noPan;
    for (let element: Element | null = target; element; element = element.parentElement) {
      noPan ||= element.classList.contains('nopan');
      noWheel ||= element.classList.contains('nowheel');
      if (element === root) break;
    }
    root.classList.toggle(classes.noPanClass, noPan);
    root.classList.toggle(classes.noWheelClass, noWheel);
  }
  const events = ['mousedown', 'touchstart', 'wheel', 'dblclick'];
  for (const type of events) root.addEventListener(type, capture, { capture: true });
  return { destroy() {
    for (const type of events) root.removeEventListener(type, capture, { capture: true });
    root.classList.remove(classes.noPanClass, classes.noWheelClass);
    root.removeAttribute('data-vict-flow-gesture-boundary');
  } };
}
