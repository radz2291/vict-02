/** Browser-only rendered-element capture. Images travel separately from conversation JSON. */
export const RENDER_CAPTURE_LIMITS = Object.freeze({ bytes: 524_288, width: 1600, height: 1200 });

export interface RenderedCapture {
  blob: Blob;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  offsetLeft: number;
  offsetTop: number;
  cropped: boolean;
}

export class RenderedCaptureError extends Error {
  constructor(
    code: string,
    readonly captureReason: string,
  ) {
    super(code);
  }
}

const SVG_PAINT_PROPERTIES = [
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin',
  'stroke-miterlimit', 'clip-rule', 'opacity', 'color', 'visibility', 'display',
  'paint-order', 'vector-effect', 'shape-rendering', 'text-rendering',
  'color-interpolation', 'color-interpolation-filters', 'stop-color', 'stop-opacity',
  'flood-color', 'flood-opacity', 'lighting-color', 'filter', 'clip-path',
  'mask', 'mask-type', 'marker-start', 'marker-mid', 'marker-end',
  'font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch',
  'font-variant', 'letter-spacing', 'word-spacing', 'text-anchor',
  'dominant-baseline', 'alignment-baseline', 'text-decoration',
] as const;

/** html-to-image deep-clones an SVG but does not decorate its descendants.
 * Resolve stylesheet paint on those real source elements into the detached
 * SVG; otherwise a CSS-painted path (for example a MiniMap mask) defaults black.
 * Geometry, source DOM and the capture engine remain unchanged. */
