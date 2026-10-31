import type { UiDocument, UiNode } from '@victframework/ui';
import {
  graphAuthoringContract,
  graphMigrationV2ToV3,
  migrateGraphV2ToV3,
  parseGraphV2,
  parseGraphV3,
  serializeGraphV3,
} from '@victframework/ui-flow-svelte';
import {
  authoredGraphVersion,
  graphSourceOwnership,
  inspectAuthoredGraphSource,
  writeMigratedGraphSource,
  type GraphOccurrenceRoute,
} from './graph-authoring.js';

export type GraphMigrationTarget = {
  nodeId: string;
  expectedGraphRevision: number;
  occurrenceRoute?: Array<GraphOccurrenceRoute[number]>;
};
type Failure = { ok: false; message: string };
const fail = (message: string): Failure => ({ ok: false, message });
const address = (document: UiDocument, nodeId: string, route: GraphOccurrenceRoute) =>
  JSON.stringify([
    graphSourceOwnership(document, nodeId),
    route.map(({ workspaceNodeId, graphNodeId }) => ({ workspaceNodeId, graphNodeId })),
  ]);

/** Enumerate only declared graph source occurrences, never arbitrary JSON strings. */
function occurrences(
  document: UiDocument,
  nodeId: string,
  seen: readonly string[] = [],
): GraphOccurrenceRoute[] | Failure {
  if (seen.includes(nodeId)) return fail('Graph migration ownership is cyclic.');
  const owner = graphSourceOwnership(document, nodeId);
  if (!owner) return fail('Graph migration requires unambiguous source ownership.');
  if (owner.kind !== 'slot' || !owner.controlled) return [[]];
  const parent = document.nodes[owner.ownerNodeId];
  const host =
    parent?.kind === 'component'
      ? graphAuthoringContract(parent.definitionId, parent.revision)
      : undefined;
  if (
    host?.body?.slot !== owner.slotName ||
    host.body.controlledState !== 'node-parameters' ||
    ![2, 3].includes(host.modelVersion)
  )
    return fail('Controlled migration requires a declared typed containing workspace.');
  const parents = occurrences(document, owner.ownerNodeId, [...seen, nodeId]);
  if ('ok' in parents) return parents;
  const result: GraphOccurrenceRoute[] = [];
  for (const route of parents) {
    const source = inspectAuthoredGraphSource(document, parent!.id, route);
    if (!source.ok) return source;
    const parsed =
      host.modelVersion === 3 ? parseGraphV3(source.source) : parseGraphV2(source.source);
    if (!parsed.ok) return fail('A containing graph source is invalid.');
    for (const member of parsed.graph.nodes) {
      const family = parsed.graph.nodeTypes.find((item) => item.id === member.type);
      if (family?.parameters[owner.key]?.type === 'string')
        result.push([
          ...route,
          {
            workspaceNodeId: parent!.id,
            graphNodeId: member.id,
            expectedGraphRevision: parsed.graph.revision,
          },
        ]);
    }
  }
  return result;
}

/** Original cursors are checked before mutation. This only follows revisions
 * advanced by earlier source writes inside this same isolated candidate. */
function refreshedRoute(
  document: UiDocument,
  original: GraphOccurrenceRoute,
): GraphOccurrenceRoute | Failure {
  const current: Array<GraphOccurrenceRoute[number]> = [];
  for (const step of original) {
    const source = inspectAuthoredGraphSource(document, step.workspaceNodeId, current);
    if (!source.ok) return source;
    const parsed =
      authoredGraphVersion(document.nodes[step.workspaceNodeId]) === 3
        ? parseGraphV3(source.source)
        : parseGraphV2(source.source);
    if (!parsed.ok || !parsed.graph.nodes.some((node) => node.id === step.graphNodeId))
      return fail('A migration occurrence is unavailable in its containing graph.');
    current.push({ ...step, expectedGraphRevision: parsed.graph.revision });
  }
  return current;
}

function children(document: UiDocument, node: UiNode): readonly string[] {
  if (node.kind === 'element' || node.kind === 'portal') return node.children;
  if (node.kind === 'repeat') return [node.templateRoot];
  if (node.kind === 'conditional') return node.branches.flatMap((branch) => [...branch.children]);
  if (node.kind === 'slot') return node.fallback ?? [];
  if (node.kind === 'component')
    return [
      ...Object.values(node.slots ?? {}).flatMap((fill) => [...fill.children]),
      ...(document.componentDefinitions[node.definitionId]
        ? [document.componentDefinitions[node.definitionId]!.root]
        : []),
    ];
  return [];
}

/** Thin source adapter: public Flow owns migration/identity meaning; one existing
 * canonical replaceDocument transaction owns persistence, validation and Undo. */
