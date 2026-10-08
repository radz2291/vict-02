/**
 * U4-B1 consumer test suite: the frozen fixtures R1–R7 executed at
 * validation level against the consumer's compile path, the amendment
 * negative set (§5 failure model), primitive-compatibility preservation,
 * and the shell composition evidence.
 */
import { describe, expect, it } from 'vitest';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  isUiValueOfType,
  validateUiDocument,
  type UiDocument,
} from '@victframework/ui';
import { b1CatalogDescriptors, compileConsumerDocuments, consumerActionInputs } from '../src/product/registrations.js';
import {
  consumerActionIds,
  consumerViewFields,
} from '../src/product/definition.js';
import { taskControlsDocument, taskShellDocument } from '../src/product/documents.js';

const CATALOGS = {
  elements: defaultSemanticElementCatalog(),
  actionIds: consumerActionIds,
  viewFields: consumerViewFields,
};

function withProbe(probe: UiDocument['nodes'][string]): UiDocument {
  // The probe must be REACHABLE from the root — compile only visits the
  // document tree, and unreachable authoring is invisible to it.
  const page = taskControlsDocument.nodes['page'];
  return {
    ...taskControlsDocument,
    id: 'consumer.probe',
    nodes: {
      ...taskControlsDocument.nodes,
      probe,
      ...(page?.kind === 'element'
        ? { page: { ...page, children: [...page.children, 'probe'] } }
        : {}),
    },
  };
}

describe('seeded documents compile through the application path', () => {
  const result = compileConsumerDocuments();
  it('compiles both documents with zero fatal issues', () => {
    expect(result.ok, result.ok ? '' : JSON.stringify([result.issues, result.uiIssues])).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.plan.documentPlans ?? {}).length).toBe(2);
  });
  it('every B1 instance carries the compile-artifact marker (outputDecls)', () => {
    expect(result.ok, result.ok ? '' : JSON.stringify([result.issues, result.uiIssues])).toBe(true);
    if (!result.ok) return;
    let markers = 0;
    const walk = (instruction: {
      kind: string;
      children?: readonly unknown[];
      outputDecls?: readonly unknown[];
      slots?: Readonly<Record<string, readonly unknown[]>>;
    }): void => {
      if (instruction.kind === 'extension') {
        expect(Array.isArray(instruction.outputDecls)).toBe(true);
        markers += 1;
      }
      for (const child of instruction.children ?? []) walk(child as never);
      for (const fills of Object.values(instruction.slots ?? {})) {
        for (const child of fills) walk(child as never);
      }
    };
    for (const plan of Object.values(result.plan.documentPlans ?? {})) {
      for (const instruction of plan.structure) walk(instruction as never);
    }
    // button + 2 checkboxes + select + switch + toggle + radio-group + dialog + appshell
    expect(markers).toBeGreaterThanOrEqual(9);
  });
});

describe('frozen negative fixtures R1–R7 (validation level)', () => {
  const asLocal = (localState: UiDocument['localState']): UiDocument => ({
    ...taskControlsDocument,
    id: 'consumer.negative',
    localState,
  });
  it('R1 stringList → scalar state rejects at compile (UI_COMPONENT_BINDING_INCOMPATIBLE)', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.checkbox',
        outputs: { checkedChange: { setState: { key: 'region' } } },
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_BINDING_INCOMPATIBLE',
    );
  });
  it('R2 malformed isoDate literal → UI_DOC_INVALID_LITERAL', () => {
    const issues = validateUiDocument(
      asLocal({ d: { key: 'd', type: 'isoDate', initial: '2026-13-45' } }),
      CATALOGS,
    );
    expect(issues.map((issue) => issue.code)).toContain('UI_DOC_INVALID_LITERAL');
  });
  it('R3 malformed isoTime literal → UI_DOC_INVALID_LITERAL', () => {
    const issues = validateUiDocument(
      asLocal({ t: { key: 't', type: 'isoTime', initial: '25:99' } }),
      CATALOGS,
    );
    expect(issues.map((issue) => issue.code)).toContain('UI_DOC_INVALID_LITERAL');
  });
  it('R4 null list member → UI_EXPR_TYPE_MISMATCH', () => {
    const issues = validateUiDocument(
      asLocal({ nums: { key: 'nums', type: 'numberList', initial: [1, null] as never } }),
      CATALOGS,
    );
    expect(issues.map((issue) => issue.code)).toContain('UI_EXPR_TYPE_MISMATCH');
  });
  it('R7 mixed members → UI_EXPR_TYPE_MISMATCH', () => {
    const issues = validateUiDocument(
      asLocal({ sel: { key: 'sel', type: 'stringList', initial: ['alpha', 1] as never } }),
      CATALOGS,
    );
    expect(issues.map((issue) => issue.code)).toContain('UI_EXPR_TYPE_MISMATCH');
  });
  it('R5 empty conventions ([] valid) and R6 (B3 range fixture) mapped explicitly', () => {
    expect(isUiValueOfType([], 'stringList')).toBe(true);
    expect(isUiValueOfType('2026-02-14', 'isoDate')).toBe(true);
    // R6 (range start > end) executes in the B3 slider-range fixture set —
    // outside B1 scope by the frozen batch plan (recalibration §10.4).
  });
});

