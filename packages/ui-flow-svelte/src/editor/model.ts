import { connectionIssueForTopology } from './topology.js';
/** Versioned, serializable application graph. UI occurrence IDs never enter this model. */
export type GraphValue = string | number | boolean | string[];
export type GraphFieldKind =
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'select'
  | 'toggle'
  | 'list'
  | 'button'
  | 'preview'
  | 'image'
  | 'video'
  | 'icon'
  | 'vector';
export interface GraphIconReference {
  pack: string;
  name: string;
  revision: string;
  source?: string;
  data?: string;
}
export interface GraphMediaOptions {
  alt?: string;
  poster?: string;
  captions?: string;
  language?: string;
  pack?: string;
  revision?: string;
  decorative?: boolean;
}
export interface GraphField {
  id: string;
  label: string;
  kind: GraphFieldKind;
  default?: GraphValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  advanced?: boolean;
  disabled?: boolean;
  media?: GraphMediaOptions;
}
export interface GraphPort {
  id: string;
  label: string;
  direction: 'input' | 'output';
  type: string;
  maxConnections?: number;
}
export interface GraphNodeType {
  id: string;
  label: string;
  fields: GraphField[];
  ports: GraphPort[];
  icon?: GraphIconReference;
}
export interface GraphNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  values: Record<string, GraphValue>;
  ports?: GraphPort[];
  collapsed?: boolean;
  icon?: GraphIconReference;
}
export interface GraphEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
}
export interface GraphDocument {
  schema: 'vict.flow-graph@1';
  revision: number;
  nodeTypes: GraphNodeType[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  allowCycles?: boolean;
}
export interface GraphSelection {
  nodes: string[];
  edges: string[];
}
export interface GraphIssue {
  code: string;
  path: string;
  message: string;
}
export type GraphResult = { ok: true; graph: GraphDocument } | { ok: false; issues: GraphIssue[] };
export class GraphValidationError extends Error {
  constructor(readonly issues: GraphIssue[]) {
    super(issues.map((item) => `${item.path}: ${item.message}`).join('; '));
    this.name = 'GraphValidationError';
  }
}
const kinds = new Set<GraphFieldKind>([
  'text',
  'textarea',
  'number',
  'slider',
  'select',
  'toggle',
  'list',
  'button',
  'preview',
  'image',
  'video',
  'icon',
  'vector',
]);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 200;
const valueOk = (value: unknown): value is GraphValue =>
  (typeof value === 'string' && value.length <= 10000) ||
  finite(value) ||
  typeof value === 'boolean' ||
  (Array.isArray(value) &&
    value.length <= 500 &&
    value.every((item) => typeof item === 'string' && item.length <= 10000) &&
    value.reduce((total, item) => total + item.length, 0) <= 10000);
const safeId = (value: unknown): value is string =>
  text(value) && !['__proto__', 'prototype', 'constructor'].includes(value);
export const emptyGraph = (): GraphDocument => ({
  schema: 'vict.flow-graph@1',
  revision: 0,
  nodeTypes: [],
  nodes: [],
  edges: [],
});
export function graphType(graph: GraphDocument, node: GraphNode) {
  return graph.nodeTypes.find((type) => type.id === node.type)!;
}
export function graphPorts(graph: GraphDocument, node: GraphNode) {
  return node.ports ?? graphType(graph, node).ports;
}
export function graphFieldValue(
  graph: GraphDocument,
  node: GraphNode,
  field: GraphField,
): GraphValue {
  return (
    node.values[field.id] ??
    field.default ??
    (field.kind === 'toggle'
      ? false
      : field.kind === 'number' || field.kind === 'slider' || field.kind === 'button'
        ? (field.min ?? 0)
        : field.kind === 'list'
          ? []
          : '')
  );
}

/** Reject malformed/unbounded input before it can reach the canvas or authoring state. */
export function validateGraph(input: unknown): GraphResult {
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
    if (serialized.length > 1_000_000)
      return {
        ok: false,
        issues: [
          { code: 'GRAPH_BOUND', path: 'graph', message: 'Graph exceeds one million characters.' },
        ],
      };
  } catch {
    return {
      ok: false,
      issues: [
        { code: 'GRAPH_DOCUMENT', path: 'graph', message: 'Graph must be finite JSON data.' },
      ],
    };
  }
  const issues: GraphIssue[] = [];
  const issue = (code: string, path: string, message: string) => {
    if (issues.length < 30) issues.push({ code, path, message });
  };
  const keys = (entry: Record<string, unknown>, allowed: string[], path: string) => {
    for (const key of Object.keys(entry))
      if (!allowed.includes(key)) issue('GRAPH_UNKNOWN_FIELD', `${path}.${key}`, 'Unknown field.');
  };
  const list = (value: unknown, maximum: number, path: string): unknown[] => {
    if (!Array.isArray(value) || value.length > maximum) {
      issue('GRAPH_BOUND', path, `Expected an array of at most ${maximum} entries.`);
      return [];
    }
    return value;
  };
  const unique = (items: unknown[], path: string) => {
    const ids = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const entry = items[i];
      if (!object(entry) || !safeId(entry.id))
        issue(
          'GRAPH_ID',
          `${path}.${i}.id`,
          'Supply a nonempty safe ID of at most 200 characters.',
        );
      else if (ids.has(entry.id))
        issue('GRAPH_DUPLICATE', `${path}.${i}.id`, 'IDs must be unique in their namespace.');
      else ids.add(entry.id);
    }
  };
  const ports = (inputPorts: unknown, path: string): GraphPort[] => {
    const entries = list(inputPorts, 128, path);
    unique(entries, path);
    entries.forEach((port, i) => {
      if (!object(port)) return;
      keys(port, ['id', 'label', 'direction', 'type', 'maxConnections'], `${path}.${i}`);
      if (
        !text(port.label) ||
        !text(port.type) ||
        !['input', 'output'].includes(String(port.direction))
      )
        issue('GRAPH_PORT', `${path}.${i}`, 'Port requires label, direction and type.');
      if (
        port.maxConnections !== undefined &&
        (!Number.isInteger(port.maxConnections) || Number(port.maxConnections) < 1)
      )
        issue(
          'GRAPH_PORT',
          `${path}.${i}.maxConnections`,
          'Connection limit must be a positive integer.',
        );
    });
    return entries as unknown as GraphPort[];
  };
  const icon = (value: unknown, path: string) => {
    if (!object(value)) {
      issue('GRAPH_ICON', path, 'Supply an icon registry identity.');
      return;
    }
    keys(value, ['pack', 'name', 'revision', 'source', 'data'], path);
    if (!text(value.pack) || !text(value.name) || !text(value.revision))
      issue('GRAPH_ICON', path, 'Icon requires stable pack/name/revision.');
    for (const key of ['source', 'data'])
      if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 10000))
        issue(
          'GRAPH_ICON',
          `${path}.${key}`,
          'Supply a bounded managed source or inert vector JSON.',
        );
  };
  if (!object(input))
    return {
      ok: false,
      issues: [{ code: 'GRAPH_DOCUMENT', path: 'graph', message: 'Expected a graph object.' }],
    };
  keys(input, ['schema', 'revision', 'nodeTypes', 'nodes', 'edges', 'allowCycles'], 'graph');
  if (input.schema !== 'vict.flow-graph@1')
    issue('GRAPH_SCHEMA', 'schema', 'Expected vict.flow-graph@1.');
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0)
    issue('GRAPH_REVISION', 'revision', 'Expected a nonnegative safe integer.');
  if (input.allowCycles !== undefined && typeof input.allowCycles !== 'boolean')
    issue('GRAPH_POLICY', 'allowCycles', 'Expected boolean.');
  const types = list(input.nodeTypes, 128, 'nodeTypes'),
    nodes = list(input.nodes, 1000, 'nodes'),
    edges = list(input.edges, 4000, 'edges');
  unique(types, 'nodeTypes');
  unique(nodes, 'nodes');
  unique(edges, 'edges');
  const typeMap = new Map<string, GraphNodeType>();
  types.forEach((type, i) => {
    if (!object(type)) return;
    keys(type, ['id', 'label', 'fields', 'ports', 'icon'], `nodeTypes.${i}`);
    if (type.icon !== undefined) icon(type.icon, `nodeTypes.${i}.icon`);
    if (!text(type.label))
      issue('GRAPH_TYPE', `nodeTypes.${i}.label`, 'Node family requires a label.');
    const fields = list(type.fields, 128, `nodeTypes.${i}.fields`);
    unique(fields, `nodeTypes.${i}.fields`);
    fields.forEach((field, j) => {
      if (!object(field)) return;
      const path = `nodeTypes.${i}.fields.${j}`;
      keys(
        field,
        [
          'id',
          'label',
          'kind',
          'default',
          'min',
          'max',
          'step',
          'options',
          'advanced',
          'disabled',
          'media',
        ],
        path,
      );
      if (!text(field.label) || !kinds.has(field.kind as GraphFieldKind))
        issue('GRAPH_FIELD', path, 'Supply a supported field kind and label.');
      if (field.media !== undefined) {
        if (!object(field.media)) issue('GRAPH_MEDIA', `${path}.media`, 'Supply media options.');
        else {
          keys(
            field.media,
            ['alt', 'poster', 'captions', 'language', 'pack', 'revision', 'decorative'],
            `${path}.media`,
          );
          for (const [key, value] of Object.entries(field.media)) {
            if (
              key === 'decorative'
                ? typeof value !== 'boolean'
                : typeof value !== 'string' || value.length > 10000
            )
              issue(
                'GRAPH_MEDIA',
                `${path}.media.${key}`,
                'Supply bounded strings or boolean decorative state.',
              );
          }
        }
      }
      for (const key of ['min', 'max', 'step'])
        if (field[key] !== undefined && !finite(field[key]))
          issue('GRAPH_FIELD', `${path}.${key}`, 'Expected a finite number.');
      if (finite(field.step) && field.step <= 0)
        issue('GRAPH_FIELD', `${path}.step`, 'Step must be positive.');
      if (finite(field.min) && finite(field.max) && field.min > field.max)
        issue('GRAPH_FIELD', path, 'Minimum exceeds maximum.');
      if (
        field.options !== undefined &&
        (!Array.isArray(field.options) || field.options.length > 200 || !field.options.every(text))
      )
        issue('GRAPH_FIELD', `${path}.options`, 'Expected bounded string options.');
      if (field.kind === 'select' && (!Array.isArray(field.options) || !field.options.length))
        issue('GRAPH_FIELD', path, 'Select requires options.');
      for (const key of ['advanced', 'disabled'])
        if (field[key] !== undefined && typeof field[key] !== 'boolean')
          issue('GRAPH_FIELD', `${path}.${key}`, 'Expected boolean.');
      if (
        field.default !== undefined &&
        (!valueOk(field.default) || !fieldValueValid(field as unknown as GraphField, field.default))
      )
        issue('GRAPH_FIELD', `${path}.default`, 'Default does not match field type or bounds.');
    });
    ports(type.ports, `nodeTypes.${i}.ports`);
    if (safeId(type.id)) typeMap.set(type.id, type as unknown as GraphNodeType);
  });
  nodes.forEach((node, i) => {
    if (!object(node)) return;
    const path = `nodes.${i}`;
    keys(node, ['id', 'type', 'label', 'position', 'values', 'ports', 'collapsed', 'icon'], path);
    if (node.icon !== undefined) icon(node.icon, `${path}.icon`);
    const type = typeMap.get(String(node.type));
    if (!type) issue('GRAPH_TYPE', `${path}.type`, 'Unknown node family.');
    if (!text(node.label)) issue('GRAPH_NODE', `${path}.label`, 'Node requires a label.');
    if (!object(node.position) || !finite(node.position.x) || !finite(node.position.y))
      issue('GRAPH_POSITION', `${path}.position`, 'Position requires finite x/y.');
    else keys(node.position, ['x', 'y'], `${path}.position`);
    if (node.collapsed !== undefined && typeof node.collapsed !== 'boolean')
      issue('GRAPH_NODE', `${path}.collapsed`, 'Expected boolean.');
    if (!object(node.values))
      issue('GRAPH_VALUE', `${path}.values`, 'Expected keyed field values.');
    else
      for (const [key, value] of Object.entries(node.values)) {
        const field = Array.isArray(type?.fields)
          ? type.fields.find((entry) => entry.id === key)
          : undefined;
        if (!safeId(key) || !field || !valueOk(value) || !fieldValueValid(field, value))
          issue(
            'GRAPH_VALUE',
            `${path}.values.${key}`,
            'Value must match an existing field, bounds and options.',
          );
      }
    if (node.ports !== undefined) ports(node.ports, `${path}.ports`);
  });
  if (!issues.length) {
    const graph = input as unknown as GraphDocument;
    const accepted: GraphEdge[] = [];
    edges.forEach((entry, i) => {
      if (!object(entry)) return;
      keys(entry, ['id', 'source', 'sourcePort', 'target', 'targetPort'], `edges.${i}`);
      const result = connectionIssue({ ...graph, edges: accepted }, entry as unknown as GraphEdge);
      if (result) issue(result.code, `edges.${i}`, result.message);
      else accepted.push(entry as unknown as GraphEdge);
    });
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, graph: JSON.parse(serialized) as GraphDocument };
}
export function fieldValueValid(field: GraphField, value: GraphValue): boolean {
  if (field.kind === 'toggle') return typeof value === 'boolean';
  if (['number', 'slider', 'button'].includes(field.kind))
    return (
      finite(value) &&
      (field.min === undefined || value >= field.min) &&
      (field.max === undefined || value <= field.max)
    );
  if (field.kind === 'list')
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (typeof value !== 'string') return false;
  return field.kind !== 'select' || !!field.options?.includes(value);
}
export function parseGraph(source: string): GraphResult {
  if (source.length > 1_000_000)
    return {
      ok: false,
      issues: [
        { code: 'GRAPH_BOUND', path: 'graph', message: 'Graph exceeds one million characters.' },
      ],
    };
  try {
    return validateGraph(JSON.parse(source));
  } catch {
    return {
      ok: false,
      issues: [{ code: 'GRAPH_JSON', path: 'graph', message: 'Graph must be valid JSON.' }],
    };
  }
}
export function serializeGraph(graph: GraphDocument): string {
  const result = validateGraph(graph);
  if (!result.ok) throw new GraphValidationError(result.issues);
  return JSON.stringify(result.graph);
}
export function connectionIssue(graph: GraphDocument, edge: GraphEdge): GraphIssue | undefined {
  return connectionIssueForTopology(graph, edge);
}
export type GraphOperation =
  | { type: 'setCyclePolicy'; allowCycles: boolean }
  | { type: 'defineNodeType'; definition: GraphNodeType; replace?: boolean }
  | { type: 'removeNodeType'; nodeType: string }
  | { type: 'addNode'; nodeType: string; id?: string; position?: { x: number; y: number } }
  | { type: 'moveNodes'; positions: Record<string, { x: number; y: number }> }
  | { type: 'setField'; nodeId: string; fieldId: string; value: GraphValue }
  | { type: 'unsetField'; nodeId: string; fieldId: string }
  | { type: 'setLabel'; nodeId: string; label: string }
  | { type: 'setIcon'; nodeId: string; icon: GraphIconReference | null }
  | { type: 'collapse'; nodeId: string; collapsed: boolean }
  | { type: 'connect'; edge: Omit<GraphEdge, 'id'> & { id?: string } }
  | { type: 'reconnect'; edgeId: string; connection: Omit<GraphEdge, 'id'> }
  | { type: 'remove'; selection: GraphSelection }
  | { type: 'duplicate'; selection: GraphSelection; offset?: number }
  | { type: 'replacePorts'; nodeId: string; ports: GraphPort[]; removeInvalidConnections?: boolean }
  | { type: 'paste'; clipboard: string; offset?: number };

