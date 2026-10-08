/**
 * U4-B1 contract tests: the widened value vocabulary (§10.1a), the
 * descriptor-instance compile path (§3.2/§3.3/§5.1) and the setOutputBinding
 * edit op (§3.6). Fixtures R1–R7 (frozen invalid-cases-recal.json) are
 * executed here at validation level and again at runtime in ui-svelte.
 */
import { describe, expect, it } from 'vitest';
import {
  applyUiEdit,
  compileUiDocument,
  defaultSemanticElementCatalog,
  isUiValueOfType,
  isUiValueType,
  uiValueEmptyFor,
  validateUiDocument,
  type UiDocument,
  type UiExtensionDescriptor,
} from '../src/index.js';
import { deriveActionInputCatalog } from '../../application/src/ui-attach.js';
const ABI_DESCRIPTOR: UiExtensionDescriptor = {
  id: 'vict.catalog.checkbox',
  revision: '1',
  abi: 'vict.ui-component-abi@1',
  events: ['vict.ui-component-abi@1'],
  props: [
    { name: 'label', type: 'string', default: '' },
    { name: 'checked', type: 'boolean', default: false },
  ],
  outputs: [{ name: 'checkedChange', payload: 'boolean' }],
  rendererImplementationId: 'vict.svelte.catalog',
};

function docWith(nodes: UiDocument['nodes'], localState: UiDocument['localState']): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'test.b1',
    revision: '1',
    root: 'root',
    nodes,
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState,
  };
}

const EMPTY_REGISTRIES = {
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
} as const;

describe('UiValue guard (§10.1a)', () => {
  it('accepts scalars, homogeneous lists and the empty list', () => {
    expect(isUiValueOfType('a', 'string')).toBe(true);
    expect(isUiValueOfType(1, 'number')).toBe(true);
    expect(isUiValueOfType(true, 'boolean')).toBe(true);
    expect(isUiValueOfType([], 'stringList')).toBe(true);
    expect(isUiValueOfType(['a', 'b'], 'stringList')).toBe(true);
    expect(isUiValueOfType([1, 2], 'numberList')).toBe(true);
    expect(isUiValueOfType('2026-02-14', 'isoDate')).toBe(true);
    expect(isUiValueOfType('12:30', 'isoTime')).toBe(true);
    expect(isUiValueOfType('12:30:45', 'isoTime')).toBe(true);
  });

  it('rejects null members, mixed members (R7), NaN and library objects', () => {
    expect(isUiValueOfType([null], 'stringList')).toBe(false);
    expect(isUiValueOfType(['alpha', 1], 'stringList')).toBe(false);
    expect(isUiValueOfType(['alpha', 1], 'numberList')).toBe(false);
    expect(isUiValueOfType([Number.NaN], 'numberList')).toBe(false);
    expect(isUiValueOfType(new Date(), 'string')).toBe(false);
    expect(isUiValueOfType(new Date(), 'stringList')).toBe(false);
    expect(isUiValueOfType({}, 'numberList')).toBe(false);
    expect(isUiValueOfType(Infinity, 'number')).toBe(false);
  });

  it('rejects format- and calendar-invalid ISO literals (R2/R3 shapes)', () => {
    expect(isUiValueOfType('2026-13-45', 'isoDate')).toBe(false);
    expect(isUiValueOfType('2026-02-30', 'isoDate')).toBe(false);
    expect(isUiValueOfType('not-a-date', 'isoDate')).toBe(false);
    expect(isUiValueOfType('25:99', 'isoTime')).toBe(false);
    expect(isUiValueOfType('99', 'isoTime')).toBe(false);
    // leap-year acceptance
    expect(isUiValueOfType('2024-02-29', 'isoDate')).toBe(true);
    expect(isUiValueOfType('2026-02-29', 'isoDate')).toBe(false);
  });

  it('exposes the vocabulary check and empty conventions', () => {
    expect(isUiValueType('stringList')).toBe(true);
    expect(isUiValueType('isoTime')).toBe(true);
    expect(isUiValueType('array')).toBe(false);
    expect(uiValueEmptyFor('string')).toBe('');
    expect(uiValueEmptyFor('stringList')).toEqual([]);
    expect(uiValueEmptyFor('numberList')).toEqual([]);
    expect(uiValueEmptyFor('number')).toBeUndefined();
    expect(uiValueEmptyFor('boolean')).toBeUndefined();
  });
});

