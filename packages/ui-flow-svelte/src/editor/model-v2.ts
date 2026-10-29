import { isUiValueType, isUiValueOfType, copyUiValue, type UiValue, type UiValueType } from '@victframework/ui';
import { graphStructuralProblems, graphDocumentSchemaV2, graphOperationsSchemaV2, graphClipboardSchemaV2, legacyParameterValueTypes } from './graph-schemas.js';
import { connectionIssueForTopology, portsForTopology } from './topology.js';
import { validateGraph, graphFieldValue, type GraphPort, type GraphEdge, type GraphIssue, type GraphSelection, type GraphDocument } from './model.js';

/** Parameter values have canonical VICT types, independently of their authored UI. */
export interface GraphParameterV2 { type: UiValueType; default: UiValue; label?: string }
export interface GraphNodeTypeV2 { id: string; label: string; parameters: Record<string, GraphParameterV2>; ports: GraphPort[] }
export interface GraphNodeV2 { id: string; type: string; label: string; position: { x: number; y: number }; values: Record<string, UiValue>; ports?: GraphPort[] }
export interface GraphDocumentV2 { schema: 'vict.flow-graph@2'; revision: number; nodeTypes: GraphNodeTypeV2[]; nodes: GraphNodeV2[]; edges: GraphEdge[]; allowCycles?: boolean }
export type GraphResultV2 = { ok: true; graph: GraphDocumentV2 } | { ok: false; issues: GraphIssue[] };
export type GraphOperationV2 =
  | { type: 'setCyclePolicy'; allowCycles: boolean }
  | { type: 'defineNodeType'; definition: GraphNodeTypeV2; replace?: boolean }
  | { type: 'removeNodeType'; nodeType: string }
  | { type: 'addNode'; nodeType: string; id?: string; position?: { x: number; y: number } }
  | { type: 'moveNodes'; positions: Record<string, { x: number; y: number }> }
  | { type: 'setParameter'; nodeId: string; key: string; value: UiValue }
  | { type: 'unsetParameter'; nodeId: string; key: string }
  | { type: 'setLabel'; nodeId: string; label: string }
  | { type: 'connect'; edge: Omit<GraphEdge, 'id'> & { id?: string } }
  | { type: 'reconnect'; edgeId: string; connection: Omit<GraphEdge, 'id'> }
  | { type: 'remove'; selection: GraphSelection }
  | { type: 'duplicate'; selection: GraphSelection; offset?: number }
  | { type: 'replacePorts'; nodeId: string; ports: GraphPort[]; removeInvalidConnections?: boolean }
  | { type: 'paste'; clipboard: string; offset?: number };