export type GraphOperationsResult =
  { ok: true; operations: GraphOperation[] } | { ok: false; issues: GraphIssue[] };
/** Runtime validation for bounded agent patches; never trust a TypeScript cast at the tool boundary. */
export function parseGraphOperations(input: unknown): GraphOperationsResult {
  const issues: GraphIssue[] = [];
  const issue = (path: string, message: string) => {
    if (issues.length < 30) issues.push({ code: 'GRAPH_OPERATION', path, message });
  };
  if (!Array.isArray(input) || !input.length || input.length > 50)
    return {
      ok: false,
      issues: [
        { code: 'GRAPH_OPERATION', path: 'operations', message: 'Supply 1–50 graph operations.' },
      ],
    };
  const allowed: Record<string, string[]> = {
    setCyclePolicy:['type','allowCycles'],
    defineNodeType: ['type', 'definition', 'replace'],
    removeNodeType: ['type', 'nodeType'],
    addNode: ['type', 'nodeType', 'id', 'position'],
    moveNodes: ['type', 'positions'],
    setField: ['type', 'nodeId', 'fieldId', 'value'],
    unsetField:['type','nodeId','fieldId'],
    setLabel: ['type', 'nodeId', 'label'],
    setIcon: ['type', 'nodeId', 'icon'],
    collapse: ['type', 'nodeId', 'collapsed'],
    connect: ['type', 'edge'],
    reconnect: ['type', 'edgeId', 'connection'],
    remove: ['type', 'selection'],
    duplicate: ['type', 'selection', 'offset'],
    replacePorts: ['type', 'nodeId', 'ports', 'removeInvalidConnections'],
    paste: ['type', 'clipboard', 'offset'],
  };
  const position = (value: unknown) =>
    object(value) &&
    Object.keys(value).every((key) => key === 'x' || key === 'y') &&
    finite(value.x) &&
    finite(value.y);
  const selection = (value: unknown) =>
    object(value) &&
    Object.keys(value).every((key) => key === 'nodes' || key === 'edges') &&
    ['nodes', 'edges'].every(
      (key) => Array.isArray(value[key]) && value[key].length <= 1000 && value[key].every(safeId),
    );
  const connection = (value: unknown, withId = false) =>
    object(value) &&
    Object.keys(value).every((key) =>
      ['source', 'sourcePort', 'target', 'targetPort', ...(withId ? ['id'] : [])].includes(key),
    ) &&
    ['source', 'sourcePort', 'target', 'targetPort'].every((key) => safeId(value[key])) &&
    (!withId || value.id === undefined || safeId(value.id));
  input.forEach((entry, index) => {
    const path = `operations.${index}`;
    if (!object(entry) || typeof entry.type !== 'string' || !Object.hasOwn(allowed, entry.type)) {
      issue(path, 'Unsupported graph operation.');
      return;
    }
    for (const key of Object.keys(entry))
      if (!allowed[entry.type]!.includes(key)) issue(`${path}.${key}`, 'Unknown operation field.');
    for (const key of ['nodeId', 'fieldId', 'nodeType', 'edgeId'])
      if (allowed[entry.type]!.includes(key) && !safeId(entry[key]))
        issue(`${path}.${key}`, 'Supply a valid ID.');
    if (entry.id !== undefined && !safeId(entry.id)) issue(`${path}.id`, 'Supply a valid ID.');
    if (entry.position !== undefined && !position(entry.position))
      issue(`${path}.position`, 'Supply finite x/y.');
    if (
      entry.type === 'moveNodes' &&
      (!object(entry.positions) ||
        !Object.keys(entry.positions).length ||
        Object.keys(entry.positions).length > 1000 ||
        !Object.entries(entry.positions).every(([id, value]) => safeId(id) && position(value)))
    )
      issue(`${path}.positions`, 'Supply a bounded nonempty map of node IDs to finite x/y.');
    if (entry.type === 'setField' && !valueOk(entry.value))
      issue(`${path}.value`, 'Supply a supported bounded field value.');
    if(entry.type==='setCyclePolicy'&&typeof entry.allowCycles!=='boolean')issue(`${path}.allowCycles`,'Supply a boolean cycle-policy choice.');
    if (entry.type === 'setLabel' && !text(entry.label))
      issue(`${path}.label`, 'Supply a nonempty bounded label.');
    if (entry.type === 'collapse' && typeof entry.collapsed !== 'boolean')
      issue(`${path}.collapsed`, 'Supply boolean collapsed state.');
    if (entry.type === 'connect' && !connection(entry.edge, true))
      issue(`${path}.edge`, 'Supply exact named connection endpoints.');
    if (entry.type === 'reconnect' && !connection(entry.connection))
      issue(`${path}.connection`, 'Supply exact named connection endpoints.');
    if (['remove', 'duplicate'].includes(entry.type) && !selection(entry.selection))
      issue(`${path}.selection`, 'Supply bounded node and edge ID arrays.');
    if (entry.offset !== undefined && (!finite(entry.offset) || Math.abs(entry.offset) > 10000))
      issue(`${path}.offset`, 'Offset must be finite and at most 10000.');
    if (entry.type === 'replacePorts') {
      const probe = validateGraph({
        schema: 'vict.flow-graph@1',
        revision: 0,
        nodeTypes: [{ id: 'probe', label: 'Probe', fields: [], ports: entry.ports }],
        nodes: [],
        edges: [],
      });
      if (!probe.ok) issue(`${path}.ports`, 'Supply valid uniquely named typed ports.');
      if (
        entry.removeInvalidConnections !== undefined &&
        typeof entry.removeInvalidConnections !== 'boolean'
      )
        issue(`${path}.removeInvalidConnections`, 'Supply a boolean reconciliation choice.');
    }
    if (
      entry.type === 'paste' &&
      (typeof entry.clipboard !== 'string' || entry.clipboard.length > 1_000_000)
    )
      issue(`${path}.clipboard`, 'Supply bounded portable selection JSON.');
  });
  input.forEach((entry, index) => {
    if (object(entry) && entry.type === 'setIcon' && entry.icon !== null) {
      const checked = validateGraph({
        schema: 'vict.flow-graph@1',
        revision: 0,
        nodeTypes: [{ id: 'probe', label: 'Probe', fields: [], ports: [], icon: entry.icon }],
        nodes: [],
        edges: [],
      });
      if (entry.icon === undefined || !checked.ok)
        issue(
          `operations.${index}.icon`,
          'Supply a stable icon identity or null to restore the family icon.',
        );
    }
    if (!object(entry) || entry.type !== 'defineNodeType') return;
    const probe = validateGraph({
      schema: 'vict.flow-graph@1',
      revision: 0,
      nodeTypes: [entry.definition],
      nodes: [],
      edges: [],
    });
    if (!probe.ok)
      issue(`operations.${index}.definition`, 'Supply one complete valid node family definition.');
    if (entry.replace !== undefined && typeof entry.replace !== 'boolean')
      issue(`operations.${index}.replace`, 'Supply boolean replacement intent.');
  });
  return issues.length
    ? { ok: false, issues }
    : { ok: true, operations: clone(input as GraphOperation[]) };
}

