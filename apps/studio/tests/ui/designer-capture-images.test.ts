// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
const toSvg = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toSvg }));
import { captureRenderedElement } from '../../../../packages/ui-ai-svelte/src/capture.js';
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

afterEach(() => { document.body.innerHTML = ''; if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts); else Reflect.deleteProperty(document, 'fonts'); vi.restoreAllMocks(); toSvg.mockReset(); });
it('omits only display-none HTML images, preserving visible broken images and hidden SVG definitions', async () => {
  const frame = document.createElement('div');
  frame.innerHTML = '<img id="fallback-image" src="" style="display:none"><div style="display:none"><img id="hidden-ancestor-image" src=""></div><img id="visible-broken-image" src="missing-visible-image.png"><svg style="display:none"><defs id="retained-svg-definitions"></defs></svg><div id="retained-hidden-non-image" style="display:none">Hidden content</div>';
  document.body.append(frame);
  const rect = new DOMRect(0, 0, 500, 300);
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(rect);
  vi.spyOn(frame, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
  // happy-dom omits the FontFaceSet API; the real browser reproduction uses it.
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  for (const node of frame.querySelectorAll('*')) { Object.defineProperty(node, 'scrollTop', { configurable: true, value: 0 }); Object.defineProperty(node, 'scrollLeft', { configurable: true, value: 0 }); }
  toSvg.mockImplementation(async (_element, options) => {
    expect(options.filter(frame.querySelector('#fallback-image'))).toBe(false);
    expect(options.filter(frame.querySelector('#hidden-ancestor-image'))).toBe(false);
    expect(options.filter(frame.querySelector('#visible-broken-image'))).toBe(true);
    expect(options.filter(frame.querySelector('#retained-svg-definitions'))).toBe(true);
    expect(options.filter(frame.querySelector('svg'))).toBe(true);
    expect(options.filter(frame.querySelector('#retained-hidden-non-image'))).toBe(true);
    throw new Error('TEST_STOP_AFTER_REAL_CAPTURE_FILTER');
  });
  await expect(captureRenderedElement(frame)).rejects.toThrow('TEST_STOP_AFTER_REAL_CAPTURE_FILTER');
  expect(toSvg).toHaveBeenCalledTimes(1);
  expect(frame.querySelector('#fallback-image')).not.toBeNull();
  expect(frame.querySelector('#hidden-ancestor-image')).not.toBeNull();
});
