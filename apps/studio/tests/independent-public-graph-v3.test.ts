import { expect, it } from 'vitest';
import { validateGraphV3, parseGraphOperationsV3, applyGraphOperationsV3, parseGraphV2, parseGraph, serializeGraphV3, type GraphDocumentV3 } from '@victframework/ui-flow-svelte';

function graph(): GraphDocumentV3 {
  return { schema: 'vict.flow-graph@3', revision: 0, nodeTypes: [], nodes: [], edges: [] };
}

it('independent: JSON hooks cannot substitute appearance data after strict admission', () => {
  let hooks = 0;
  const substituted = new Proxy(graph(), { get(target, key, receiver) {
    if (key === 'toJSON') return () => { hooks++; return { ...graph(), edgeDefaults: { color: 'url(https://attacker.invalid/paint.svg#x)' } }; };
    return Reflect.get(target, key, receiver);
  } });
  const admitted = validateGraphV3(substituted);
  expect(admitted.ok).toBe(false);
  expect(hooks).toBe(0);
});

it('independent: operation JSON hooks cannot replace a finite admitted appearance', () => {
  const operation = new Proxy({ type: 'setEdgeDefaults', appearance: { width: 2 } }, { get(target, key, receiver) {
    if (key === 'toJSON') return () => ({ type: 'setEdgeDefaults', appearance: { color: 'url(https://attacker.invalid/paint)' } });
    return Reflect.get(target, key, receiver);
  } });
  expect(parseGraphOperationsV3([operation]).ok).toBe(false);
});

it('independent: strict legacy parsers retain old schemas and refuse appearance extension', () => {
  const value = graph();
  expect(parseGraphV2(JSON.stringify(value)).ok).toBe(false);
  expect(parseGraph(JSON.stringify(value)).ok).toBe(false);
  expect(parseGraphV2(JSON.stringify({ ...value, schema: 'vict.flow-graph@2', edgeDefaults: {} })).ok).toBe(false);
  expect(parseGraphV2(JSON.stringify({ ...value, schema: 'vict.flow-graph@2' })).ok).toBe(true);
});

it('independent: failed appearance batches preserve the original source and finite width grammar', () => {
  const value = graph(), before = serializeGraphV3(value);
  expect(applyGraphOperationsV3(value, [{ type: 'setEdgeDefaults', appearance: { width: 2 } }, { type: 'setEdgeAppearance', edgeId: 'missing', appearance: {} }]).ok).toBe(false);
  expect(serializeGraphV3(value)).toBe(before);
  for (const width of [0, -1, Number.NaN, Infinity, -Infinity])
    expect(parseGraphOperationsV3([{ type: 'setEdgeDefaults', appearance: { width } }]).ok).toBe(false);
  for (const width of [Number.MIN_VALUE, Number.MAX_VALUE])
    expect(parseGraphOperationsV3([{ type: 'setEdgeDefaults', appearance: { width } }]).ok).toBe(true);
});
