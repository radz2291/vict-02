/**
 * VERIFICATION PROBE (round 3a) — family-and-mode AUTHORING coverage.
 *
 * The round-3 record demonstrated the authoring loop on a single B3 family.
 * This probe drives the SAME data path the Inspector uses — descriptor prop
 * declarations → ExpressionEditor contract (bindExpression + expected
 * working revision, the editor-bridge contract) → the real UiEditSession
 * state machine (applyTransaction: idempotency, revision history) → document
 * compile → DocumentHost render — for EVERY descriptor in the catalog.
 * Composition-required families use the package-owned canonical example
 * including its exact provider slots, paired identities and controlled state;
 * a family that still renders unavailable is an authoring-support defect.
 *
 * Assertions per family:
 *   - the seed and edited documents compile through the joint compiler;
 *   - the applied transaction is accepted, the working revision advances,
 *     and the edited document carries the authored literal (state agreement);
 *   - display props echo into the canvas (text or aria-label); other props
 *     keep the render stable.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { UiEditSession, materializeAuthoringFragment } from '@victframework/ui';
import type { UiDocument, UiNode } from '@victframework/ui';
import { compileUiDocument, defaultSemanticElementCatalog } from '@victframework/ui';
import { bindExpression } from '@victframework/ui-editor';
import { catalogDescriptors, catalogImplementations } from '../src/catalog/components/catalog.js';
import { catalogAuthoringRegistrations } from '../src/catalog/components/authoring.js';
import type { UiExtensionDescriptor } from '@victframework/ui';
import type { UiSvelteComponentImplementation } from '../src/document/extensions.js';
import DocumentHost from '../src/document/DocumentHost.svelte';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

const isDisplayProp = (name: string): boolean =>
  /label|title|text|placeholder|description|heading|caption/i.test(name);
const isAriaOnly = (id: string, name: string): boolean =>
  id === 'vict.catalog.range-calendar' ||
  id === 'vict.catalog.calendar' ||
  id === 'vict.catalog.pagination';

/** Structural parts have no value prop by design; their authoring mode is
 * composition (slots/children) and cascade styling, not value editing. */
const STRUCTURAL = new Set([
  'vict.catalog.dropdown-menu.checkbox-group',
  'vict.catalog.dropdown-menu.separator',
  'vict.catalog.context-menu.checkbox-group',
  'vict.catalog.context-menu.separator',
  'vict.catalog.menubar.checkbox-group',
  'vict.catalog.menubar.separator',
]);

/** The exact package example owns provider context, required peers, identity
 * remapping and state. Track the intended leaf rather than guessing ancestry
 * from descriptor names or overwriting valid seeded values with empty defaults. */
function docFor(descriptor: UiExtensionDescriptor): { document: UiDocument; targetId: string } {
  const registration = catalogAuthoringRegistrations.find(item =>
    item.descriptor.id === descriptor.id && item.descriptor.revision === descriptor.revision);
  expect(registration, `${descriptor.id}: exact authoring registration`).toBeDefined();
  const example = registration?.examples?.[0];
  expect(example, `${descriptor.id}: documented canonical example`).toBeDefined();
  if (!example) throw new Error(`Missing canonical authoring example: ${descriptor.id}@${descriptor.revision}`);
  const fragment = materializeAuthoringFragment(example, 'fixture');
  const targets = fragment.nodes.filter(node => node.kind === 'component' &&
    node.definitionId === descriptor.id && node.revision === descriptor.revision);
  expect(targets, `${descriptor.id}: one intended edited occurrence`).toHaveLength(1);
  const targetId = targets[0]!.id;
  const nodes: UiNode[] = [...fragment.nodes];
  // Host-required examples intentionally omit host composition. Supply only
  // declared required presentation slots here; this does not prove navigation.
  if (registration?.eligibility.kind === 'host-required') {
    const implementation = catalogImplementations.find(item => item.extensionId === descriptor.id &&
      item.revision === descriptor.revision);
    const index = nodes.findIndex(node => node.id === targetId);
    const target = nodes[index]!;
    if (target.kind !== 'component') throw new Error('Expected component fixture target');
    const slots = { ...target.slots };
    for (const slot of implementation?.required ?? []) {
      if (slots[slot]?.children.length) continue;
      const id = `test-host-${targetId}-${slot}`;
      expect(nodes.some(node => node.id === id || node.id === `${id}-text`)).toBe(false);
      nodes.push({ kind: 'element', id, tag: 'p', children: [`${id}-text`] },
        { kind: 'text', id: `${id}-text`, content: { type: 'literal', value: 'Explicit test host content' } });
      slots[slot] = { name: slot, children: [id] };
    }
    nodes[index] = { ...target, slots };
  }
  const document: UiDocument = {
    schema: 'vict.ui-document@1', id: `probe.authoring.${descriptor.id}`, revision: '1', root: 'root',
    nodes: Object.fromEntries([
      { kind: 'element' as const, id: 'root', tag: 'div', children: [fragment.root] },
      ...nodes,
    ].map(node => [node.id, node])),
    componentDefinitions: {}, styleSources: {}, tokens: {}, conditions: {}, assets: {},
    localState: fragment.localState ?? {},
  };
  return { document, targetId };
}

