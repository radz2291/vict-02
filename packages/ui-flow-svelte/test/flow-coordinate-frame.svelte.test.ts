import { afterEach, expect, test, vi } from 'vitest';
import { getPointerPosition, getHandleBounds, getViewportForBounds } from '@xyflow/system';
import {
  engineViewport,
  logicalViewport,
  observeFlowCoordinateFrame,
} from '../src/flow-coordinate-frame.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test.each([1, 0.348405, 0.5, 0.348405 * 0.7, 0.348405 * 0.7 * 0.6, 2])(
  'logical/engine roundtrip and native pointer units at ancestor scale %s',
  (scale) => {
    const logical = { x: 22.873, y: 14, zoom: 1.00317 },
      engine = engineViewport(logical, scale);
    const roundtrip = logicalViewport(engine, scale);
    expect(roundtrip.x).toBeCloseTo(logical.x, 12);
    expect(roundtrip.y).toBeCloseTo(logical.y, 12);
    expect(roundtrip.zoom).toBeCloseTo(logical.zoom, 12);
    const start = getPointerPosition(new MouseEvent('mousemove', { clientX: 600, clientY: 450 }), {
      transform: [engine.x, engine.y, engine.zoom],
      containerBounds: new DOMRect(100, 200, 760 * scale, 380 * scale),
    });
    const end = getPointerPosition(new MouseEvent('mousemove', { clientX: 630, clientY: 460 }), {
      transform: [engine.x, engine.y, engine.zoom],
      containerBounds: new DOMRect(100, 200, 760 * scale, 380 * scale),
    });
    expect((end.x - start.x) * logical.zoom * scale).toBeCloseTo(30, 9);
    expect((end.y - start.y) * logical.zoom * scale).toBeCloseTo(10, 9);
    const panned = logicalViewport({ ...engine, x: engine.x + 30, y: engine.y + 10 }, scale);
    expect((panned.x - logical.x) * scale).toBeCloseTo(30, 9);
    expect((panned.y - logical.y) * scale).toBeCloseTo(10, 9);
  },
);

test('wheel anchoring, fit and zoom policy are conjugated into engine screen units', () => {
  const scale = 0.348405,
    logical = { x: 22.873, y: 14, zoom: 1.00317 },
    engine = engineViewport(logical, scale),
    point = { x: 500, y: 250 };
  const world = { x: (point.x - engine.x) / engine.zoom, y: (point.y - engine.y) / engine.zoom },
    nextZoom = 2 * scale;
  const zoomed = logicalViewport(
    { x: point.x - world.x * nextZoom, y: point.y - world.y * nextZoom, zoom: nextZoom },
    scale,
  );
  expect(scale * (zoomed.x + world.x * zoomed.zoom)).toBeCloseTo(point.x, 9);
  expect(scale * (zoomed.y + world.y * zoomed.zoom)).toBeCloseTo(point.y, 9);
  const bounds = { x: 0, y: 0, width: 680, height: 150 };
  const ordinary = getViewportForBounds(bounds, 760, 380, 0.15, 1.1, 0.2),
    scaled = getViewportForBounds(bounds, 760 * scale, 380 * scale, 0.15 * scale, 1.1 * scale, 0.2);
  const restored = logicalViewport(scaled, scale);
  // The pinned public fitter floors padding to physical pixels, so its two
  // independently sized viewports need not have identical subpixel padding.
  expect(Math.abs(restored.x - ordinary.x) * scale).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.y - ordinary.y) * scale).toBeLessThanOrEqual(1);
  expect(Math.abs(restored.zoom - ordinary.zoom) * bounds.width * scale).toBeLessThanOrEqual(2);
});

test('public handle measurement keeps authored local coordinates after frame normalization', () => {
  const node = document.createElement('div'),
    handle = document.createElement('div');
  handle.className = 'source';
  handle.dataset.handleid = 'out';
  handle.dataset.handlepos = 'right';
  node.append(handle);
  const zoom = 0.348405 * 1.2,
    nodeRect = new DOMRect(100, 200, 190 * zoom, 110 * zoom);
  vi.spyOn(handle, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100 + 186 * zoom, 200 + 51 * zoom, 8 * zoom, 8 * zoom),
  );
  Object.defineProperties(handle, { offsetWidth: { value: 8 }, offsetHeight: { value: 8 } });
  const result = getHandleBounds('source', node, nodeRect, zoom, 'same-inner-id')!;
  expect(result[0]).toMatchObject({ id: 'out', nodeId: 'same-inner-id', width: 8, height: 8 });
  expect(result[0].x).toBeCloseTo(186, 9);
  expect(result[0].y).toBeCloseTo(51, 9);
});

