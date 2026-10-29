/** Domain-neutral connection topology shared by retained and typed graph models. */
export interface GraphTopologyPort {
  id: string;
  label: string;
  direction: 'input' | 'output';
  type: string;
  maxConnections?: number;
}
export interface GraphTopologyFamily { id: string; ports: GraphTopologyPort[] }
export interface GraphTopologyNode { id: string; type: string; ports?: GraphTopologyPort[] }
export interface GraphTopologyEdge { id: string; source: string; sourcePort: string; target: string; targetPort: string }
export interface GraphTopology {
  nodeTypes: GraphTopologyFamily[];
  nodes: GraphTopologyNode[];
  edges: GraphTopologyEdge[];
  allowCycles?: boolean;
}
export interface GraphTopologyIssue { code: string; path: string; message: string }
export function portsForTopology(graph: GraphTopology, node: GraphTopologyNode): GraphTopologyPort[] {
  return node.ports ?? graph.nodeTypes.find(type => type.id === node.type)?.ports ?? [];
}
export function connectionIssueForTopology(graph: GraphTopology, edge: GraphTopologyEdge): GraphTopologyIssue | undefined {
  const fail = (code: string, message: string) => ({ code, path: 'connection', message });
  const source = graph.nodes.find(node => node.id === edge.source), target = graph.nodes.find(node => node.id === edge.target);
  if (!source || !target) return fail('GRAPH_ENDPOINT', 'Connection endpoint is unavailable.');
  const output = portsForTopology(graph, source).find(port => port.id === edge.sourcePort), input = portsForTopology(graph, target).find(port => port.id === edge.targetPort);
  if (output?.direction !== 'output' || input?.direction !== 'input') return fail('GRAPH_DIRECTION', 'Connect a named output to a named input.');
  if (output.type !== input.type && output.type !== '*' && input.type !== '*') return fail('GRAPH_PORT_TYPE', 'Port types are incompatible.');
  const existing = graph.edges.filter(item => item.id !== edge.id);
  if (existing.some(item => item.source === edge.source && item.sourcePort === edge.sourcePort && item.target === edge.target && item.targetPort === edge.targetPort)) return fail('GRAPH_DUPLICATE_EDGE', 'This connection already exists.');
  if ((output.maxConnections && existing.filter(item => item.source === source.id && item.sourcePort === output.id).length >= output.maxConnections) || (input.maxConnections && existing.filter(item => item.target === target.id && item.targetPort === input.id).length >= input.maxConnections)) return fail('GRAPH_MULTIPLICITY', 'Port connection limit would be exceeded.');
  if (!graph.allowCycles) {
    const seen = new Set<string>();
    const visits = (id: string): boolean => {
      if (id === source.id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return existing.filter(item => item.source === id).some(item => visits(item.target));
    };
    if (visits(target.id)) return fail('GRAPH_CYCLE', 'This application graph forbids cycles.');
  }
  return undefined;
}
