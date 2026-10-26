import { MarkerType, type Edge } from '@victframework/ui-flow-svelte';
import type { StructureEdgeData, StructureGraph } from './structure.js';
import { relationLabels, type RelationRole } from './structure-semantics.js';

export type ConnectionKind =
  'hierarchy' | 'read' | 'write' | 'action' | 'definition' | 'navigation' | 'reference';
export const connectionKinds: Record<ConnectionKind, { color: string; dash?: string }> = {
  hierarchy: { color: '#7b879a' },
  read: { color: '#0f766e' },
  write: { color: '#a16207', dash: '5 3' },
  action: { color: '#7c3aed' },
  definition: { color: '#3566a4', dash: '2 3' },
  navigation: { color: '#0369a1', dash: '8 3' },
  reference: { color: '#64748b', dash: '3 3' },
};
const roleKinds: Record<RelationRole, ConnectionKind> = {
  contains: 'hierarchy',
  value: 'read',
  updates: 'write',
  payload: 'read',
  fallback: 'read',
  items: 'read',
  key: 'read',
  condition: 'read',
  branch: 'hierarchy',
  otherwise: 'hierarchy',
  template: 'hierarchy',
  uses: 'definition',
  defines: 'definition',
  slot: 'hierarchy',
  invokes: 'action',
  navigates: 'navigation',
  styles: 'definition',
  pending: 'write',
  error: 'write',
  result: 'write',
  success: 'write',
  overlay: 'reference',
  emits: 'action',
};
export function connectionKind(edge: Edge<StructureEdgeData>): ConnectionKind {
  if (edge.data?.kind === 'containment') return 'hierarchy';
  return edge.data?.role
    ? roleKinds[edge.data.role]
    : edge.data?.kind === 'definition'
      ? 'definition'
      : 'reference';
}
export function relationLabel(edge: Edge<StructureEdgeData>): string {
  return edge.data?.role ? relationLabels[edge.data.role] : String(edge.label ?? 'Reference');
}
export type StructurePort = {
  id: string;
  kind: ConnectionKind;
  side: 'in' | 'out';
  label: string;
  count: number;
  color: string;
};
/** Ports describe visible declared edges, never new effect or connection authority. */
export function structurePorts(graph: StructureGraph, nodeId: string): StructurePort[] {
  const ports = new Map<string, StructurePort>();
  for (const edge of graph.edges) {
    const kind = connectionKind(edge),
      meta = connectionKinds[kind];
    for (const side of ['in', 'out'] as const) {
      if ((side === 'out' ? edge.source : edge.target) !== nodeId) continue;
      const id = `${side}-${edge.data?.role ?? kind}`,
        port = ports.get(id);
      if (port) port.count++;
      else
        ports.set(id, { id, kind, side, label: relationLabel(edge), count: 1, color: meta.color });
    }
  }
  return [...ports.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function structureConnectionEdges(graph: StructureGraph): StructureGraph['edges'] {
  const groups = new Map<string, StructureGraph['edges']>();
  const groupKey = (edge: StructureGraph['edges'][number]) =>
    JSON.stringify([
      edge.source,
      edge.target,
      edge.data?.role,
      edge.data?.description,
      edge.data?.owner,
      edge.data?.origin,
    ]);
  for (const edge of graph.edges) {
    const key = groupKey(edge);
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  return graph.edges.map((edge) => {
    const kind = connectionKind(edge),
      meta = connectionKinds[kind];
    const group = groups.get(groupKey(edge))!;
    const name = relationLabel(edge);
    return {
      ...edge,
      sourceHandle: `out-${edge.data?.role ?? kind}`,
      targetHandle: `in-${edge.data?.role ?? kind}`,
      focusable: group[0]?.id === edge.id,
      selectable: group[0]?.id === edge.id,
      label:
        group[0]?.id === edge.id
          ? `${name}${group.length > 1 ? ` · ${group.length}` : ''}`
          : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: meta.color, width: 12, height: 12 },
      style: `stroke: ${meta.color}; stroke-width: 1.5${meta.dash ? `; stroke-dasharray: ${meta.dash}` : ''}`,
    };
  });
}
export type RelationshipGroup = {
  targetId: string;
  count: number;
  relations: {
    kind: ConnectionKind;
    label: string;
    direction: 'incoming' | 'outgoing';
    count: number;
    paths: string[];
    description?: string;
    origin?: string;
  }[];
};
/** Same typed vocabulary on nodes, edges, Selection and accessibility surfaces. */
export function groupStructureRelationships(
  graph: StructureGraph,
  selectedId?: string,
): RelationshipGroup[] {
  const groups = new Map<string, RelationshipGroup>();
  for (const edge of graph.edges) {
    if (edge.source !== selectedId && edge.target !== selectedId) continue;
    const outgoing = edge.source === selectedId,
      targetId = outgoing ? edge.target : edge.source;
    const kind = connectionKind(edge),
      label = relationLabel(edge),
      direction = outgoing ? 'outgoing' : 'incoming';
    const group = groups.get(targetId) ?? { targetId, count: 0, relations: [] };
    const relation = group.relations.find(
      (entry) =>
        entry.kind === kind &&
        entry.label === label &&
        entry.direction === direction &&
        entry.description === edge.data?.description &&
        entry.origin === edge.data?.origin,
    );
    if (relation) {
      relation.count++;
      relation.paths.push(edge.data?.path ?? '');
    } else
      group.relations.push({
        kind,
        label,
        direction,
        count: 1,
        paths: [edge.data?.path ?? ''],
        description: edge.data?.description,
        origin: edge.data?.origin,
      });
    group.count++;
    groups.set(targetId, group);
  }
  return [...groups.values()];
}

const relationMeanings:Record<RelationRole,string>={
 contains:'The source directly contains the destination in the declared structure.',
 value:'The source supplies a value read by the destination.',
 updates:'The source declares an update to the destination state.',
 payload:'The source supplies part of the destination action or navigation input.',
 fallback:'The source supplies a declared fallback value or content for the destination.',
 items:'The source supplies the collection used by the destination repeat.',
 key:'The source contributes to the identity of repeated items.',
 condition:'The source controls when the destination applies.',
 branch:'The destination belongs to a conditional branch of the source.',
 otherwise:'The destination is fallback branch content of the source.',
 template:'The destination is the source repeat template, not an individual runtime row.',
 uses:'The source uses the destination component definition or library entry.',
 defines:'The source definition declares the destination root.',
 slot:'The destination is slot content owned by the source.',
 invokes:'The source declares a request to invoke the destination action.',
 navigates:'The source declares navigation to the destination route.',
 styles:'The source contributes declared styling to the destination.',
 pending:'The host maps the source action pending state to the destination state.',
 error:'The host maps the source action error to the destination state.',
 result:'The host maps the source action result to the destination state.',
 success:'The host maps the source action success to the destination state.',
 overlay:'The source is the logical overlay target of the destination.',
 emits:'The source component declares the destination output.',
};
export function relationMeaning(edge:Edge<StructureEdgeData>):string {
 return edge.data?.role?relationMeanings[edge.data.role]:'A declared relationship between the source and destination.';
}
