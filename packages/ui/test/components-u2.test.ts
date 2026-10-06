/**
 * U2-01/U2-02 model tests: required-slot and unknown-prop diagnostics,
 * definition-edit propagation to instances, instance override persistence,
 * portal logical ownership in occurrence provenance.
 */
import { describe, expect, it } from 'vitest';
import {
  canonicalUiDocument,
  compileUiDocument,
  defaultSemanticElementCatalog,
  UiEditSession,
  validateUiDocument,
  type UiCatalogs,
  type UiDocument,
} from '../src/index.js';

type DeepWritable<T> = T extends readonly (infer V)[]
  ? DeepWritable<V>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepWritable<T[K]> }
    : T;
type WUiNode = DeepWritable<UiDocument['nodes'][string]>;
type WElement = Extract<WUiNode, { kind: 'element' }>;

const catalogs: UiCatalogs = {
  elements: defaultSemanticElementCatalog(),
  actionIds: [],
  routeIds: [],
  viewFields: {},
};

/** Writable deep copy for test authoring. */
function draft<T>(value: T): DeepWritable<T> {
  return JSON.parse(JSON.stringify(value)) as DeepWritable<T>;
}
const mutable = (document: UiDocument): DeepWritable<UiDocument> => draft(document);

function minimalDocument(): UiDocument {
  return {
    schema: 'vict.ui-document@1',
    id: 'doc.u2',
    revision: '1',
    root: 'n.root',
    nodes: {
      'n.root': { kind: 'element', id: 'n.root', tag: 'section', children: [] },
    },
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
}

/** Mutable working copy (document registries are readonly in the type). */

/** A card definition with a required `title` slot and a typed prop. */
function cardDocument(): UiDocument {
  const document = mutable(minimalDocument());
  document.componentDefinitions['def.card'] = {
    id: 'def.card',
    revision: '1',
    root: 'n.card',
    props: [{ name: 'tone', type: 'string', default: 'neutral' }],
    slots: { title: { required: true }, body: {} },
  };
  document.nodes['n.card'] = {
    kind: 'element',
    id: 'n.card',
    tag: 'article',
    children: ['n.cardHeading', 'n.cardSlot'],
  } as WUiNode;
  document.nodes['n.cardHeading'] = {
    kind: 'slot',
    id: 'n.cardHeading',
    name: 'title',
  } as WUiNode;
  document.nodes['n.cardSlot'] = { kind: 'slot', id: 'n.cardSlot', name: 'body' } as WUiNode;
  return document;
}

describe('U2-01 component diagnostics', () => {
  it('an instance leaving a REQUIRED slot unfilled is a structural error', () => {
    const document = mutable(cardDocument());
    document.nodes['n.i1'] = {
      kind: 'component',
      id: 'n.i1',
      definitionId: 'def.card',
      slots: { body: { name: 'body', children: [] } },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.i1'];
    const issues = validateUiDocument(document, catalogs);
    const missing = issues.find((issue) => issue.code === 'UI_DOC_REQUIRED_SLOT_MISSING');
    expect(missing?.severity).toBe('error');
    // compile gates on it (structural)
    const compiled = compileUiDocument(document, catalogs.elements);
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.issues.some((issue) => issue.code === 'UI_DOC_REQUIRED_SLOT_MISSING')).toBe(
        true,
      );
    }
  });

  it('filling the required slot clears the diagnostic; optional slots stay optional', () => {
    const document = mutable(cardDocument());
    document.nodes['n.titleFill'] = {
      kind: 'text',
      id: 'n.titleFill',
      content: { type: 'literal', value: 'Service areas' },
    } as WUiNode;
    document.nodes['n.i1'] = {
      kind: 'component',
      id: 'n.i1',
      definitionId: 'def.card',
      slots: {
        title: { name: 'title', children: ['n.titleFill'] },
        body: { name: 'body', children: [] },
      },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.i1'];
    const issues = validateUiDocument(document, catalogs);
    expect(issues.some((issue) => issue.code === 'UI_DOC_REQUIRED_SLOT_MISSING')).toBe(false);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('an instance prop the definition does not declare is diagnosed', () => {
    const document = mutable(cardDocument());
    document.nodes['n.titleFill'] = {
      kind: 'text',
      id: 'n.titleFill',
      content: { type: 'literal', value: 'x' },
    } as WUiNode;
    document.nodes['n.i1'] = {
      kind: 'component',
      id: 'n.i1',
      definitionId: 'def.card',
      props: { accent: { type: 'literal', value: 'teal' } },
      slots: { title: { name: 'title', children: ['n.titleFill'] } },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.i1'];
    const issues = validateUiDocument(document, catalogs);
    const unknown = issues.find((issue) => issue.code === 'UI_DOC_UNKNOWN_PROP');
    expect(unknown?.severity).toBe('error');
  });

  it('a literal prop with the wrong declared type is diagnosed (type errors)', () => {
    const document = mutable(cardDocument());
    document.nodes['n.titleFill'] = {
      kind: 'text',
      id: 'n.titleFill',
      content: { type: 'literal', value: 'x' },
    } as WUiNode;
    document.nodes['n.i1'] = {
      kind: 'component',
      id: 'n.i1',
      definitionId: 'def.card',
      props: { tone: { type: 'literal', value: 42 } },
      slots: { title: { name: 'title', children: ['n.titleFill'] } },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.i1'];
    const issues = validateUiDocument(document, catalogs);
    expect(
      issues.some((issue) => issue.code === 'UI_EXPR_TYPE_MISMATCH' && issue.nodeId === 'n.i1'),
    ).toBe(true);
  });
});

describe('U2-01 definition editing propagates to instances', () => {
  function twoInstanceDocument(): UiDocument {
    const document = mutable(cardDocument());
    document.nodes['n.titleA'] = {
      kind: 'text',
      id: 'n.titleA',
      content: { type: 'literal', value: 'First' },
    } as WUiNode;
    document.nodes['n.titleB'] = {
      kind: 'text',
      id: 'n.titleB',
      content: { type: 'literal', value: 'Second' },
    } as WUiNode;
    document.nodes['n.i1'] = {
      kind: 'component',
      id: 'n.i1',
      definitionId: 'def.card',
      slots: { title: { name: 'title', children: ['n.titleA'] } },
    } as WUiNode;
    document.nodes['n.i2'] = {
      kind: 'component',
      id: 'n.i2',
      definitionId: 'def.card',
      slots: { title: { name: 'title', children: ['n.titleB'] } },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.i1', 'n.i2'];
    return document;
  }

  const slotTextOf = (
    document: UiDocument,
    compiled: Extract<ReturnType<typeof compileUiDocument>, { ok: true }>['plan'],
    instanceId: string,
  ): string => {
    void document;
    const root = compiled.structure[0];
    if (root === undefined || root.kind !== 'element') return '';
    const instance = root.children.find(
      (child) => child?.kind === 'component' && child.nodeId === instanceId,
    );
    if (instance === undefined || instance.kind !== 'component') return '';
    const fill = instance.slots['title']?.[0];
    return fill !== undefined && fill.kind === 'text'
      ? fill.content.type === 'literal'
        ? fill.content.value
        : ''
      : '';
  };

  it('editing the DEFINITION body updates every instance; instance slot fills stay per-instance', () => {
    const document = mutable(twoInstanceDocument());
    const session = UiEditSession.open({ document, storedRevision: '1' });
    // Definition-owned node (detached subtree under def.card): change its tag.
    const edit = session.applyTransaction({
      requestId: 'def-edit-1',
      expectedDocumentRevision: '1#0',
      commands: [{ op: 'setProperty', nodeId: 'n.card', property: 'tag', value: 'section' }],
    });
    expect(edit.ok).toBe(true);
    const compiled = compileUiDocument(session.state().working.document, catalogs.elements);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    // Both instances render the definition's EDITED tag (shared source).
    for (const instanceId of ['n.i1', 'n.i2']) {
      const root = compiled.plan.structure[0];
      if (root === undefined || root.kind !== 'element') continue;
      const instance = root.children.find(
        (child) => child?.kind === 'component' && child.nodeId === instanceId,
      );
      if (instance === undefined || instance.kind !== 'component') continue;
      expect(instance.body.kind === 'element' && instance.body.tag).toBe('section');
    }
    // The two instances keep their OWN slot fills.
    expect(slotTextOf(document, compiled.plan, 'n.i1')).toBe('First');
    expect(slotTextOf(document, compiled.plan, 'n.i2')).toBe('Second');
  });

  it('an instance-local style override persists through canonical round-trip and stays instance-local', () => {
    const document = mutable(twoInstanceDocument());
    const session = UiEditSession.open({ document, storedRevision: '1' });
    const override = session.applyTransaction({
      requestId: 'override-1',
      expectedDocumentRevision: '1#0',
      commands: [
        {
          op: 'setStyleDeclaration',
          nodeId: 'n.i2',
          property: 'border',
          value: { type: 'text', value: '2px solid var(--ui-token-color_accent)' },
        },
      ],
    });
    expect(override.ok).toBe(true);
    const roundTrip = JSON.parse(
      JSON.stringify(canonicalUiDocument(session.state().working.document)),
    ) as { contentDigest: string };
    expect(roundTrip.contentDigest).toEqual(expect.any(String));
    const persisted = session.state().working.document.nodes['n.i2'];
    expect(persisted?.kind === 'component' && persisted.localStyle?.[0]?.property).toBe('border');
    // The sibling instance is untouched.
    const sibling = session.state().working.document.nodes['n.i1'];
    expect(sibling?.kind === 'component' && sibling.localStyle).toBeUndefined();
  });
});

describe('U2-02 provenance', () => {
  it('a node presented through a portal carries the portal ownership segment', () => {
    const document = mutable(minimalDocument());
    document.nodes['n.portal'] = {
      kind: 'portal',
      id: 'n.portal',
      target: { overlayId: 'ov.dialog' },
      children: ['n.insidePortal'],
    } as WUiNode;
    document.nodes['n.insidePortal'] = {
      kind: 'text',
      id: 'n.insidePortal',
      content: { type: 'literal', value: 'owned by the overlay' },
    } as WUiNode;
    (document.nodes['n.root'] as WElement).children = ['n.portal'];
    const compiled = compileUiDocument(document, catalogs.elements);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    // Declared unsupported, with an explicit diagnostic (U2-08 honesty).
    expect(
      compiled.plan.diagnostics.some(
        (issue) => issue.code === 'UI_DOC_UNSUPPORTED_FEATURE' && issue.nodeId === 'n.portal',
      ),
    ).toBe(true);
    // AND the occurrence provenance keeps the LOGICAL portal ownership.
    const entry = compiled.plan.sourceMap.find((item) => item.sourceNodeId === 'n.insidePortal');
    expect(entry?.componentInstancePath.join('|')).toContain('portal:n.portal:ov.dialog');
  });
});
