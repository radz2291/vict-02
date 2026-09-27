import { describe, expect, it } from 'vitest';
import { deriveUiPlan } from '../src/index.js';

/** Defensive derivation of the declared view initial sort onto table intents. */

function tableIntent(view: unknown): { readonly initialSort?: unknown } | undefined {
  const plan = {
    screens: {
      's.home': { title: 'Home', layout: [{ surfaces: [{ role: 'table', id: 'x', viewId: 'v.items' }] }] },
    },
    views: { 'v.items': view },
  } as never;
  return deriveUiPlan(plan).tables['x'];
}

describe('deriveUiPlan: declared view initial sort', () => {
  it('carries a well-formed declared sort', () => {
    expect(tableIntent({ resourceId: 'r', sort: [{ field: 'title', direction: 'desc' }] })?.initialSort).toEqual([
      { field: 'title', direction: 'desc' },
    ]);
  });

  it('carries a multi-entry declared sort in declared order', () => {
    expect(
      tableIntent({
        resourceId: 'r',
        sort: [
          { field: 'status', direction: 'asc' },
          { field: 'createdAt', direction: 'desc' },
        ],
      })?.initialSort,
    ).toEqual([
      { field: 'status', direction: 'asc' },
      { field: 'createdAt', direction: 'desc' },
    ]);
  });

  it('omits initialSort when the view declares no sort (or an empty array)', () => {
    expect(tableIntent({ resourceId: 'r' })?.initialSort).toBeUndefined();
    expect(tableIntent({ resourceId: 'r', sort: [] })?.initialSort).toBeUndefined();
    expect(tableIntent(undefined)?.initialSort).toBeUndefined();
  });

  it('discards a malformed sort declaration wholesale (defensive; compiler already rejects it)', () => {
    expect(tableIntent({ resourceId: 'r', sort: 'title' })?.initialSort).toBeUndefined();
    expect(tableIntent({ resourceId: 'r', sort: [{ field: 'title' }] })?.initialSort).toBeUndefined();
    expect(
      tableIntent({ resourceId: 'r', sort: [{ field: 'title', direction: 'sideways' }] })?.initialSort,
    ).toBeUndefined();
    expect(
      tableIntent({
        resourceId: 'r',
        sort: [
          { field: 'title', direction: 'asc' },
          { field: 42, direction: 'asc' },
        ],
      })?.initialSort,
    ).toBeUndefined();
  });
});
