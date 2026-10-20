import { expect, it } from 'vitest';
import { floatingPlacement } from '../src/floating-position.js';
const visible = { left: 200, right: 1000, top: 100, bottom: 700 };
it('keeps the page header below the selection while pages change size when space permits', () => {
  const anchor = { left: 300, right: 800, top: 200, bottom: 250 };
  expect(floatingPlacement(anchor, visible, 80, 'below')?.top).toBe(260);
  expect(floatingPlacement(anchor, visible, 200, 'below')?.top).toBe(260);
});
it('prefers above and clamps a palette near the right edge', () => {
  expect(floatingPlacement({ left: 800, right: 950, top: 300, bottom: 350 }, visible, 40)).toEqual({
    left: 520,
    top: 250,
    width: 480,
  });
});
it('uses below near the top, and wraps within narrow editing surfaces', () => {
  expect(
    floatingPlacement(
      { left: 30, right: 300, top: 110, bottom: 160 },
      { left: 10, right: 380, top: 100, bottom: 700 },
      75,
    ),
  ).toEqual({ left: 10, top: 170, width: 370 });
});
it('hides offscreen selections and tolerates oversized containers without escaping the surface', () => {
  expect(
    floatingPlacement({ left: 300, right: 500, top: 800, bottom: 900 }, visible, 40),
  ).toBeUndefined();
  expect(floatingPlacement({ left: 300, right: 900, top: 110, bottom: 690 }, visible, 60)).toEqual({
    left: 300,
    top: 100,
    width: 480,
  });
});
