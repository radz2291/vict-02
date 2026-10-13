import type { UiDocument, UiNode, UiEditCommand, UiExtensionDescriptor } from '@victframework/ui';
import type { TransactionDraft } from './commands.js';
import { nodeLabel, type EditorLabels } from './inspector-ux.js';

export interface CompositionTarget {
  readonly nodeId: string;
  readonly slotName?: string;
  readonly index?: number;
}
export interface InsertRecipe {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Source nodes only, with the subtree root first. */
  readonly create: (id: string) => readonly UiNode[];
}
export function compositionChildren(node: UiNode): readonly string[] {
  return node.kind === 'element' || node.kind === 'portal'
    ? node.children
    : node.kind === 'component'
      ? Object.values(node.slots ?? {}).flatMap((fill) => fill.children)
      : [];
}
export function compositionTargets(
  document: UiDocument,
  descriptors: readonly UiExtensionDescriptor[],
  exclude?: string,
  labels: EditorLabels = {},
): (CompositionTarget & { readonly label: string })[] {
  const excluded = new Set<string>();
  const walk = (id: string) => {
    if (excluded.has(id)) return;
    excluded.add(id);
    const node = document.nodes[id];
    if (node) compositionChildren(node).forEach(walk);
  };
  if (exclude) walk(exclude);
  return Object.values(document.nodes)
    .filter((node) => !excluded.has(node.id))
    .flatMap((node) => {
      if (
        node.kind === 'element' &&
        [
          'main',
          'section',
          'div',
          'article',
          'aside',
          'header',
          'footer',
          'nav',
          'form',
          'fieldset',
          'ul',
          'ol',
          'li',
        ].includes(node.tag)
      )
        return [
          {
            nodeId: node.id,
            label:
              node.id === document.root ? 'Screen' : compositionName(document, node.id, labels),
          },
        ];
      if (node.kind === 'component')
        return (descriptors.find((d) => d.id === node.definitionId)?.slots ?? []).map(
          (slotName) => ({
            nodeId: node.id,
            slotName,
            label: `${compositionName(document, node.id, labels)} / ${slotName.replace(/^./, (c) => c.toUpperCase())}`,
          }),
        );
      return [];
    });
}
export function compositionName(
  document: UiDocument,
  id: string,
  labels: EditorLabels = {},
): string {
  const name = nodeLabel(document, id, labels);
  const peers = Object.keys(document.nodes).filter(
    (key) => nodeLabel(document, key, labels) === name,
  );
  return peers.length > 1 ? `${name} ${peers.indexOf(id) + 1}` : name;
}
export type CompositionPlacement = 'before' | 'inside' | 'after';
/** Source-addressed tree moves; the edit engine still owns final cycle/closure validation. */
export function moveRelative(
  document: UiDocument,
  nodeId: string,
  anchorId: string,
  placement: CompositionPlacement,
  descriptors: readonly UiExtensionDescriptor[],
): Extract<UiEditCommand, { op: 'move' }> | undefined {
  if (nodeId === anchorId || nodeId === document.root) return undefined;
  const targets = compositionTargets(document, descriptors, nodeId);
  if (placement === 'inside') {
    const matches = targets.filter((target) => target.nodeId === anchorId);
    if (matches.length !== 1) return undefined; // Multi-slot owners require an explicit slot choice.
    return { op: 'move', nodeId, newParentId: anchorId, slotName: matches[0]!.slotName };
  }
  const parent = compositionParent(document, anchorId);
  if (
    !parent ||
    !targets.some(
      (target) => target.nodeId === parent.nodeId && target.slotName === parent.slotName,
    )
  )
    return undefined;
  let index = parent.children.indexOf(anchorId) + (placement === 'after' ? 1 : 0);
  const current = compositionParent(document, nodeId);
  if (
    current?.nodeId === parent.nodeId &&
    current.slotName === parent.slotName &&
    current.children.indexOf(nodeId) < index
  )
    index--;
  return { op: 'move', nodeId, newParentId: parent.nodeId, slotName: parent.slotName, index };
}
export function compositionParent(
  document: UiDocument,
  nodeId: string,
): (CompositionTarget & { children: readonly string[] }) | undefined {
  for (const node of Object.values(document.nodes)) {
    if ((node.kind === 'element' || node.kind === 'portal') && node.children.includes(nodeId))
      return { nodeId: node.id, children: node.children };
    if (node.kind === 'component')
      for (const [slotName, fill] of Object.entries(node.slots ?? {}))
        if (fill.children.includes(nodeId))
          return { nodeId: node.id, slotName, children: fill.children };
  }
  return undefined;
}
/** Expand a recipe into one atomic, undoable subtree insertion, including slot ownership. */
export function insertSubtree(
  requestId: string,
  nodes: readonly UiNode[],
  target: CompositionTarget,
): TransactionDraft {
  const commands: UiEditCommand[] = [];
  const walk = (id: string, into: CompositionTarget) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Missing recipe node ${id}`);
    commands.push({
      op: 'insert',
      parentId: into.nodeId,
      ...(into.slotName ? { slotName: into.slotName } : {}),
      ...(into.index !== undefined ? { index: into.index } : {}),
      node:
        node.kind === 'element' || node.kind === 'portal'
          ? { ...node, children: [] }
          : node.kind === 'component'
            ? { ...node, slots: {} }
            : node,
    });
    if (node.kind === 'element' || node.kind === 'portal')
      node.children.forEach((child) => walk(child, { nodeId: id }));
    if (node.kind === 'component')
      Object.entries(node.slots ?? {}).forEach(([slotName, fill]) =>
        fill.children.forEach((child) => walk(child, { nodeId: id, slotName })),
      );
  };
  if (nodes[0]) walk(nodes[0].id, target);
  return { requestId, reason: 'Insert authored subtree', commands };
}