describe('validation widening (§10.1a boundary 6)', () => {
  it('accepts widened declarations the legacy validator rejected', () => {
    const document = docWith(
      { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
      {
        sel: { key: 'sel', type: 'stringList', initial: [] },
        nums: { key: 'nums', type: 'numberList', initial: [1, 2] },
      },
    );
    const issues = validateUiDocument(document, {
      elements: defaultSemanticElementCatalog(),
    });
    expect(issues.filter((issue) => issue.code === 'UI_EXPR_TYPE_MISMATCH')).toEqual([]);
  });

  it('raises UI_DOC_INVALID_LITERAL for malformed ISO literals', () => {
    const document = docWith(
      { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
      { d: { key: 'd', type: 'isoDate', initial: '2026-13-45' } },
    );
    const issues = validateUiDocument(document, {
      elements: defaultSemanticElementCatalog(),
    });
    expect(issues.map((issue) => issue.code)).toContain('UI_DOC_INVALID_LITERAL');
  });

  it('raises UI_EXPR_TYPE_MISMATCH for mixed list members (R7) and scalar/list swaps (R1)', () => {
    const mixed = docWith(
      { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
      { sel: { key: 'sel', type: 'stringList', initial: ['alpha', 1] as never } },
    );
    expect(
      validateUiDocument(mixed, { elements: defaultSemanticElementCatalog() }).map(
        (issue) => issue.code,
      ),
    ).toContain('UI_EXPR_TYPE_MISMATCH');
    const scalar = docWith(
      { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
      { sel: { key: 'sel', type: 'stringList', initial: 'a' as never } },
    );
    expect(
      validateUiDocument(scalar, { elements: defaultSemanticElementCatalog() }).map(
        (issue) => issue.code,
      ),
    ).toContain('UI_EXPR_TYPE_MISMATCH');
  });

  it('rejects $output outside output bindings', () => {
    const document = docWith(
      {
        root: {
          kind: 'element',
          id: 'root',
          tag: 'p',
          children: ['t'],
        },
        t: {
          kind: 'text',
          id: 't',
          content: { type: 'expression', expression: { type: 'ref', path: '$output' } },
        },
      },
      {},
    );
    expect(
      validateUiDocument(document, { elements: defaultSemanticElementCatalog() }).map(
        (issue) => issue.code,
      ),
    ).toContain('UI_COMPONENT_OUTPUT_PAYLOAD_INVALID');
  });

  it('reports an output binding to an undeclared state key', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          outputs: { checkedChange: { setState: { key: 'missing' } } },
        },
      },
      {},
    );
    expect(
      validateUiDocument(document, { elements: defaultSemanticElementCatalog() }).map(
        (issue) => issue.code,
      ),
    ).toContain('UI_COMPONENT_BINDING_INCOMPATIBLE');
  });
});

