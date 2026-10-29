import { describe, expect, it } from 'vitest';
import { applyGraphCommand, parseGraphCommand, type GraphCommand } from '../src/editor/commands.js';
import { applyGraphOperations, serializeGraph } from '../src/editor/model.js';
import { graphFixture } from './editor-fixture.js';

const command = (): GraphCommand => ({
  schema: 'vict.flow-command@1', id: 'rename-a-1', expectedRevision: 3,
  operations: [{ type: 'setLabel', nodeId: 'a', label: 'Renamed' }],
});

describe('UI-neutral graph command contract', () => {
  it('validates the complete versioned serializable envelope and existing operation vocabulary', () => {
    expect(parseGraphCommand(JSON.stringify(command())).ok).toBe(true);
    for (const input of [
      null, 'invalid JSON', { ...command(), schema: 'vict.flow-command@2' },
      { ...command(), id: '' }, { ...command(), id: 'constructor' },
      { ...command(), expectedRevision: 1.5 }, { ...command(), expectedRevision: -1 },
      { ...command(), unknown: true }, { ...command(), operations: [] },
      { ...command(), operations: [{ type: 'executeProvider', provider: 'anything' }] },
      { ...command(), callback: () => undefined },
      { ...command(), operations: [{ type: 'setField', nodeId: 'a', fieldId: 'amount', value: Infinity }] },
    ]) expect(parseGraphCommand(input).ok, JSON.stringify(input)).toBe(false);
    const cyclic: Record<string, unknown> = { ...command() }; cyclic.self = cyclic;
    expect(parseGraphCommand(cyclic).ok).toBe(false);
    expect(parseGraphCommand(' '.repeat(1_000_001)).ok).toBe(false);
  });

  it('applies one atomic transaction without mutating source or caller operations', () => {
    const graph = graphFixture(), before = serializeGraph(graph), input = command();
    const result = applyGraphCommand(graph, input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.revision).toBe(4);
    expect(result.graph.nodes[0]!.label).toBe('Renamed');
    expect(result.graph.edges).toEqual(graph.edges);
    expect(serializeGraph(graph)).toBe(before);
    expect(result.receipt).toMatchObject({ id: input.id, outcome: 'applied', expectedRevision: 3, resultingRevision: 4 });
    expect(input).toEqual(command());
  });

  it('replays the same intent after rerender/remount without replacing newer graph state', () => {
    const first = applyGraphCommand(graphFixture(), command());
    if (!first.ok) throw Error('fixture');
    const manual = applyGraphOperations(first.graph, [{ type: 'setField', nodeId: 'b', fieldId: 'amount', value: 7 }]);
    if (!manual.ok) throw Error('fixture');
    const restoredReceipts = JSON.parse(JSON.stringify(first.receipts));
    const replay = applyGraphCommand(manual.graph, JSON.stringify(command()), restoredReceipts);
    expect(replay.ok).toBe(true);
    expect(replay.replayed).toBe(true);
    if (replay.ok) expect(replay.graph).toBe(manual.graph);
    expect(replay.receipts).toHaveLength(1);
    // If a host deliberately discards receipts, the old revision still refuses.
    const withoutLedger = applyGraphCommand(manual.graph, command());
    expect(withoutLedger.ok).toBe(false);
    if (!withoutLedger.ok) expect(withoutLedger.issues[0]!.code).toBe('GRAPH_STALE');
  });

  it('uses semantic payload identity and refuses an ID reused for changed intent', () => {
    const first = applyGraphCommand(graphFixture(), command());
    if (!first.ok) throw Error('fixture');
    const reordered = { operations: [{ label: 'Renamed', nodeId: 'a', type: 'setLabel' }], expectedRevision: 3, id: 'rename-a-1', schema: 'vict.flow-command@1' };
    expect(applyGraphCommand(first.graph, reordered, first.receipts).replayed).toBe(true);
    const conflict = applyGraphCommand(first.graph, { ...command(), expectedRevision: 4 }, first.receipts);
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.issues[0]!.code).toBe('GRAPH_COMMAND_ID_REUSED');
    expect(conflict.receipts).toBe(first.receipts);
  });

  it('retains stale and typed-connection refusal receipts without a partial update', () => {
    const graph = graphFixture();
    graph.nodes[2]!.ports = [{ id: 'in', label: 'Numeric input', direction: 'input', type: 'number' }];
    const before = serializeGraph(graph);
    const stale = applyGraphCommand(graph, { ...command(), expectedRevision: 2 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.issues[0]!.code).toBe('GRAPH_STALE');
    const rejected = applyGraphCommand(graph, { ...command(), operations: [
      { type: 'setLabel', nodeId: 'a', label: 'Must not be applied' },
      { type: 'connect', edge: { source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' } },
    ] });
    expect(rejected.ok).toBe(false);
    expect(rejected.receipt?.outcome).toBe('refused');
    expect(serializeGraph(graph)).toBe(before);
    expect(applyGraphCommand(graph, { ...command(), expectedRevision: 2 }, stale.receipts).replayed).toBe(true);
  });

  it('isolates caller-owned occurrence ledgers and refuses capacity without evicting old intents', () => {
    const graph = graphFixture(), first = applyGraphCommand(graph, command());
    expect(first.receipts).toHaveLength(1);
    expect(applyGraphCommand(graph, command(), []).replayed).toBe(false);
    const full = Array.from({ length: 128 }, (_, index) => ({
      id: `previous-${index}`, signature: '{}', expectedRevision: 1, resultingRevision: 2, outcome: 'applied' as const,
    }));
    const result = applyGraphCommand(graph, command(), full);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.code).toBe('GRAPH_COMMAND_LEDGER_FULL');
    expect(result.receipts).toBe(full);
  });
});
