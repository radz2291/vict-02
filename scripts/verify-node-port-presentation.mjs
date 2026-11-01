/** Read-only comparison of an actual agent edit; never writes application source. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const [beforePath, afterPath, reportPath] = process.argv.slice(2);
if (!beforePath || !afterPath || !reportPath) throw Error('Usage: node scripts/verify-node-port-presentation.mjs <before.json> <after.json> <report.json>');
const beforeBytes = readFileSync(beforePath), afterBytes = readFileSync(afterPath);
const before = JSON.parse(beforeBytes), after = JSON.parse(afterBytes);
const hash = value => createHash('sha256').update(value).digest('hex');
const errors = [], changes = [], directions = new Map();
const row = node => node?.kind === 'component' && node.definitionId === 'vict.flow.port-row';
const columns = node => node?.kind === 'component' && node.definitionId === 'vict.flow.port-columns';
const baselineRows = Object.values(before.nodes).filter(row);
const currentRows = Object.values(after.nodes).filter(row);
const currentColumns = Object.values(after.nodes).filter(columns);
const graphStrings = [];
function graphDirections(graph) {
  for (const family of graph.nodeTypes ?? []) for (const port of family.ports ?? []) {
    const set = directions.get(port.id) ?? new Set(); set.add(port.direction); directions.set(port.id, set);
  }
  for (const family of graph.nodeTypes ?? []) for (const parameter of Object.values(family.parameters ?? {})) {
    try { const nested = JSON.parse(parameter.default); if (/^vict\.flow-graph@\d+$/.test(nested?.schema ?? '')) graphDirections(nested); } catch { /* Ordinary parameter. */ }
  }
}
function visit(value, path = []) {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (/^vict\.flow-graph@\d+$/.test(parsed?.schema ?? '')) {
        let next = after;
        for (const key of path) next = next?.[key];
        graphStrings.push({ path, schema: parsed.schema, revision: parsed.revision, nodes: parsed.nodes.length, edges: parsed.edges.length, sha256: hash(value), unchanged: next === value });
        graphDirections(parsed);
        if (next !== value) errors.push(`Graph source changed at ${JSON.stringify(path)}`);
      }
    } catch { /* Ordinary text is not a graph. */ }
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
  }
}
visit(before);
if (!graphStrings.length) errors.push('No baseline graph found');
for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
  if (!['nodes', 'revision', 'styleSources'].includes(key) && !isDeepStrictEqual(before[key], after[key])) errors.push(`Document contract/theme/state changed: ${key}`);
}
for (const [id, style] of Object.entries(before.styleSources ?? {})) if (!isDeepStrictEqual(after.styleSources?.[id], style)) errors.push(`Existing style source changed: ${id}`);
function childLists(node) {
  if (['element', 'portal'].includes(node?.kind)) return [['children', node.children]];
  if (node?.kind === 'component') return Object.entries(node.slots ?? {}).map(([key, slot]) => [`slots/${key}`, slot.children ?? []]);
  if (node?.kind === 'conditional') return node.branches.map((branch, index) => [`branches/${index}`, branch.children]);
  if (node?.kind === 'repeat') return [['templateRoot', [node.templateRoot]]];
  if (node?.kind === 'slot') return [['fallback', node.fallback ?? []]];
  return [];
}
function parents(document) {
  const result = new Map();
  for (const node of Object.values(document.nodes)) for (const [slot, children] of childLists(node)) for (const [index, child] of children.entries()) {
    const list = result.get(child) ?? []; list.push({ id: node.id, slot, preceding: children.slice(0, index) }); result.set(child, list);
  }
  return result;
}
function skeleton(document, retained = new Set()) {
  const result = new Set(), visiting = new Set();
  const pure = id => {
    if (result.has(id)) return true;
    if (visiting.has(id)) return false;
    const node = document.nodes[id]; if (!node) return false;
    if (row(node)) { result.add(id); return true; }
    if (!(columns(node) || (node.kind === 'element' && node.tag === 'div')) || !layoutOnly(node)) return false;
    const children = childLists(node).flatMap(([, list]) => list);
    if (!children.length && !columns(node) && !retained.has(id)) return false;
    visiting.add(id); const answer = children.every(pure); visiting.delete(id);
    if (answer) result.add(id); return answer;
  };
  for (const id of Object.keys(document.nodes)) pure(id);
  return result;
}
function layoutOnly(node) {
  if (node.interactions?.length) return false;
  if (node.kind === 'component' && (Object.keys(node.props ?? {}).length || Object.keys(node.outputs ?? {}).length || Object.values(node.slots ?? {}).some(slot => slot.scope))) return false;
  if (node.kind === 'element' && Object.entries(node.attributes ?? {}).some(([name, value]) => /^on/i.test(name) || (value && typeof value === 'object'))) return false;
  return true;
}
const beforeSkeleton = skeleton(before), afterSkeleton = skeleton(after, beforeSkeleton);
const beforeParents = parents(before), parent = parents(after);
const anchor = (id, map, ignored) => {
  const seen = new Set();
  while (!seen.has(id)) {
    seen.add(id); const owners = map.get(id);
    if (!owners || owners.length !== 1) return undefined;
    const owner = owners[0]; if (!ignored.has(owner.id)) return { id: owner.id, slot: owner.slot, precedingOrdinary: owner.preceding.filter(child => !ignored.has(child)).length };
    id = owner.id;
  }
};
const rowShape = node => {
  const copy = structuredClone(node); delete copy.revision; delete copy.id;
  if (copy.props) { delete copy.props.showType; if (!Object.keys(copy.props).length) delete copy.props; }
  return copy;
};
const rowSourceIdentityMapping = [], usedRows = new Set();
function hasOutsideReference(id) {
  const copy = structuredClone(before); delete copy.nodes[id];
  for (const node of Object.values(copy.nodes)) for (const [, children] of childLists(node)) {
    for (let index = children.length - 1; index >= 0; index--) if (children[index] === id) children.splice(index, 1);
  }
  return JSON.stringify(copy).includes(id) || JSON.stringify(after).includes(id);
}
for (const original of baselineRows) {
  const candidates = currentRows.filter(candidate => !usedRows.has(candidate.id)
    && isDeepStrictEqual(rowShape(original), rowShape(candidate))
    && isDeepStrictEqual(anchor(original.id, beforeParents, beforeSkeleton), anchor(candidate.id, parent, afterSkeleton)));
  const next = row(after.nodes[original.id]) ? after.nodes[original.id] : candidates.length === 1 ? candidates[0] : undefined;
  if (!row(next) || next.revision !== '2') errors.push(`Port row not explicitly adopted as @2: ${original.id}`);
  if (!next) continue;
  usedRows.add(next.id);
  if (original.id !== next.id) {
    if (hasOutsideReference(original.id)) errors.push(`Replaced UI row has an outside or stale reference: ${original.id}`);
    rowSourceIdentityMapping.push({ before: original.id, after: next.id, semanticPort: next.props?.id?.value, owner: anchor(original.id, beforeParents, beforeSkeleton) });
  }
  if (!isDeepStrictEqual(rowShape(original), rowShape(next))) errors.push(`Port fields/bindings/styles changed: ${original.id}`);
  if (next.props?.showType && !isDeepStrictEqual(next.props.showType, { type: 'literal', value: false })) errors.push(`Port is not explicitly names-only: ${original.id}`);
  const owners = parent.get(next.id), owner = owners?.[0];
  if (owners?.length !== 1) errors.push(`Port has ambiguous ownership: ${original.id}`);
  if (!owner || !columns(after.nodes[owner.id]) || !['slots/inputs', 'slots/outputs'].includes(owner.slot)) errors.push(`Port lacks direct independent column: ${original.id}`);
  if (!isDeepStrictEqual(anchor(original.id, beforeParents, beforeSkeleton), anchor(next.id, parent, afterSkeleton))) errors.push(`Port moved to a different body/scope: ${original.id}`);
  const possible = directions.get(next.props?.id?.value);
  if (owner && possible?.size === 1 && owner.slot !== ([...possible][0] === 'input' ? 'slots/inputs' : 'slots/outputs')) errors.push(`Port is in the wrong side column: ${original.id}`);
}
if (currentRows.length !== baselineRows.length) errors.push('Semantic row source count changed');
if (!currentColumns.length) errors.push('No independent port-column composition');
for (const column of currentColumns) {
  if (column.revision !== '1') errors.push(`Unpinned port columns: ${column.id}`);
  if (!layoutOnly(column)) errors.push(`Port columns introduce behavior or scope: ${column.id}`);
  if ((parent.get(column.id)?.length ?? 0) !== 1) errors.push(`Ambiguous column owner: ${column.id}`);
  for (const [slot, children] of childLists(column)) {
    if (!['slots/inputs', 'slots/outputs'].includes(slot) || children.some(id => !row(after.nodes[id]))) errors.push(`Unexpected column content: ${column.id}/${slot}`);
  }
}
// Prune only proven port-only containers. Ordinary ordering, containment, scope,
// bindings and controls remain part of the exact comparison.
const shape = (node, ignored) => {
  if (!node || ignored.has(node.id)) return undefined;
  const copy = structuredClone(node);
  if (['element', 'portal'].includes(copy.kind)) copy.children = copy.children.filter(id => !ignored.has(id));
  if (copy.kind === 'component') for (const slot of Object.values(copy.slots ?? {})) slot.children = (slot.children ?? []).filter(id => !ignored.has(id));
  if (copy.kind === 'conditional') for (const branch of copy.branches) branch.children = branch.children.filter(id => !ignored.has(id));
  if (copy.kind === 'slot' && copy.fallback) copy.fallback = copy.fallback.filter(id => !ignored.has(id));
  return copy;
};
for (const [id, node] of Object.entries(before.nodes)) {
  if (beforeSkeleton.has(id)) continue;
  if (!isDeepStrictEqual(shape(node, beforeSkeleton), shape(after.nodes[id], afterSkeleton))) {
    changes.push({ id, beforeKind: node.kind, afterKind: after.nodes[id]?.kind, deleted: !after.nodes[id] });
    errors.push(`Existing non-port source/order/scope changed: ${id}`);
  }
}
for (const id of Object.keys(after.nodes)) if (!before.nodes[id] && !afterSkeleton.has(id)) errors.push(`New ordinary node outside port presentation: ${id}`);
for (const id of beforeSkeleton) if (after.nodes[id] && !afterSkeleton.has(id)) errors.push(`Port container acquired non-presentation behavior: ${id}`);
const report = { schema: 'vict.actual-port-presentation-comparison@3', status: errors.length ? 'FAIL' : 'PASS', before: { path: beforePath, sha256: hash(beforeBytes), revision: before.revision }, after: { path: afterPath, sha256: hash(afterBytes), revision: after.revision }, sourceRows: baselineRows.length, explicitRowsV2: currentRows.filter(node => node.revision === '2').length, independentColumnSources: currentColumns.length, rowSourceIdentityMapping, graphStrings, otherNonstructuralChanges: changes, addedStyleSources: Object.keys(after.styleSources ?? {}).filter(id => !before.styleSources?.[id]), errors, scope: 'Read-only actual-source preservation and explicit adoption checks, including non-port order/ownership and scope. Bijective UI leaf replacement permits only id/revision/showType changes, identical semantic ports/fields/body anchors and no outside references. Ambiguous semantic port directions and painted socket geometry remain separately reviewed.' };
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ status: report.status, sourceRows: report.sourceRows, columns: report.independentColumnSources, graphStrings: graphStrings.length, errors }));
if (errors.length) process.exitCode = 1;