/** Editing a paired identity is one atomic source edit, including its actual
 * matching peer. The package rule supplies the relationship, not an ID map. */
function fixtureEdit(document: UiDocument, descriptor: UiExtensionDescriptor, targetId: string,
  edit: { name: string; next: string | number | boolean }) {
  const draft = bindExpression({ requestId: `probe.${descriptor.id}`, nodeId: targetId,
    target: { kind: 'prop', name: edit.name }, expression: { type: 'literal', value: edit.next } });
  const commands = [...draft.commands];
  const paired: { nodeId: string; property: string }[] = [];
  const target = document.nodes[targetId]!;
  if (target.kind !== 'component') throw new Error('Expected component fixture target');
  for (const provider of Object.values(document.nodes)) {
    if (provider.kind !== 'component') continue;
    const registration = catalogAuthoringRegistrations.find(item =>
      item.descriptor.id === provider.definitionId && item.descriptor.revision === provider.revision);
    for (const rule of registration?.rules ?? []) {
      if (rule.kind !== 'pairedValues') continue;
      for (const [side, other] of [[rule.left, rule.right], [rule.right, rule.left]] as const) {
        if (side.property !== edit.name || !side.definitionIds.includes(descriptor.id) ||
          !provider.slots?.[side.slot]?.children.includes(targetId)) continue;
        const before = target.props?.[edit.name];
        expect(before?.type, `${descriptor.id}: seeded paired identity is explicit`).toBe('literal');
        const peers = (provider.slots?.[other.slot]?.children ?? []).filter(id => {
          const peer = document.nodes[id];
          const value = peer?.kind === 'component' ? peer.props?.[other.property] : undefined;
          return peer?.kind === 'component' && other.definitionIds.includes(peer.definitionId) &&
            value?.type === 'literal' && before?.type === 'literal' && value.value === before.value;
        });
        expect(peers.length, `${descriptor.id}: matching paired fixture peer`).toBeGreaterThan(0);
        for (const nodeId of peers) {
          if (paired.some(peer => peer.nodeId === nodeId && peer.property === other.property)) continue;
          commands.push(...bindExpression({ requestId: `probe.peer.${nodeId}`, nodeId,
            target: { kind: 'prop', name: other.property },
            expression: { type: 'literal', value: edit.next } }).commands);
          paired.push({ nodeId, property: other.property });
        }
      }
    }
  }
  return { draft: { ...draft, commands }, paired };
}