export type GraphOperationsResultV2 = { ok: true; operations: GraphOperationV2[] } | { ok: false; issues: GraphIssue[] };
export type GraphPatchResultV2 = { ok: true; graph: GraphDocumentV2; source: string } | { ok: false; issues: GraphIssue[] };
export class GraphValidationErrorV2 extends Error {
  constructor(readonly issues: GraphIssue[]) { super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')); this.name = 'GraphValidationErrorV2'; }
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const issue = (code: string, path: string, message: string): GraphIssue => ({ code, path, message });
function finiteJson(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 64 || seen.has(value)) return false;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  seen.add(value);
  const valid = (Array.isArray(value) ? Array.from(value) : Object.values(value)).every(child => finiteJson(child, seen, depth + 1));
  seen.delete(value); return valid;
}
function jsonProblem(input: unknown): GraphIssue[] {
  try {
    if (!finiteJson(input)) return [issue('GRAPH_JSON', 'graph', 'Supply finite canonical JSON data.')];
    if (JSON.stringify(input).length > 1_000_000) return [issue('GRAPH_BOUND', 'graph', 'Graph data exceeds one million characters.')];
    return [];
  } catch { return [issue('GRAPH_JSON', 'graph', 'Supply finite canonical JSON data.')]; }
}
export const emptyGraphV2 = (): GraphDocumentV2 => ({ schema: 'vict.flow-graph@2', revision: 0, nodeTypes: [], nodes: [], edges: [] });
export function graphTypeV2(graph: GraphDocumentV2, node: GraphNodeV2): GraphNodeTypeV2 { return graph.nodeTypes.find(type => type.id === node.type)!; }
export function graphPortsV2(graph: GraphDocumentV2, node: GraphNodeV2): GraphPort[] { return portsForTopology(graph, node); }
export function graphParameterValueV2(graph: GraphDocumentV2, node: GraphNodeV2, key: string): UiValue | undefined { return node.values[key] ?? graphTypeV2(graph, node).parameters[key]?.default; }
export function connectionIssueV2(graph: GraphDocumentV2, edge: GraphEdge): GraphIssue | undefined { return connectionIssueForTopology(graph, edge); }

export function validateGraphV2(input: unknown): GraphResultV2 {
  const preliminary = jsonProblem(input); if (preliminary.length) return { ok: false, issues: preliminary };
  const issues = graphStructuralProblems(graphDocumentSchemaV2, input); if (issues.length) return { ok: false, issues };
  const graph = clone(input) as GraphDocumentV2;
  const add = (code: string, path: string, message: string) => { if (issues.length < 30) issues.push(issue(code, path, message)); };
  const unique = (entries: readonly { id: string }[], path: string) => { const seen = new Set<string>(); entries.forEach((entry, index) => { if (seen.has(entry.id)) add('GRAPH_DUPLICATE', `${path}.${index}.id`, 'IDs must be unique in their namespace.'); seen.add(entry.id); }); };
  unique(graph.nodeTypes, 'nodeTypes'); unique(graph.nodes, 'nodes'); unique(graph.edges, 'edges');
  for (const [index, family] of graph.nodeTypes.entries()) {
    unique(family.ports, `nodeTypes.${index}.ports`);
    for (const [key, declaration] of Object.entries(family.parameters)) if (!isUiValueType(declaration.type) || !isUiValueOfType(declaration.default, declaration.type)) add('GRAPH_PARAMETER', `nodeTypes.${index}.parameters.${key}.default`, 'Default must match its canonical VICT value type.');
  }
  for (const [index, node] of graph.nodes.entries()) {
    const family = graphTypeV2(graph, node);
    if (!family) { add('GRAPH_TYPE', `nodes.${index}.type`, 'Unknown node family.'); continue; }
    if (node.ports) unique(node.ports, `nodes.${index}.ports`);
    for (const [key, value] of Object.entries(node.values)) {
      const declaration = family.parameters[key];
      if (!declaration || !isUiValueOfType(value, declaration.type)) add('GRAPH_PARAMETER', `nodes.${index}.values.${key}`, 'Value must match a declared canonical VICT parameter type.');
    }
  }
  if (!issues.length) {
    const accepted: GraphEdge[] = [];
    for (const [index, edge] of graph.edges.entries()) {
      const problem = connectionIssueV2({ ...graph, edges: accepted }, edge);
      if (problem) add(problem.code, `edges.${index}`, problem.message); else accepted.push(edge);
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, graph };
}
export function parseGraphV2(source: string): GraphResultV2 {
  if (source.length > 1_000_000) return { ok: false, issues: [issue('GRAPH_BOUND', 'graph', 'Graph exceeds one million characters.')] };
  try { return validateGraphV2(JSON.parse(source)); } catch { return { ok: false, issues: [issue('GRAPH_JSON', 'graph', 'Supply valid graph JSON.')] }; }
}
export function serializeGraphV2(graph: GraphDocumentV2): string { const checked = validateGraphV2(graph); if (!checked.ok) throw new GraphValidationErrorV2(checked.issues); return JSON.stringify(checked.graph); }
export function parseGraphOperationsV2(input: unknown): GraphOperationsResultV2 {
  const preliminary = jsonProblem(input); if (preliminary.length) return { ok: false, issues: preliminary };
  const issues = graphStructuralProblems(graphOperationsSchemaV2, input, 'operations');
  if (issues.length) return { ok: false, issues };
  const operations = clone(input) as GraphOperationV2[];
  // Defaults and duplicate ports require semantic validation beyond JSON shape.
  for (const [index, operation] of operations.entries()) if (operation.type === 'defineNodeType' || operation.type === 'replacePorts') {
    const family = operation.type === 'defineNodeType' ? operation.definition : { id: 'probe', label: 'Probe', parameters: {}, ports: operation.ports };
    const checked = validateGraphV2({ ...emptyGraphV2(), nodeTypes: [family] });
    if (!checked.ok) issues.push(...checked.issues.map(problem => ({ ...problem, path: `operations.${index}.${problem.path}` })));
  }
  return issues.length ? { ok: false, issues: issues.slice(0, 30) } : { ok: true, operations };
}
const nextId = (prefix: string, ids: readonly string[]) => { const set = new Set(ids); let counter = 1; while (set.has(`${prefix}-${counter}`)) counter++; return `${prefix}-${counter}`; };
export function copyGraphSelectionV2(graph: GraphDocumentV2, selection: GraphSelection): string {
  const checked = validateGraphV2(graph); if (!checked.ok) throw new GraphValidationErrorV2(checked.issues);
  const nodes = checked.graph.nodes.filter(node => selection.nodes.includes(node.id)), ids = new Set(nodes.map(node => node.id));
  return JSON.stringify({ schema: 'vict.flow-clipboard@2', nodeTypes: checked.graph.nodeTypes.filter(type => nodes.some(node => node.type === type.id)), nodes, edges: checked.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)), ...(graph.allowCycles === undefined ? {} : { allowCycles: graph.allowCycles }) });
}
export function applyGraphOperationsV2(graph: GraphDocumentV2, input: readonly GraphOperationV2[], expectedRevision = graph.revision): GraphResultV2 {
  const parsed = parseGraphOperationsV2(input); if (!parsed.ok) return parsed;
  if (expectedRevision !== graph.revision) return { ok: false, issues: [issue('GRAPH_STALE', 'revision', 'Graph changed; read the current revision before retrying.')] };
  const initial = validateGraphV2(graph); if (!initial.ok) return initial;
  const next = initial.graph;
  const fail = (message: string): never => { throw new GraphValidationErrorV2([issue('GRAPH_OPERATION', 'operations', message)]); };
  const node = (id: string) => next.nodes.find(item => item.id === id) ?? fail(`Unknown node ${id}.`);
  try {
    for (const operation of parsed.operations) switch (operation.type) {
      case 'setCyclePolicy': next.allowCycles = operation.allowCycles; break;
      case 'defineNodeType': {
        const index = next.nodeTypes.findIndex(type => type.id === operation.definition.id);
        if (index >= 0 && !operation.replace) fail('Node family exists; explicit replacement is required.');
        if (index >= 0) next.nodeTypes[index] = clone(operation.definition); else next.nodeTypes.push(clone(operation.definition)); break;
      }
      case 'removeNodeType':
        if (next.nodes.some(item => item.type === operation.nodeType)) fail('Remove instances before removing their family.');
        if (!next.nodeTypes.some(type => type.id === operation.nodeType)) fail('Unknown node family.');
        next.nodeTypes = next.nodeTypes.filter(type => type.id !== operation.nodeType); break;
      case 'addNode': {
        const family = next.nodeTypes.find(type => type.id === operation.nodeType) ?? fail('Unknown node family.');
        next.nodes.push({ id: operation.id ?? nextId(family.id, next.nodes.map(item => item.id)), type: family.id, label: family.label, position: operation.position ?? { x: 40, y: 40 }, values: {} }); break;
      }
      case 'moveNodes': for (const [id, position] of Object.entries(operation.positions)) node(id).position = clone(position); break;
      case 'setParameter': {
        const target = node(operation.nodeId), declaration = graphTypeV2(next, target).parameters[operation.key];
        if (!declaration || !isUiValueOfType(operation.value, declaration.type)) fail('Parameter must exist and match its canonical VICT type.');
        target.values[operation.key] = copyUiValue(operation.value); break;
      }
      case 'unsetParameter': {
        const target = node(operation.nodeId); if (!graphTypeV2(next, target).parameters[operation.key]) fail('Unknown parameter.'); delete target.values[operation.key]; break;
      }
      case 'setLabel': node(operation.nodeId).label = operation.label; break;
      case 'connect': next.edges.push({ ...operation.edge, id: operation.edge.id ?? nextId('edge', next.edges.map(item => item.id)) }); break;
      case 'reconnect': {
        const index = next.edges.findIndex(edge => edge.id === operation.edgeId); if (index < 0) fail('Unknown edge.'); next.edges[index] = { ...operation.connection, id: operation.edgeId }; break;
      }
      case 'remove': {
        const ids = new Set(operation.selection.nodes); for (const id of ids) node(id);
        for (const id of operation.selection.edges) if (!next.edges.some(edge => edge.id === id)) fail('Unknown selected edge.');
        next.nodes = next.nodes.filter(item => !ids.has(item.id)); next.edges = next.edges.filter(edge => !ids.has(edge.source) && !ids.has(edge.target) && !operation.selection.edges.includes(edge.id)); break;
      }
      case 'replacePorts': {
        const target = node(operation.nodeId); target.ports = clone(operation.ports);
        if (operation.removeInvalidConnections) next.edges = next.edges.filter(edge => !(edge.source === target.id || edge.target === target.id) || !connectionIssueV2({ ...next, edges: next.edges.filter(item => item.id !== edge.id) }, edge)); break;
      }
      case 'duplicate': case 'paste': {
        const source = operation.type === 'duplicate' ? copyGraphSelectionV2(next, operation.selection) : operation.clipboard;
        if (source.length > 1_000_000) fail('Clipboard exceeds the graph budget.');
        let clipboard: unknown; try { clipboard = JSON.parse(source); } catch { fail('Clipboard must be valid JSON.'); }
        const problems = graphStructuralProblems(graphClipboardSchemaV2, clipboard, 'clipboard'); if (problems.length) throw new GraphValidationErrorV2(problems);
        const data = clipboard as { nodeTypes: GraphNodeTypeV2[]; nodes: GraphNodeV2[]; edges: GraphEdge[]; allowCycles?: boolean };
        const checked = validateGraphV2({ ...emptyGraphV2(), nodeTypes: data.nodeTypes, nodes: data.nodes, edges: data.edges, ...(data.allowCycles === undefined ? {} : { allowCycles: data.allowCycles }) });
        if (!checked.ok) throw new GraphValidationErrorV2(checked.issues);
        for (const family of checked.graph.nodeTypes) {
          const existing = next.nodeTypes.find(type => type.id === family.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(family)) fail('Clipboard family conflicts with the installed definition.');
          if (!existing) next.nodeTypes.push(family);
        }
        const ids = new Map<string, string>();
        for (const item of checked.graph.nodes) { const id = nextId(item.type, next.nodes.map(entry => entry.id)); ids.set(item.id, id); next.nodes.push({ ...item, id, position: { x: item.position.x + (operation.offset ?? 32), y: item.position.y + (operation.offset ?? 32) } }); }
        for (const edge of checked.graph.edges) next.edges.push({ ...edge, id: nextId('edge', next.edges.map(item => item.id)), source: ids.get(edge.source)!, target: ids.get(edge.target)! }); break;
      }
    }
    next.revision++; return validateGraphV2(next);
  } catch (error) { return { ok: false, issues: error instanceof GraphValidationErrorV2 ? error.issues : [issue('GRAPH_OPERATION', 'operations', 'Invalid graph operation.')] }; }
}
export function applyGraphPatchV2(source: string, input: unknown, expectedRevision: number): GraphPatchResultV2 {
  const parsed = parseGraphV2(source); if (!parsed.ok) return parsed;
  const operations = parseGraphOperationsV2(input); if (!operations.ok) return operations;
  const result = applyGraphOperationsV2(parsed.graph, operations.operations, expectedRevision);
  return result.ok ? { ...result, source: serializeGraphV2(result.graph) } : result;
}
export class GraphSessionV2 {
  private current: GraphDocumentV2; private past: GraphDocumentV2[] = []; private future: GraphDocumentV2[] = [];
  constructor(graph: GraphDocumentV2, private readonly options: { readOnly?: boolean; maxHistory?: number; validate?: (graph: GraphDocumentV2) => readonly GraphIssue[] } = {}) { const checked = validateGraphV2(graph); if (!checked.ok) throw new GraphValidationErrorV2(checked.issues); this.current = checked.graph; }
  get graph() { return clone(this.current); } get canUndo() { return this.past.length > 0; } get canRedo() { return this.future.length > 0; }
  setReadOnly(readOnly: boolean) { this.options.readOnly = readOnly; }
  private policy(graph: GraphDocumentV2): readonly GraphIssue[] { try { return this.options.validate?.(clone(graph)) ?? []; } catch { return [issue('GRAPH_DOMAIN_VALIDATION', 'graph', 'Application graph validation is unavailable; existing graph retained.')]; } }
  apply(operations: readonly GraphOperationV2[], expectedRevision = this.current.revision): GraphResultV2 {
    if (this.options.readOnly) return { ok: false, issues: [issue('GRAPH_READ_ONLY', 'graph', 'Graph is read-only.')] };
    const result = applyGraphOperationsV2(this.current, operations, expectedRevision); if (!result.ok) return result;
    const issues = this.policy(result.graph); if (issues.length) return { ok: false, issues: [...issues] };
    this.past.push(this.current); if (this.past.length > (this.options.maxHistory ?? 100)) this.past.shift(); this.future = []; this.current = result.graph; return { ok: true, graph: this.graph };
  }
  replace(graph: GraphDocumentV2): GraphResultV2 { const result = validateGraphV2(graph); if (!result.ok) return result; const issues = this.policy(result.graph); if (issues.length) return { ok: false, issues: [...issues] }; this.current = result.graph; this.past = []; this.future = []; return { ok: true, graph: this.graph }; }
  undo() { return this.travel(this.past, this.future); } redo() { return this.travel(this.future, this.past); }
  private travel(from: GraphDocumentV2[], to: GraphDocumentV2[]): GraphResultV2 {
    if (this.options.readOnly) return { ok: false, issues: [issue('GRAPH_READ_ONLY', 'graph', 'Graph is read-only.')] };
    const next = from.at(-1); if (!next) return { ok: false, issues: [issue('GRAPH_HISTORY_EMPTY', 'history', 'No history in this direction.')] };
    const checked = validateGraphV2({ ...clone(next), revision: this.current.revision + 1 }); if (!checked.ok) return checked;
    const issues = this.policy(checked.graph); if (issues.length) return { ok: false, issues: [...issues] };
    from.pop(); to.push(this.current); this.current = checked.graph; return { ok: true, graph: this.graph };
  }
}

