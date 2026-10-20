import type { UiDocument, UiNode } from '@victframework/ui';
import { compositionChildren, compositionParent, insertSubtree } from './composition.js';
import { setTextLiteral, type TransactionDraft } from './commands.js';

/** Only unambiguous literal content is edited directly. Bindings stay in the Inspector. */
export function literalTextTarget(
  document: UiDocument,
  nodeId: string,
): { nodeId: string; value: string; prop?: string } | undefined {
  const node = document.nodes[nodeId];
  if (node?.kind === 'text' && node.content.type === 'literal')
    return { nodeId, value: node.content.value };
  if (node?.kind === 'element' && node.children.length === 1)
    return literalTextTarget(document, node.children[0]!);
  if (node?.kind === 'component') {
    const prop = ['label', 'title'].find(
      (key) => node.props?.[key]?.type === 'literal' && typeof node.props[key].value === 'string',
    );
    const value = prop ? node.props?.[prop] : undefined;
    if (prop && value?.type === 'literal' && typeof value.value === 'string')
      return { nodeId, prop, value: value.value };
  }
  return undefined;
}
export function editLiteralText(
  document: UiDocument,
  nodeId: string,
  value: string,
): TransactionDraft | undefined {
  const target = literalTextTarget(document, nodeId);
  if (!target) return undefined;
  const requestId = crypto.randomUUID();
  return target.prop
    ? {
        requestId,
        reason: 'Edit text',
        commands: [
          {
            op: 'bindExpression',
            nodeId: target.nodeId,
            target: { kind: 'prop', name: target.prop },
            expression: { type: 'literal', value },
          },
        ],
      }
    : { ...setTextLiteral({ requestId, nodeId: target.nodeId, value }), reason: 'Edit text' };
}
/** Clone source ownership, never definition projections. Expressions retain their original bindings. */
export function duplicateSubtree(
  document: UiDocument,
  nodeId: string,
): { draft: TransactionDraft; nodeId: string } | undefined {
  const parent = compositionParent(document, nodeId);
  if (!parent || nodeId === document.root) return undefined;
  const nodes: UiNode[] = [];
  const ids = new Map<string, string>();
  const collect = (id: string): boolean => {
    const node = document.nodes[id];
    if (!node || ids.has(id) || !['element', 'text', 'component', 'portal'].includes(node.kind))
      return false;
    ids.set(id, `copy-${crypto.randomUUID()}`);
    nodes.push(node);
    return compositionChildren(node).every(collect);
  };
  if (!collect(nodeId)) return undefined;
  const copies = nodes.map((node) => {
    const copy = { ...node, id: ids.get(node.id)! };
    if (copy.kind === 'element' || copy.kind === 'portal')
      return { ...copy, children: copy.children.map((id) => ids.get(id)!) };
    if (copy.kind === 'component')
      return {
        ...copy,
        slots: Object.fromEntries(
          Object.entries(copy.slots ?? {}).map(([key, fill]) => [
            key,
            { ...fill, children: fill.children.map((id) => ids.get(id)!) },
          ]),
        ),
      };
    return copy;
  });
  return {
    nodeId: ids.get(nodeId)!,
    draft: {
      ...insertSubtree(crypto.randomUUID(), copies, {
        ...parent,
        index: parent.children.indexOf(nodeId) + 1,
      }),
      reason: 'Duplicate selection',
    },
  };
}