function preserveSvgDescendantPaint(source: HTMLElement, serialized: Element): void {
  const native = Array.from(source.querySelectorAll('svg')),
    copies = Array.from(serialized.querySelectorAll('svg'));
  if (native.length !== copies.length)
    throw new RenderedCaptureError('STUDIO_CAPTURE_SVG_UNSUPPORTED', 'svg-clone-correspondence');
  for (let index = 0; index < native.length; index++) {
    const original = native[index]!, copy = copies[index]!,
      children = Array.from(original.querySelectorAll('*')),
      cloned = Array.from(copy.querySelectorAll('*'));
    if (children.length !== cloned.length)
      throw new RenderedCaptureError('STUDIO_CAPTURE_SVG_UNSUPPORTED', 'svg-clone-correspondence');
    for (let childIndex = 0; childIndex < children.length; childIndex++) {
      const node = children[childIndex]!, target = cloned[childIndex]!;
      if (node.localName !== target.localName || node.namespaceURI !== target.namespaceURI)
        throw new RenderedCaptureError('STUDIO_CAPTURE_SVG_UNSUPPORTED', 'svg-clone-correspondence');
      if (node.namespaceURI !== 'http://www.w3.org/2000/svg') continue;
      const style = source.ownerDocument.defaultView!.getComputedStyle(node);
      for (const property of SVG_PAINT_PROPERTIES) {
        let value = style.getPropertyValue(property);
        if (!value) continue;
        if (/url\(/i.test(value)) {
          // A serialized data SVG has a new document URL. Preserve only an
          // owned fragment; never invent or fetch a missing/external resource.
          const match = /^url\(["']?([^"')]+)["']?\)$/i.exec(value);
          let id: string | undefined;
          try {
            if (match) {
              const url = new URL(match[1]!, source.ownerDocument.baseURI),
                base = new URL(source.ownerDocument.baseURI);
              if (url.origin === base.origin && url.pathname === base.pathname &&
                  url.search === base.search && url.hash)
                id = decodeURIComponent(url.hash.slice(1));
            }
          } catch { /* Refuse malformed or nonlocal references below. */ }
          if (!id || /[\u0000-\u001f\u007f]/.test(id) || !source.contains(source.ownerDocument.getElementById(id)))
            throw new RenderedCaptureError('STUDIO_CAPTURE_SVG_UNSUPPORTED', 'svg-paint-resource-unverified');
          value = `url("#${id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`;
        }
        (target as SVGElement).style.setProperty(property, value);
      }
    }
  }
}

/** A flow border box is not the paint boundary of its in-subtree popup outlet.
 * Measure only connected, visible source descendants which intersect the actual
 * viewport. Keep ancestor clipping and owner scope; never clone viewport siblings.
 * The original root CSS dimensions remain unchanged in the serialized layout. */
function subtreePaintExtent(element: HTMLElement, descendants: readonly HTMLElement[], viewport: DOMRect) {
  const rect=element.getBoundingClientRect(), view=element.ownerDocument.defaultView!;
  let right=rect.right,bottom=rect.bottom;
  const owners=new Set([...(element.matches('[data-ui-owner-root]')?[element]:[]),...element.querySelectorAll<HTMLElement>('[data-ui-owner-root]')].map(node=>node.dataset.uiOwnerRoot).filter(Boolean));
  for(const node of descendants){
    if(!node.isConnected||!node.getClientRects().length)continue;
    const owner=node.closest('[data-ui-owner]')?.getAttribute('data-ui-owner');
    if(owners.size&&owner&&!owners.has(owner))continue;
    const paint=node.getBoundingClientRect();
    if(paint.width<=0||paint.height<=0)continue;
    let left=paint.left,top=paint.top,edge=paint.right,base=paint.bottom,visible=true;
    for(let ancestor:HTMLElement|null=node;ancestor;ancestor=ancestor.parentElement){
      const style=view.getComputedStyle(ancestor);
      if(style.display==='none'||['hidden','collapse'].includes(style.visibility)||style.opacity==='0'){visible=false;break;}
      if(ancestor!==node){
        const clip=ancestor.getBoundingClientRect();
        if(/^(hidden|clip|auto|scroll)$/.test(style.overflowX||style.overflow)){left=Math.max(left,clip.left);edge=Math.min(edge,clip.right);}
        if(/^(hidden|clip|auto|scroll)$/.test(style.overflowY||style.overflow)){top=Math.max(top,clip.top);base=Math.min(base,clip.bottom);}
      }
      if(ancestor===element)break;
    }
    if(!visible||Math.min(edge,viewport.right)<=Math.max(left,viewport.left)||Math.min(base,viewport.bottom)<=Math.max(top,viewport.top))continue;
    // This raster path retains the real root as its image origin. Visible
    // paint before that origin needs a different coordinate projection; do not
    // omit it and claim an uncropped observation, or expand this path's ABI.
    if(Math.max(left,viewport.left)<rect.left||Math.max(top,viewport.top)<rect.top)
      throw new RenderedCaptureError('STUDIO_CAPTURE_PAINT_UNSUPPORTED','paint-before-root-origin');
    right=Math.max(right,edge);bottom=Math.max(bottom,base);
  }
  return {right,bottom};
}

/** Rasterizes the existing, styled DOM; it does not render a source-document substitute.
 * The caller identifies the actual preview element and fences changing preview state.
 * Browser rasterization can refuse unsupported fonts/images rather than inventing pixels. */
export async function captureRenderedElement(
  element: HTMLElement,
  viewport?: HTMLElement,
): Promise<RenderedCapture> {
  if (!element.isConnected || element.getClientRects().length === 0)
    throw new RenderedCaptureError(
      'STUDIO_CAPTURE_NOT_VISIBLE',
      !element.isConnected ? 'frame-disconnected' : 'frame-no-layout',
    );
  await element.ownerDocument.fonts.ready;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1)
    throw new RenderedCaptureError('STUDIO_CAPTURE_NOT_VISIBLE', 'frame-zero-size');
  let sourceWidth = Math.ceil(rect.width);
  let sourceHeight = Math.ceil(rect.height);
  const clipping = viewport?.getBoundingClientRect() ?? rect;
  const offsetLeft = Math.max(0, Math.ceil(clipping.left - rect.left));
  const offsetTop = Math.max(0, Math.ceil(clipping.top - rect.top));
  let width = Math.min(
    Math.ceil(Math.min(rect.right, clipping.right) - Math.max(rect.left, clipping.left)),
    RENDER_CAPTURE_LIMITS.width,
  );
  let height = Math.min(
    Math.ceil(Math.min(rect.bottom, clipping.bottom) - Math.max(rect.top, clipping.top)),
    RENDER_CAPTURE_LIMITS.height,
  );
  if (width < 1 || height < 1)
    throw new RenderedCaptureError('STUDIO_CAPTURE_NOT_VISIBLE', 'frame-outside-viewport');
  const descendants = Array.from(element.querySelectorAll<HTMLElement>('*'));
  const nestedScroll =
    element.scrollTop !== 0 ||
    element.scrollLeft !== 0 ||
    descendants.some((node) => node.scrollTop !== 0 || node.scrollLeft !== 0);
  const positionedScroll =
    !!viewport &&
    (viewport.scrollTop !== 0 || viewport.scrollLeft !== 0) &&
    descendants.some((node) => ['fixed', 'sticky'].includes(getComputedStyle(node).position));
  if (nestedScroll || positionedScroll) {
    // The specialized path composes this same existing DOM into detached
    // clones. Unsupported geometry/resources are still explicit refusals.
    const { captureScrolledViewport } = await import('./capture-scroll.js');
    const blob = await captureScrolledViewport(element, viewport, RENDER_CAPTURE_LIMITS);
    return {
      blob,
      width,
      height,
      sourceWidth,
      sourceHeight,
      offsetLeft,
      offsetTop,
      cropped: width < sourceWidth || height < sourceHeight,
    };
  }
  if(viewport){
    const extent=subtreePaintExtent(element,descendants,clipping);
    sourceWidth=Math.ceil(extent.right-rect.left);
    sourceHeight=Math.ceil(extent.bottom-rect.top);
    width=Math.min(Math.ceil(Math.min(extent.right,clipping.right)-Math.max(rect.left,clipping.left)),RENDER_CAPTURE_LIMITS.width);
    height=Math.min(Math.ceil(Math.min(extent.bottom,clipping.bottom)-Math.max(rect.top,clipping.top)),RENDER_CAPTURE_LIMITS.height);
  }
  const { toSvg } = await import('html-to-image');
  const renderedStyle = getComputedStyle(element);
  const svgUrl = await toSvg(element, {
    width: sourceWidth,
    height: sourceHeight,
    pixelRatio: 1,
    // Options width/height also affect clone CSS. Restore the source's exact
    // content/border-box dimensions so padded elements do not expand/reflow.
    // The capture root becomes the image origin. Its external positioning is
    // already represented by rect and the viewport crop; copying those offsets
    // into the clone would apply them a second time. Keep its position mode
    // (and therefore descendant containing-block behavior) and normalize only
    // the root insets. Descendant positions and the source DOM stay untouched.
    style: {
      width: renderedStyle.width,
      height: renderedStyle.height,
      margin: '0',
      left: '0px',
      top: '0px',
      right: 'auto',
      bottom: 'auto',
    },
    cacheBust: false,
    // Avatar fallbacks may retain a display:none img with src="". Embedding
    // that non-rendered image fetches the page HTML and fails image decoding.
    // Omit only images outside layout; visible images and SVG defs stay intact.
    filter: (node) => {
      if ((node as Element).tagName !== 'IMG') return true;
      for (let current: Element | null = node; current; current = current.parentElement)
        if (getComputedStyle(current).display === 'none') return false;
      return true;
    },
  });
  // Keep source layout dimensions unchanged, then crop the raster viewport.
  // Changing the element's width/height before capture would reflow its layout.
  const xml = new DOMParser().parseFromString(
    decodeURIComponent(svgUrl.slice(svgUrl.indexOf(',') + 1)),
    'image/svg+xml',
  );
  const svg = xml.documentElement;
  // A standalone SVG lays out its foreignObject at its own pixel scale. At
  // fractional browser zoom, copied subpixel borders can round differently and
  // reflow an exactly fitting flex row (for example, segmented date inputs).
  // Lay out the clone at twice the internal scale, then map it back to the
  // original CSS-pixel viewport. This changes neither the source DOM nor the
  // requested canvas size, crop, or byte budget.
  const layoutScale = 2;
  const foreignObject = svg.querySelector('foreignObject');
  if (!foreignObject) throw new Error('STUDIO_CAPTURE_FAILED');
  preserveSvgDescendantPaint(element, foreignObject);
  const layout = xml.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  layout.setAttribute(
    'style',
    `zoom:${layoutScale};width:${sourceWidth}px;height:${sourceHeight}px`,
  );
  while (foreignObject.firstChild) layout.appendChild(foreignObject.firstChild);
  foreignObject.appendChild(layout);
  foreignObject.setAttribute('width', String(sourceWidth * layoutScale));
  foreignObject.setAttribute('height', String(sourceHeight * layoutScale));
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute(
    'viewBox',
    `${offsetLeft * layoutScale} ${offsetTop * layoutScale} ${width * layoutScale} ${height * layoutScale}`,
  );
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('STUDIO_CAPTURE_FAILED');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0);
  for (const quality of [0.85, 0.65, 0.45]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (blob && blob.size > 0 && blob.size <= RENDER_CAPTURE_LIMITS.bytes)
      return {
        blob,
        width,
        height,
        sourceWidth,
        sourceHeight,
        offsetLeft,
        offsetTop,
        cropped: width < sourceWidth || height < sourceHeight,
      };
  }
  throw new Error('STUDIO_CAPTURE_IMAGE_LIMIT');
}
