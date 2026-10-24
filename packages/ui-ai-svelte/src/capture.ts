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
  constructor(code: string, readonly captureReason: string) { super(code); }
}

/** Rasterizes the existing, styled DOM; it does not render a source-document substitute.
 * The caller identifies the actual preview element and fences changing preview state.
 * Browser rasterization can refuse unsupported fonts/images rather than inventing pixels. */
export async function captureRenderedElement(element: HTMLElement, viewport?: HTMLElement): Promise<RenderedCapture> {
  if (!element.isConnected || element.getClientRects().length === 0)
    throw new RenderedCaptureError('STUDIO_CAPTURE_NOT_VISIBLE', !element.isConnected ? 'frame-disconnected' : 'frame-no-layout');
  await document.fonts.ready;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) throw new RenderedCaptureError('STUDIO_CAPTURE_NOT_VISIBLE', 'frame-zero-size');
  const sourceWidth = Math.ceil(rect.width);
  const sourceHeight = Math.ceil(rect.height);
  const clipping = viewport?.getBoundingClientRect() ?? rect;
  const offsetLeft = Math.max(0, Math.ceil(clipping.left - rect.left));
  const offsetTop = Math.max(0, Math.ceil(clipping.top - rect.top));
  const width = Math.min(Math.ceil(Math.min(rect.right, clipping.right) - Math.max(rect.left, clipping.left)), RENDER_CAPTURE_LIMITS.width);
  const height = Math.min(Math.ceil(Math.min(rect.bottom, clipping.bottom) - Math.max(rect.top, clipping.top)), RENDER_CAPTURE_LIMITS.height);
  if (width < 1 || height < 1) throw new RenderedCaptureError('STUDIO_CAPTURE_NOT_VISIBLE', 'frame-outside-viewport');
  // html-to-image does not preserve scrolled descendant offsets. Refuse such
  // a state instead of supplying a misleading top-of-content image.
  if (element.scrollTop !== 0 || element.scrollLeft !== 0 || Array.from(element.querySelectorAll<HTMLElement>('*')).some(node => node.scrollTop !== 0 || node.scrollLeft !== 0))
    throw new RenderedCaptureError('STUDIO_CAPTURE_NESTED_SCROLL', 'nested-scroll');
  const { toSvg } = await import('html-to-image');
  const renderedStyle = getComputedStyle(element);
  const svgUrl = await toSvg(element, {
    width: sourceWidth, height: sourceHeight, pixelRatio: 1,
    // Options width/height also affect clone CSS. Restore the source's exact
    // content/border-box dimensions so padded elements do not expand/reflow.
    // The capture root becomes the image origin. Its external positioning is
    // already represented by rect and the viewport crop; copying those offsets
    // into the clone would apply them a second time. Keep its position mode
    // (and therefore descendant containing-block behavior) and normalize only
    // the root insets. Descendant positions and the source DOM stay untouched.
    style: { width: renderedStyle.width, height: renderedStyle.height, margin: '0', left: '0px', top: '0px', right: 'auto', bottom: 'auto' },
    cacheBust: false,
    // Avatar fallbacks may retain a display:none img with src="". Embedding
    // that non-rendered image fetches the page HTML and fails image decoding.
    // Omit only images outside layout; visible images and SVG defs stay intact.
    filter: node => {
      if (!(node instanceof HTMLImageElement)) return true;
      for (let current: Element | null = node; current; current = current.parentElement)
        if (getComputedStyle(current).display === 'none') return false;
      return true;
    },
  });
  // Keep source layout dimensions unchanged, then crop the raster viewport.
  // Changing the element's width/height before capture would reflow its layout.
  const xml = new DOMParser().parseFromString(decodeURIComponent(svgUrl.slice(svgUrl.indexOf(',') + 1)), 'image/svg+xml');
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
  const layout = xml.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  layout.setAttribute('style', `zoom:${layoutScale};width:${sourceWidth}px;height:${sourceHeight}px`);
  while (foreignObject.firstChild) layout.appendChild(foreignObject.firstChild);
  foreignObject.appendChild(layout);
  foreignObject.setAttribute('width', String(sourceWidth * layoutScale));
  foreignObject.setAttribute('height', String(sourceHeight * layoutScale));
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `${offsetLeft * layoutScale} ${offsetTop * layoutScale} ${width * layoutScale} ${height * layoutScale}`);
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`; });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('STUDIO_CAPTURE_FAILED');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0);
  for (const quality of [0.85, 0.65, 0.45]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size > 0 && blob.size <= RENDER_CAPTURE_LIMITS.bytes)
      return { blob, width, height, sourceWidth, sourceHeight, offsetLeft, offsetTop, cropped: width < sourceWidth || height < sourceHeight };
  }
  throw new Error('STUDIO_CAPTURE_IMAGE_LIMIT');
}
