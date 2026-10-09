/**
 * Round-3 shared helpers for catalog interaction probes: compile a document
 * (descriptor-driven) and mount it through the real DocumentHost.
 */
import { flushSync, mount, unmount } from 'svelte';
import type { UiDocument, UiLocalStateDecl, UiValue } from '@victframework/ui';
import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
import CatalogDocFixture from './CatalogDocFixture.svelte';
import { catalogDescriptors } from '../src/catalog/components/catalog.js';
import type { UiSvelteComponentIO } from '../src/document/extensions.js';

const cleanups: (() => void | Promise<void>)[] = [];

export function teardownAll(): void {
  for (const cleanup of cleanups.splice(0)) void cleanup();
}

export function mountDoc(doc: Partial<UiDocument> & Pick<UiDocument, 'root' | 'nodes'>, localState: Record<string, UiLocalStateDecl> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const full = {
    schema: 'vict.ui-document@1',
    id: 'probe.catalog',
    revision: '1',
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState,
    ...doc,
    localState: { ...(doc.localState ?? {}), ...localState },
  } as UiDocument;
  const compiled = compileUiDocument(full, defaultSemanticElementCatalog(), catalogDescriptors, { actionIds: [] });
  if (!compiled.ok) throw new Error('compile failed: ' + JSON.stringify(compiled.issues));
  const instance = mount(CatalogDocFixture, {
    target,
    props: { plan: compiled.plan, localState, stateValues: {} },
  });
  cleanups.push(() => unmount(instance));
  return target;
}

/** Mount a raw catalog adapter directly with a capturing io (no host). */
export function mountAdapter(component: never, props: Record<string, unknown>): { target: HTMLElement; emits: { name: string; value: unknown }[] } {
  const target = document.createElement('div');
  document.body.append(target);
  const emits: { name: string; value: unknown }[] = [];
  const io = { emit: (name: string, value: unknown) => { emits.push({ name, value }); } } as unknown as UiSvelteComponentIO;
  const instance = mount(component, { target, props: { ...props, io, presentation: undefined } });
  cleanups.push(() => unmount(instance));
  return { target, emits };
}

export function click(el: Element | undefined | null): void {
  if (!el) throw new Error('click target missing');
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
  (el as HTMLElement).click();
  flushSync();
}

export function text(target: HTMLElement): string {
  flushSync();
  return (target.textContent ?? '').replace(/\s+/g, ' ');
}

export const dateLiteral = (value: string | number | boolean) => ({ type: 'literal', value }) as never;
export const ref = (path: string) => ({ type: 'ref', path }) as never;

export const isoState = (key: string, type: 'isoDate' | 'isoTime', initial: string): UiLocalStateDecl =>
  ({ key, type, initial }) as UiLocalStateDecl;
export const strState = (key: string, initial: string): UiLocalStateDecl =>
  ({ key, type: 'string', initial }) as UiLocalStateDecl;
export const boolState = (key: string, initial: boolean): UiLocalStateDecl =>
  ({ key, type: 'boolean', initial }) as UiLocalStateDecl;
export const listState = (key: string, initial: readonly string[]): UiLocalStateDecl =>
  ({ key, type: 'stringList', initial }) as UiLocalStateDecl;
