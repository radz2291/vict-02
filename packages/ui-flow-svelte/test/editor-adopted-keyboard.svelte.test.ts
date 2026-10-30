import {afterEach, describe, expect, it} from 'vitest';
import {flushSync, mount, unmount} from 'svelte';
import GraphSurface from '../src/editor/GraphSurface.svelte';
import {parseGraph, serializeGraph} from '../src/editor/model.js';
import {graphFixture} from './editor-fixture.js';

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const dispose of cleanup.splice(0).reverse()) await dispose(); });
async function settle() { flushSync(); await new Promise(resolve => setTimeout(resolve, 40)); flushSync(); }
async function fixture(readOnly = false) {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  cleanup.push(() => iframe.remove());
  const child = iframe.contentDocument!, view = child.defaultView!;
  const left = document.createElement('div'), right = document.createElement('div');
  child.body.append(child.adoptNode(left), child.adoptNode(right));
  const writes: string[] = [], otherWrites: string[] = [];
  const viewState = {get: () => ({viewport: {x: 0, y: 0, zoom: 1}, selection: {nodes: ['a'], edges: []}}), set: () => {}};
  const one = mount(GraphSurface, {target: left, props: {graph: serializeGraph(graphFixture()), readOnly, viewState, ongraphchange: value => writes.push(value)}});
  const two = mount(GraphSurface, {target: right, props: {graph: serializeGraph(graphFixture()), viewState, ongraphchange: value => otherWrites.push(value)}});
  cleanup.push(() => unmount(two)); cleanup.push(() => unmount(one));
  await settle();
  // Happy DOM shares constructors. After actual adoption, model the browser's
  // distinct destination prototype while retaining each target's creation realm.
  const original = Object.getOwnPropertyDescriptor(view, 'HTMLElement')!;
  Object.defineProperty(view, 'HTMLElement', {...original, value: class DestinationHTMLElement extends HTMLElement {}});
  cleanup.push(() => Object.defineProperty(view, 'HTMLElement', original));
  const node = left.querySelector<HTMLElement>('[data-id=a]')!;
  expect(node.ownerDocument).toBe(child);
  expect(node instanceof view.HTMLElement).toBe(false);
  return {child, left, right, node, writes, otherWrites};
}
function key(target: Element, value: string, shiftKey = false, prevented = false) {
  const event = new KeyboardEvent('keydown', {key: value, shiftKey, bubbles: true, cancelable: true});
  if (prevented) event.preventDefault();
  target.dispatchEvent(event); return event;
}
function position(value: string) {const result = parseGraph(value); if (!result.ok) throw Error('Invalid committed graph'); return result.graph.nodes[0]!.position;}

describe('adopted rich editor keyboard transactions', () => {
  it('commits 10/40 pixel movement to the graph, isolates another editor and retains local undo/redo', async () => {
    const f = await fixture();
    expect(key(f.node, 'ArrowRight').defaultPrevented).toBe(true); await settle();
    expect(f.writes).toHaveLength(1); expect(position(f.writes[0]!)).toEqual({x: 10, y: 0});
    key(f.node, 'ArrowDown', true); await settle();
    expect(f.writes).toHaveLength(2); expect(position(f.writes[1]!)).toEqual({x: 10, y: 40});
    expect(f.otherWrites).toHaveLength(0);
    f.node.dispatchEvent(new KeyboardEvent('keydown', {key:'z',ctrlKey:true,bubbles:true,cancelable:true})); await settle();
    expect(position(f.writes.at(-1)!)).toEqual({x: 10, y: 0});
    f.node.dispatchEvent(new KeyboardEvent('keydown', {key:'z',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
    await settle(); expect(position(f.writes.at(-1)!)).toEqual({x: 10, y: 40});
    expect(f.otherWrites).toHaveLength(0);
  });
  it('keeps editable controls, pre-consumed keys and unowned targets outside graph movement', async () => {
    const f = await fixture();
    for (const selector of ['input', 'textarea', 'select', 'button', '[contenteditable=true]', '[role=slider]', '[role=combobox]']) {
      const tag = /^[a-z]+$/.test(selector) ? selector : 'div';
      const control = document.createElement(tag);
      if (selector.startsWith('[contenteditable')) control.setAttribute('contenteditable', 'true');
      if (selector.startsWith('[role=')) control.setAttribute('role', selector.slice(6, -1));
      f.node.append(control); key(control, 'ArrowRight'); control.remove();
    }
    key(f.node, 'ArrowRight', false, true);
    key(f.child.body, 'ArrowRight'); await settle();
    expect(f.writes).toHaveLength(0); expect(f.otherWrites).toHaveLength(0);
  });
  it('keeps read-only adopted editors unchanged', async () => {
    const f = await fixture(true); key(f.node, 'ArrowRight'); key(f.node, 'ArrowDown', true); await settle();
    expect(f.writes).toHaveLength(0); expect(f.otherWrites).toHaveLength(0);
  });
});
