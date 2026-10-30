import { effectiveUiDescriptor, type UiDocument, type UiNode, type UiEditCommand, type UiExtensionDescriptor, type UiLocalStateDecl } from '@victframework/ui';
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
  /** Context-owned primitive parts may only be inserted into these declared slots. */
  readonly placements?: readonly { readonly definitionId: string; readonly revision?: string; readonly slotName: string }[];
  /** Typed local presentation values for this recipe's reference-bound controls. */
  readonly initialState?: (id: string) => Readonly<Record<string, UiLocalStateDecl>>;
  /** Source nodes only, with the subtree root first. */
  readonly create: (id: string) => readonly UiNode[];
}
/** Shared UI/tool affordance guard; the canonical compiler still validates the result. */
export function canInsertRecipe(recipe: InsertRecipe, document: UiDocument, target: CompositionTarget, descriptors: readonly UiExtensionDescriptor[] = []): boolean {
  if (!recipe.placements) return true;
  type Context={definitionId:string;revision?:string;slotName:string};
  type Fill={children:readonly (string|symbol)[];scope:Readonly<Record<string,Fill>>};
  const results:boolean[]=[];
  const marker=Symbol('insertion');
  function visit(id:string|symbol,context:readonly Context[],fills:Readonly<Record<string,Fill>>,ancestors:ReadonlySet<string>){
    if(id===marker){const nearest=[...context].reverse().find(entry=>recipe.placements!.some(placement=>placement.definitionId===entry.definitionId));results.push(!!nearest&&recipe.placements!.some(placement=>placement.definitionId===nearest.definitionId&&(placement.revision===undefined||placement.revision===nearest.revision)&&placement.slotName===nearest.slotName));return;}
    if(typeof id!=='string'||ancestors.has(id))return;const node=document.nodes[id];if(!node)return;const next=new Set([...ancestors,id]);
    const children=(ids:readonly (string|symbol)[],nextContext=context,nextFills=fills)=>ids.forEach(child=>visit(child,nextContext,nextFills,next));
    if(node.kind==='element'||node.kind==='portal')children(node.id===target.nodeId?[...node.children,marker]:node.children);
    else if(node.kind==='component'){
      const slots:Record<string,readonly (string|symbol)[]>=Object.fromEntries(Object.entries(node.slots??{}).map(([name,fill])=>[name,fill.children]));
      if(node.id===target.nodeId&&target.slotName)slots[target.slotName]=[...(slots[target.slotName]??[]),marker];
      const definition=document.componentDefinitions[node.definitionId];
      if(definition){const substituted=Object.fromEntries(Object.entries(slots).map(([name,ids])=>[name,{children:ids,scope:fills}]));children([definition.root],context,substituted);}
      else for(const [slotName,ids]of Object.entries(slots))children(ids,[...context,{definitionId:node.definitionId,revision:effectiveUiDescriptor(node,descriptors)?.revision??node.revision,slotName}]);
    }else if(node.kind==='slot'){const fill=fills[node.name];if(fill?.children.length)children(fill.children,context,fill.scope);else children(node.fallback??[]);}
    else if(node.kind==='conditional')node.branches.forEach(branch=>children(branch.children));
    else if(node.kind==='repeat')children([node.templateRoot]);
  }
  visit(document.root,[],{},new Set());
  return results.length>0&&results.every(Boolean);
}
/** Seed local presentation state and source nodes as one canonical transaction. */
export function insertRecipe(requestId: string, recipe: InsertRecipe, document: UiDocument, nodeId: string, target: CompositionTarget, descriptors: readonly UiExtensionDescriptor[] = []): TransactionDraft {
  if (!canInsertRecipe(recipe, document, target, descriptors)) throw new Error('This component requires a compatible parent slot.');
  const state = recipe.initialState?.(nodeId) ?? {};
  if (Object.keys(state).some(key => Object.hasOwn(document.localState, key))) throw new Error('Recipe state identity already exists.');
  const tree = insertSubtree(requestId, recipe.create(nodeId), target);
  return { ...tree, commands: [
    ...(Object.keys(state).length ? [{ op: 'replaceDocument' as const, document: { ...document, localState: { ...document.localState, ...state } } }] : []),
    ...tree.commands,
  ] };
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
        return (effectiveUiDescriptor(node,descriptors)?.slots ?? []).map(
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
/** Batched presentation labels with the same duplicate-name ordinals as compositionName. */
export function compositionNames(document: UiDocument, labels: EditorLabels = {}): ReadonlyMap<string, string> {
  const names = new Map(Object.keys(document.nodes).map(id => [id, nodeLabel(document, id, labels)]));
  const totals = new Map<string, number>();
  for (const name of names.values()) totals.set(name, (totals.get(name) ?? 0) + 1);
  const ordinals = new Map<string, number>();
  return new Map([...names].map(([id, name]) => {
    const ordinal = (ordinals.get(name) ?? 0) + 1; ordinals.set(name, ordinal);
    return [id, (totals.get(name) ?? 0) > 1 ? `${name} ${ordinal}` : name];
  }));
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

/** Unowned source roots that can be reused; definition/template roots are not spare content. */
export function detachedContent(document: UiDocument): readonly UiNode[] {
  const owned = new Set<string>([document.root]);
  for (const node of Object.values(document.nodes)) {
    compositionChildren(node).forEach((id) => owned.add(id));
    if (node.kind === 'repeat') owned.add(node.templateRoot);
    if (node.kind === 'slot') node.fallback?.forEach((id) => owned.add(id));
    if (node.kind === 'conditional')
      node.branches.forEach((branch) => branch.children.forEach((id) => owned.add(id)));
  }
  for (const definition of Object.values(document.componentDefinitions)) {
    owned.add(definition.root);
    Object.values(definition.slots ?? {}).forEach((slot) =>
      slot.fallback?.forEach((id) => owned.add(id)),
    );
  }
  return Object.values(document.nodes).filter(
    (node) => !owned.has(node.id) && ['element', 'text', 'component'].includes(node.kind),
  );
}
/** Remove only a slot attachment. The node and its whole source subtree remain authored. */
export function detachSlotContent(
  requestId: string,
  document: UiDocument,
  nodeId: string,
): TransactionDraft | undefined {
  const parent = compositionParent(document, nodeId);
  if (!parent?.slotName || document.nodes[parent.nodeId]?.kind !== 'component') return undefined;
  return {
    requestId,
    reason: 'Keep slot content aside',
    commands: [
      {
        op: 'fillSlot',
        nodeId: parent.nodeId,
        slotName: parent.slotName,
        children: parent.children.filter((id) => id !== nodeId),
      },
    ],
  };
}
