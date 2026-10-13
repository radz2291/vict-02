import type { UiDocument, UiNode, UiEditCommand, UiExtensionDescriptor } from '@victframework/ui';
import type { TransactionDraft } from './commands.js';

export interface CompositionTarget {
  readonly nodeId: string;
  readonly slotName?: string;
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
            label: node.id === document.root ? 'Screen' : `${node.tag} · ${node.id}`,
          },
        ];
      if (node.kind === 'component')
        return (descriptors.find((d) => d.id === node.definitionId)?.slots ?? []).map(
          (slotName) => ({ nodeId: node.id, slotName, label: `${node.id} / ${slotName}` }),
        );
      return [];
    });
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
