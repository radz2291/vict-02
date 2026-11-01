import { describe, expect, it } from 'vitest';
import { chooseLayoutEngine, layoutGraph } from '../src/layout.js';

describe('caller-owned layout choice', () => {
  it('preserves explicit and default engine choices across the former threshold', () => {
    for (const count of [0, 120, 121, 500, 10000]) {
      expect(chooseLayoutEngine(count, 'elk')).toEqual({ engine: 'elk' });
      expect(chooseLayoutEngine(count, 'dagre')).toEqual({ engine: 'dagre' });
      expect(chooseLayoutEngine(count)).toEqual({ engine: 'elk' });
    }
  });
  it('actually routes all 121 nodes with ELK without changing caller data', async () => {
    const nodes = Array.from({ length: 121 }, (_, i) => ({ id: String(i), data: {}, position: { x: 0, y: 0 }, width: 80, height: 40 }));
    const edges = nodes.slice(1).map((node, i) => ({ id: `e${i}`, source: String(i), target: node.id }));
    const before = JSON.stringify({ nodes, edges });
    const result = await layoutGraph(nodes, edges, { engine: 'elk' });
    expect(result.engine).toBe('elk');
    expect(result.nodes).toHaveLength(121);
    expect(result.edges).toHaveLength(120);
    expect(result.edges.every(edge => (edge.data?.route?.length ?? 0) >= 2)).toBe(true);
    expect(result.nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true);
    expect(JSON.stringify({ nodes, edges })).toBe(before);
  }, 30000);
});
