// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { captureRenderedElement } from '@victframework/ui-ai-svelte';

const { toSvg } = vi.hoisted(() => ({
  toSvg: vi.fn(async (_element: HTMLElement, _options: Record<string, unknown>): Promise<string> => {
    throw new Error('INDEPENDENT_FILTER_PROBE_STOP');
  }),
}));
vi.mock('html-to-image', () => ({ toSvg }));
const fonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  document.body.replaceChildren();
  if (fonts) Object.defineProperty(document, 'fonts', fonts);
  else delete (document as unknown as Record<string, unknown>).fonts;
  vi.restoreAllMocks();
  toSvg.mockClear();
});

it('independent challenge: capture skips only non-rendered HTML images and preserves visible failures and SVG resources', async () => {
  // Configuration seam only: no raster, image decode or provider proof is claimed.
  const frame = document.createElement('main');
  document.body.append(frame);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  vi.spyOn(frame, 'getClientRects').mockReturnValue({ length: 1 } as DOMRectList);
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, toJSON: () => ({}) });
  const image = (style = '') => { const img = document.createElement('img'); img.setAttribute('src', '/independent-missing-image.png'); img.setAttribute('style', style); frame.append(img); return img; };
  const hidden = image('display:none');
  const parent = document.createElement('div'); parent.style.display = 'none'; frame.append(parent);
  const hiddenByParent = document.createElement('img'); parent.append(hiddenByParent);
  const visibleBroken = image();
  const zeroSize = image('width:0;height:0');
  const opacity = image('opacity:0');
  const visibility = image('visibility:hidden');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); defs.setAttribute('style', 'display:none');
  const svgImage = document.createElementNS('http://www.w3.org/2000/svg', 'image'); defs.append(svgImage); svg.append(defs); frame.append(svg);
  await expect(captureRenderedElement(frame)).rejects.toThrow('INDEPENDENT_FILTER_PROBE_STOP');
  const filter = toSvg.mock.calls[0]?.[1]?.filter;
  expect(typeof filter).toBe('function');
  if (typeof filter !== 'function') return;
  expect(filter(hidden)).toBe(false);
  expect(filter(hiddenByParent)).toBe(false);
  for (const retained of [visibleBroken, zeroSize, opacity, visibility, svg, defs, svgImage]) expect(filter(retained)).toBe(true);
});
