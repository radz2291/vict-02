export interface FlowViewportUnits {
  x: number;
  y: number;
  zoom: number;
}
export interface FlowCoordinateUnits {
  readonly scale: number;
}
export interface FlowCoordinateState extends FlowCoordinateUnits {
  viewport: FlowViewportUnits;
  readonly minZoom: number;
  readonly maxZoom: number;
}
export const FLOW_COORDINATE_UNITS = Symbol('vict.flow.coordinate-units@1');
export const engineViewport = (viewport: FlowViewportUnits, scale: number): FlowViewportUnits => ({
  x: viewport.x * scale,
  y: viewport.y * scale,
  zoom: viewport.zoom * scale,
});
export const logicalViewport = (viewport: FlowViewportUnits, scale: number): FlowViewportUnits => ({
  x: viewport.x / scale,
  y: viewport.y / scale,
  zoom: viewport.zoom / scale,
});

/** Measure only this frame and its ancestor transforms. No polling/global stores. */
export function observeFlowCoordinateFrame(
  root: HTMLElement,
  changed: (scale: number, supported: boolean) => void,
) {
  let width = 0,
    height = 0,
    alive = true,
    queued = false;
  const view = root.ownerDocument.defaultView!;
  function measure() {
    queued = false;
    if (!alive) return;
    const style = view.getComputedStyle(root),
      logicalWidth = width || parseFloat(style.width),
      logicalHeight = height || parseFloat(style.height),
      rect = root.getBoundingClientRect();
    // A hidden/unlaid-out frame supplies no scale evidence. Keep the ordinary
    // initial frame until layout/ResizeObserver reports a real positive extent.
    if (!(logicalWidth > 0 && logicalHeight > 0 && rect.width > 0 && rect.height > 0)) return;
    const x = rect.width / logicalWidth,
      y = rect.height / logicalHeight;
    let supported =
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x > 0 &&
      y > 0 &&
      Math.abs(x - y) <= Math.max(x, y) * 1e-6;
    for (
      let ancestor: HTMLElement | null = root.parentElement;
      supported && ancestor;
      ancestor = ancestor.parentElement
    ) {
      const css = view.getComputedStyle(ancestor);
      if (css.rotate && css.rotate !== 'none' && css.rotate !== '0deg') {
        supported = false;
        break;
      }
      // Individual CSS scale is separate from the transform matrix. A reflected
      // frame has a positive bounding rectangle but cannot use this positive-unit
      // conversion safely.
      if (css.scale && css.scale !== 'none') {
        const factors = css.scale.split(/\s+/).map(Number);
        if (factors.some((value) => !Number.isFinite(value) || value <= 0)) {
          supported = false;
          break;
        }
      }
      if (css.transform && css.transform !== 'none') {
        try {
          const matrix = new DOMMatrixReadOnly(css.transform);
          supported =
            matrix.is2D &&
            matrix.a > 0 &&
            matrix.d > 0 &&
            Math.abs(matrix.b) < 1e-10 &&
            Math.abs(matrix.c) < 1e-10;
        } catch {
          supported = false;
        }
      }
    }
    changed(supported ? (x + y) / 2 : 1, supported);
  }
  function schedule() {
    if (!queued && alive) {
      queued = true;
      queueMicrotask(measure);
    }
  }
  const resize = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry) {
      width = entry.contentRect.width;
      height = entry.contentRect.height;
    }
    measure();
  });
  resize.observe(root);
  const mutations = new MutationObserver(schedule);
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement)
    mutations.observe(ancestor, { attributes: true, attributeFilter: ['style', 'class'] });
  // Media queries and viewport units can change computed ancestor transforms
  // without changing any attribute or this frame's content-box size.
  view.addEventListener('resize', schedule);
  measure();
  return {
    destroy() {
      alive = false;
      resize.disconnect();
      mutations.disconnect();
      view.removeEventListener('resize', schedule);
    },
  };
}
