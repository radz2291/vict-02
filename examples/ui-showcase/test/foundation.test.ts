import { describe, expect, it } from 'vitest';
import { compileFoundationPlan } from '../src/lib/application/foundation.js';
import { createShowcaseServer } from '../src/lib/server/application-server.js';

describe('foundation through the normal application boundary', () => {
  it('compiles two screens without custom slots and preserves a deterministic identity', () => {
    const plan = compileFoundationPlan();
    expect(Object.keys(plan.screens)).toHaveLength(2);
    expect(plan.components).toEqual([]);
    expect(plan.applicationVersion).toBe(compileFoundationPlan().applicationVersion);
  });
  it('creates independent requests with zero/false and reads them back', async () => {
    const server = createShowcaseServer({ foundation: true });
    for (const name of ['First request', 'Second request']) {
      expect(
        (
          await server.dispatch('act.create', {
            name,
            rank: 0,
            zeroCheck: false,
            comment: 'Product',
          })
        ).ok,
      ).toBe(true);
    }
    const data = await server.loadRoute('/records');
    expect(data?.viewData['v.requests']?.rows).toHaveLength(8);
    const rows = data!.viewData['v.requests']!.rows!;
    expect(rows.filter((r) => r.rank === 0 && r.zeroCheck === false)).toHaveLength(2);
    expect(new Set(rows.map((r) => r.id)).size).toBe(8);
  });
  it('rejects out-of-range input at the server and sends conversation through a capability', async () => {
    const server = createShowcaseServer({ foundation: true });
    expect(
      (await server.dispatch('act.create', { name: 'Bad', rank: 999, zeroCheck: false })).ok,
    ).toBe(false);
    expect(
      (await server.dispatch('act.send', { text: 'Hello', author: 'You', participant: 'user' })).ok,
    ).toBe(true);
    expect((await server.loadRoute('/workspace'))?.viewData['v.messages']?.rows).toHaveLength(5);
  });
});
