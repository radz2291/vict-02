import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import CatalogFixture from './catalog-fixture.svelte';
import Consumer from './action-consumer-fixture.svelte';
import { compileApplication } from '@victframework/application';
import { createComponentRegistry } from '@victframework/application/renderer';
import { renderVictApplication } from '@victframework/ui-svelte';
import { itemResource } from './fixtures.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});
function fixture() {
  const target = document.createElement('div');
  document.body.append(target);
  const instance = mount(CatalogFixture, { target });
  flushSync();
  cleanups.push(() => unmount(instance));
  const value = () => JSON.parse(target.querySelector('output')!.textContent!);
  const click = (selector: string) => {
    target.querySelector<HTMLElement>(selector)!.click();
    flushSync();
  };
  return { target, value, click };
}
describe('granular catalog components', () => {
  it('keeps checkbox and immediate switch values independently bound', () => {
    const f = fixture();
    f.click('[role="checkbox"]');
    expect(f.value().checked).toBe(true);
    expect(f.target.querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('true');
    f.click('[role="switch"]');
    expect(f.value().enabled).toBe(false);
    expect(f.value().checked).toBe(true);
  });
  it('keeps multiple toggle values and ignores a disabled option', () => {
    const f = fixture();
    f.click('[data-value="inbox"]');
    expect(f.value().channels).toEqual(['email', 'inbox']);
    f.click('[data-value="locked"]');
    expect(f.value().channels).toEqual(['email', 'inbox']);
    f.click('[data-value="email"]');
    expect(f.value().channels).toEqual(['inbox']);
  });
  it('exposes labelled date segments and serializes a calendar date without timezone conversion', () => {
    const f = fixture();
    expect(f.target.querySelectorAll('[role="spinbutton"]').length).toBe(3);
    expect(f.target.querySelector<HTMLInputElement>('input[name="due"]')?.value).toBe('2026-10-08');
    expect(f.target.querySelector('[data-date-field-input]')?.getAttribute('aria-labelledby')).toBe(
      f.target.querySelector('[data-date-field-label]')?.id,
    );
  });
});
describe('registered component action bridge', () => {
  function app(actionId = 'save', dispatch = vi.fn(async () => ({ ok: true, value: {} }))) {
    const compiled = compileApplication({
      application: {
        schema: 'vict.application@2',
        id: 'app.component-actions',
        revision: '1',
        routes: [{ id: 'home', path: '/', screenId: 'home' }],
        screens: [
          {
            id: 'home',
            title: 'Registered actions',
            layout: [
              {
                name: 'main',
                surfaces: [
                  {
                    role: 'component',
                    id: 'probe',
                    componentId: 'probe',
                    revision: '1',
                    props: { actionId },
                  },
                ],
              },
            ],
          },
        ],
        actions: [
          {
            kind: 'mutation',
            id: 'save',
            revision: '1',
            resourceId: 'items',
            resourceRevision: '1',
            op: 'create',
            inputContractId: 'test.item.input',
          },
        ],
        resources: [{ resourceId: 'items', revision: '1' }],
        components: [{ componentId: 'probe', revision: '1' }],
      },
      resources: [itemResource],
      contracts: [{ id: 'test.item.input', revision: '1' }],
      components: [{ componentId: 'probe', revision: '1' }],
    });
    if (!compiled.ok) throw Error(JSON.stringify(compiled.issues));
    const registry = createComponentRegistry('test.catalog', '1');
    registry.register({ componentId: 'probe', revision: '1', implementation: Consumer });
    const onInvalidate = vi.fn();
    const rendered = renderVictApplication({
      plan: compiled.plan,
      registry,
      dispatch,
      onInvalidate,
    });
    cleanups.push(() => rendered.unmount());
    return { rendered, dispatch, onInvalidate };
  }
  it('dispatches declared actions through the host and invalidates on success', async () => {
    const f = app();
    f.rendered.output.querySelector<HTMLButtonElement>('.vict-component-slot button')!.click();
    await vi.waitFor(() =>
      expect(f.dispatch).toHaveBeenCalledWith('save', { name: 'Scheduled review' }),
    );
    await vi.waitFor(() =>
      expect(f.rendered.output.querySelector('output')?.textContent).toBe('Saved'),
    );
    expect(f.onInvalidate).toHaveBeenCalledOnce();
  });
  it('rejects undeclared actions without reaching the dispatcher', async () => {
    const f = app('undeclared');
    f.rendered.output.querySelector<HTMLButtonElement>('.vict-component-slot button')!.click();
    await vi.waitFor(() =>
      expect(f.rendered.output.querySelector('output')?.textContent).toContain('not declared'),
    );
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(f.onInvalidate).not.toHaveBeenCalled();
  });
});
