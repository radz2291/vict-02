import type { UiDocument, UiNode, UiExtensionDescriptor } from '@victframework/ui';
import { authoredOccurrence, compositionNames, moveRelative, canInsertRecipe, type InsertRecipe, type TransactionDraft } from '@victframework/ui-editor';
import type { Node, Edge } from '@victframework/ui-flow-svelte';

/** Graph ids identify source, never a transient rendered occurrence or array position. */
// Flow interpolates these ids into quoted attribute selectors. Encode the entire
// tuple so source quotes/backslashes cannot become selector syntax.
export const structureId = (documentId: string, kind: string, id: string) => encodeURIComponent(JSON.stringify([documentId, kind, id]));
export function parseStructureId(value: string): readonly [string, string, string] | undefined {
  try {
    const tuple: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(tuple) && tuple.length === 3 && tuple.every(part => typeof part === 'string')
      ? tuple as [string, string, string] : undefined;
  } catch { return undefined; }
}
export type StructureNodeData = { label: string; summary?: string; sourceId?: string; occurrence?: string; kind: string; kindLabel?: string; childCount?: number; collapsedCount?: number; moveSource?: boolean; moveTarget?: boolean; direction?: string };
export type StructureEdgeData = Record<string, unknown> & { kind: 'containment' | 'binding' | 'definition'; path: string };
export type StructureGraph = { nodes: Node<StructureNodeData>[]; edges: Edge<StructureEdgeData>[] };
export type StructureHandoff = { destination: 'design' | 'layers' | 'inspector' | 'data' | 'actions'; sourceId?: string; occurrence?: string; key?: string };

export function structureChildren(node: UiNode): { id: string; label: string }[] {
  if (node.kind === 'element' || node.kind === 'portal') return node.children.map(id => ({ id, label: 'contains' }));
  if (node.kind === 'component') return Object.entries(node.slots ?? {}).flatMap(([slot, fill]) => fill.children.map(id => ({ id, label: `slot: ${slot}` })));
  if (node.kind === 'repeat') return [{ id: node.templateRoot, label: 'repeat template' }];
  if (node.kind === 'slot') return (node.fallback ?? []).map(id => ({ id, label: `fallback: ${node.name}` }));
  if (node.kind === 'conditional') return node.branches.flatMap((branch, i) => branch.children.map(id => ({ id, label: `branch: ${branch.when ?? `else ${i + 1}`}` })));
  return [];
}
const children = structureChildren;
const stateNames: Record<string, string> = { message: 'Message', accepted: 'Agreement', busy: 'Submitting', dialogOpen: 'Dialog open', actionError: 'Action error', actionResult: 'Action result' };
const friendly = (value: string) => value.replace(/^vict\.catalog\./, '').replace(/[-_.]/g, ' ').replace(/^./, first => first.toUpperCase());
const kindLabel = (node: UiNode) => node.kind === 'component' ? 'Component' : node.kind === 'element' ? (children(node).length ? 'Container' : 'Element') : friendly(node.kind);

/** Refuse definition templates, repeated projections and multiply-owned source paths. */
export function structureOccurrence(document: UiDocument, nodeId: string): string | undefined {
  return ownershipGuard(document)(nodeId) ? authoredOccurrence(document, nodeId) : undefined;
}
function ownershipGuard(document: UiDocument): (nodeId: string) => boolean {
  const definitionRoots = new Set(Object.values(document.componentDefinitions).flatMap(definition => [definition.root, ...Object.values(definition.slots).flatMap(slot => slot.fallback ?? [])]));
  const owners = new Map<string, UiNode[]>();
  for (const node of Object.values(document.nodes)) for (const child of children(node)) owners.set(child.id, [...(owners.get(child.id) ?? []), node]);
  const valid = new Map<string, boolean>();
  const check = (id: string, seen = new Set<string>()): boolean => {
    if (valid.has(id)) return valid.get(id)!;
    if (!document.nodes[id] || definitionRoots.has(id) || seen.has(id)) return false;
    seen.add(id);
    const parents = owners.get(id) ?? [];
    const result = id === document.root ? parents.length === 0 : parents.length === 1 && ['element', 'component', 'portal'].includes(parents[0]!.kind) && check(parents[0]!.id, seen);
    valid.set(id, result); return result;
  };
  return id => check(id);
}