describe('compile: descriptor instances (§3.1–§3.3, §5.1)', () => {
  const localState = {
    ack: { key: 'ack', type: 'boolean', initial: false },
  } as const;

  it('emits outputDecls (compile-artifact marker) with the effective revision', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          props: { label: { type: 'literal', value: 'Ack' } },
          outputs: {
            checkedChange: {
              setState: { key: 'ack', value: { type: 'ref', path: '$output' } },
            },
          },
        },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rootInstruction = result.plan.structure[0]!;
    if (rootInstruction.kind !== 'element') throw new Error('not element');
    const instruction = rootInstruction.children[0]!;
    expect(instruction.kind).toBe('extension');
    if (instruction.kind !== 'extension') return;
    expect(instruction.revision).toBe('1');
    expect(instruction.outputDecls).toEqual(ABI_DESCRIPTOR.outputs);
    expect(instruction.outputBindings?.checkedChange).toBeDefined();
  });

  it('emits the declared list (marker present even when the author wired no outputs)', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: { kind: 'component', id: 'cb', definitionId: 'vict.catalog.checkbox' },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    if (!result.ok) throw new Error('compile failed');
    const rootInstruction = result.plan.structure[0]!;
    if (rootInstruction.kind !== 'element') throw new Error('not element');
    const instruction = rootInstruction.children[0]!;
    if (instruction.kind !== 'extension') throw new Error('not extension');
    // §3.3: the DECLARED list is always emitted (the marker), independent
    // of authored wiring; bindings are {} when unwired.
    expect(instruction.outputDecls).toEqual(ABI_DESCRIPTOR.outputs);
    expect(instruction.outputBindings).toEqual({});
  });

  it('fails closed on a revision pin matching no registered revision', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          revision: '9',
        },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_REVISION_UNRESOLVED',
    );
  });

  it('raises UI_COMPONENT_ABI_UNSUPPORTED for a malformed marker/abi pair', () => {
    const broken: UiExtensionDescriptor = {
      ...ABI_DESCRIPTOR,
      events: ['vict.ui-component-abi@1'],
      abi: undefined,
    };
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: { kind: 'component', id: 'cb', definitionId: 'vict.catalog.checkbox' },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [broken]);
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_ABI_UNSUPPORTED',
    );
  });

  it('rejects unknown outputs and payload/state type mismatches (R1)', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          outputs: {
            checkedChange: { setState: { key: 'textState' } },
            ghost: { setState: { key: 'ack' } },
          },
        },
      },
      { ...localState, textState: { key: 'textState', type: 'string', initial: '' } },
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    if (!result.ok) throw new Error('compile failed');
    const codes = result.plan.diagnostics.map((issue) => issue.code);
    expect(codes).toContain('UI_COMPONENT_OUTPUT_UNKNOWN');
    expect(codes).toContain('UI_COMPONENT_BINDING_INCOMPATIBLE');
  });

  it('types action inputs against the derived catalog and flags undeclared inputs', () => {
    const descriptor: UiExtensionDescriptor = {
      ...ABI_DESCRIPTOR,
      id: 'vict.catalog.button',
      props: [{ name: 'label', type: 'string', default: '' }],
      outputs: [{ name: 'press', payload: 'void' }],
    };
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['btn'] },
        btn: {
          kind: 'component',
          id: 'btn',
          definitionId: 'vict.catalog.button',
          outputs: {
            press: {
              invokeAction: {
                actionId: 'review.approve',
                input: {
                  noteId: { type: 'literal', value: 'n_1' },
                  ghost: { type: 'literal', value: 'x' },
                },
              },
            },
          },
        },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [descriptor], {
      actionIds: ['review.approve'],
      actionInputs: { 'review.approve': { noteId: 'string' } },
    });
    if (!result.ok) throw new Error('compile failed');
    const codes = result.plan.diagnostics.map((issue) => issue.code);
    expect(codes).toContain('UI_COMPONENT_BINDING_INCOMPATIBLE');
  });

  it('rejects undeclared slot fills at compile (never silently dropped)', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          slots: { body: { name: 'body', children: [] } },
        },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_DOC_UNKNOWN_COMPONENT',
    );
  });

  it('compiles declared slot fills in the instance scope', () => {
    const dialog: UiExtensionDescriptor = {
      id: 'vict.catalog.dialog',
      revision: '1',
      abi: 'vict.ui-component-abi@1',
      events: ['vict.ui-component-abi@1'],
      props: [{ name: 'title', type: 'string', default: '' }],
      outputs: [{ name: 'openChange', payload: 'boolean' }],
      slots: ['body'],
      rendererImplementationId: 'vict.svelte.catalog',
    };
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['dlg'] },
        dlg: {
          kind: 'component',
          id: 'dlg',
          definitionId: 'vict.catalog.dialog',
          slots: { body: { name: 'body', children: ['confirm'] } },
        },
        confirm: { kind: 'element', id: 'confirm', tag: 'button', children: [] },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [dialog]);
    if (!result.ok) throw new Error('compile failed');
    const rootInstruction = result.plan.structure[0]!;
    if (rootInstruction.kind !== 'element') throw new Error('not element');
    const instruction = rootInstruction.children[0]!;
    if (instruction.kind !== 'extension') throw new Error('not extension');
    expect(instruction.slots?.body?.length).toBe(1);
    expect(instruction.slots?.body?.[0]?.nodeId).toBe('confirm');
  });

  it('checks literal and reference prop types for descriptor instances', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: {
          kind: 'component',
          id: 'cb',
          definitionId: 'vict.catalog.checkbox',
          props: { checked: { type: 'literal', value: 'yes' } },
        },
      },
      localState,
    );
    const result = compileUiDocument(document, defaultSemanticElementCatalog(), [ABI_DESCRIPTOR]);
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain('UI_EXPR_TYPE_MISMATCH');
  });
});

