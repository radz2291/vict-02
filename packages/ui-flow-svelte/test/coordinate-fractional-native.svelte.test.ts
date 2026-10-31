import { afterEach, expect, test, vi } from 'vitest';
import { observeFlowCoordinateFrame } from '../src/flow-coordinate-frame.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('fresh layout dimensions are used during resize before another RO callback arrives', async () => {
  let callback: ResizeObserverCallback | undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(next: ResizeObserverCallback) {
        callback = next;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  const root = document.createElement('div');
  root.style.width = '760px';
  root.style.height = '380px';
  document.body.append(root);
  const rect = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 380, 190));
  const values: number[] = [],
    observer = observeFlowCoordinateFrame(root, (scale) => values.push(scale));
  try {
    callback!(
      [{ target: root, contentRect: new DOMRect(0, 0, 760, 380) } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    root.style.width = '800px';
    root.style.height = '400px';
    rect.mockReturnValue(new DOMRect(0, 0, 400, 200));
    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(values.at(-1)).toBe(0.5);
  } finally {
    observer.destroy();
  }
});

test.each([
  {
    width: 1215.2,
    height: 718.4,
    rectWidth: 1215.2000732421875,
    rectHeight: 718.4000244140625,
    roWidth: 1215.1875,
    roHeight: 718.390625,
    scale: 1,
  },
  {
    width: 736.8,
    height: 378.4,
    rectWidth: 236.7107391357422,
    rectHeight: 121.5680694580078,
    roWidth: 736.796875,
    roHeight: 378.390625,
    scale: 0.321269,
  },
])(
  'coherent fractional computed/rect measurement stays supported after differently quantized RO notification: $width',
  (sample) => {
    let callback: ResizeObserverCallback | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(next: ResizeObserverCallback) {
          callback = next;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    const parent = document.createElement('div'),
      root = document.createElement('div');
    root.style.width = `${sample.width}px`;
    root.style.height = `${sample.height}px`;
    parent.style.transform = `matrix(${sample.scale},0,0,${sample.scale},0,0)`;
    parent.append(root);
    document.body.append(parent);
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, sample.rectWidth, sample.rectHeight),
    );
    const values: { scale: number; supported: boolean }[] = [],
      observer = observeFlowCoordinateFrame(root, (scale, supported) =>
        values.push({ scale, supported }),
      );
    try {
      expect(values.at(-1)?.supported).toBe(true);
      callback!(
        [
          {
            target: root,
            contentRect: new DOMRect(0, 0, sample.roWidth, sample.roHeight),
          } as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
      expect(values.at(-1)?.supported).toBe(true);
      expect(values.at(-1)?.scale).toBeCloseTo(sample.scale, 6);
    } finally {
      observer.destroy();
    }
  },
);
