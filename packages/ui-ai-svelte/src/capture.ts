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

/** Rasterizes the existing, styled DOM; it does not render a source-document substitute.
 * The caller identifies the actual preview element and fences changing preview state.
 * Browser rasterization can refuse unsupported fonts/images rather than inventing pixels. */
export async function captureRenderedElement(element: HTMLElement, viewport?: HTMLElement): Promise<RenderedCapture> {
  if (!element.isConnected || element.getClientRects().length === 0)
    throw new Error('STUDIO_CAPTURE_NOT_VISIBLE');
  await document.fonts.ready;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) throw new Error('STUDIO_CAPTURE_NOT_VISIBLE');
  const sourceWidth = Math.ceil(rect.width);
  const sourceHeight = Math.ceil(rect.height);
  const clipping = viewport?.getBoundingClientRect() ?? rect;
  const offsetLeft = Math.max(0, Math.ceil(clipping.left - rect.left));
  const offsetTop = Math.max(0, Math.ceil(clipping.top - rect.top));
  const width = Math.min(Math.ceil(Math.min(rect.right, clipping.right) - Math.max(rect.left, clipping.left)), RENDER_CAPTURE_LIMITS.width);
  const height = Math.min(Math.ceil(Math.min(rect.bottom, clipping.bottom) - Math.max(rect.top, clipping.top)), RENDER_CAPTURE_LIMITS.height);
  if (width < 1 || height < 1) throw new Error('STUDIO_CAPTURE_NOT_VISIBLE');
  // html-to-image does not preserve scrolled descendant offsets. Refuse such
  // a state instead of supplying a misleading top-of-content image.
  if (element.scrollTop !== 0 || element.scrollLeft !== 0 || Array.from(element.querySelectorAll<HTMLElement>('*')).some(node => node.scrollTop !== 0 || node.scrollLeft !== 0))
    throw new Error('STUDIO_CAPTURE_NESTED_SCROLL');
  const { toSvg } = await import('html-to-image');
  const renderedStyle = getComputedStyle(element);
  const svgUrl = await toSvg(element, {
    width: sourceWidth, height: sourceHeight, pixelRatio: 1,
    // Options width/height also affect clone CSS. Restore the source's exact
    // content/border-box dimensions so padded elements do not expand/reflow.
    style: { width: renderedStyle.width, height: renderedStyle.height, margin: '0' },
    cacheBust: false,
  });
  // Keep source layout dimensions unchanged, then crop the raster viewport.
  // Changing the element's width/height before capture would reflow its layout.
  const xml = new DOMParser().parseFromString(decodeURIComponent(svgUrl.slice(svgUrl.indexOf(',') + 1)), 'image/svg+xml');
  const svg = xml.documentElement;
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `${offsetLeft} ${offsetTop} ${width} ${height}`);
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
