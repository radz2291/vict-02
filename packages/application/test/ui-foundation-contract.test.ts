import { describe, expect, it } from 'vitest';
import { compileApplication, type CompileApplicationInput } from '../src/index.js';

function fixture() {
  return {
    application: {
      schema: 'vict.application@2',
      id: 'app.foundation-contract',
      revision: '1',
      routes: [{ id: 'home', path: '/', screenId: 'screen' }],
      screens: [
        {
          id: 'screen',
          title: 'Requests',
          layoutMode: 'split',
          layout: [
            {
              name: 'main',
              size: 'main',
              appearance: 'panel',
              flow: 'stack',
              surfaces: [{ role: 'form', id: 'form', formId: 'f' }],
            },
          ],
        },
      ],
      resources: [{ resourceId: 'items', revision: '1' }],
      forms: [
        {
          formId: 'f',
          resourceId: 'items',
          resourceRevision: '1',
          inputContractId: 'input',
          submitActionId: 'save',
          fields: [
            {
              name: 'team',
              label: 'Team',
              widget: 'select',
              required: true,
              options: [
                { value: 'engineering', label: 'Engineering' },
                { value: 'product', label: 'Product' },
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
          inputContractId: 'input',
        },
      ],
    },
    resources: [
      {
        schema: 'vict.resource@1',
        id: 'items',
        revision: '1',
        identity: { key: 'id' },
        fields: [
          { name: 'id', type: 'string' },
          { name: 'team', type: 'string' },
        ],
        mutations: [
          { op: 'create', effect: 'write', inputContractId: 'input', idempotency: 'keyed' },
        ],
        authorization: { effect: 'read' },
      },
    ],
    contracts: [{ id: 'input', revision: '1' }],
  };
}
const compile = (input: ReturnType<typeof fixture>) =>
  compileApplication(input as unknown as CompileApplicationInput);

describe('foundation composition and selection contracts', () => {
  it('compiles, freezes and identifies presentation metadata deterministically', () => {
    const result = compile(fixture());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.screens.screen?.layoutMode).toBe('split');
    expect(Object.isFrozen(result.plan.forms.f?.fields[0]?.options)).toBe(true);
    const changed = fixture();
    changed.application.forms[0]!.fields[0]!.options.reverse();
    const other = compile(changed);
    expect(other.ok).toBe(true);
    if (other.ok) expect(other.plan.applicationVersion).not.toBe(result.plan.applicationVersion);
  });
  it.each(['size', 'appearance', 'flow'])('rejects unsupported region %s values', (key) => {
    const input = fixture();
    Object.assign(input.application.screens[0]!.layout[0]!, { [key]: 'arbitrary-css' });
    expect(compile(input).ok).toBe(false);
  });
  it('rejects unknown screen layout modes', () => {
    const input = fixture();
    input.application.screens[0]!.layoutMode = 'pixel-editor';
    expect(compile(input).ok).toBe(false);
  });
  it.each(
    [
      [],
      [
        { value: 'same', label: 'A' },
        { value: 'same', label: 'B' },
      ],
      [{ value: '', label: 'Empty' }],
      [{ value: 'x', label: '' }],
    ].map((options) => ({ options })),
  )('rejects invalid choices %j', ({ options }) => {
    const input = fixture();
    input.application.forms[0]!.fields[0]!.options = options;
    expect(compile(input).ok).toBe(false);
  });
  it('rejects options on another widget and additions in @1', () => {
    const input = fixture();
    input.application.forms[0]!.fields[0]!.widget = 'text';
    expect(compile(input).ok).toBe(false);
    input.application.schema = 'vict.application@1';
    expect(compile(input).ok).toBe(false);
  });
});
