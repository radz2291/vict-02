import type { Node, Edge, XYPosition, Position } from '@xyflow/svelte';
import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js';

export type LayoutEngine = 'elk' | 'dagre';
export type LayoutDirection = 'RIGHT' | 'DOWN';
export type LayoutOptions = { engine?: LayoutEngine; direction?: LayoutDirection; spacing?: number };
export type RoutedEdgeData = Record<string, unknown> & { route?: XYPosition[] };
export function chooseLayoutEngine(count: number, requested: LayoutEngine = 'elk'): { engine: LayoutEngine; reason?: string } {
  return requested === 'elk' && count > 120 ? { engine: 'dagre', reason: 'Large expanded view uses the faster hierarchy layout. Focus or collapse groups to enable routed layout.' } : { engine: requested };
}

/** Presentation only. Measured sizes take precedence over explicit initial sizes. */
export function nodeSize(node: Node): { width: number; height: number } {
  return { width: node.measured?.width ?? node.width ?? 224, height: node.measured?.height ?? node.height ?? 90 };
}

/** Layout never mutates caller nodes, edges or source documents. */
export async function layoutGraph<N extends Node, E extends Edge>(nodes: N[], edges: E[], options: LayoutOptions = {}): Promise<{ nodes: N[]; edges: E[]; engine: LayoutEngine; reason?: string }> {
  const direction = options.direction ?? 'RIGHT';
  const handles = { sourcePosition: (direction === 'RIGHT' ? 'right' : 'bottom') as Position,
    targetPosition: (direction === 'RIGHT' ? 'left' : 'top') as Position };
  const spacing = options.spacing ?? 48;
  const selection = chooseLayoutEngine(nodes.length, options.engine);
  if (!nodes.length) return { nodes: [], edges: [], ...selection };
  if (selection.engine === 'dagre') {
    const { default: dagre } = await import('@dagrejs/dagre');
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: direction === 'RIGHT' ? 'LR' : 'TB', nodesep: spacing, ranksep: spacing * 1.5 });
    for (const node of nodes) graph.setNode(node.id, nodeSize(node));
    for (const edge of edges) graph.setEdge(edge.source, edge.target);
    dagre.layout(graph);
    return { nodes: nodes.map(node => { const point = graph.node(node.id); const size = nodeSize(node); return { ...node, ...handles, position: { x: point.x - size.width / 2, y: point.y - size.height / 2 } }; }), edges: edges.map(edge => ({ ...edge, data: { ...edge.data, route: undefined } })), ...selection };
  }
  const module = await import('elkjs/lib/elk.bundled.js');
  // elkjs is CommonJS; NodeNext types its interop default as the module namespace.
  const Constructor = module.default as unknown as { new(): ELK };
  const elk = new Constructor();
  const result = await elk.layout<ElkNode>({ id: 'layout', layoutOptions: {
    'elk.algorithm': 'layered', 'elk.direction': direction, 'elk.edgeRouting': 'ORTHOGONAL',
    'elk.spacing.nodeNode': String(spacing), 'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.8),
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  }, children: nodes.map(node => {
    const size = nodeSize(node); const horizontal = direction === 'RIGHT';
    return { id: node.id, ...size, layoutOptions: { 'elk.portConstraints': 'FIXED_POS' }, ports: [
      { id: `${node.id}:in`, x: horizontal ? 0 : size.width / 2, y: horizontal ? size.height / 2 : 0, width: 0, height: 0, layoutOptions: { 'elk.port.side': horizontal ? 'WEST' : 'NORTH' } },
      { id: `${node.id}:out`, x: horizontal ? size.width : size.width / 2, y: horizontal ? size.height / 2 : size.height, width: 0, height: 0, layoutOptions: { 'elk.port.side': horizontal ? 'EAST' : 'SOUTH' } },
    ] };
  }),
  edges: edges.map(edge => ({ id: edge.id, sources: [`${edge.source}:out`], targets: [`${edge.target}:in`] })) });
  const positions = new Map(result.children?.map(node => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
  const routes = new Map(result.edges?.map(edge => {
    const section = edge.sections?.[0];
    return [edge.id, section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : undefined];
  }));
  return { nodes: nodes.map(node => ({ ...node, ...handles, position: positions.get(node.id) ?? node.position })),
    edges: edges.map(edge => ({ ...edge, data: { ...edge.data, route: routes.get(edge.id) } })), ...selection };
}

/** Each document/revision/filter/measurement change invalidates outstanding work. */
export class LayoutFence {
  private generation = 0;
  issue(): number { return ++this.generation; }
  current(ticket: number): boolean { return ticket === this.generation; }
  cancel(): void { ++this.generation; }
}
