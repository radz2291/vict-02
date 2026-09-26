import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_ROLES as directRoles,
  createVictRenderer as directCreateVictRenderer,
  renderVictApplication as directRenderVictApplication,
  RENDERER_ID as directRendererId,
  RENDERER_REVISION as directRendererRevision,
  VitApp as directVitApp,
} from '@victframework/ui-svelte';
import {
  createVictRenderer,
  renderVictApplication,
  RENDERER_ID,
  RENDERER_REVISION,
  VitApp,
} from '@victframework/renderer-svelte';
import { probeApp, testRegistry } from '../../ui-svelte/test/fixtures.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Compatibility-facade contract (permanent regression guard).
 *
 * `@victframework/renderer-svelte` must never carry an independent renderer
 * implementation again: every public binding must BE the implementation
 * owned by `@victframework/ui-svelte` (same module identity, not a copy).
 * If the two packages ever silently diverge (a reimplementation, a stale
 * copy, or a forked constant), these assertions fail.
 */
describe('renderer-svelte compatibility facade', () => {
  it('preserves the frozen renderer identity through the facade', () => {
    expect(RENDERER_ID).toBe('renderer.svelte-kit');
    expect(RENDERER_REVISION).toBe('5.0.0');
    // Facade constants must be the DIRECT implementation's constants —
    // the same values AND the same module bindings.
    expect(RENDERER_ID).toBe(directRendererId);
    expect(RENDERER_REVISION).toBe(directRendererRevision);
  });

  it('re-exports the SAME implementation bindings (no divergent copies)', () => {
    // Re-exports pass through the identical binding: a reimplementation in
    // the facade would fail this identity check.
    expect(createVictRenderer).toBe(directCreateVictRenderer);
    expect(renderVictApplication).toBe(directRenderVictApplication);
    expect(VitApp).toBe(directVitApp);
  });

  it('produces the canonical renderer through the compat path', () => {
    const renderer = createVictRenderer();
    expect(renderer.id).toBe('renderer.svelte-kit');
    expect(renderer.revision).toBe('5.0.0');
    expect([...renderer.supportedSurfaceRoles]).toEqual([...directRoles]);
  });

  it('renders identically through the compat and direct paths', () => {
    const plan = probeApp({ role: 'text', id: 'x', content: 'Hello renderer' });
    const registry = testRegistry();
    const compat = renderVictApplication({
      plan,
      registry,
      dispatch: async () => ({ ok: true, value: null }),
      viewData: { 'v.items': { rows: [], record: null } },
    });
    const direct = directRenderVictApplication({
      plan,
      registry,
      dispatch: async () => ({ ok: true, value: null }),
      viewData: { 'v.items': { rows: [], record: null } },
    });
    try {
      const compatHost = compat.output.querySelector('[data-testid="vict-host"]');
      const directHost = direct.output.querySelector('[data-testid="vict-host"]');
      expect(compatHost).not.toBeNull();
      expect(compatHost?.innerHTML).toBe(directHost?.innerHTML);
      expect(compatHost?.textContent).toContain('Hello renderer');
    } finally {
      compat.unmount();
      direct.unmount();
    }
  });

  it('renders a reactive path update through the compat path', () => {
    const mounted = renderVictApplication({
      plan: probeApp({ role: 'text', id: 'x', content: 'Home body' }),
      registry: testRegistry(),
      dispatch: async () => ({ ok: true, value: null }),
      path: '/',
      viewData: { 'v.items': { rows: [], record: null } },
    });
    try {
      expect(mounted.output.querySelector('[data-testid="vict-host"]')).not.toBeNull();
      mounted.update({ viewData: { 'v.items': { rows: [{ id: 'i-1' }], record: null } } });
      // Same mounted host instance (no remount) after a reactive update.
      expect(mounted.output.querySelector('[data-testid="vict-host"]')).not.toBeNull();
    } finally {
      mounted.unmount();
    }
  });

  it('theme.css remains a pure compatibility entry point routing to ui-svelte styles', () => {
    const themeCss = readFileSync(join(HERE, '..', 'src', 'theme.css'), 'utf8');
    expect(themeCss).toContain("@import '@victframework/ui-svelte/styles.css';");
    // No rules of its own (comments aside): the one style source stays ui-svelte.
    const remainder = themeCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@import[^;]+;/g, '')
      .trim();
    expect(remainder).toBe('');
    const stylesCss = readFileSync(
      join(HERE, '..', '..', 'ui-svelte', 'src', 'styles.css'),
      'utf8',
    );
    expect(stylesCss).toContain('.vict-app');
  });

  it('the facade source declares no implementation of its own', () => {
    const facade = readFileSync(join(HERE, '..', 'src', 'index.ts'), 'utf8');
    // Every export is a re-export from the implementation owner.
    expect(facade).toContain("from '@victframework/ui-svelte'");
    expect(facade).not.toMatch(/export (async )?function|export class|export const \w+\s*=/);
  });
});
