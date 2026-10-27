import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { approvedCaptureBlobUrl, isStaticCaptureRaster } from '../src/capture-resource.js';
it('admits only the source document origin and blob protocol, without credential-bearing inner URLs', () => {
  const base = 'http://127.0.0.26:5626/frame.html';
  expect(approvedCaptureBlobUrl('blob:http://127.0.0.26:5626/asset-1', base)).toBe(
    'blob:http://127.0.0.26:5626/asset-1',
  );
  for (const url of [
    'https://example.test/private',
    'http://127.0.0.26:5626/image.png',
    'blob:http://127.0.0.25:5625/asset',
    'blob:null/asset',
    'blob:http://user:pass@127.0.0.26:5626/asset',
    'data:image/png;base64,AA==',
  ])
    expect(approvedCaptureBlobUrl(url, base)).toBeUndefined();
  expect(approvedCaptureBlobUrl('blob:http://127.0.0.26:5626/a', 'about:blank')).toBeUndefined();
});
it('admits a real static PNG fixture but rejects animated formats, APNG controls and malformed chunks', () => {
  const png = new Uint8Array(
    readFileSync(
      new URL(
        '../../ui-media-svelte/test/fixtures/foundation-media/synthetic-image.png',
        import.meta.url,
      ),
    ),
  );
  expect(isStaticCaptureRaster(png, 'image/png')).toBe(true);
  expect(isStaticCaptureRaster(png, 'image/gif')).toBe(false);
  expect(isStaticCaptureRaster(png, 'image/webp')).toBe(false);
  const animated = new Uint8Array(png.length + 20);
  animated.set(png.subarray(0, 8));
  new DataView(animated.buffer).setUint32(8, 8);
  animated.set(new TextEncoder().encode('acTL'), 12);
  animated.set(png.subarray(8), 28);
  expect(isStaticCaptureRaster(animated, 'image/png')).toBe(false);
  const malformed = png.slice();
  new DataView(malformed.buffer).setUint32(8, 0xffffffff);
  expect(isStaticCaptureRaster(malformed, 'image/png')).toBe(false);
});