test('own-frame measurement follows two/three ancestor scales and parent zoom changes without polling', async () => {
  const outer = document.createElement('div'),
    middle = document.createElement('div'),
    frame = document.createElement('div');
  outer.style.transform = 'scale(0.348405)';
  middle.style.transform = 'scale(0.7)';
  frame.style.width = '760px';
  frame.style.height = '380px';
  outer.append(middle);
  middle.append(frame);
  document.body.append(outer);
  let total = 0.348405 * 0.7;
  vi.spyOn(frame, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(100, 200, 760 * total, 380 * total),
  );
  const values: { scale: number; supported: boolean }[] = [],
    action = observeFlowCoordinateFrame(frame, (scale, supported) =>
      values.push({ scale, supported }),
    );
  expect(values.at(-1)?.supported).toBe(true);
  expect(values.at(-1)?.scale).toBeCloseTo(total, 10);
  total *= 0.6;
  middle.style.transform = 'scale(0.42)';
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(values.at(-1)?.scale).toBeCloseTo(total, 10);
  total = 0.5 * 0.42;
  outer.style.transform = 'scale(0.5)';
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(values.at(-1)?.scale).toBeCloseTo(total, 10);
  action.destroy();
  const count = values.length;
  outer.style.transform = 'scale(0.8)';
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(values).toHaveLength(count);
});

test('rotated or nonuniform measured frames explicitly refuse instead of publishing false coordinates', () => {
  const parent = document.createElement('div'),
    frame = document.createElement('div');
  frame.style.width = '760px';
  frame.style.height = '380px';
  parent.append(frame);
  document.body.append(parent);
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 380, 190));
  parent.style.transform = 'rotate(45deg)';
  const values: boolean[] = [],
    first = observeFlowCoordinateFrame(frame, (_scale, supported) => values.push(supported));
  expect(values.at(-1)).toBe(false);
  first.destroy();
  parent.style.transform = 'none';
  vi.mocked(frame.getBoundingClientRect).mockReturnValue(new DOMRect(0, 0, 380, 380));
  const second = observeFlowCoordinateFrame(frame, (_scale, supported) => values.push(supported));
  expect(values.at(-1)).toBe(false);
  second.destroy();
});

test('individual CSS reflections refuse despite a positive uniform bounding box', () => {
  const parent = document.createElement('div'),
    frame = document.createElement('div');
  parent.style.scale = '-1';
  frame.style.width = '760px';
  frame.style.height = '380px';
  parent.append(frame);
  document.body.append(parent);
  vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 760, 380));
  const values: boolean[] = [],
    action = observeFlowCoordinateFrame(frame, (_scale, supported) => values.push(supported));
  expect(values.at(-1)).toBe(false);
  action.destroy();
});

test('own-window resize is coalesced and its listener/queued measurement are removed on teardown', async () => {
  const root = document.createElement('div');
  root.style.width = '760px';
  root.style.height = '380px';
  document.body.append(root);
  const rect = vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 380, 190));
  const add = vi.spyOn(window, 'addEventListener'),
    remove = vi.spyOn(window, 'removeEventListener');
  const seen: number[] = [];
  const action = observeFlowCoordinateFrame(root, (value) => seen.push(value));
  const listener = add.mock.calls.find((call) => call[0] === 'resize')?.[1];
  expect(listener).toBeTypeOf('function');
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('resize'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(seen).toEqual([0.5, 0.5]);
  window.dispatchEvent(new Event('resize'));
  action.destroy();
  const reads = rect.mock.calls.length;
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.dispatchEvent(new Event('resize'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(rect).toHaveBeenCalledTimes(reads);
  expect(seen).toEqual([0.5, 0.5]);
  expect(remove).toHaveBeenCalledWith('resize', listener);
});
