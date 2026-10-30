import { afterEach, expect, it, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import Fixture from './viewport-host-fixture.svelte';

let component: ReturnType<typeof mount> | undefined;
afterEach(async () => { if (component) await unmount(component); component = undefined; vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('establishes and updates a query host inside the iframe without replacing authored children', async () => {
  component = mount(Fixture, { target: document.body });
  flushSync(); await tick();
  const frame = document.querySelector('iframe')!;
  const doc = frame.contentDocument!;
  // Happy DOM parses srcdoc and emits load asynchronously. This is a DOM
  // lifecycle check, not proof of browser referrer or viewport geometry.
  await vi.waitFor(() => expect(doc.querySelector('[data-application-content]')).not.toBeNull());
  const host = doc.querySelector<HTMLElement>('[data-application-content]')!;
  expect(host).not.toBeNull();
  const child = doc.querySelector('main')!;
  expect(child.textContent).toBe('Retained authored content');
  expect(host.classList.contains('vict-controls')).toBe(true);
  expect(host.style.containerName).toBe('');
  const click = async (text: string) => {
    [...document.querySelectorAll('button')].find(button => button.textContent === text)!.click();
    flushSync(); await tick();
  };
  await click('Establish query host');
  expect(host.style.containerName).toBe('studio-screen');
  expect(host.style.containerType).toBe('inline-size');
  expect(child.closest('[data-application-content]')).toBe(host);
  expect(host.ownerDocument).toBe(doc);
  expect(host.ownerDocument).not.toBe(document);
  await click('Rename query host');
  expect(host.style.containerName).toBe('alternate-screen');
  expect(doc.querySelector('main')).toBe(child);
  await click('Clear query host');
  expect(host.style.containerName).toBe('');
  expect(host.style.containerType).toBe('');
  expect(doc.querySelector('main')).toBe(child);
});

it('ignores the initial blank document, mounts once on srcdoc load, and disposes style observers', async () => {
  // Model the browser's transient document explicitly; Happy DOM ordinarily
  // makes its final srcdoc Document available immediately after insertion.
  const readDocument = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument')!.get!;
  const initialDocument = document.implementation.createHTMLDocument('Initial blank shell');
  const currentDocument = vi.spyOn(HTMLIFrameElement.prototype, 'contentDocument', 'get').mockReturnValue(initialDocument);
  const disconnectResize = vi.spyOn(ResizeObserver.prototype, 'disconnect');
  component = mount(Fixture, { target: document.body });
  flushSync(); await tick();
  const frame = document.querySelector('iframe')!;
  const doc = readDocument.call(frame) as Document;
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  expect(initialDocument.querySelector('[data-application-content]')).toBeNull();
  expect(doc.querySelector('[data-application-content]')).toBeNull();
  expect(frame.hasAttribute('sandbox')).toBe(false);
  expect(frame.getAttribute('srcdoc')).toBe('<!doctype html><html><head></head><body></body></html>');
  expect(doc.querySelector('script')).toBeNull();

  currentDocument.mockReturnValue(doc);
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  const child = doc.querySelector('main')!;
  expect(child.textContent).toBe('Retained authored content');
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  expect(doc.querySelectorAll('main')).toHaveLength(1);
  expect(doc.querySelector('main')).toBe(child);

  const style = document.createElement('style'); style.dataset.viewportLifecycleTest = ''; style.textContent = 'main{color:red}'; document.head.append(style);
  await vi.waitFor(() => expect(doc.querySelector('[data-viewport-styles] [data-viewport-lifecycle-test]')?.textContent).toBe('main{color:red}'));
  const detachedStyles = doc.querySelector('[data-viewport-styles]')!;
  const replaceStyles = vi.spyOn(detachedStyles, 'replaceChildren');
  await unmount(component); component = undefined;
  expect(disconnectResize).toHaveBeenCalledOnce();
  expect(doc.querySelector('main')).toBeNull();
  replaceStyles.mockClear();
  style.textContent = 'main{color:blue}'; await tick(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(replaceStyles).not.toHaveBeenCalled();
  style.remove();
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  expect(doc.querySelector('main')).toBeNull();
});

it('waits for a parsing shell and replaces the renderer when a different srcdoc Document loads', async () => {
  const parsing = document.implementation.createHTMLDocument('Parsing shell');
  vi.spyOn(parsing, 'URL', 'get').mockReturnValue('about:srcdoc');
  vi.spyOn(parsing, 'readyState', 'get').mockReturnValue('loading');
  const currentDocument = vi.spyOn(HTMLIFrameElement.prototype, 'contentDocument', 'get').mockReturnValue(parsing);
  component = mount(Fixture, { target: document.body }); flushSync(); await tick();
  const frame = document.querySelector('iframe')!;
  expect(parsing.querySelector('main')).toBeNull();
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  const firstChild = parsing.querySelector('main')!;
  expect(firstChild.textContent).toBe('Retained authored content');

  const replacement = document.implementation.createHTMLDocument('Replacement shell');
  vi.spyOn(replacement, 'URL', 'get').mockReturnValue('about:srcdoc');
  currentDocument.mockReturnValue(replacement);
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  expect(parsing.querySelector('main')).toBeNull();
  expect(replacement.querySelector('main')?.textContent).toBe('Retained authored content');
  expect(replacement.querySelector('main')).not.toBe(firstChild);
  frame.dispatchEvent(new Event('load')); flushSync(); await tick();
  expect(replacement.querySelectorAll('main')).toHaveLength(1);
});