/** A read-only projection of actual authored containment, definitions and references. */
export function projectStructure(document: UiDocument): StructureGraph {
  const nodes: Node<StructureNodeData>[] = [];
  const edges: Edge<StructureEdgeData>[] = [];
  const known = new Set<string>();
  const key = (kind: string, id: string) => structureId(document.id, kind, id);
  const sourceNames = compositionNames(document);
  const uniquelyAuthored = ownershipGuard(document);
  const add = (kind: string, id: string, label: string, data: Partial<StructureNodeData> = {}) => {
    const graphId = key(kind, id);
    if (!known.has(graphId)) {
      known.add(graphId);
      nodes.push({ id: graphId, type: 'source', position: { x: 0, y: 0 }, width: 224, data: { label, kind, ...data }, ariaLabel: `${data.kindLabel ?? friendly(kind)}: ${label}${data.sourceId ? `, source ${data.sourceId}` : ''}`, deletable: false });
    }
    return graphId;
  };
  const link = (source: string, target: string, label: string, path: string, kind: StructureEdgeData['kind'] = 'binding') => edges.push({
    id: encodeURIComponent(JSON.stringify([source, target, label, path])), source, target, label,
    deletable: false, type: 'routed', sourceHandle: 'content', targetHandle: 'container',
    data: { kind, path }, ariaLabel: `${label}, declared source location ${path}`,
    style: kind === 'containment' ? 'stroke: #94a3b8' : 'stroke: #7c3aed; stroke-dasharray: 5 3',
  });
  for (const node of Object.values(document.nodes)) {
    const description = node.kind === 'element' ? `<${node.tag}>` : node.kind === 'component' ? friendly(node.definitionId) : node.kind === 'text' && node.content.type === 'literal' ? node.content.value.slice(0, 55) : friendly(node.kind);
    add('node', node.id, node.id === document.root ? 'Screen' : sourceNames.get(node.id) ?? friendly(node.kind), { sourceId: node.id, summary: description, kindLabel: kindLabel(node), childCount: children(node).length, occurrence: uniquelyAuthored(node.id) ? authoredOccurrence(document, node.id) : undefined });
  }
  for (const [id, state] of Object.entries(document.localState)) add('state', id, stateNames[id] ?? friendly(id), { summary: `${state.type} · declared initial value`, kindLabel: 'State' });
  for (const [id, definition] of Object.entries(document.componentDefinitions)) {
    const source = add('definition', id, friendly(id), { summary: `Local definition · revision ${definition.revision}`, kindLabel: 'Definition' });
    link(source, key('node', definition.root), 'definition root', 'root', 'definition');
    for (const [slot, value] of Object.entries(definition.slots)) for (const [index, child] of (value.fallback ?? []).entries()) link(source, key('node', child), `definition fallback: ${slot}`, `${slot}.${index}`, 'definition');
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
    if (typeof entry.actionId === 'string') link(source, add('action', entry.actionId, entry.actionId === 'demo.submit' ? 'Submit (simulated)' : friendly(entry.actionId), { kindLabel: 'Action', summary: 'Declared action reference' }), 'invokes action', path);
    if (typeof entry.routeId === 'string') link(source, add('route', entry.routeId, friendly(entry.routeId), { kindLabel: 'Route', summary: 'Declared route reference' }), 'navigates', path);
    if (entry.setState && typeof entry.setState === 'object') {
      const state = entry.setState as { key?: unknown };
      if (typeof state.key === 'string') link(source, add('state', state.key, `state.${state.key}`), 'writes state', path);
    }
    for (const [name, nested] of Object.entries(entry)) references(nested, source, `${path}.${name}`);
  }
  for (const node of Object.values(document.nodes)) {
    const source = key('node', node.id);
    children(node).forEach((child, index) => link(source, key('node', child.id), child.label, `${node.id}.${child.label}.${index}`, 'containment'));
    if (node.kind === 'component') {
      const local = document.componentDefinitions[node.definitionId];
      const target = local ? add('definition', node.definitionId, friendly(node.definitionId))
        : add('catalog', `${node.definitionId}@${node.revision ?? 'current'}`, friendly(node.definitionId), { kindLabel: 'Catalog', summary: `Library definition${node.revision ? ` · revision ${node.revision}` : ''}` });
      link(source, target, 'uses definition', `${node.id}.definitionId`, 'definition');
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

/** Exact declared values and bindings; never inferred runtime values or defects. */
export function structureFacts(document: UiDocument, node: Node<StructureNodeData>): { path: string; value: string }[] {
  const tuple = parseStructureId(node.id);
  if (!tuple) return [];
  const [, kind, id] = tuple;
  const value = kind === 'node' ? document.nodes[id] : kind === 'state' ? document.localState[id] : kind === 'definition' ? document.componentDefinitions[id] : undefined;
  if (!value) return [{ path: kind, value: id }];
  const result: { path: string; value: string }[] = [];
  function visit(entry: unknown, path: string) {
    if (entry && typeof entry === 'object') {
      for (const [key, nested] of Object.entries(entry)) visit(nested, path ? `${path}.${key}` : key);
    } else result.push({ path, value: typeof entry === 'string' ? entry : JSON.stringify(entry) ?? String(entry) });
  }
  visit(value, '');
  return result;
}

export type StructureFilter = { search?: string; focusId?: string; collapsed?: ReadonlySet<string>; bindings?: boolean; definitions?: boolean };
/** Collapse and layers are view projections. They do not alter canonical ownership. */
export function filterStructure(graph: StructureGraph, options: StructureFilter = {}): StructureGraph {
  const containment = graph.edges.filter(edge => edge.data?.kind === 'containment');
  const descendants = (id: string, found = new Set<string>()): Set<string> => {
    for (const edge of containment) if (edge.source === id && !found.has(edge.target)) { found.add(edge.target); descendants(edge.target, found); }
    return found;
  };
  const query = options.search?.trim().toLowerCase();
  let visible = new Set(graph.nodes.filter(node => node.data.kind === 'node' && (options.definitions || node.data.occurrence)).map(node => node.id));
  if (query) {
    visible = new Set(graph.nodes.filter(node => `${node.data.label} ${node.data.summary} ${node.data.sourceId ?? parseStructureId(node.id)?.[2]}`.toLowerCase().includes(query)).map(node => node.id));
    // Show the path to each match without expanding the rest of the tree.
    let changed = true;
    while (changed) { changed = false; for (const edge of containment) if (visible.has(edge.target) && !visible.has(edge.source)) { visible.add(edge.source); changed = true; } }
  } else {
    for (const id of options.collapsed ?? []) for (const child of descendants(id)) visible.delete(child);
  }
  if (options.focusId && !query) {
    const focus = new Set([options.focusId, ...descendants(options.focusId)]);
    for (const edge of containment) if (edge.target === options.focusId) focus.add(edge.source);
    if (graph.nodes.find(node => node.id === options.focusId)?.data.kind !== 'node') {
      for (const edge of graph.edges) if (edge.source === options.focusId || edge.target === options.focusId) { focus.add(edge.source); focus.add(edge.target); }
      visible = focus;
    } else {
      visible = new Set([...visible].filter(id => focus.has(id)));
      visible.add(options.focusId);
    }
  }
  const enabledEdges = graph.edges.filter(edge => edge.data?.kind === 'containment' || (edge.data?.kind === 'binding' ? options.bindings : options.definitions));
  // Shared state/definitions appear only when related to visible source.
  for (const edge of enabledEdges) if (visible.has(edge.source) && graph.nodes.find(node => node.id === edge.target)?.data.kind !== 'node') visible.add(edge.target);
  const nodes = graph.nodes.filter(node => visible.has(node.id)).map(node => ({ ...node, data: { ...node.data, collapsedCount: !query && options.collapsed?.has(node.id) ? descendants(node.id).size : undefined } }));
  return { nodes, edges: enabledEdges.filter(edge => visible.has(edge.source) && visible.has(edge.target)) };
}

export type StructureEditRequest = { documentId: string; revision: string; source: string; target: string };
export function structureMove(document: UiDocument, revision: string, request: StructureEditRequest, blocked: boolean, descriptors: readonly UiExtensionDescriptor[], recipes: readonly InsertRecipe[] = []): { ok: true; draft: TransactionDraft } | { ok: false; message: string } {
  if (blocked) return { ok: false, message: 'Apply or cancel your draft before changing structure.' };
  if (request.documentId !== document.id || request.revision !== revision) return { ok: false, message: 'The source changed while connecting. Retry against the current structure.' };
  const sourceTuple = parseStructureId(request.source);
  const targetTuple = parseStructureId(request.target);
  const sourceId = sourceTuple?.[0] === document.id && sourceTuple[1] === 'node' ? sourceTuple[2] : undefined;
  const targetId = targetTuple?.[0] === document.id && targetTuple[1] === 'node' ? targetTuple[2] : undefined;
  if (!sourceId || !targetId || !structureOccurrence(document, sourceId) || !structureOccurrence(document, targetId)) return { ok: false, message: 'Only unambiguous authored nodes can be moved. Definitions, repeats and bindings are inspectable references.' };
  const command = moveRelative(document, sourceId, targetId, 'inside', descriptors);
  if (!command) return { ok: false, message: 'Move refused: choose a different container with one unambiguous slot. Root, cycle and unsupported connections are not edits.' };
  const sourceNode = document.nodes[sourceId];
  const recipe = sourceNode?.kind === 'component' ? recipes.find(entry => entry.id === sourceNode.definitionId.replace('vict.catalog.', '')) : undefined;
  if (recipe && !canInsertRecipe(recipe, document, { nodeId: command.newParentId, slotName: command.slotName })) return { ok: false, message: 'This component requires its declared parent and slot. Choose a compatible composition in Design.' };
  return { ok: true, draft: { requestId: crypto.randomUUID(), reason: 'Move source node from structure', commands: [command] } };
}
