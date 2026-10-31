import { expect, test } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  compileUiDocument,
  defaultSemanticElementCatalog,
  createUiAuthoringRegistry,
  type UiDocument,
  type UiValue,
} from '@victframework/ui';
import DocumentHost from '../../ui-svelte/src/document/DocumentHost.svelte';
import {
  catalogDescriptors,
  catalogImplementations,
} from '../../ui-svelte/src/catalog/components/catalog.js';
import { flowAuthoringDescriptors, graphPortRowDescriptor } from '../src/authoring/descriptors.js';
import { flowAuthoringImplementations } from '../src/authoring/implementations.js';
import { flowAuthoringPackage } from '../src/authoring/knowledge.js';
import { compositionDocument, typedCompositionDocument } from './composition-fixtures.js';
import { migrateGraphV2ToV3 } from '../src/editor/model-v3.js';

const literal = (value: UiValue) => ({ type: 'literal' as const, value });
const settle = async () => {
  flushSync();
  await new Promise((resolve) => setTimeout(resolve, 50));
  flushSync();
};
function source(version: 1 | 2 | 3): UiDocument {
  const document = version === 1 ? compositionDocument('media') : typedCompositionDocument('media');
  if (version === 3) {
    const migrated = migrateGraphV2ToV3(JSON.parse(String(document.localState.graph.initial)));
    if (!migrated.ok) throw Error(JSON.stringify(migrated));
    document.localState.graph.initial = JSON.stringify(migrated.graph);
    for (const node of Object.values(document.nodes))
      if (
        node.kind === 'component' &&
        ['vict.flow.workspace', 'vict.flow.viewport'].includes(node.definitionId)
      )
        node.revision = '3';
  }
  for (const node of Object.values(document.nodes))
    if (node.kind === 'component' && node.definitionId === 'vict.flow.port') {
      node.definitionId = 'vict.flow.port-row';
      node.revision = '1';
    }
  return document;
}
async function open(document: UiDocument) {
  const descriptors = [...catalogDescriptors, ...flowAuthoringDescriptors];
  const compiled = compileUiDocument(document, defaultSemanticElementCatalog(), descriptors);
  expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
  if (!compiled.ok) throw Error('Fixture compile');
  const target = globalThis.document.createElement('div');
  globalThis.document.body.append(target);
  const writes: unknown[] = [];
  const app = mount(DocumentHost, {
    target,
    props: {
      plan: compiled.plan,
      localState: document.localState,
      extensionDescriptors: descriptors,
      extensionImplementations: [...catalogImplementations, ...flowAuthoringImplementations],
      dispatch: async () => undefined,
      navigate: () => {},
      onStateChange: (...args: unknown[]) => writes.push(args),
    },
  });
  await settle();
  return {
    target,
    writes,
    close: async () => {
      await unmount(app);
      target.remove();
    },
  };
}

test.each([1, 2, 3] as const)(
  'row@1 uses actual graph@%s port semantics without any source write',
  async (version) => {
    const document = source(version),
      before = JSON.stringify(document),
      view = await open(document);
    try {
      const rows = [...view.target.querySelectorAll<HTMLElement>('.graph-port-row')];
      expect(rows).toHaveLength(5);
      const input = view.target.querySelector('[data-node-port="sampler/source"]')!;
      expect(input.querySelector('.svelte-flow__handle-left.target')).not.toBeNull();
      expect(input.querySelector('.port-row-label')?.textContent).toBe('Prompt');
      expect(input.querySelector('.port-row-type')?.textContent).toBe('text');
      const output = view.target.querySelector('[data-node-port="sampler/result"]')!;
      expect(output.querySelector('.svelte-flow__handle-right.source')).not.toBeNull();
      expect(output.querySelector('.port-row-label')?.textContent).toBe('Frame');
      expect(view.writes).toEqual([]);
      expect(JSON.stringify(document)).toBe(before);
    } finally {
      await view.close();
    }
  },
);