function pickEdit(
  descriptor: UiExtensionDescriptor,
): { name: string; next: string | number | boolean } | null {
  const strings = descriptor.props.filter((p) => p.type === 'string');
  const display = strings.find((p) => isDisplayProp(p.name));
  if (display) return { name: display.name, next: `AUTHORED ${descriptor.id}` };
  if (strings[0]) return { name: strings[0]!.name, next: 'AUTHORED' };
  const boolean = descriptor.props.find((p) => p.type === 'boolean');
  if (boolean) return { name: boolean.name, next: true };
  const number = descriptor.props.find((p) => p.type === 'number');
  if (number) return { name: number.name, next: 7 };
  return null;
}

const families = catalogDescriptors.map((d) => ({ descriptor: d, edit: pickEdit(d) }));

/** Families whose display prop does not render while closed: menu surfaces
 * (items/menu roots mount on open), overlay content (tooltip/popover/
 * link-preview content), dialog titles (open-state), and parts whose visible
 * text comes from slot content while the label prop feeds aria/textValue.
 * The plan-persistence assertion above covers the authoring path for these;
 * open-state visibility is demonstrated in the browser (round-3 report §6).
 * Any family NOT in this set must echo in the canvas in this unit probe. */
const METADATA_ECHO = new Set([
  'vict.catalog.accordion',
  'vict.catalog.accordion-multiple',
  'vict.catalog.accordion-item',
  'vict.catalog.alert-dialog',
  'vict.catalog.collapsible',
  'vict.catalog.combobox-item',
  'vict.catalog.select-item',
  'vict.catalog.toggle-group-item',
  'vict.catalog.command',
  'vict.catalog.command.group',
  'vict.catalog.command.item',
  'vict.catalog.context-menu',
  'vict.catalog.context-menu.checkbox-item',
  'vict.catalog.context-menu.group',
  'vict.catalog.context-menu.item',
  'vict.catalog.context-menu.radio-group',
  'vict.catalog.context-menu.radio-item',
  'vict.catalog.context-menu.sub',
  'vict.catalog.dropdown-menu',
  'vict.catalog.dropdown-menu.checkbox-item',
  'vict.catalog.dropdown-menu.group',
  'vict.catalog.dropdown-menu.item',
  'vict.catalog.dropdown-menu.radio-group',
  'vict.catalog.dropdown-menu.radio-item',
  'vict.catalog.dropdown-menu.sub',
  'vict.catalog.label',
  'vict.catalog.link-preview',
  'vict.catalog.menubar',
  'vict.catalog.menubar.checkbox-item',
  'vict.catalog.menubar.group',
  'vict.catalog.menubar.item',
  'vict.catalog.menubar.menu',
  'vict.catalog.menubar.radio-group',
  'vict.catalog.menubar.radio-item',
  'vict.catalog.menubar.sub',
  'vict.catalog.navigation-menu.item',
  'vict.catalog.navigation-menu.link',
  'vict.catalog.navigation-menu.sub',
  'vict.catalog.popover',
  'vict.catalog.tabs-panel',
  'vict.catalog.tabs-trigger',
  'vict.catalog.toolbar-button',
  'vict.catalog.tooltip',
]);

function render(plan: never, localState: unknown): { target: HTMLElement; diagnostics: unknown[] } {
  const target = document.createElement('div');
  document.body.append(target);
  const diagnostics: unknown[] = [];
  const instance = mount(DocumentHost, {
    target,
    props: {
      plan,
      extensionDescriptors: catalogDescriptors,
      extensionImplementations:
        catalogImplementations as readonly UiSvelteComponentImplementation[],
      localState,
      stateValues: {},
      view: {},
      dispatch: async () => ({ ok: true }),
      navigate: () => {},
      onRenderDiagnostic: (diagnostic: unknown) => diagnostics.push(diagnostic),
    } as never,
  });
  cleanups.push(async () => { await unmount(instance); target.remove(); });
  flushSync();
  return { target, diagnostics };
}

function compile(doc: UiDocument): { ok: boolean; plan?: never; issues?: unknown } {
  const result = compileUiDocument(doc, defaultSemanticElementCatalog(), catalogDescriptors, {
    actionIds: [],
  });
  return result as { ok: boolean; plan?: never; issues?: unknown };
}