export function migrateAuthoredGraphs(
  document: UiDocument,
  targets: readonly GraphMigrationTarget[],
): { ok: true; document: UiDocument } | Failure {
  if (!targets.length) return fail('Graph migration requires explicit targets.');
  const requested = new Map<string, GraphMigrationTarget>();
  const readers = new Set<string>();
  for (const target of targets) {
    if (authoredGraphVersion(document.nodes[target.nodeId]) !== 2)
      return fail('Graph migration requires an exact graph2 workspace source.');
    const route = target.occurrenceRoute ?? [];
    const source = inspectAuthoredGraphSource(document, target.nodeId, route);
    if (!source.ok) return source;
    const parsed = parseGraphV2(source.source);
    if (!parsed.ok || parsed.graph.revision !== target.expectedGraphRevision)
      return fail('A target graph revision is stale or its graph2 source is invalid.');
    const key = address(document, target.nodeId, route);
    if (requested.has(key)) return fail('Duplicate graph migration source occurrence.');
    requested.set(key, target);
    const owner = JSON.stringify(graphSourceOwnership(document, target.nodeId));
    for (const node of Object.values(document.nodes)) {
      if (JSON.stringify(graphSourceOwnership(document, node.id)) !== owner) continue;
      if (authoredGraphVersion(node) !== 2)
        return fail('A source reader cannot migrate to graph3 with this workspace.');
      const identity =
        node.kind === 'component' &&
        graphMigrationV2ToV3.componentRevisions.find(
          (entry) =>
            entry.definitionId === node.definitionId &&
            entry.from === node.revision &&
            entry.role === 'workspace',
        );
      if (!identity) return fail('A source reader has no public graph3 migration identity.');
      readers.add(node.id);
    }
  }
  // Changing one shared workspace identity changes every controlled occurrence.
  // All of those sources must be explicitly named, including sibling instances.
  for (const nodeId of readers) {
    const routes = occurrences(document, nodeId);
    if ('ok' in routes) return routes;
    if (!routes.length) return fail('No authored occurrence is available for this migration.');
    for (const route of routes)
      if (!requested.has(address(document, nodeId, route)))
        return fail('Migration targets omit an affected sibling graph occurrence.');
  }

  let working = document;
  // Inner writes compose into their containing string first. Migrating that
  // current outer value afterwards preserves them instead of restoring a stale
  // original snapshot. Public migration itself retains the current revision.
  for (const target of [...requested.values()].sort(
    (a, b) => (b.occurrenceRoute?.length ?? 0) - (a.occurrenceRoute?.length ?? 0),
  )) {
    const route = refreshedRoute(working, target.occurrenceRoute ?? []);
    if ('ok' in route) return route;
    const source = inspectAuthoredGraphSource(working, target.nodeId, route);
    if (!source.ok) return source;
    const parsed = parseGraphV2(source.source);
    if (!parsed.ok) return fail('The composed migration source is not a valid graph2.');
    const migrated = migrateGraphV2ToV3(parsed.graph);
    if (!migrated.ok) return fail('The public graph migration refused this source.');
    const next = writeMigratedGraphSource(
      working,
      target.nodeId,
      serializeGraphV3(migrated.graph),
      route,
    );
    if (!next) return fail('The migrated graph source does not satisfy its ownership.');
    working = next;
  }

  // Resolve nearest workspace context structurally. A context-bound source node
  // shared with an untouched workspace cannot silently change that workspace.
  const contexts = new Map<string, Set<string>>();
  for (const workspace of Object.values(document.nodes).filter((node) =>
    authoredGraphVersion(node),
  )) {
    const pending = [...children(document, workspace)],
      visited = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = document.nodes[id];
      if (!node) return fail('A workspace descendant is missing.');
      if (authoredGraphVersion(node)) continue;
      const owners = contexts.get(id) ?? new Set<string>();
      owners.add(workspace.id);
      contexts.set(id, owners);
      pending.push(...children(document, node));
    }
  }
  const nodes = { ...working.nodes };
  for (const node of Object.values(working.nodes)) {
    if (node.kind !== 'component') continue;
    const identity = graphMigrationV2ToV3.componentRevisions.find(
      (entry) => entry.definitionId === node.definitionId && entry.from === node.revision,
    );
    if (!identity) continue;
    const owners = contexts.get(node.id);
    const shouldMigrate =
      identity.role === 'workspace'
        ? readers.has(node.id)
        : owners && [...owners].some((id) => readers.has(id));
    if (!shouldMigrate) continue;
    if (identity.role !== 'workspace' && [...owners!].some((id) => !readers.has(id)))
      return fail('A context component is shared with an untouched workspace.');
    nodes[node.id] = { ...node, revision: identity.to };
  }
  return { ok: true, document: { ...working, nodes } };
}
