import { isUiValueType, type UiValueType } from '@victframework/ui';
import type { GraphFieldKind, GraphOperation } from './model.js';
import type { GraphOperationV2 } from './model-v2.js';

/** Public JSON structural contracts. Semantic cross-references use model validation. */
export interface GraphJsonSchema {
  readonly $schema?: string; readonly $id?: string; readonly $comment?: string;
  readonly $ref?: string; readonly $defs?: Readonly<Record<string, GraphJsonSchema>>;
  readonly type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  readonly const?: unknown; readonly enum?: readonly unknown[];
  readonly required?: readonly string[]; readonly properties?: Readonly<Record<string, GraphJsonSchema>>;
  readonly additionalProperties?: boolean | GraphJsonSchema; readonly propertyNames?: GraphJsonSchema;
  readonly items?: GraphJsonSchema; readonly oneOf?: readonly GraphJsonSchema[]; readonly anyOf?: readonly GraphJsonSchema[];
  readonly minLength?: number; readonly maxLength?: number; readonly pattern?: string;
  readonly minimum?: number; readonly maximum?: number; readonly exclusiveMinimum?: number;
  readonly minItems?: number; readonly maxItems?: number; readonly minProperties?: number; readonly maxProperties?: number;
  readonly not?: GraphJsonSchema;
}
const record = (properties: Record<string, GraphJsonSchema>, required = Object.keys(properties)): GraphJsonSchema => ({ type: 'object', properties, required, additionalProperties: false });
const list = (items: GraphJsonSchema, maximum?: number, minimum?: number): GraphJsonSchema => ({ type: 'array', items, ...(maximum === undefined ? {} : { maxItems: maximum }), ...(minimum === undefined ? {} : { minItems: minimum }) });
const number: GraphJsonSchema = { type: 'number' }, boolean: GraphJsonSchema = { type: 'boolean' };
const text: GraphJsonSchema = { type: 'string', minLength: 1, maxLength: 200 };
const id: GraphJsonSchema = { ...text, not: { enum: ['__proto__', 'prototype', 'constructor'] } };
const key: GraphJsonSchema = { ...id, pattern: '^[A-Za-z_][A-Za-z0-9_-]*$' };
const revision: GraphJsonSchema = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const position = record({ x: number, y: number });
const port = record({ id, label: text, direction: { enum: ['input', 'output'] }, type: text, maxConnections: { type: 'integer', minimum: 1 } }, ['id', 'label', 'direction', 'type']);
const ports = list(port, 128);
const edge = record({ id, source: id, sourcePort: id, target: id, targetPort: id });
const connection = record({ source: id, sourcePort: id, target: id, targetPort: id });
const newConnection = record({ id, ...connection.properties }, ['source', 'sourcePort', 'target', 'targetPort']);
const selection = record({ nodes: list(id, 1000), edges: list(id, 1000) });
const offset: GraphJsonSchema = { type: 'number', minimum: -10000, maximum: 10000 };
const uiValues: Record<UiValueType, GraphJsonSchema> = {
  string: { type: 'string' }, number, boolean,
  stringList: list({ type: 'string' }), numberList: list(number),
  isoDate: { type: 'string', $comment: 'Empty string or valid Gregorian YYYY-MM-DD, checked by canonical isUiValueOfType.' },
  isoTime: { type: 'string', $comment: 'Empty string or valid HH:MM[:SS], checked by canonical isUiValueOfType.' },
};
const valueTypes = Object.keys(uiValues).filter(isUiValueType);
const uiValue: GraphJsonSchema = { anyOf: [uiValues.string, number, boolean, uiValues.stringList, uiValues.numberList] };
const legacyValue: GraphJsonSchema = { anyOf: [{ type: 'string', maxLength: 10000 }, number, boolean, list({ type: 'string', maxLength: 10000 }, 500)] };
export const legacyParameterValueTypes = Object.freeze({
  text: 'string', textarea: 'string', number: 'number', slider: 'number', select: 'string', toggle: 'boolean', list: 'stringList', button: 'number', preview: 'string', image: 'string', video: 'string', icon: 'string', vector: 'string',
} satisfies Record<GraphFieldKind, UiValueType>);
const icon = record({ pack: text, name: text, revision: text, source: { type: 'string', maxLength: 10000 }, data: { type: 'string', maxLength: 10000 } }, ['pack', 'name', 'revision']);
const media = record(Object.fromEntries(['alt', 'poster', 'captions', 'language', 'pack', 'revision'].map(name => [name, { type: 'string', maxLength: 10000 } as GraphJsonSchema]).concat([['decorative', boolean]])), []);
const field = record({ id, label: text, kind: { enum: Object.keys(legacyParameterValueTypes) }, default: legacyValue, min: number, max: number, step: { type: 'number', exclusiveMinimum: 0 }, options: list(text, 200), advanced: boolean, disabled: boolean, media }, ['id', 'label', 'kind']);
const family1 = record({ id, label: text, fields: list(field, 128), ports, icon }, ['id', 'label', 'fields', 'ports']);
const family2 = record({ id, label: text, parameters: { type: 'object', propertyNames: key, maxProperties: 128, additionalProperties: { oneOf: valueTypes.map(type => record({ type: { const: type }, default: uiValues[type], label: text }, ['type', 'default'])) } }, ports });
const node1 = record({ id, type: id, label: text, position, values: { type: 'object', propertyNames: id, additionalProperties: legacyValue }, ports, collapsed: boolean, icon }, ['id', 'type', 'label', 'position', 'values']);
const node2 = record({ id, type: id, label: text, position, values: { type: 'object', propertyNames: key, additionalProperties: uiValue }, ports }, ['id', 'type', 'label', 'position', 'values']);
function documentSchema(version: 1 | 2): GraphJsonSchema {
  return { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `urn:vict:flow-graph:${version}`, $comment: `${version === 1 ? 'Retained v1 canonical shape; legacy validateGraph remains authoritative and is not tightened by this metadata. ' : ''}Structural shape only. Unique IDs, declared parameter types/defaults, topology, capacity and cycle policy are validated by the corresponding graph model. Total serialized graph budget: one million characters.`,
    ...record({ schema: { const: `vict.flow-graph@${version}` }, revision, nodeTypes: list(version === 1 ? family1 : family2, 128), nodes: list(version === 1 ? node1 : node2, 1000), edges: list(edge, 4000), allowCycles: boolean }, ['schema', 'revision', 'nodeTypes', 'nodes', 'edges']) };
}
const operation = (name: string, properties: Record<string, GraphJsonSchema>, required = Object.keys(properties)): GraphJsonSchema => record({ type: { const: name }, ...properties }, ['type', ...required]);
const sharedOperations = (family: GraphJsonSchema) => ({
  setCyclePolicy: operation('setCyclePolicy', { allowCycles: boolean }),
  defineNodeType: operation('defineNodeType', { definition: family, replace: boolean }, ['definition']),
  removeNodeType: operation('removeNodeType', { nodeType: id }),
  addNode: operation('addNode', { nodeType: id, id, position }, ['nodeType']),
  moveNodes: operation('moveNodes', { positions: { type: 'object', minProperties: 1, maxProperties: 1000, propertyNames: id, additionalProperties: position } }),
  setLabel: operation('setLabel', { nodeId: id, label: text }),
  connect: operation('connect', { edge: newConnection }),
  reconnect: operation('reconnect', { edgeId: id, connection }),
  remove: operation('remove', { selection }),
  duplicate: operation('duplicate', { selection, offset }, ['selection']),
  replacePorts: operation('replacePorts', { nodeId: id, ports, removeInvalidConnections: boolean }, ['nodeId', 'ports']),
  paste: operation('paste', { clipboard: { type: 'string', maxLength: 1_000_000 }, offset }, ['clipboard']),
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export const graphDocumentSchemaV1 = freeze(documentSchema(1));
export const graphDocumentSchemaV2 = freeze(documentSchema(2));
export const graphClipboardSchemaV1 = freeze(record({ schema: { const: 'vict.flow-clipboard@1' }, nodeTypes: list(family1, 128), nodes: list(node1, 1000), edges: list(edge, 4000) }));
export const graphClipboardSchemaV2 = freeze(record({ schema: { const: 'vict.flow-clipboard@2' }, nodeTypes: list(family2, 128), nodes: list(node2, 1000), edges: list(edge, 4000), allowCycles: boolean }, ['schema', 'nodeTypes', 'nodes', 'edges']));
export const graphOperationSchemasV1 = freeze({ ...sharedOperations(family1),
  setField: operation('setField', { nodeId: id, fieldId: id, value: legacyValue }),
  unsetField: operation('unsetField', { nodeId: id, fieldId: id }),
  setIcon: operation('setIcon', { nodeId: id, icon: { anyOf: [icon, { type: 'null' }] } }),
  collapse: operation('collapse', { nodeId: id, collapsed: boolean }),
} satisfies Record<GraphOperation['type'], GraphJsonSchema>);
export const graphOperationSchemasV2 = freeze({ ...sharedOperations(family2),
  setParameter: operation('setParameter', { nodeId: id, key, value: uiValue }),
  unsetParameter: operation('unsetParameter', { nodeId: id, key }),
} satisfies Record<GraphOperationV2['type'], GraphJsonSchema>);
export const graphOperationsSchemaV1 = freeze({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:vict:flow-operations:1', $comment: 'Retained v1 canonical operation shape. Legacy parseGraphOperations and semantic graph validation remain authoritative; metadata does not tighten historical admission.', ...list({ oneOf: Object.values(graphOperationSchemasV1) }, 50, 1) });
export const graphOperationsSchemaV2 = freeze({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:vict:flow-operations:2', ...list({ oneOf: Object.values(graphOperationSchemasV2) }, 50, 1) });
export const graphDataExamples = freeze({
  v1: { schema: 'vict.flow-graph@1', revision: 0, nodeTypes: [], nodes: [], edges: [] },
  v2: { schema: 'vict.flow-graph@2', revision: 0, nodeTypes: [], nodes: [], edges: [] },
  typedParameters: { schema: 'vict.flow-graph@2', revision: 0,
    nodeTypes: [{ id: 'project-type', label: 'Project-defined parameters', parameters: { title: { type: 'string', default: '' }, weights: { type: 'numberList', default: [0.25, 0.75] }, tags: { type: 'stringList', default: [] }, due: { type: 'isoDate', default: '' }, time: { type: 'isoTime', default: '' }, enabled: { type: 'boolean', default: false }, count: { type: 'number', default: 0 } }, ports: [] }],
    nodes: [{ id: 'project-node', type: 'project-type', label: 'Project node', position: { x: 0, y: 0 }, values: {} }], edges: [] },
});

/** The finite JSON-schema subset above is also the v2 runtime shape validator. */
export function graphStructuralProblems(schema: GraphJsonSchema, value: unknown, path = 'graph'): { code: string; path: string; message: string }[] {
  const walk = (rule: GraphJsonSchema, item: unknown, at: string): string[] => {
    if (rule.$ref) { const name = rule.$ref.replace(/^#\/\$defs\//, ''); const found = schema.$defs?.[name]; return found ? walk(found, item, at) : [`${at}: Unknown structural schema reference.`]; }
    if (rule.oneOf || rule.anyOf) {
      const variants = rule.oneOf ?? rule.anyOf!;
      const discriminated = item && typeof item === 'object' && !Array.isArray(item) ? variants.filter(candidate => candidate.properties?.type?.const !== undefined && candidate.properties.type.const === (item as { type?: unknown }).type) : [];
      if (discriminated.length === 1) return walk(discriminated[0]!, item, at);
      const results = variants.map(candidate => walk(candidate, item, at));
      const matches = results.filter(result => !result.length).length;
      if (rule.oneOf ? matches === 1 : matches > 0) return [];
      return [`${at}: Expected ${rule.oneOf ? 'exactly one' : 'one'} declared structural shape.`];
    }
    if (rule.not && !walk(rule.not, item, at).length) return [`${at}: Reserved value.`];
    if (Object.hasOwn(rule, 'const') && item !== rule.const) return [`${at}: Expected ${JSON.stringify(rule.const)}.`];
    if (rule.enum && !rule.enum.includes(item)) return [`${at}: Expected one of ${rule.enum.join(', ')}.`];
    if (rule.type) {
      const valid = rule.type === 'null' ? item === null : rule.type === 'array' ? Array.isArray(item) : rule.type === 'object' ? item !== null && typeof item === 'object' && !Array.isArray(item) : rule.type === 'integer' ? typeof item === 'number' && Number.isFinite(item) && Number.isInteger(item) : rule.type === 'number' ? typeof item === 'number' && Number.isFinite(item) : typeof item === rule.type;
      if (!valid) return [`${at}: Expected ${rule.type}.`];
    }
    const problems: string[] = [];
    if (typeof item === 'string') {
      if (rule.minLength !== undefined && item.length < rule.minLength) problems.push(`${at}: Text is too short.`);
      if (rule.maxLength !== undefined && item.length > rule.maxLength) problems.push(`${at}: Text is too long.`);
      if (rule.pattern && !new RegExp(rule.pattern).test(item)) problems.push(`${at}: Text does not match the declared pattern.`);
    }
    if (typeof item === 'number') {
      if (rule.minimum !== undefined && item < rule.minimum || rule.maximum !== undefined && item > rule.maximum || rule.exclusiveMinimum !== undefined && item <= rule.exclusiveMinimum) problems.push(`${at}: Number is outside the declared range.`);
    }
    if (Array.isArray(item)) {
      if (rule.minItems !== undefined && item.length < rule.minItems || rule.maxItems !== undefined && item.length > rule.maxItems) problems.push(`${at}: Array length is outside the declared range.`);
      if (rule.items) for (let index = 0; index < item.length && problems.length < 30; index++) problems.push(...walk(rule.items, item[index], `${at}.${index}`));
    } else if (item !== null && typeof item === 'object') {
      const values = item as Record<string, unknown>, names = Object.keys(values);
      if (rule.minProperties !== undefined && names.length < rule.minProperties || rule.maxProperties !== undefined && names.length > rule.maxProperties) problems.push(`${at}: Property count is outside the declared range.`);
      for (const name of rule.required ?? []) if (!Object.hasOwn(values, name)) problems.push(`${at}.${name}: Required property.`);
      for (const name of names) {
        if (problems.length >= 30) break;
        if (rule.propertyNames) problems.push(...walk(rule.propertyNames, name, `${at}.${name}`));
        const child = rule.properties?.[name];
        if (child) problems.push(...walk(child, values[name], `${at}.${name}`));
        else if (rule.additionalProperties === false) problems.push(`${at}.${name}: Unknown property.`);
        else if (rule.additionalProperties && typeof rule.additionalProperties === 'object') problems.push(...walk(rule.additionalProperties, values[name], `${at}.${name}`));
      }
    }
    return problems.slice(0, 30);
  };
  return walk(schema, value, path).map(message => ({ code: 'GRAPH_STRUCTURE', path: message.slice(0, message.indexOf(':')), message }));
}
