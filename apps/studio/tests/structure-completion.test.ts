import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalUiDocument, type UiDocument, type UiNode } from '@victframework/ui';
import { newScreen } from '../src/lib/designer/application.js';
import { compositionName, compositionNames } from '@victframework/ui-editor';
import { projectStructure, filterStructure, structureId, structureFacts } from '../src/lib/designer/structure.js';
import { layoutGraph, LayoutFence, nodeSize, type LayoutEngine, type LayoutDirection } from '../../../packages/ui-flow-svelte/src/layout.js';
import type { Node, Edge } from '@xyflow/svelte';

function fixture(count: number): UiDocument {
  const base = newScreen(`Structure fixture ${count}`, `structure-${count}`);
  const nodes: Record<string, UiNode> = { screen: { id: 'screen', kind: 'element', tag: 'main', children: [] } };
  for (let index = 1; index < count; index++) {
    const id = `item-${index}`;
    const parent = index <= 8 ? 'screen' : `item-${Math.max(1, Math.floor((index - 1) / 8))}`;
    const owner = nodes[parent];
    if (owner?.kind === 'element') (owner.children as string[]).push(id);
    nodes[id] = { id, kind: 'element', tag: index < Math.ceil(count / 8) ? 'section' : 'div', attributes: { 'aria-label': `Group ${index}` }, children: [] };
  }
  return { ...base, nodes };
}
function overlaps(nodes: Node[]): number {
  let count = 0;
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const first = nodes[a]!; const second = nodes[b]!; const sa = nodeSize(first); const sb = nodeSize(second);
    if (first.position.x < second.position.x + sb.width && second.position.x < first.position.x + sa.width && first.position.y < second.position.y + sb.height && second.position.y < first.position.y + sa.height) count++;
  }
  return count;
}
describe('Structure completion: useful source projection', () => {
  it('starts with containment, exposes precise source facts and reads/writes on demand', () => {
    const base = fixture(12);
    const document: UiDocument = { ...base, nodes: { ...base.nodes, 'item-2': { id: 'item-2', kind: 'component', definitionId: 'vict.catalog.checkbox', props: { checked: { type: 'ref', path: 'state.accepted' } }, outputs: { checkedChange: { setState: { key: 'accepted' } } }, slots: {} } } };
    const digest = canonicalUiDocument(document).contentDigest;
    const graph = projectStructure(document);
    const overview = filterStructure(graph);
    expect(overview.nodes.every(node => node.data.kind === 'node')).toBe(true);
    expect(overview.edges.every(edge => edge.data?.kind === 'containment')).toBe(true);
    const checkbox = graph.nodes.find(node => node.data.sourceId === 'item-2')!;
    expect(checkbox.data.label).not.toContain('vict.catalog.');
    expect(checkbox.ariaLabel).toContain('source item-2');
    expect(structureFacts(document, checkbox)).toEqual(expect.arrayContaining([{ path: 'props.checked.path', value: 'state.accepted' }, { path: 'outputs.checkedChange.setState.key', value: 'accepted' }]));
    const related = filterStructure(graph, { bindings: true, focusId: structureId(document.id, 'state', 'accepted') });
    expect(related.nodes.some(node => node.id === checkbox.id)).toBe(true);
    expect(related.edges.map(edge => edge.data?.path)).toEqual(expect.arrayContaining(['/nodes/item-2/props/checked', '/nodes/item-2/outputs/checkedChange']));
    expect(canonicalUiDocument(document).contentDigest).toBe(digest);
  });
  it('search reveals collapsed descendants with their authored path and collapse preserves source', () => {
    const document = fixture(89); const graph = projectStructure(document);
    const group = structureId(document.id, 'node', 'item-1');
    const collapsed = new Set([group]);
    const overview = filterStructure(graph, { collapsed });
    expect(overview.nodes.length).toBeLessThan(filterStructure(graph).nodes.length);
    expect(overview.nodes.find(node => node.id === group)?.data.collapsedCount).toBeGreaterThan(0);
    const searched = filterStructure(graph, { collapsed, search: 'item-10' });
    expect(searched.nodes.some(node => node.data.sourceId === 'item-10')).toBe(true);
    expect(searched.nodes.some(node => node.data.sourceId === 'screen')).toBe(true);
  });
  it('rejects stale async layout results when source or geometry changes', async () => {
    const fence = new LayoutFence();
    const older = fence.issue(); const current = fence.issue();
    expect(fence.current(older)).toBe(false); expect(fence.current(current)).toBe(true);
    fence.cancel(); expect(fence.current(current)).toBe(false);
  });
});

it('compares real Dagre and ELK layouts at small, owner-sized and advertised-size fixtures', async () => {
  const results: object[] = [];
  for (const count of [12, 89, 500]) {
    const source = fixture(count); const before = canonicalUiDocument(source).contentDigest;
    const projectionStart = performance.now(); const graph = filterStructure(projectStructure(source)); const projectionMs = performance.now() - projectionStart;
    // Dimensions reflect actual custom-card width plus variable measured label heights.
    const nodes = graph.nodes.map((node, index) => ({ ...node, measured: { width: index % 7 === 0 ? 258 : 224, height: index % 5 === 0 ? 116 : 88 } }));
    for (const engine of ['dagre', 'elk'] as LayoutEngine[]) for (const direction of ['RIGHT', 'DOWN'] as LayoutDirection[]) {
      const started = performance.now(); const result = await layoutGraph(nodes, graph.edges, { engine, direction }); const elapsedMs = performance.now() - started;
      const overlapCount = overlaps(result.nodes);
      const maxX = Math.max(...result.nodes.map(node => node.position.x + nodeSize(node).width));
      const maxY = Math.max(...result.nodes.map(node => node.position.y + nodeSize(node).height));
      const routedEdges = result.edges.filter(edge => (edge.data as { route?: unknown })?.route).length;
      results.push({ fixtureNodes: count, requestedEngine: engine, actualEngine: result.engine, fallbackReason: result.reason, direction, projectionMs: +projectionMs.toFixed(2), elapsedMs: +elapsedMs.toFixed(2), overlapCount, width: maxX, height: maxY, routedEdges, edges: result.edges.length });
      expect(result.nodes.length).toBe(nodes.length); expect(overlapCount).toBe(0);
      expect(result.nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
      expect(result.nodes.every(node => node.sourcePosition === (direction === 'RIGHT' ? 'right' : 'bottom') && node.targetPosition === (direction === 'RIGHT' ? 'left' : 'top'))).toBe(true);
      if (result.engine === 'elk') expect(routedEdges).toBe(result.edges.length);
      if (count > 120) expect(result.engine).toBe('dagre');
      if (count === 12) {
        const again = await layoutGraph(nodes, graph.edges, { engine, direction });
        expect(again.nodes.map(node => node.position)).toEqual(result.nodes.map(node => node.position));
      }
    }
    expect(canonicalUiDocument(source).contentDigest).toBe(before);
  }
  const directory = fileURLToPath(new URL('../../../docs/studio/cycle-1-4/structure-semantics/', import.meta.url));
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/layout-comparison.json`, JSON.stringify({ kind: 'deterministic synthetic source fixture benchmark; variable measured sizes supplied; not a browser measurement', engines: { dagre: '1.1.5', elk: '0.11.0' }, results }, null, 2));
}, 120_000);

it('batch names preserve the shared composition naming semantics', () => {
  const source = fixture(12); const names = compositionNames(source);
  for (const id of Object.keys(source.nodes)) expect(names.get(id)).toBe(compositionName(source, id));
});
