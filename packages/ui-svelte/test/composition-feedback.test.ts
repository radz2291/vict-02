import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { compileApplication } from '@victframework/application';
import type { ApplicationDefinition } from '@victframework/sdk';
import { createComponentRegistry } from '@victframework/application/renderer';
import { renderVictApplication, type ActionResult } from '@victframework/ui-svelte';
const definition: ApplicationDefinition = {
  schema: 'vict.application@2',
  id: 'app.probe',
  revision: '1',
  routes: [
    { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home' } },
    { id: 'record', path: '/items/:id', screenId: 's.home' },
  ],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layout: [{ name: 'main', surfaces: [{ role: 'form', id: 'form', formId: 'f' }] }],
    },
  ],
  forms: [
    {
      formId: 'f',
      resourceId: 'items',
      resourceRevision: '1',
      inputContractId: 'input',
      submitActionId: 'save',
      fields: [{ name: 'name', label: 'Name', widget: 'text', required: true }],
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
      inputContractId: 'input',
      feedback: { success: 'Item saved to your list.' },
    },
  ],
  resources: [{ resourceId: 'items', revision: '1' }],
};
function plan(application = definition) {
  const result = compileApplication({
    application,
    contracts: [{ id: 'input', revision: '1' }],
    resources: [
      {
        schema: 'vict.resource@1',
        id: 'items',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string', required: true },
          { name: 'name', type: 'string' },
        ],
        queries: { list: {} },
        mutations: [{ op: 'create', effect: 'write', permissions: [], inputContractId: 'input' }],
        authorization: { effect: 'read' },
      },
    ],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}
function mount(dispatch: () => Promise<ActionResult>, application = definition) {
  const app = renderVictApplication({
    plan: plan(application),
    registry: createComponentRegistry('test.composition', '1'),
    dispatch,
  });
  const input = app.output.querySelector<HTMLInputElement>('input')!;
  const form = app.output.querySelector('form')!;
  const submit = () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    flushSync();
  };
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  };
  const success = () => app.output.querySelector('[data-testid="action-success"]')?.textContent;
  const error = () => app.output.querySelector('[data-testid="action-error"]')?.textContent;
  return { app, input, form, type, submit, success, error };
}
describe('composition and integrated feedback through the real renderer', () => {
  it('selects shells by configuration and updates without route or application-name conventions', () => {
    const app = mount(async () => ({ ok: true }));
    try {
      expect(app.app.output.querySelector('.vict-shell')?.getAttribute('data-navigation')).toBe(
        'sidebar',
      );
      app.app.update({
        plan: plan({
          ...definition,
          composition: {
            navigation: 'top',
            density: 'compact',
            responsive: { navigationAt: 'medium' },
          },
          screens: [{ ...definition.screens[0]!, composition: { contentWidth: 'standard' } }],
        }),
      });
      expect(app.app.output.querySelector('.vict-shell')?.getAttribute('data-navigation')).toBe(
        'top',
      );
      expect(app.app.output.querySelector('main')?.getAttribute('data-content-width')).toBe(
        'standard',
      );
      expect(app.app.output.querySelector('.vict-shell')?.getAttribute('data-density')).toBe(
        'compact',
      );
      app.app.update({ plan: plan({ ...definition, composition: { navigation: 'none' } }) });
      expect(app.app.output.querySelector('.vict-nav-toggle')).toBeNull();
      expect(app.app.output.querySelector('[data-desktop-navigation]')).toBeNull();
      expect(app.app.output.querySelector('form')).not.toBeNull();
    } finally {
      app.app.unmount();
    }
  });
  it('focuses a single invalid field, associates its error, and never dispatches it', async () => {
    const dispatch = vi.fn(async () => ({ ok: true }));
    const app = mount(dispatch);
    try {
      app.submit();
      await vi.waitFor(() => expect(document.activeElement).toBe(app.input));
      expect(dispatch).not.toHaveBeenCalled();
      expect(app.input.getAttribute('aria-invalid')).toBe('true');
      expect(
        app.app.output.querySelector('#' + app.input.getAttribute('aria-describedby'))?.textContent,
      ).toBeTruthy();
      expect(app.app.output.querySelector('.vict-form-summary')).toBeNull();
      expect(app.success()).toBe('');
    } finally {
      app.app.unmount();
    }
  });
  it('replaces success on invalid retry, clears while pending, persists errors and restores success', async () => {
    let resolve!: (value: ActionResult) => void;
    const dispatch = () =>
      new Promise<ActionResult>((r) => {
        resolve = r;
      });
    const app = mount(dispatch);
    try {
      app.type('First');
      app.submit();
      expect(app.form.getAttribute('aria-busy')).toBe('true');
      resolve({ ok: true });
      await vi.waitFor(() => expect(app.success()).toBe('Item saved to your list.'));
      app.app.update({ plan: plan(), record: null });
      expect(app.success()).toBe('Item saved to your list.');
      app.type('');
      app.submit();
      expect(app.success()).toBe('');
      expect(app.input.getAttribute('aria-invalid')).toBe('true');
      app.type('Retry');
      app.submit();
      expect(app.error()).toBe('');
      expect(app.success()).toBe('');
      resolve({ ok: false, code: 'DATA_UNAUTHORIZED', message: 'Ask your team owner for access.' });
      await vi.waitFor(() => expect(app.error()).toBe('Ask your team owner for access.'));
      expect(app.input.value).toBe('Retry');
      app.type('Revised draft');
      expect(app.error()).toBe('Ask your team owner for access.');
      app.submit();
      expect(app.error()).toBe('');
      resolve({ ok: true });
      await vi.waitFor(() => expect(app.success()).toBe('Item saved to your list.'));
      expect(app.error()).toBe('');
      expect(
        app.app.output.querySelector('[data-testid="action-success"]')?.getAttribute('role'),
      ).toBe('status');
      expect(
        app.app.output.querySelector('[data-testid="action-error"]')?.getAttribute('role'),
      ).toBe('alert');
      expect(app.app.output.textContent).not.toContain('Done.');
    } finally {
      app.app.unmount();
    }
  });
  it('maps safe server field errors beside fields and keeps non-field failures by the action', async () => {
    const dispatch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: 'CONTRACT_REJECTED',
        fieldErrors: { name: 'Choose a unique name.' },
      })
      .mockResolvedValueOnce({
        ok: false,
        code: 'CONTRACT_REJECTED',
        message: 'This record is locked.',
      })
      .mockRejectedValueOnce(new Error('PRIVATE-CANARY'));
    const app = mount(dispatch);
    try {
      app.type('Duplicate');
      app.submit();
      await vi.waitFor(() => expect(app.input.getAttribute('aria-invalid')).toBe('true'));
      expect(app.app.output.querySelector('.vict-field-error')?.textContent).toBe(
        'Choose a unique name.',
      );
      expect(app.error()).toBe('');
      app.type('Another');
      app.submit();
      await vi.waitFor(() => expect(app.error()).toBe('This record is locked.'));
      expect(app.input.hasAttribute('aria-invalid')).toBe(false);
      app.submit();
      await vi.waitFor(() => expect(app.error()).toContain('could not be completed'));
      expect(app.app.output.textContent).not.toContain('PRIVATE-CANARY');
      expect(app.input.value).toBe('Another');
    } finally {
      app.app.unmount();
    }
  });
  it('discards a late result after switching record identity', async () => {
    let resolve!: (value: ActionResult) => void;
    const app = mount(
      () =>
        new Promise<ActionResult>((r) => {
          resolve = r;
        }),
    );
    try {
      app.type('Previous record');
      app.submit();
      app.app.update({ path: '/items/next', record: { name: 'Next record' } });
      expect(app.input.value).toBe('Next record');
      resolve({ ok: true });
      await new Promise((r) => setTimeout(r, 10));
      expect(app.success()).toBe('');
      expect(app.error()).toBe('');
      expect(app.form.getAttribute('aria-busy')).toBe('false');
    } finally {
      app.app.unmount();
    }
  });
  it('uses a quiet Save default when no result text is supplied', async () => {
    const app = mount(async () => ({ ok: true }), {
      ...definition,
      actions: definition.actions.map(({ feedback, ...action }) => action),
    });
    try {
      app.type('A name');
      app.submit();
      await vi.waitFor(() => expect(app.success()).toBe('Changes saved.'));
    } finally {
      app.app.unmount();
    }
  });
});
