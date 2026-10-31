// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { defaultGraphEdgeAppearance } from '@victframework/ui-flow-svelte';
import Geometry from './fixtures/IndependentEdgeGeometry.svelte';

it('independent white-box: equal edge IDs across separate mounts reference only their own finite SVG paths and markers', async () => {
  for (const route of ['bezier', 'straight', 'orthogonal'] as const) {
    const first = document.createElement('div'),
      second = document.createElement('div');
    document.body.append(first, second);
    const appearance = {
      ...defaultGraphEdgeAppearance,
      route,
      color: 'token:accent',
      width: Number.MAX_VALUE,
      startArrow: 'arrow' as const,
      endArrow: 'closed' as const,
    };
    const a = mount(Geometry, { target: first, props: { appearance } }),
      b = mount(Geometry, {
        target: second,
        props: { appearance: { ...appearance, color: '#1234', pattern: 'dot' } },
      });
    try {
      flushSync();
      await Promise.resolve();
      flushSync();
      const ids = [...document.querySelectorAll('marker')].map((marker) => marker.id);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
      for (const root of [first, second]) {
        const path = root.querySelector<SVGPathElement>('.svelte-flow__edge-path')!;
        expect(path).toBeTruthy();
        expect(path.getAttribute('d')).not.toMatch(/NaN|Infinity/);
        expect(path.getAttribute('style')).not.toMatch(/NaN|Infinity|https?:/);
        for (const end of ['start', 'end']) {
          const reference = path.getAttribute(`marker-${end}`)!;
          expect(reference).toMatch(/^url\(#vict-edge-/);
          const id = reference.slice(5, -1);
          expect(root.querySelector(`marker[id="${id}"]`)).toBeTruthy();
          expect((root === first ? second : first).querySelector(`marker[id="${id}"]`)).toBeNull();
        }
      }
    } finally {
      await unmount(a);
      await unmount(b);
      first.remove();
      second.remove();
    }
  }
});
