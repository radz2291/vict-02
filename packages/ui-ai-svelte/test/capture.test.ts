// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
const toSvg = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toSvg }));
import { captureRenderedElement, RENDER_CAPTURE_LIMITS } from '../src/capture.js';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  document.body.innerHTML = '';
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); toSvg.mockReset();
});

function fixture(rect: DOMRect, clipping?: DOMRect, rootStyle = 'width:640px;height:731.2px') {
  const frame = document.createElement('div');
  frame.setAttribute('style', rootStyle);
  frame.innerHTML = '<div style="display:inline-flex;flex-wrap:wrap;width:112.912px;border:.8px solid;padding:8px 10px"><span>15</span><span>/</span><span>04</span><span>/</span><span>2026</span></div>';
  document.body.append(frame);
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(rect);
  vi.spyOn(frame, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  const viewport = clipping ? document.createElement('div') : undefined;
  if (viewport) vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(clipping!);
  toSvg.mockImplementation(async (_element, options) => {
    const clone = frame.cloneNode(true) as HTMLElement;
    // html-to-image applies options.style only to the cloned root, after
    // copying the source computed styles. Exercise that real boundary here.
    Object.assign(clone.style, options.style);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="${Math.ceil(rect.width)}" height="${Math.ceil(rect.height)}">${clone.outerHTML}</foreignObject></svg>`)}`;
  });
  let rasterSvg = '';
  vi.stubGlobal('Image', class {
    onload?: () => void;
    set src(value: string) { rasterSvg = decodeURIComponent(value.slice(value.indexOf(',') + 1)); queueMicrotask(() => this.onload?.()); }
  });
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['actual-encoder-boundary'], { type: 'image/jpeg' })));
  return { frame, viewport, context, encode, raster: () => new DOMParser().parseFromString(rasterSvg, 'image/svg+xml') };
}

it('scales only serialized clone layout and crop coordinates, preserving fractional source geometry and the actual DOM', async () => {
  const test = fixture(new DOMRect(20, 30, 641.6, 731.2), new DOMRect(60.2, 55.3, 300.2, 200.4));
  const before = test.frame.outerHTML;
  const capture = await captureRenderedElement(test.frame, test.viewport);
  expect(capture).toMatchObject({ width: 301, height: 201, sourceWidth: 642, sourceHeight: 732, offsetLeft: 41, offsetTop: 26, cropped: true });
  const xml = test.raster(), svg = xml.documentElement, foreign = xml.querySelector('foreignObject')!;
  expect(svg.getAttribute('width')).toBe('301'); expect(svg.getAttribute('height')).toBe('201');
  expect(svg.getAttribute('viewBox')).toBe('82 52 602 402');
  expect(foreign.getAttribute('width')).toBe('1284'); expect(foreign.getAttribute('height')).toBe('1464');
  expect(foreign.firstElementChild?.getAttribute('style')).toBe('zoom:2;width:642px;height:732px');
  expect(foreign.querySelector('[style*="inline-flex"]')?.getAttribute('style')).toContain('width:112.912px');
  expect(test.frame.outerHTML).toBe(before);
  expect(test.context.fillRect).toHaveBeenCalledWith(0, 0, 301, 201);
  expect(test.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0);
  expect(test.encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
});

it.each(['relative', 'absolute'])('normalizes only a %s captured root position before applying the measured viewport crop', async position => {
  const test = fixture(new DOMRect(-10, 127.1, 641.6, 732), new DOMRect(20, 347.10001, 420, 460), `position:${position};left:-30px;top:-220px;right:4px;bottom:8px;width:640px;height:730.4px;margin:0`);
  const child = test.frame.firstElementChild as HTMLElement;
  child.style.position = 'relative'; child.style.left = '7px'; child.style.top = '11px';
  const before = test.frame.outerHTML;
  const capture = await captureRenderedElement(test.frame, test.viewport);
  expect(capture).toMatchObject({ width: 420, height: 460, sourceWidth: 642, sourceHeight: 732, offsetLeft: 30, offsetTop: 221, cropped: true });
  const xml = test.raster();
  expect(xml.documentElement.getAttribute('viewBox')).toBe('60 442 840 920');
  const cloneRoot = xml.querySelector('foreignObject')!.firstElementChild!.firstElementChild as HTMLElement;
  expect(cloneRoot.style.position).toBe(position);
  expect(cloneRoot.style.left).toBe('0px'); expect(cloneRoot.style.top).toBe('0px');
  expect(cloneRoot.style.right).toBe('auto'); expect(cloneRoot.style.bottom).toBe('auto');
  const cloneChild = cloneRoot.firstElementChild as HTMLElement;
  expect(cloneChild.style.left).toBe('7px'); expect(cloneChild.style.top).toBe('11px');
  expect(test.frame.outerHTML).toBe(before);
  expect(test.context.fillRect).toHaveBeenCalledWith(0, 0, 420, 460);
});

it('keeps output pixel and JPEG byte budgets unchanged by internal layout scaling', async () => {
  const test = fixture(new DOMRect(0, 0, 2000, 1800));
  test.encode.mockImplementation((callback, _type, quality) => callback(new Blob([new Uint8Array(quality === 0.85 ? RENDER_CAPTURE_LIMITS.bytes + 1 : 123)], { type: 'image/jpeg' })));
  const capture = await captureRenderedElement(test.frame);
  expect(capture).toMatchObject({ width: 1600, height: 1200, sourceWidth: 2000, sourceHeight: 1800, offsetLeft: 0, offsetTop: 0, cropped: true });
  expect(capture.blob.size).toBe(123);
  expect(test.raster().documentElement.getAttribute('viewBox')).toBe('0 0 3200 2400');
  expect(test.context.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200);
  expect(test.encode.mock.calls.map(call => call[2])).toEqual([0.85, 0.65]);
});
