import type {
  UiDocument,
  UiExtensionDescriptor,
  UiRenderInstruction,
  UiRenderPlan,
} from '@victframework/ui';
import { compositionChildren, compositionName, compositionParent } from './composition.js';

/** Editor navigation only. Never written to a document, application or runtime state. */
export interface CompositionFocus {
  readonly nodeId: string;
  readonly slotName: string;
}

/** Source-owned slot paths carry their owning catalog instances in renderer keys. */
export function authoredOccurrence(document: UiDocument, nodeId: string): string | undefined {
  const path: string[] = [];
  const seen = new Set<string>();
  let current = nodeId;
  while (current !== document.root) {
    if (seen.has(current)) return undefined;
    seen.add(current);
    const parent = compositionParent(document, current);
    if (!parent) return undefined;
    const owner = document.nodes[parent.nodeId];
    if (owner?.kind === 'component') path.unshift(`${owner.id}@${owner.definitionId}`);
    current = parent.nodeId;
  }
  return [document.id, nodeId, ...path].join('|');
}

export function compositionMembers(
  document: UiDocument,
  focus: CompositionFocus,
): ReadonlySet<string> {
  const node = document.nodes[focus.nodeId];
  const members = new Set<string>();
  function walk(id: string) {
    if (members.has(id)) return;
    members.add(id);
    const child = document.nodes[id];
    if (child) compositionChildren(child).forEach(walk);
  }
  if (node?.kind === 'component') node.slots?.[focus.slotName]?.children.forEach(walk);
  return members;
}

/** Only directly authored component instances, not definition/repeat projections. */
export function compositionSlots(
  document: UiDocument,
  nodeId: string,
  descriptors: readonly UiExtensionDescriptor[],
): readonly string[] {
  const node = document.nodes[nodeId];
  if (node?.kind !== 'component') return [];
  const seen = new Set<string>();
  let current = nodeId;
  while (current !== document.root) {
    if (seen.has(current)) return [];
    seen.add(current);
    const parent = compositionParent(document, current);
    if (!parent) return [];
    current = parent.nodeId;
  }
  return (
    descriptors.find(
      (entry) =>
        entry.id === node.definitionId && (!node.revision || entry.revision === node.revision),
    )?.slots ?? []
  );
}

export function firstCompositionSlot(slots: readonly string[]): string | undefined {
  return (
    ['body', 'content', 'panels', 'items'].find((name) => slots.includes(name)) ??
    slots.find((name) => name !== 'trigger') ??
    slots[0]
  );
}

export function compositionTrail(
  document: UiDocument,
  focus: CompositionFocus,
): readonly CompositionFocus[] {
  const trail: CompositionFocus[] = [focus];
  const seen = new Set<string>();
  let current = focus.nodeId;
  while (!seen.has(current)) {
    seen.add(current);
    const parent = compositionParent(document, current);
    if (!parent) break;
    if (parent.slotName) trail.unshift({ nodeId: parent.nodeId, slotName: parent.slotName });
    current = parent.nodeId;
  }
  return trail;
}

/**
 * Source-backed viewport projection, not a second compiler or saved plan.
 * Reuses the compiled slot instructions, occurrence keys, styles and bindings.
 * Nested slot components are selectable composition tiles: mounting contextual
 * parts (e.g. Tabs.Panel) without their provider would be invalid. Entering their
 * own slot opens the real authored content instead. Ordinary leaf widgets retain
 * their registered framework adapters.
 */
export function projectComposition(
  plan: UiRenderPlan,
  document: UiDocument,
  focus: CompositionFocus,
  descriptors: readonly UiExtensionDescriptor[],
  contextParts: readonly string[] = [],
): UiRenderPlan | undefined {
  if (!compositionSlots(document, focus.nodeId, descriptors).includes(focus.slotName))
    return undefined;
  type ElementInstruction = Extract<UiRenderInstruction, { kind: 'element' }>;
  type ExtensionInstruction = Extract<UiRenderInstruction, { kind: 'extension' }>;
  function frame(
    node: ExtensionInstruction,
    children: readonly UiRenderInstruction[],
    tile = false,
  ): ElementInstruction {
    return {
      kind: 'element',
      nodeId: node.nodeId,
      occurrenceKey: node.occurrenceKey,
      tag: 'section',
      attributes: [
        {
          name: 'aria-label',
          value: { type: 'literal', value: compositionName(document, node.nodeId) },
        },
      ],
      classes: [...(node.classes ?? []), tile ? 'uv-composition-tile' : 'uv-composition-surface'],
      styleRuleIds: node.styleRuleIds ?? [],
      interactions: [],
      children,
    };
  }
  function content(node: UiRenderInstruction): UiRenderInstruction {
    if (
      node.kind === 'extension' &&
      ((descriptors.find((d) => d.id === node.extensionId && d.revision === node.revision)?.slots
        ?.length ?? 0) > 0 ||
        contextParts.includes(node.extensionId))
    ) {
      const slots = compositionSlots(document, node.nodeId, descriptors);
      return frame(
        node,
        [
          {
            kind: 'text',
            nodeId: node.nodeId,
            occurrenceKey: node.occurrenceKey,
            content: {
              type: 'literal',
              value: `${compositionName(document, node.nodeId)}${slots.length ? ' · Double-click to edit contents' : ''}`,
            },
          },
        ],
        true,
      );
    }
    if (node.kind === 'element' || node.kind === 'unsupported')
      return { ...node, children: node.children.map(content) };
    if (node.kind === 'conditional')
      return {
        ...node,
        branches: node.branches.map((branch) => ({
          ...branch,
          children: branch.children.map(content),
        })),
      };
    if (node.kind === 'repeat') return { ...node, template: content(node.template) };
    return node;
  }
  function find(nodes: readonly UiRenderInstruction[]): readonly UiRenderInstruction[] | undefined {
    for (const node of nodes) {
      if (node.kind === 'extension') {
        if (node.nodeId === focus.nodeId)
          return [frame(node, (node.slots?.[focus.slotName] ?? []).map(content))];
        for (const children of Object.values(node.slots ?? {})) {
          const found = find(children);
          if (found)
            return [
              {
                ...frame(node, found),
                classes: [...(node.classes ?? []), 'uv-composition-context'],
              },
            ];
        }
      }
      if (node.kind === 'element') {
        const found = find(node.children);
        if (found)
          return [
            {
              ...node,
              classes: [...node.classes, 'uv-composition-context'],
              interactions: [],
              children: found,
            },
          ];
      }
    }
    return undefined;
  }
  const structure = find(plan.structure);
  return structure ? { ...plan, structure } : undefined;
}
