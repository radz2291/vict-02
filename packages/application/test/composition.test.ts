import { describe, expect, it } from 'vitest';
import { compileApplication } from '../src/compile.js';
import type { ApplicationDefinition } from '@victframework/sdk';
import { resolveApplicationComposition, resolvePageComposition } from '@victframework/ui';
const base: ApplicationDefinition = {
  schema: 'vict.application@2',
  id: 'app.composition',
  revision: '1',
  routes: [{ id: 'home', path: '/', screenId: 's.home' }],
  screens: [
    {
      id: 's.home',
      title: 'Home',
      layout: [{ name: 'main', surfaces: [{ role: 'text', id: 'hello', content: 'Hello' }] }],
    },
  ],
  actions: [{ kind: 'local', id: 'act.local', revision: '1' }],
  resources: [],
};
const compile = (application: unknown) =>
  compileApplication({ application: application as ApplicationDefinition, resources: [] });
describe('portable composition and action feedback contracts', () => {
  it('retains default rendering intent and original identities when choices are absent', () => {
    expect(resolveApplicationComposition()).toEqual({
      navigation: 'sidebar',
      contentWidth: 'wide',
      density: 'comfortable',
      navigationAt: 'small',
    });
    expect(resolvePageComposition()).toEqual({
      contentWidth: 'wide',
      density: 'comfortable',
      supportingWidth: 'standard',
      stackAt: 'large',
    });
    for (const schema of ['vict.application@1', 'vict.application@2'])
      expect(compile({ ...base, schema }).ok).toBe(true);
  });
  it('validates, freezes and versions application and page choices', () => {
    const application = {
      ...base,
      composition: {
        navigation: 'top',
        density: 'compact',
        responsive: { navigationAt: 'medium' },
      },
      screens: [
        {
          ...base.screens[0],
          composition: { contentWidth: 'standard', supportingWidth: 'narrow', stackAt: 'small' },
        },
      ],
      actions: [{ ...base.actions[0], feedback: { success: 'Preferences updated.' } }],
    };
    const result = compile(application);
    const defaultPlan = compile(base);
    expect(result.ok && defaultPlan.ok).toBe(true);
    if (!result.ok || !defaultPlan.ok) return;
    expect(result.plan.applicationVersion).not.toBe(defaultPlan.plan.applicationVersion);
    expect(result.plan.manifest.composition).toEqual(application.composition);
    expect(Object.isFrozen(result.plan.manifest.composition)).toBe(true);
    const again = compile(application);
    expect(again.ok && again.plan.applicationVersion).toBe(result.plan.applicationVersion);
    const shellOnly = compile({ ...base, composition: { navigation: 'top' } });
    expect(shellOnly.ok && shellOnly.plan.applicationVersion).not.toBe(
      defaultPlan.plan.applicationVersion,
    );
    expect(
      resolvePageComposition(
        { density: 'compact', contentWidth: 'full' },
        { contentWidth: 'standard' },
      ),
    ).toMatchObject({ density: 'compact', contentWidth: 'standard' });
  });
  it.each([
    null,
    [],
    'top',
    { navigation: 'floating' },
    { responsive: { navigationAt: 'large' } },
    { responsive: { mode: 'push' } },
    { route: '/workspace' },
    { density: 0 },
  ])('rejects malformed application composition: %j', (composition) => {
    const result = compile({ ...base, composition });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((issue) => issue.code === 'INVALID_UI_COMPOSITION')).toBe(true);
  });
  it.each([null, [], { navigation: 'top' }, { supportingWidth: 500 }, { stackAt: 'never' }])(
    'rejects malformed page composition: %j',
    (composition) => {
      expect(compile({ ...base, screens: [{ ...base.screens[0], composition }] }).ok).toBe(false);
    },
  );
  it.each([null, [], { success: '' }, { toast: 'Done' }, { failure: false }])(
    'rejects malformed feedback: %j',
    (feedback) => {
      expect(compile({ ...base, actions: [{ ...base.actions[0], feedback }] }).ok).toBe(false);
    },
  );
  it('keeps @1 closed and gives deterministic nested diagnostics', () => {
    expect(compile({ ...base, schema: 'vict.application@1', composition: {} }).ok).toBe(false);
    expect(
      compile({
        ...base,
        schema: 'vict.application@1',
        actions: [{ ...base.actions[0], feedback: {} }],
      }).ok,
    ).toBe(false);
    const a = compile({ ...base, composition: { z: 'x', a: 'y' } });
    const b = compile({ ...base, composition: { a: 'y', z: 'x' } });
    expect(a).toEqual(b);
  });
});
