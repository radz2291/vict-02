import { expect, test, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {getViewportForBounds} from '@xyflow/svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  type UiDocument,
} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import { flowAuthoringDescriptors } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 40));
  flushSync();
};
const source: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'readonly-fit-race',
  revision: '1',
  root: 'root',
  nodes: {
    root: { kind: 'element', id: 'root', tag: 'div', children: ['canvas', 'draft'] },
    draft: {
      kind: 'element',
      id: 'draft',
      tag: 'input',
      children: [],
      attributes: {
        'aria-label': { type: 'literal', value: 'readonly-draft' },
        value: { type: 'literal', value: 'Unsaved draft' },
      },
    },
    canvas: {
      kind: 'component',
      id: 'canvas',
      definitionId: 'vict.flow.canvas',
      revision: '1',
      props: {
        height: { type: 'literal', value: 380 },
        controls: { type: 'literal', value: false },
        background: { type: 'literal', value: false },
      },
      slots: { nodes: { name: 'nodes', children: ['crop', 'grade', 'caption'] } },
    },
    ...Object.fromEntries(
      ['crop', 'grade', 'caption'].map((id, index) => [
        id,
        {
          kind: 'component',
          id,
          definitionId: 'vict.flow.node',
          revision: '1',
          props: {
            id: { type: 'literal', value: id },
            label: { type: 'literal', value: id },
            x: { type: 'literal', value: 40 + index * 320 },
            y: { type: 'literal', value: 40 },
          },
        },
      ]),
    ),
  },
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
  localState: {},
};

test('actual authored read-only canvas fits three measured cards after its own engine dimension update', async () => {
  let engineWidth = 737,
    engineHeight = 380,
    ancestorScale = 0.321269;
  const observers: { callback: ResizeObserverCallback; targets: Set<Element> }[] = [];
  const entry = (target: Element) =>
    ({
      target,
      contentRect: new DOMRect(0, 0, target.clientWidth, target.clientHeight),
      borderBoxSize: [{ inlineSize: target.clientWidth, blockSize: target.clientHeight }],
      contentBoxSize: [{ inlineSize: target.clientWidth, blockSize: target.clientHeight }],
    }) as ResizeObserverEntry;
  class ControlledObserver {
    targets = new Set<Element>();
    constructor(public callback: ResizeObserverCallback) {
      observers.push(this);
    }
    observe(target: Element) {
      this.targets.add(target);
      queueMicrotask(() => {
        if (this.targets.has(target))
          this.callback([entry(target)], this as unknown as ResizeObserver);
      });
    }
    unobserve(target: Element) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
  }
  vi.stubGlobal('ResizeObserver', ControlledObserver);
  const original = HTMLElement.prototype.getBoundingClientRect;
  const rectangle = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('flow-coordinate-frame'))
        return new DOMRect(0, 0, 736.8 * ancestorScale, 380 * ancestorScale);
      return original.call(this);
    });
  const css = window.getComputedStyle.bind(window),
    computed = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const value = css(element, pseudo);
      if (!element.classList.contains('flow-coordinate-frame')) return value;
      return new Proxy(value, {
        get(target, key) {
          if (key === 'width') return '736.8px';
          if (key === 'height') return '380px';
          const item = Reflect.get(target, key, target);
          return typeof item === 'function' ? item.bind(target) : item;
        },
      });
    });
  const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('svelte-flow') ? engineWidth : 0;
  });
  const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('svelte-flow') ? engineHeight : 0;
  });
  const ow = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('svelte-flow__node') ? 180 : 0;
  });
  const oh = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('svelte-flow__node') ? 54 : 0;
  });
  const target = document.createElement('div');
  target.style.transform = `scale(${ancestorScale})`;
  document.body.append(target);
  const writes: unknown[] = [];
  const compiled = compileUiDocument(
    source,
    defaultSemanticElementCatalog(),
    flowAuthoringDescriptors,
  );
  if (!compiled.ok) throw Error(JSON.stringify(compiled));
  const app = mount(DocumentHost, {
    target,
    props: {
      plan: compiled.plan,
      localState: source.localState,
      extensionDescriptors: flowAuthoringDescriptors,
      extensionImplementations: flowAuthoringImplementations,
      dispatch: async () => undefined,
      navigate: () => {},
      onStateChange: (...args: unknown[]) => writes.push(args),
    },
  });
  try {
    await settle();
    expect(target.querySelectorAll('.vict-authored-flow-node')).toHaveLength(3);
    engineWidth = 237;
    engineHeight = 122;
    for (const observer of observers)
      if (observer.targets.size)
        observer.callback([...observer.targets].map(entry), observer as unknown as ResizeObserver);
    await settle();
    const transform = target.querySelector<HTMLElement>('.svelte-flow__viewport')!.style.transform;
    const parts = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)\s*scale\(([-\d.e]+)\)/.exec(transform);
    expect(parts, transform).not.toBeNull();
    const [, x, y, z] = parts!.map(Number);
    const originalFit=getViewportForBounds({x:40,y:40,width:820,height:54},engineWidth,engineHeight,.5*ancestorScale,2*ancestorScale,.1);
    expect(x).toBeCloseTo(originalFit.x,7);expect(y).toBeCloseTo(originalFit.y,7);expect(z).toBeCloseTo(originalFit.zoom,7);
    expect(z).toBeGreaterThan(0);
    expect(x + 40 * z).toBeGreaterThanOrEqual(0);
    expect(x + 860 * z).toBeLessThanOrEqual(engineWidth);
    expect(y + 40 * z).toBeGreaterThanOrEqual(0);
    expect(y + 94 * z).toBeLessThanOrEqual(engineHeight);
    expect(writes).toEqual([]);
    const pane = target.querySelector('.svelte-flow__pane')!;
    pane.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: 60,
        clientY: 40,
        view: window,
      }),
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        buttons: 1,
        clientX: 90,
        clientY: 50,
        view: window,
      }),
    );
    window.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        button: 0,
        clientX: 90,
        clientY: 50,
        view: window,
      }),
    );
    await settle();
    const camera = () =>
      /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)\s*scale\(([-\d.e]+)\)/
        .exec(target.querySelector<HTMLElement>('.svelte-flow__viewport')!.style.transform)!
        .slice(1)
        .map(Number);
    const panned = camera();
    expect(panned[0] - x).toBeCloseTo(30, 7);
    expect(panned[1] - y).toBeCloseTo(10, 7);
    const input = target.querySelector<HTMLInputElement>('[aria-label="readonly-draft"]')!;
    input.focus();
    input.value = 'Retained native draft';
    ancestorScale = 0.5;
    target.style.transform = 'scale(0.5)';
    engineWidth = 368;
    engineHeight = 190;
    for (const observer of observers)
      if (observer.targets.size)
        observer.callback([...observer.targets].map(entry), observer as unknown as ResizeObserver);
    await settle();
    const changed = camera();
    for (let index = 0; index < 3; index++)
      expect(changed[index] / 0.5).toBeCloseTo(panned[index] / 0.321269, 7);
    expect(target.querySelector('[aria-label="readonly-draft"]')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Retained native draft');
    expect(writes).toEqual([]);
  } finally {
    await unmount(app);
    target.remove();
    rectangle.mockRestore();
    computed.mockRestore();
    cw.mockRestore();
    ch.mockRestore();
    ow.mockRestore();
    oh.mockRestore();
    vi.unstubAllGlobals();
  }
});