export interface GraphMigrationNote { path: string; message: string }
export type GraphMigrationResult = { ok: true; graph: GraphDocumentV2; notes: GraphMigrationNote[] } | { ok: false; issues: GraphIssue[]; notes: GraphMigrationNote[] };
/** Explicit migration only. Body bindings must deliberately adopt canonical types. */
export function migrateGraphV1ToV2(input: GraphDocument, options: { acknowledgeUnmappedConstraints?: boolean } = {}): GraphMigrationResult {
  const checked = validateGraph(input); if (!checked.ok) return { ...checked, notes: [] };
  const notes: GraphMigrationNote[] = [], source = checked.graph;
  const note = (path: string, message: string) => notes.push({ path, message });
  for (const family of source.nodeTypes) {
    if (family.icon) note(`nodeTypes.${family.id}.icon`, 'Move this presentation identity into the authored body.');
    for (const field of family.fields) for (const property of ['min', 'max', 'step', 'options', 'disabled', 'advanced', 'media'] as const) if (field[property] !== undefined) note(`nodeTypes.${family.id}.fields.${field.id}.${property}`, 'This legacy constraint/presentation metadata needs an explicit body or host validation policy; graph@2 does not infer a control.');
  }
  for (const node of source.nodes) for (const property of ['icon', 'collapsed'] as const) if (node[property] !== undefined) note(`nodes.${node.id}.${property}`, 'This presentation metadata needs an explicit authored body state/presentation decision.');
  if (notes.length && !options.acknowledgeUnmappedConstraints) return { ok: false, issues: [issue('GRAPH_MIGRATION_POLICY_REQUIRED', 'migration', 'Review unmapped legacy constraints/presentation and explicitly acknowledge the new body/host policy before migration.')], notes };
  const result = validateGraphV2({ schema: 'vict.flow-graph@2', revision: source.revision,
    nodeTypes: source.nodeTypes.map(family => ({ id: family.id, label: family.label, ports: clone(family.ports), parameters: Object.fromEntries(family.fields.map(field => [field.id, { type: legacyParameterValueTypes[field.kind], default: graphFieldValue(source, { id: 'migration-default', type: family.id, label: 'Default', position: { x: 0, y: 0 }, values: {} }, field), label: field.label }])) })),
    nodes: source.nodes.map(node => ({ id: node.id, type: node.type, label: node.label, position: clone(node.position), values: clone(node.values), ...(node.ports ? { ports: clone(node.ports) } : {}) })), edges: clone(source.edges), ...(source.allowCycles === undefined ? {} : { allowCycles: source.allowCycles }),
  });
  return { ...result, notes };
}
