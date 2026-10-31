import {isUiValueOfType,copyUiValue} from '@victframework/ui';
/** Internal shared typed reducer. Callers validate versioned input and final graph atomically. */
import {GraphValidationErrorV2,copyGraphSelectionV2,graphTypeV2,connectionIssueV2,emptyGraphV2,validateGraphV2,type GraphDocumentV2,type GraphOperationV2,type GraphResultV2,type GraphNodeTypeV2,type GraphNodeV2} from './model-v2.js';
import {graphStructuralProblems,graphClipboardSchemaV2} from './graph-schemas.js';
import type {GraphEdge,GraphIssue,GraphSelection} from './model.js';
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const nextId=(prefix:string,ids:readonly string[])=>{const set=new Set(ids);let counter=1;while(set.has(`${prefix}-${counter}`))counter++;return `${prefix}-${counter}`;};
const issue=(code:string,path:string,message:string):GraphIssue=>({code,path,message});
export interface TypedReducerHooks {
 operation?(graph:GraphDocumentV2,operation:unknown):boolean;
 copy?(graph:GraphDocumentV2,selection:GraphSelection):string;
 clipboard?(source:string,purpose:'duplicate'|'paste'):GraphResultV2;
}
export function reduceTypedGraphOperations(graph:GraphDocumentV2,operations:readonly GraphOperationV2[],hooks:TypedReducerHooks={}):GraphResultV2 {
  const next = graph;
  const fail = (message: string): never => { throw new GraphValidationErrorV2([issue('GRAPH_OPERATION', 'operations', message)]); };
  const node = (id: string) => next.nodes.find(item => item.id === id) ?? fail(`Unknown node ${id}.`);
  try {
    for (const operation of operations) {
      if (hooks.operation?.(next, operation)) continue;
      switch (operation.type) {
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
        const source = operation.type === 'duplicate' ? (hooks.copy ?? copyGraphSelectionV2)(next, operation.selection) : operation.clipboard;
        let checked: GraphResultV2;
        if (hooks.clipboard) checked = hooks.clipboard(source, operation.type);
        else {
        let clipboard: unknown; try { clipboard = JSON.parse(source); } catch { fail('Clipboard must be valid JSON.'); }
        const problems = graphStructuralProblems(graphClipboardSchemaV2, clipboard, 'clipboard'); if (problems.length) throw new GraphValidationErrorV2(problems);
        const data = clipboard as { nodeTypes: GraphNodeTypeV2[]; nodes: GraphNodeV2[]; edges: GraphEdge[]; allowCycles?: boolean };
        checked = validateGraphV2({ ...emptyGraphV2(), nodeTypes: data.nodeTypes, nodes: data.nodes, edges: data.edges, ...(data.allowCycles === undefined ? {} : { allowCycles: data.allowCycles }) });
        }
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
    }
    next.revision++; return {ok:true,graph:next};
  } catch (error) { return { ok: false, issues: error instanceof GraphValidationErrorV2 ? error.issues : [issue('GRAPH_OPERATION', 'operations', 'Invalid graph operation.')] }; }
}