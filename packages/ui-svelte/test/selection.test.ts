import { describe, expect, it } from 'vitest';
import { prefillFormState, toSubmitPayload } from '../src/form-values.js';
const fields = [
  {
    name: 'team',
    widget: 'select',
    required: true,
    options: [{ value: 'product', label: 'Product' }],
  },
];
describe('selection value boundary', () => {
  it('round-trips a declared string choice', () => {
    expect(toSubmitPayload(fields, prefillFormState(fields, { team: 'product' }))).toEqual({
      ok: true,
      payload: { team: 'product' },
    });
  });
  it('rejects unlisted prefills and empty required selections', () => {
    for (const team of ['forged', ''])
      expect(toSubmitPayload(fields, prefillFormState(fields, { team })).ok).toBe(false);
  });
  it('keeps optional empty selection as an empty string', () => {
    const optional = [{ ...fields[0]!, required: false }];
    expect(toSubmitPayload(optional, prefillFormState(optional, {}))).toEqual({
      ok: true,
      payload: { team: '' },
    });
  });
});
