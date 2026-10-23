import type { UiDocument, UiNode, UiExtensionDescriptor } from '@victframework/ui';
import { authoredOccurrence, moveRelative, canInsertRecipe, type InsertRecipe, type TransactionDraft } from '@victframework/ui-editor';
import type { Node, Edge } from '@victframework/ui-flow-svelte';

/** Graph ids identify source, never a transient rendered occurrence or array position. */
export const structureId = (documentId: string, kind: string, id: string) => JSON.stringify([documentId, kind, id]);
export type StructureNodeData = { label: string; sourceId?: string; occurrence?: string; kind: string };

function children(node: UiNode): { id: string; label: string }[] {
  if (node.kind === 'element' || node.kind === 'portal') return node.children.map(id => ({ id, label: 'contains' }));
  if (node.kind === 'component') return Object.entries(node.slots ?? {}).flatMap(([slot, fill]) => fill.children.map(id => ({ id, label: `slot: ${slot}` })));
  if (node.kind === 'repeat') return [{ id: node.templateRoot, label: 'repeat template' }];
  if (node.kind === 'slot') return (node.fallback ?? []).map(id => ({ id, label: `fallback: ${node.name}` }));
  if (node.kind === 'conditional') return node.branches.flatMap((branch, i) => branch.children.map(id => ({ id, label: `branch: ${branch.when ?? `else ${i + 1}`}` })));
  return [];
}

/** Refuse definition templates, repeated projections and multiply-owned source paths. */
export function structureOccurrence(document: UiDocument, nodeId: string): string | undefined {
  if (!document.nodes[nodeId]) return undefined;
  const definitionRoots = new Set(Object.values(document.componentDefinitions).flatMap(definition => [definition.root, ...Object.values(definition.slots).flatMap(slot => slot.fallback ?? [])]));
  const seen = new Set<string>();
  let current = nodeId;
  while (true) {
    if (seen.has(current) || definitionRoots.has(current)) return undefined;
    seen.add(current);
    const owners = Object.values(document.nodes).flatMap(node => children(node).filter(child => child.id === current).map(() => node));
    if (current === document.root) return owners.length ? undefined : authoredOccurrence(document, nodeId);
    if (owners.length !== 1 || !['element', 'component', 'portal'].includes(owners[0]!.kind)) return undefined;
    current = owners[0]!.id;
  }
}