describe('amendment negatives (§5 failure model)', () => {
  it('unknown output name → UI_COMPONENT_OUTPUT_UNKNOWN', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.checkbox',
        outputs: { ghost: { setState: { key: 'region' } } },
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_OUTPUT_UNKNOWN',
    );
  });
  it('incompatible binding: boolean payload → string state rejects', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.checkbox',
        outputs: { checkedChange: { setState: { key: 'region' } } },
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_BINDING_INCOMPATIBLE',
    );
  });
  it('revision pin mismatch → UI_COMPONENT_REVISION_UNRESOLVED', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.checkbox',
        revision: '99',
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_REVISION_UNRESOLVED',
    );
  });
  it('action input typing: undeclared input name rejects against the derived catalog', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.button',
        outputs: {
          press: {
            invokeAction: {
              actionId: 'task.submit',
              input: { ghost: { type: 'literal', value: 'x' } },
            },
          },
        },
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
      {
        actionIds: consumerActionIds,
        actionInputs: { 'task.submit': { ...consumerActionInputs['task.submit'] } },
      },
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_COMPONENT_BINDING_INCOMPATIBLE',
    );
  });
  it('undeclared slot fill on a descriptor instance rejects at compile', () => {
    const result = compileUiDocument(
      withProbe({
        kind: 'component',
        id: 'probe',
        definitionId: 'vict.catalog.checkbox',
        slots: { body: { name: 'body', children: [] } },
      }),
      CATALOGS.elements,
      b1CatalogDescriptors,
    );
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.map((issue) => issue.code)).toContain(
      'UI_DOC_UNKNOWN_COMPONENT',
    );
  });
});

describe('primitive compatibility preserved (probe-matrix row)', () => {
  it('a primitive-only document still validates and compiles unchanged', () => {
    // A genuinely primitive-only document (no component instances, no
    // widened vocabulary): the exact pre-amendment shape.
    const primitive: UiDocument = {
      schema: 'vict.ui-document@1',
      id: 'consumer.primitive',
      revision: '1',
      root: 'root',
      componentDefinitions: {},
      styleSources: {},
      tokens: {},
      conditions: {},
      assets: {},
      localState: { flag: { key: 'flag', type: 'boolean', initial: false } },
      nodes: {
        root: { kind: 'element', id: 'root', tag: 'p', children: ['label'] },
        label: { kind: 'text', id: 'label', content: { type: 'literal', value: 'Ready' } },
      },
    };
    // Document-level validation defers descriptor resolution (UI_DOC_UNKNOWN_COMPONENT
    // is the joint compiler's code); everything else must be clean.
    expect(
      validateUiDocument(primitive, CATALOGS).filter(
        (issue) => issue.severity === 'error' && issue.code !== 'UI_DOC_UNKNOWN_COMPONENT',
      ),
    ).toEqual([]);
    const result = compileUiDocument(primitive, CATALOGS.elements, b1CatalogDescriptors);
    expect(result.ok).toBe(true);
  });
  it('widened declarations the legacy validator rejected now validate (new-side acceptance)', () => {
    const widened: UiDocument = {
      ...taskControlsDocument,
      localState: {
        ...taskControlsDocument.localState,
        dueDate: { key: 'dueDate', type: 'isoDate', initial: '2026-10-08' },
      },
    };
    expect(
      validateUiDocument(widened, CATALOGS).filter(
        (issue) => issue.severity === 'error' && issue.code !== 'UI_DOC_UNKNOWN_COMPONENT',
      ),
    ).toEqual([]);
  });
});

describe('shell document (P-overlay + composition evidence)', () => {
  it('dialog open loop and appshell content slot compile with instance-scope fills', () => {
    const result = compileUiDocument(taskShellDocument, CATALOGS.elements, b1CatalogDescriptors);
    if (!result.ok) throw new Error('compile failed');
    expect(result.plan.diagnostics.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});