test('registration binds only body contexts@1/@2/@3 and rejects drifted row compatibility', () => {
  const registration = flowAuthoringPackage.registrations.find(
    (item) => item.descriptor.id === 'vict.flow.port-row',
  )!;
  expect(registration.rules).toEqual([
    {
      kind: 'ancestorSlot',
      placements: [1, 2, 3].map((revision) => ({
        definitionId: 'vict.flow.workspace',
        revision: String(revision),
        slotName: 'body',
      })),
    },
  ]);
  expect(graphPortRowDescriptor.props?.map((prop) => prop.name)).toEqual([
    'id',
    'color',
    'showType',
  ]);
  expect(graphPortRowDescriptor.outputs).toEqual([]);
  const drifted = {
    ...flowAuthoringPackage,
    registrations: flowAuthoringPackage.registrations.map((item) =>
      item === registration
        ? { ...item, descriptor: { ...item.descriptor, styleTargets: ['root'] } }
        : item,
    ),
  };
  expect(
    createUiAuthoringRegistry([drifted], flowAuthoringImplementations, {
      requireCompatibility: true,
    }).issues.length,
  ).toBeGreaterThan(0);
});

test.each([
  'url(https://invalid.example/x)',
  'red;--attack:1',
  'token:Accent',
  'token:accent);color:red',
  ' #abc',
])('unsafe color %s is absent from markup while labels remain', async (value) => {
  const document = source(2),
    row = document.nodes['settings-out'];
  if (row.kind !== 'component') throw Error('Fixture');
  row.props = { ...row.props, color: literal(value), showType: literal(false) };
  const view = await open(document);
  try {
    const output = view.target.querySelector<HTMLElement>('[data-node-port="sampler/result"]')!;
    expect(output.querySelector('.port-row-label')?.textContent).toBe('Frame');
    expect(output.querySelector('.port-row-type')).toBeNull();
    expect(output.querySelector('[role=alert]')).not.toBeNull();
    expect(output.outerHTML).not.toContain(value);
    expect(view.writes).toEqual([]);
  } finally {
    await view.close();
  }
});

test('missing semantic port cannot manufacture a socket, and outside-body leaf is diagnostic only', async () => {
  const document = source(2),
    row = document.nodes['settings-out'];
  if (row.kind !== 'component') throw Error('Fixture');
  row.props = { id: literal('not-a-port') };
  const inside = await open(document);
  try {
    expect(inside.target.querySelectorAll('.graph-port-row')).toHaveLength(4);
    expect(inside.target.textContent).toContain('Graph port unavailable or duplicated: not-a-port');
    expect(inside.writes).toEqual([]);
  } finally {
    await inside.close();
  }
  document.root = 'settings-out';
  row.slots = {};
  const outside = await open(document);
  try {
    expect(outside.target.querySelector('.svelte-flow__handle')).toBeNull();
    expect(outside.target.querySelector('[role=alert]')).not.toBeNull();
    expect(outside.writes).toEqual([]);
  } finally {
    await outside.close();
  }
});

test('conditional duplicate row unregisters on hide and affects only its own repeated body', async () => {
  const document = source(2),
    workspace = document.nodes.workspace,
    card = document.nodes['prompt-card'];
  if (workspace.kind !== 'component' || card.kind !== 'element') throw Error('Fixture');
  workspace.slots!.body!.scope!.conditions!['duplicate-visible'] = {
    type: 'ref',
    path: 'state.expanded',
  };
  card.children.push('duplicate-toggle', 'duplicate-condition');
  document.nodes['duplicate-toggle'] = {
    kind: 'element',
    id: 'duplicate-toggle',
    tag: 'input',
    children: [],
    attributes: {
      type: literal('checkbox'),
      'aria-label': literal('duplicate-toggle'),
      checked: { type: 'ref', path: 'state.expanded' },
    },
    interactions: [{ on: 'change', action: 'setState', key: 'expanded', value: literal(false) }],
  };
  document.nodes['duplicate-condition'] = {
    kind: 'conditional',
    id: 'duplicate-condition',
    branches: [{ when: 'duplicate-visible', children: ['duplicate-row'] }],
  };
  document.nodes['duplicate-row'] = {
    kind: 'component',
    id: 'duplicate-row',
    definitionId: 'vict.flow.port-row',
    revision: '1',
    props: { id: literal('result') },
  };
  const before = JSON.stringify(document),
    view = await open(document);
  try {
    expect(view.target.querySelector('[data-node-port="prompt-a/result"]')).not.toBeNull();
    const toggle = view.target.querySelector<HTMLInputElement>('[aria-label="duplicate-toggle"]')!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(view.target.querySelector('[data-node-port="prompt-a/result"]')).toBeNull();
    expect(view.target.querySelector('[data-node-port="prompt-b/result"]')).not.toBeNull();
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(view.target.querySelectorAll('[data-node-port="prompt-a/result"]')).toHaveLength(1);
    expect(view.writes).toEqual([]);
    expect(JSON.stringify(document)).toBe(before);
  } finally {
    await view.close();
  }
});