/** A read-only projection of actual authored containment, definitions and references. */
export function projectStructure(document: UiDocument): { nodes: Node<StructureNodeData>[]; edges: Edge[] } {
  const nodes: Node<StructureNodeData>[] = [];
  const edges: Edge[] = [];
  const known = new Set<string>();
  const key = (kind: string, id: string) => structureId(document.id, kind, id);
  const add = (kind: string, id: string, label: string, data: Partial<StructureNodeData> = {}) => {
    const graphId = key(kind, id);
    if (!known.has(graphId)) {
      known.add(graphId);
      nodes.push({ id: graphId, position: { x: 0, y: 0 }, data: { label, kind, ...data }, deletable: false });
    }
    return graphId;
  };
  const link = (source: string, target: string, label: string, path: string) => edges.push({
    id: JSON.stringify([source, target, label, path]), source, target, label,
    deletable: false, reconnectable: false, type: 'smoothstep',
    style: label === 'contains' || label.startsWith('slot:') ? 'stroke: #64748b' : 'stroke: #a78bfa; stroke-dasharray: 5 3',
  });
  for (const node of Object.values(document.nodes)) {
    const description = node.kind === 'element' ? `<${node.tag}>` : node.kind === 'component' ? node.definitionId : node.kind === 'text' && node.content.type === 'literal' ? node.content.value.slice(0, 55) : node.kind;
    add('node', node.id, `${node.id}\n${description}`, { sourceId: node.id, occurrence: structureOccurrence(document, node.id) });
  }
  for (const [id, state] of Object.entries(document.localState)) add('state', id, `state.${id}\n${state.type}`);
  for (const [id, definition] of Object.entries(document.componentDefinitions)) {
    const source = add('definition', id, `Definition: ${id}\nrevision ${definition.revision}`);
    link(source, key('node', definition.root), 'definition root', 'root');
    for (const [slot, value] of Object.entries(definition.slots)) for (const [index, child] of (value.fallback ?? []).entries()) link(source, key('node', child), `definition fallback: ${slot}`, `${slot}.${index}`);
  }
  function references(value: unknown, source: string, path: string) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((entry, i) => references(entry, source, `${path}.${i}`)); return; }
    const entry = value as Record<string, unknown>;
    if (entry.type === 'ref' && typeof entry.path === 'string') {
      const state = entry.path.startsWith('state.') ? entry.path.slice(6) : undefined;
      const target = state && document.localState[state] ? add('state', state, `state.${state}`) : add('reference', entry.path, `Reference: ${entry.path}`);
      link(source, target, `reads: ${entry.path}`, path);
    }
    if (entry.action === 'setState' && typeof entry.key === 'string') link(source, add('state', entry.key, `state.${entry.key}`), 'writes state', path);
    if (typeof entry.actionId === 'string') link(source, add('action', entry.actionId, `Action reference: ${entry.actionId}`), 'invokes action', path);
    if (typeof entry.routeId === 'string') link(source, add('route', entry.routeId, `Route reference: ${entry.routeId}`), 'navigates', path);
    if (entry.setState && typeof entry.setState === 'object') {
      const state = entry.setState as { key?: unknown };
      if (typeof state.key === 'string') link(source, add('state', state.key, `state.${state.key}`), 'writes state', path);
    }
    for (const [name, nested] of Object.entries(entry)) references(nested, source, `${path}.${name}`);
  }
  for (const node of Object.values(document.nodes)) {
    const source = key('node', node.id);
    children(node).forEach((child, index) => link(source, key('node', child.id), child.label, String(index)));
    if (node.kind === 'component') {
      const local = document.componentDefinitions[node.definitionId];
      const target = local ? add('definition', node.definitionId, `Definition: ${node.definitionId}`)
        : add('catalog', `${node.definitionId}@${node.revision ?? 'current'}`, `Catalog: ${node.definitionId}${node.revision ? ` @${node.revision}` : ''}`);
      link(source, target, 'uses definition', 'definition');
    }
    references(node, source, node.id);
  }
  // Deterministic initial layout only. Never inserted into canonical document bytes.
  const levels = new Map<string, number>([[document.root, 0]]);
  const visit = (id: string, level: number) => {
    const node = document.nodes[id];
    if (!node) return;
    for (const child of children(node)) if (!levels.has(child.id)) { levels.set(child.id, level + 1); visit(child.id, level + 1); }
  };
  visit(document.root, 0);
  const rows = new Map<number, number>();
  const lastLevel = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) {
    const level = node.data.sourceId ? levels.get(node.data.sourceId) ?? lastLevel : lastLevel + 1;
    const row = rows.get(level) ?? 0;
    rows.set(level, row + 1);
    node.position = { x: level * 290, y: row * 125 };
  }
  return { nodes, edges };
}

export type StructureEditRequest = { documentId: string; revision: string; source: string; target: string };
export function structureMove(document: UiDocument, revision: string, request: StructureEditRequest, blocked: boolean, descriptors: readonly UiExtensionDescriptor[], recipes: readonly InsertRecipe[] = []): { ok: true; draft: TransactionDraft } | { ok: false; message: string } {
  if (blocked) return { ok: false, message: 'Apply or cancel your draft before changing structure.' };
  if (request.documentId !== document.id || request.revision !== revision) return { ok: false, message: 'The source changed while connecting. Retry against the current structure.' };
  const graph = projectStructure(document);
  const sourceId = graph.nodes.find(node => node.id === request.source)?.data.sourceId;
  const targetId = graph.nodes.find(node => node.id === request.target)?.data.sourceId;
  if (!sourceId || !targetId || !structureOccurrence(document, sourceId) || !structureOccurrence(document, targetId)) return { ok: false, message: 'Only unambiguous authored nodes can be moved. Definitions, repeats and bindings are inspectable references.' };
  const command = moveRelative(document, sourceId, targetId, 'inside', descriptors);
  if (!command) return { ok: false, message: 'Move refused: choose a different container with one unambiguous slot. Root, cycle and unsupported connections are not edits.' };
  const sourceNode = document.nodes[sourceId];
  const recipe = sourceNode?.kind === 'component' ? recipes.find(entry => entry.id === sourceNode.definitionId.replace('vict.catalog.', '')) : undefined;
  if (recipe && !canInsertRecipe(recipe, document, { nodeId: command.newParentId, slotName: command.slotName })) return { ok: false, message: 'This component requires its declared parent and slot. Choose a compatible composition in Design.' };
  return { ok: true, draft: { requestId: crypto.randomUUID(), reason: 'Move source node from structure', commands: [command] } };
}