describe('authoring coverage: every catalog family through the Inspector data path', () => {
  it('inventories the full catalog; every non-structural family has an authorable prop', () => {
    expect(
      families.length,
      'available descriptor count (38 families + AppShell decompositions)',
    ).toBeGreaterThanOrEqual(38);
    const withoutEdit = families
      .filter((f) => !f.edit && !STRUCTURAL.has(f.descriptor.id))
      .map((f) => f.descriptor.id);
    expect(withoutEdit, 'every non-structural family exposes an authorable prop').toEqual([]);
    for (const id of STRUCTURAL)
      expect(
        families.some((f) => f.descriptor.id === id),
        `structural part inventoried: ${id}`,
      ).toBe(true);
  });

  for (const { descriptor, edit } of families) {
    if (!edit) continue;
    it(`authoring round-trip: ${descriptor.id} (${edit.name})`, () => {
      const { document: doc, targetId } = docFor(descriptor);

      const seeded = compile(doc);
      expect(
        seeded.ok,
        `seed document compiles: ${seeded.ok ? '' : JSON.stringify(seeded.issues)}`,
      ).toBe(true);

      // The real authoring state machine (Inspector → bindExpression → session),
      // with the editor-bridge contract (expected working revision).
      const session = UiEditSession.open({ document: doc, storedRevision: '1' });
      const prepared = fixtureEdit(doc, descriptor, targetId, edit);
      const outcome = session.applyTransaction({
        ...prepared.draft,
        expectedDocumentRevision: session.workingRevision,
      } as never);
      expect(
        outcome.ok,
        `transaction accepted: ${outcome.ok ? '' : JSON.stringify(outcome.issues)}`,
      ).toBe(true);
      expect(session.workingRevision === '1', 'working revision advanced').toBe(false);
      const occurrence = session.document.nodes[targetId] as unknown as {
        props: Record<string, { type: string; value: unknown }>;
      }; // the exact materialized target, including context-owned parts
      expect(
        occurrence.props[edit.name]?.value,
        'edited document carries the authored literal',
      ).toEqual(edit.next);
      for (const peer of prepared.paired) {
        const node = session.document.nodes[peer.nodeId];
        expect(node?.kind === 'component' ? node.props?.[peer.property] : undefined,
          'paired identity changed in the same accepted transaction').toEqual({ type: 'literal', value: edit.next });
      }

      const edited = compile(session.document);
      expect(
        edited.ok,
        `edited document compiles: ${edited.ok ? '' : JSON.stringify(edited.issues)}`,
      ).toBe(true);
      const { target, diagnostics } = render(edited.plan as never, session.document.localState);
      expect(diagnostics, `${descriptor.id}: valid canonical composition has no renderer diagnostic`).toEqual([]);
      const rendered = (target.textContent ?? '').replace(/\s+/g, ' ');
      expect(
        /unavailable/i.test(rendered),
        `${descriptor.id}: composes through its documented slots (no unavailable surface)`,
      ).toBe(false);
      const planText = JSON.stringify(edited.plan);
      expect(
        planText.includes(String(edit.next)),
        'authored literal persisted into the compiled plan',
      ).toBe(true);
      if (METADATA_ECHO.has(descriptor.id)) {
        // Closed-surface / aria-metadata families: the authored prop is
        // carried in state and plan (asserted above) and becomes visible on
        // open — the open-state echo is browser-verified (round-3 report §6)
        // and re-checked by the reviewer. Nothing further assertable closed.
        expect(rendered.length, `${descriptor.id}: renders composed while closed`).toBeGreaterThan(
          0,
        );
      } else if (isDisplayProp(edit.name) && !isAriaOnly(descriptor.id, edit.name)) {
        const ariaEcho = [...target.querySelectorAll('[aria-label]')].some((e) =>
          (e.getAttribute('aria-label') ?? '').includes(String(edit.next)),
        );
        expect(
          rendered.includes(String(edit.next)) || ariaEcho,
          `${descriptor.id}: authored ${edit.name} reaches the canvas`,
        ).toBe(true);
      }
    });
  }
});
