// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
const toSvg = vi.hoisted(() => vi.fn());
vi.mock('dom-to-image-more', () => ({ default: { toSvg } }));
import {
  captureScrolledViewport,
  prepareScrollCapture,
  projectPositionedRect,
} from '../src/capture-scroll.js';
const limits = { width: 1600, height: 1200, bytes: 524288 };
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('style');
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  toSvg.mockReset();
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
  else Reflect.deleteProperty(document, 'fonts');
});
function rect(node: Element, x: number, y: number, width: number, height: number) {
  vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height));
}
function fixture() {
  const root = document.createElement('div');
  root.style.cssText =
    'width:390px;height:420px;position:relative;overflow:auto;isolation:isolate;font-family:Arial';
  root.innerHTML =
    '<header style="position:sticky;top:0;z-index:20">Header</header><section style="position:relative;overflow:auto"><div style="position:sticky;top:0;z-index:11">Inner header</div><p>Rows</p></section><button style="position:fixed;bottom:12px;right:12px;z-index:30">Fixed action</button>';
  document.body.append(root);
  const [header, nested, fixed] = Array.from(root.children) as HTMLElement[];
  rect(root, 0, 0, 390, 420);
  rect(header!, 0, 0, 390, 42);
  rect(nested!, 20, -20, 290, 140);
  rect(nested!.firstElementChild!, 20, -20, 290, 30);
  rect(nested!.lastElementChild!, 20, -85, 290, 80);
  rect(fixed!, 286, 374, 92, 34);
  root.scrollTop = 110;
  nested!.scrollTop = 95;
  Object.defineProperties(nested!, {
    clientLeft: { value: 0 },
    clientTop: { value: 0 },
    clientWidth: { value: 290 },
    clientHeight: { value: 140 },
  });
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(new Set(), { ready: Promise.resolve() }),
  });
  let serialized: HTMLElement | undefined;
  toSvg.mockImplementation(async (source: HTMLElement, options) => {
    const clone = source.cloneNode(true) as HTMLElement;
    const native = [source, ...source.querySelectorAll('*')],
      copies = [clone, ...clone.querySelectorAll('*')];
    native.forEach((node, index) => options.adjustClonedNode(node, copies[index], true));
    Object.assign(clone.style, options.style);
    options.onclone(clone);
    serialized = clone;
    return 'data:image/svg+xml;charset=utf-8,<svg/>';
  });
  vi.stubGlobal(
    'Image',
    class {
      onload?: () => void;
      onerror?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
    cb(new Blob(['jpeg'], { type: 'image/jpeg' })),
  );
  return { root, header: header!, nested: nested!, fixed: fixed!, serialized: () => serialized! };
}
it('projects current measured coordinates and clips through nested and outer scrollports', () => {
  expect(
    projectPositionedRect(new DOMRect(20, -20, 290, 30), new DOMRect(0, 0, 390, 420), [
      new DOMRect(20, -20, 290, 140),
    ]),
  ).toEqual({ left: 20, top: -20, width: 290, height: 30, visible: true, inset: [20, 0, 0, 0] });
  expect(
    projectPositionedRect(new DOMRect(0, 500, 20, 20), new DOMRect(0, 0, 390, 420)).visible,
  ).toBe(false);
});
it('uses the public clone boundary, preserves flow placeholders and paints measured fixed/sticky copies without source mutations', async () => {
  const f = fixture(),
    before = f.root.outerHTML;
  const blob = await captureScrolledViewport(f.root, f.root, limits);
  expect(blob.type).toBe('image/jpeg');
  expect(f.root.outerHTML).toBe(before);
  expect([f.root.scrollTop, f.nested.scrollTop]).toEqual([110, 95]);
  expect(toSvg.mock.calls[0]![1]).toMatchObject({
    preserveScroll: true,
    copyDefaultStyles: false,
    disableEmbedFonts: true,
    width: 390,
    height: 420,
  });
  const clone = f.serialized(),
    overlays = Array.from(clone.children).filter(
      (node) => (node as HTMLElement).style.position === 'absolute',
    ) as HTMLElement[];
  expect(overlays).toHaveLength(3);
  expect(overlays[2]!.style.top).toBe('374px');
  expect(overlays[2]!.style.left).toBe('286px');
  expect(overlays[1]!.style.clipPath).toBe('inset(20px 0px 0px 0px)');
  expect((clone.firstElementChild as HTMLElement).style.visibility).toBe('hidden');
});
it('keeps measured scrollbar gutters without introducing interactive clone scrollbars', async () => {
  const f = fixture();
  Object.defineProperties(f.root, {
    offsetWidth: { value: 390 },
    clientWidth: { value: 375 },
    offsetHeight: { value: 420 },
    clientHeight: { value: 420 },
  });
  const before = f.root.outerHTML;
  await captureScrolledViewport(f.root, f.root, limits);
  const clone = f.serialized();
  expect(clone.style.overflowX).toBe('hidden');
  expect(clone.style.overflowY).toBe('hidden');
  expect(clone.style.paddingRight).toBe('15px');
  expect(clone.style.paddingBottom).toBe('0px');
  expect(clone.style.width).toBe('390px');
  expect(clone.style.height).toBe('420px');
  expect(f.root.outerHTML).toBe(before);
});
it.each([
  [
    'transform',
    (f) => {
      f.nested.style.transform = 'translateX(2px)';
    },
  ],
  [
    'auto stacking',
    (f) => {
      f.fixed.style.zIndex = 'auto';
    },
  ],
  [
    'rounded positioned clip',
    (f) => {
      f.nested.style.borderRadius = '20px';
    },
  ],
  [
    'native scroll',
    (f) => {
      const input = document.createElement('textarea');
      input.scrollTop = 2;
      f.root.append(input);
    },
  ],
  [
    'live video',
    (f) => {
      f.root.append(document.createElement('video'));
    },
  ],
  [
    'direct scrolled text',
    (f) => {
      f.nested.append(document.createTextNode('Direct scrolled text'));
    },
  ],
  [
    'RTL unscrolled gutter',
    (f) => {
      f.root.scrollTop = 0;
      f.nested.scrollTop = 0;
      f.root.style.direction = 'rtl';
    },
  ],
  [
    'static flex z context',
    (f) => {
      f.root.style.display = 'flex';
      f.nested.style.position = 'static';
      f.nested.style.zIndex = '2';
    },
  ],
  [
    'outside scale',
    (f) => {
      const ancestor = document.createElement('div');
      ancestor.style.transform = 'scale(2)';
      f.root.replaceWith(ancestor);
      ancestor.append(f.root);
    },
  ],
  [
    'changed absolute containing block',
    (f) => {
      const wrapper = document.createElement('div');
      const absolute = document.createElement('div');
      absolute.style.position = 'absolute';
      wrapper.append(absolute);
      f.nested.append(wrapper);
      Object.defineProperty(absolute, 'offsetParent', { value: f.root });
    },
  ],
] as const)('refuses the unverified %s composition', (_name, change) => {
  const f = fixture();
  change(f);
  expect(() => prepareScrollCapture(f.root)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
});
it('refuses unrelated viewport content rather than capturing Studio siblings', () => {
  const f = fixture(),
    viewport = document.createElement('div');
  f.root.replaceWith(viewport);
  viewport.append(f.root);
  rect(viewport, 0, 0, 390, 420);
  const toolbar = document.createElement('button');
  toolbar.textContent = 'Studio control';
  viewport.append(toolbar);
  rect(toolbar, 0, 0, 100, 30);
  expect(() => prepareScrollCapture(f.root, viewport)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
});
it('clips only X for the real clip/visible overflow combination', () => {
  const f = fixture();
  f.nested.style.overflow = '';
  f.nested.style.overflowX = 'clip';
  f.nested.style.overflowY = 'visible';
  const prepared = prepareScrollCapture(f.root);
  expect(
    prepared.positioned.find((item) => item.node === f.nested.firstElementChild)!.projection.inset,
  ).toEqual([20, 0, 0, 0]);
  rect(f.nested.firstElementChild!, 20, 115, 290, 30);
  expect(
    prepareScrollCapture(f.root).positioned.find(
      (item) => item.node === f.nested.firstElementChild,
    )!.projection.inset,
  ).toEqual([0, 0, 0, 0]);
});
it('refuses lifting a sticky over a later ordinary sibling at the same stack level', () => {
  const f = fixture(),
    later = document.createElement('div');
  later.style.cssText = 'position:absolute;z-index:20;top:0;left:0';
  later.textContent = 'Later ordinary overlay';
  f.root.append(later);
  expect(() => prepareScrollCapture(f.root)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
  try {
    prepareScrollCapture(f.root);
  } catch (error) {
    expect(error).toMatchObject({ captureReason: 'scroll-positioned-paint-order' });
  }
});
it('refuses creating a containing block for a static viewport absolute descendant', () => {
  const f = fixture(),
    absolute = document.createElement('div');
  f.root.style.position = 'static';
  f.root.scrollTop = 0;
  absolute.style.position = 'absolute';
  absolute.textContent = 'Externally positioned';
  f.root.append(absolute);
  Object.defineProperty(absolute, 'offsetParent', { value: document.body });
  expect(() => prepareScrollCapture(f.root)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
  try {
    prepareScrollCapture(f.root);
  } catch (error) {
    expect(error).toMatchObject({ captureReason: 'scroll-root-containing-block' });
  }
});
it('refuses an unembedded webfont whose quoted family includes a comma', () => {
  const f = fixture();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: new Set([{ family: '"Capture, Font"' }]),
  });
  f.root.style.fontFamily = '"Capture, Font", Arial';
  // Happy DOM strips quotes inside family names; retain the browser's legal
  // computed serialization at this boundary so the comma remains one family.
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node, pseudo) => {
    const style = computed(node, pseudo);
    if (node === f.root && !pseudo)
      return new Proxy(style, {
        get(target, key) {
          if (key === 'fontFamily') return '"Capture, Font", Arial';
          const value = Reflect.get(target, key, target);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    return style;
  });
  expect(() => prepareScrollCapture(f.root)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
});
it('does not silently ignore a font inventory entry requiring unsupported CSS escape decoding', () => {
  const f = fixture();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: new Set([{ family: 'Capture\\2c Font' }]),
  });
  expect(() => prepareScrollCapture(f.root)).toThrow('STUDIO_CAPTURE_SCROLL_UNSUPPORTED');
});
it('never falls through to a remote resource fetch or accepts its placeholder', async () => {
  const f = fixture(),
    fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  toSvg.mockImplementation(async (_root, options) => {
    await options.requestInterceptor('https://example.test/private-image').catch(() => {});
    return 'data:image/svg+xml,<svg/>';
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toThrow(
    'STUDIO_CAPTURE_SCROLL_UNSUPPORTED',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('admits a genuine same-origin immutable PNG blob with bounded credential-free options', async () => {
  const f = fixture(),
    origin = new URL(document.baseURI).origin,
    url = `blob:${origin}/owned-image`,
    png = new Uint8Array(
      readFileSync(
        new NodeURL(
          '../../ui-media-svelte/test/fixtures/foundation-media/synthetic-image.png',
          import.meta.url,
        ),
      ),
    );
  const fetch = vi.fn(
    async () => new Response(png.buffer, { headers: { 'content-type': 'image/png' } }),
  );
  vi.stubGlobal('fetch', fetch);
  toSvg.mockImplementation(async (_root, options) => {
    expect(await options.requestInterceptor(url)).toMatch(/^data:image\/png;base64,/);
    return 'data:image/svg+xml,<svg/>';
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).resolves.toBeInstanceOf(Blob);
  expect(fetch).toHaveBeenCalledWith(
    url,
    expect.objectContaining({
      credentials: 'omit',
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }),
  );
});
it('refuses a foreign blob before any fetch', async () => {
  const f = fixture(),
    fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  toSvg.mockImplementation(async (_root, options) => {
    await options
      .requestInterceptor('blob:https://unrelated.example/private-image')
      .catch(() => {});
    return 'data:image/svg+xml,<svg/>';
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toThrow(
    'STUDIO_CAPTURE_SCROLL_UNSUPPORTED',
  );
  expect(fetch).not.toHaveBeenCalled();
});
it('does not accept a placeholder after a same-origin blob exceeds its streamed byte bound', async () => {
  const f = fixture(),
    url = `blob:${new URL(document.baseURI).origin}/too-large`;
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(new Uint8Array(4 * 1024 * 1024 + 1), {
          headers: { 'content-type': 'image/png' },
        }),
    ),
  );
  toSvg.mockImplementation(async (_root, options) => {
    await options.requestInterceptor(url).catch(() => {});
    return 'data:image/svg+xml,<svg/>';
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toThrow(
    'STUDIO_CAPTURE_SCROLL_UNSUPPORTED',
  );
});
it('refuses a changed source after serialization instead of reporting stale pixels', async () => {
  const f = fixture(),
    serialize = toSvg.getMockImplementation()!;
  toSvg.mockImplementation(async (...args) => {
    const result = await serialize(...args);
    f.header.textContent = 'Changed by owner';
    return result;
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toThrow(
    'STUDIO_CAPTURE_STALE',
  );
});
it('rechecks paint ancestors after encoding rather than accepting a newly filtered outside context', async () => {
  const f = fixture(),
    serialize = toSvg.getMockImplementation()!;
  toSvg.mockImplementation(async (...args) => {
    const result = await serialize(...args);
    document.body.style.opacity = '.5';
    return result;
  });
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toMatchObject({
    captureReason: 'scroll-outside-ancestor-paint',
  });
});
it('rejects stylesheet-only text paint changes even when the source DOM and measured boxes stay unchanged', async () => {
  const f = fixture(),
    serialize = toSvg.getMockImplementation()!,
    stylesheet = document.createElement('style');
  f.header.id = 'capture-header';
  stylesheet.textContent = '#capture-header { font-weight: 400; letter-spacing: 0px; }';
  document.head.append(stylesheet);
  try {
    toSvg.mockImplementation(async (...args) => {
      const result = await serialize(...args);
      stylesheet.textContent = '#capture-header { font-weight: 700; letter-spacing: 2px; }';
      return result;
    });
    await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toThrow(
      'STUDIO_CAPTURE_STALE',
    );
  } finally {
    stylesheet.remove();
  }
});
it('quarantines an unsettled shared engine and recovers only after that operation really settles', async () => {
  const f = fixture(),
    serialize = toSvg.getMockImplementation()!;
  vi.useFakeTimers();
  let finish!: (svg: string) => void;
  toSvg.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const running = captureScrolledViewport(f.root, f.root, limits),
    failure = expect(running).rejects.toMatchObject({
      message: 'STUDIO_CAPTURE_SCROLL_ENGINE_STALLED',
      captureReason: 'scroll-engine-stalled-reload-required',
    });
  await vi.advanceTimersByTimeAsync(0);
  expect(toSvg).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(8001);
  await failure;
  await expect(captureScrolledViewport(f.root, f.root, limits)).rejects.toMatchObject({
    captureReason: 'scroll-engine-stalled-reload-required',
  });
  finish('data:image/svg+xml,<svg/>');
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  toSvg.mockImplementation(serialize);
  await expect(captureScrolledViewport(f.root, f.root, limits)).resolves.toBeInstanceOf(Blob);
});
