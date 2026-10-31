import { expect, test, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Host from './CoordinateFrameHost.svelte';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 65));
  flushSync();
};
function drag(target: Element, dx: number, dy: number) {
  target.dispatchEvent(
    new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      view: window,
    }),
  );
  window.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      buttons: 1,
      clientX: 100 + dx,
      clientY: 100 + dy,
      view: window,
    }),
  );
  window.dispatchEvent(
    new MouseEvent('mouseup', {
      bubbles: true,
      button: 0,
      clientX: 100 + dx,
      clientY: 100 + dy,
      view: window,
    }),
  );
}
test('pinned public engine uses normalized camera/node units and preserves logical camera across parent zoom changes', async () => {
  const original = HTMLElement.prototype.getBoundingClientRect;
  const measurement = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (!this.classList.contains('flow-coordinate-frame')) return original.call(this);
      let scale = 1;
      for (
        let element: HTMLElement | null = this.parentElement;
        element;
        element = element.parentElement
      )
        if (element.dataset.coordinateTestScale)
          scale *= Number(element.dataset.coordinateTestScale);
      return new DOMRect(0, 0, 760 * scale, 380 * scale);
    });
  const css = window.getComputedStyle.bind(window),
    computed = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const value = css(element, pseudo);
      if (!element.classList.contains('flow-coordinate-frame')) return value;
      return new Proxy(value, {
        get(target, key) {
          if (key === 'width') return '760px';
          if (key === 'height') return '380px';
          const member = Reflect.get(target, key, target);
          return typeof member === 'function' ? member.bind(target) : member;
        },
      });
    });
  const target = document.createElement('div'),
    siblingTarget = document.createElement('div');
  document.body.append(target, siblingTarget);
  const app = mount(Host, { target }),
    sibling = mount(Host, { target: siblingTarget });
  try {
    await settle();
    const scale = 0.348405 * 0.7 * 0.6,
      frame = target.querySelector<HTMLElement>('.flow-coordinate-frame')!;
    expect(Number(frame.dataset.victFlowCoordinateScale)).toBeCloseTo(scale, 9);
    expect(target.querySelector('[role=alert]')).toBeNull();
    const siblingCamera = sibling.engineViewport(),
      siblingNode = sibling.nodePosition();
    const logical = app.logicalViewport(),
      engine = app.engineViewport()!;
    expect(engine.x).toBeCloseTo(logical.x * scale, 9);
    expect(engine.zoom).toBeCloseTo(logical.zoom * scale, 9);
    drag(target.querySelector('.svelte-flow__pane')!, 30, 10);
    await settle();
    const panned = app.logicalViewport();
    expect((panned.x - logical.x) * scale).toBeCloseTo(30, 8);
    expect((panned.y - logical.y) * scale).toBeCloseTo(10, 8);
    const beforeNode = app.nodePosition();
    drag(target.querySelector('.svelte-flow__node')!, 30, 10);
    await settle();
    const moved = app.nodePosition();
    expect((moved.x - beforeNode.x) * panned.zoom * scale).toBeCloseTo(30, 7);
    expect((moved.y - beforeNode.y) * panned.zoom * scale).toBeCloseTo(10, 7);
    const input = target.querySelector('input')!;
    input.value = 'Unsaved draft';
    input.focus();
    const beforeParent = app.logicalViewport();
    app.setParentScale(0.5);
    await settle();
    expect(app.logicalViewport().x).toBeCloseTo(beforeParent.x, 8);
    expect(app.logicalViewport().zoom).toBeCloseTo(beforeParent.zoom, 8);
    expect(app.engineViewport()!.zoom).toBeCloseTo(beforeParent.zoom * 0.5 * 0.7 * 0.6, 8);
    expect(target.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Unsaved draft');
    const pane = target.querySelector('.svelte-flow__pane')!,
      cursor = { x: 70, y: 35 };
    async function wheel(deltaY: number) {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY });
      Object.defineProperties(event, {
        clientX: { value: cursor.x },
        clientY: { value: cursor.y },
      });
      pane.dispatchEvent(event);
      await settle();
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
    const beforeWheel = app.engineViewport()!,
      world = {
        x: (cursor.x - beforeWheel.x) / beforeWheel.zoom,
        y: (cursor.y - beforeWheel.y) / beforeWheel.zoom,
      };
    await wheel(-100);
    const afterWheel = app.engineViewport()!;
    expect(afterWheel.zoom).toBeGreaterThan(beforeWheel.zoom);
    expect(afterWheel.x + world.x * afterWheel.zoom).toBeCloseTo(cursor.x, 7);
    expect(afterWheel.y + world.y * afterWheel.zoom).toBeCloseTo(cursor.y, 7);
    await wheel(-10000);
    expect(app.logicalViewport().zoom).toBeCloseTo(2, 7);
    await wheel(10000);
    expect(app.logicalViewport().zoom).toBeCloseTo(0.1, 7);
    await wheel(-100);
    expect(app.logicalViewport().zoom).toBeGreaterThan(0.1);
    expect(app.logicalViewport().zoom).toBeLessThan(2);
    expect(sibling.engineViewport()).toEqual(siblingCamera);
    expect(sibling.nodePosition()).toEqual(siblingNode);
  } finally {
    await unmount(app);
    await unmount(sibling);
    target.remove();
    siblingTarget.remove();
    measurement.mockRestore();
    computed.mockRestore();
  }
});