/** Studio/agent seam: validated operations produce one new serialized snapshot at an expected graph revision. */
export type GraphPatchResult =
  { ok: true; graph: GraphDocument; source: string } | { ok: false; issues: GraphIssue[] };
export function applyGraphPatch(
  source: string,
  input: unknown,
  expectedRevision: number,
): GraphPatchResult {
  const parsed = parseGraph(source);
  if (!parsed.ok) return parsed;
  const operations = parseGraphOperations(input);
  if (!operations.ok) return operations;
  const result = applyGraphOperations(parsed.graph, operations.operations, expectedRevision);
  return result.ok ? { ...result, source: serializeGraph(result.graph) } : result;
}
const nextId = (prefix: string, ids: string[]) => {
  const set = new Set(ids);
  let counter = 1;
  while (set.has(`${prefix}-${counter}`)) counter++;
  return `${prefix}-${counter}`;
};
export function copyGraphSelection(graph: GraphDocument, selection: GraphSelection): string {
  const nodes = graph.nodes.filter((node) => selection.nodes.includes(node.id)),
    ids = new Set(nodes.map((node) => node.id));
  return JSON.stringify({
    schema: 'vict.flow-clipboard@1',
    nodeTypes: graph.nodeTypes.filter((type) => nodes.some((node) => node.type === type.id)),
    nodes,
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  });
}
export function applyGraphOperations(
  graph: GraphDocument,
  operations: readonly GraphOperation[],
  expectedRevision = graph.revision,
): GraphResult {
  const validatedOperations = parseGraphOperations(operations);
  if (!validatedOperations.ok) return validatedOperations;
  if (expectedRevision !== graph.revision)
    return {
      ok: false,
      issues: [
        {
          code: 'GRAPH_STALE',
          path: 'revision',
          message: 'Graph changed; read the current revision before retrying.',
        },
      ],
    };
  const initial = validateGraph(graph);
  if (!initial.ok) return initial;
  const next = initial.graph;
  const error = (message: string): never => {
    throw new GraphValidationError([{ code: 'GRAPH_OPERATION', path: 'operations', message }]);
  };
  try {
    for (const operation of operations) {
      const requireNode = (id: string) =>
        next.nodes.find((node) => node.id === id) ?? error(`Unknown node ${id}.`);
      switch (operation.type) {
        case 'setCyclePolicy':next.allowCycles=operation.allowCycles;break;
        case 'defineNodeType': {
          const index = next.nodeTypes.findIndex((type) => type.id === operation.definition.id);
          if (index >= 0 && !operation.replace)
            error('Node family exists; explicit replacement is required.');
          if (index >= 0) next.nodeTypes[index] = clone(operation.definition);
          else next.nodeTypes.push(clone(operation.definition));
          break;
        }
        case 'removeNodeType': {
          if (next.nodes.some((node) => node.type === operation.nodeType))
            error('Remove or replace instances before removing their node family.');
          if (!next.nodeTypes.some((type) => type.id === operation.nodeType))
            error('Unknown node family.');
          next.nodeTypes = next.nodeTypes.filter((type) => type.id !== operation.nodeType);
          break;
        }
        case 'addNode': {
          const family =
            next.nodeTypes.find((type) => type.id === operation.nodeType) ??
            error('Unknown node family.');
          const id =
            operation.id ??
            nextId(
              family.id,
              next.nodes.map((node) => node.id),
            );
          next.nodes.push({
            id,
            type: family.id,
            label: family.label,
            position: operation.position ?? { x: 40, y: 40 },
            values: {},
          });
          break;
        }
        case 'moveNodes':
          for (const [id, position] of Object.entries(operation.positions))
            requireNode(id).position = clone(position);
          break;
        case 'setField': {
          const node = requireNode(operation.nodeId),
            field =
              graphType(next, node).fields.find((item) => item.id === operation.fieldId) ??
              error('Unknown field.');
          if (field.disabled) error('Field is disabled.');
          node.values[field.id] = clone(operation.value);
          break;
        }
        case 'unsetField':delete requireNode(operation.nodeId).values[operation.fieldId];break;
        case 'setLabel':
          requireNode(operation.nodeId).label = operation.label;
          break;
        case 'setIcon': {
          const node = requireNode(operation.nodeId);
          if (operation.icon === null) delete node.icon;
          else node.icon = clone(operation.icon);
          break;
        }
        case 'collapse':
          requireNode(operation.nodeId).collapsed = operation.collapsed;
          break;
        case 'connect':
          next.edges.push({
            ...operation.edge,
            id:
              operation.edge.id ??
              nextId(
                'edge',
                next.edges.map((edge) => edge.id),
              ),
          });
          break;
        case 'reconnect': {
          const index = next.edges.findIndex((edge) => edge.id === operation.edgeId);
          if (index < 0) error('Unknown edge.');
          next.edges[index] = { ...operation.connection, id: operation.edgeId };
          break;
        }
        case 'remove': {
          const ids = new Set(operation.selection.nodes);
          for (const id of ids) requireNode(id);
          next.nodes = next.nodes.filter((node) => !ids.has(node.id));
          next.edges = next.edges.filter(
            (edge) =>
              !ids.has(edge.source) &&
              !ids.has(edge.target) &&
              !operation.selection.edges.includes(edge.id),
          );
          break;
        }
        case 'replacePorts': {
          const node = requireNode(operation.nodeId);
          node.ports = clone(operation.ports);
          if (operation.removeInvalidConnections)
            next.edges = next.edges.filter(
              (edge) =>
                !(edge.source === node.id || edge.target === node.id) ||
                !connectionIssue(
                  { ...next, edges: next.edges.filter((item) => item.id !== edge.id) },
                  edge,
                ),
            );
          break;
        }
        case 'duplicate':
        case 'paste': {
          const source =
            operation.type === 'duplicate'
              ? copyGraphSelection(next, operation.selection)
              : operation.clipboard;
          if (source.length > 1_000_000) error('Clipboard exceeds the graph budget.');
          let clipboard: unknown;
          try {
            clipboard = JSON.parse(source);
          } catch {
            error('Clipboard is not valid JSON.');
          }
          if (!object(clipboard) || clipboard.schema !== 'vict.flow-clipboard@1')
            error('Unsupported graph clipboard.');
          const data = clipboard as unknown as {
            nodeTypes: GraphNodeType[];
            nodes: GraphNode[];
            edges: GraphEdge[];
          };
          const checked = validateGraph({
            schema: 'vict.flow-graph@1',
            revision: 0,
            nodeTypes: data.nodeTypes,
            nodes: data.nodes,
            edges: data.edges,
          });
          if (!checked.ok) throw new GraphValidationError(checked.issues);
          for (const family of checked.graph.nodeTypes) {
            const existing = next.nodeTypes.find((type) => type.id === family.id);
            if (existing && JSON.stringify(existing) !== JSON.stringify(family))
              error('Clipboard node family conflicts with the installed definition.');
            if (!existing) next.nodeTypes.push(family);
          }
          const ids = new Map<string, string>();
          for (const node of checked.graph.nodes) {
            const id = nextId(
              node.type,
              next.nodes.map((item) => item.id),
            );
            ids.set(node.id, id);
            next.nodes.push({
              ...node,
              id,
              position: {
                x: node.position.x + (operation.offset ?? 32),
                y: node.position.y + (operation.offset ?? 32),
              },
            });
          }
          for (const edge of checked.graph.edges)
            next.edges.push({
              ...edge,
              id: nextId(
                'edge',
                next.edges.map((item) => item.id),
              ),
              source: ids.get(edge.source)!,
              target: ids.get(edge.target)!,
            });
          break;
        }
      }
    }
    next.revision++;
    return validateGraph(next);
  } catch (error) {
    return {
      ok: false,
      issues:
        error instanceof GraphValidationError
          ? error.issues
          : [{ code: 'GRAPH_OPERATION', path: 'operations', message: 'Invalid graph operation.' }],
    };
  }
}