describe('deriveActionInputCatalog (§3.5)', () => {
  const actions = [
    {
      kind: 'mutation',
      id: 'review.approve',
      revision: '1',
      inputContractId: 'c.note',
      inputContractRevision: '1',
    },
    { kind: 'mutation', id: 'review.reject', revision: '1', inputContractId: 'c.missing' },
    { kind: 'local', id: 'ui.flash', revision: '1' },
  ];
  const contracts = [{ id: 'c.note', revision: '1' }];

  it('derives typing for resolvable contracts and skips unresolvable ones', () => {
    const catalog = deriveActionInputCatalog(actions, contracts, {
      'c.note': { noteId: 'string' },
    });
    expect(catalog['review.approve']).toEqual({ noteId: 'string' });
    expect(catalog['review.reject']).toBeUndefined();
    expect(catalog['ui.flash']).toBeUndefined();
  });

  it('fail-closes on a declared contract revision not registered', () => {
    const catalog = deriveActionInputCatalog(
      [{ id: 'a', inputContractId: 'c.note', inputContractRevision: '2' }],
      contracts,
      { 'c.note': { noteId: 'string' } },
    );
    expect(catalog['a']).toBeUndefined();
  });
});

const ABI_LOCAL_STATE = {
  ack: { key: 'ack', type: 'boolean', initial: false },
} as const;

describe('setOutputBinding edit op (§3.6)', () => {
  it('sets and clears bindings transactionally with validation', () => {
    const document = docWith(
      {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['cb'] },
        cb: { kind: 'component', id: 'cb', definitionId: 'vict.catalog.checkbox' },
      },
      ABI_LOCAL_STATE,
    );
    const snapshot = { document, revision: '1' };
    const set = applyUiEdit(
      snapshot,
      {
        requestId: 'r1',
        expectedDocumentRevision: '1',
        commands: [
          {
            op: 'setOutputBinding',
            nodeId: 'cb',
            output: 'checkedChange',
            binding: { setState: { key: 'ack', value: { type: 'ref', path: '$output' } } },
          },
        ],
      },
      { elements: defaultSemanticElementCatalog() },
    );
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    const node = set.document.nodes['cb'];
    if (node?.kind !== 'component') throw new Error('not component');
    expect(node.outputs?.checkedChange).toBeDefined();
    const clear = applyUiEdit(
      { document: set.document, revision: set.revision },
      {
        requestId: 'r2',
        expectedDocumentRevision: set.revision,
        commands: [{ op: 'setOutputBinding', nodeId: 'cb', output: 'checkedChange' }],
      },
      { elements: defaultSemanticElementCatalog() },
    );
    expect(clear.ok).toBe(true);
    if (!clear.ok) return;
    const cleared = clear.document.nodes['cb'];
    if (cleared?.kind !== 'component') throw new Error('not component');
    expect(cleared.outputs).toBeUndefined();
  });

  it('rejects setOutputBinding on a non-component node', () => {
    const document = docWith(
      { root: { kind: 'element', id: 'root', tag: 'p', children: [] } },
      ABI_LOCAL_STATE,
    );
    const result = applyUiEdit(
      { document, revision: '1' },
      {
        requestId: 'r1',
        expectedDocumentRevision: '1',
        commands: [{ op: 'setOutputBinding', nodeId: 'root', output: 'x' }],
      },
      { elements: defaultSemanticElementCatalog() },
    );
    expect(result.ok).toBe(false);
  });
});