/** One transaction per gesture. Host may supply additional domain validation without enabling effects. */
export class GraphSession {
  private current: GraphDocument;
  private past: GraphDocument[] = [];
  private future: GraphDocument[] = [];
  constructor(
    graph: GraphDocument,
    private readonly options: {
      readOnly?: boolean;
      maxHistory?: number;
      validate?: (graph: GraphDocument) => readonly GraphIssue[];
    } = {},
  ) {
    const checked = validateGraph(graph);
    if (!checked.ok) throw new GraphValidationError(checked.issues);
    this.current = checked.graph;
  }
  get graph() {
    return clone(this.current);
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  setReadOnly(readOnly: boolean): void {
    this.options.readOnly = readOnly;
  }
  private domainIssues(graph: GraphDocument): readonly GraphIssue[] {
    try {
      return this.options.validate?.(clone(graph)) ?? [];
    } catch {
      return [
        {
          code: 'GRAPH_DOMAIN_VALIDATION',
          path: 'graph',
          message: 'Application graph validation is unavailable; existing graph retained.',
        },
      ];
    }
  }
  apply(
    operations: readonly GraphOperation[],
    expectedRevision = this.current.revision,
  ): GraphResult {
    if (this.options.readOnly)
      return {
        ok: false,
        issues: [{ code: 'GRAPH_READ_ONLY', path: 'graph', message: 'This editor is read-only.' }],
      };
    const result = applyGraphOperations(this.current, operations, expectedRevision);
    if (!result.ok) return result;
    const issues = this.domainIssues(result.graph);
    if (issues?.length) return { ok: false, issues: [...issues] };
    this.past.push(this.current);
    if (this.past.length > (this.options.maxHistory ?? 100)) this.past.shift();
    this.future = [];
    this.current = result.graph;
    return { ok: true, graph: this.graph };
  }
  replace(graph: GraphDocument): GraphResult {
    const result = validateGraph(graph);
    if (!result.ok) return result;
    const issues = this.domainIssues(result.graph);
    if (issues?.length) return { ok: false, issues: [...issues] };
    this.current = result.graph;
    this.past = [];
    this.future = [];
    return { ok: true, graph: this.graph };
  }
  undo(): GraphResult {
    return this.travel(this.past, this.future);
  }
  redo(): GraphResult {
    return this.travel(this.future, this.past);
  }
  private travel(from: GraphDocument[], to: GraphDocument[]): GraphResult {
    if (this.options.readOnly)
      return {
        ok: false,
        issues: [{ code: 'GRAPH_READ_ONLY', path: 'graph', message: 'This editor is read-only.' }],
      };
    const next = from.at(-1);
    if (!next)
      return {
        ok: false,
        issues: [
          {
            code: 'GRAPH_HISTORY_EMPTY',
            path: 'history',
            message: 'No history in this direction.',
          },
        ],
      };
    const graph = { ...clone(next), revision: this.current.revision + 1 };
    const checked = validateGraph(graph);
    if (!checked.ok) return checked;
    const issues = this.domainIssues(graph);
    if (issues?.length) return { ok: false, issues: [...issues] };
    from.pop();
    to.push(this.current);
    this.current = graph;
    return { ok: true, graph: this.graph };
  }
}
