import { describe, it, expect } from 'vitest';
import {
  createTurnMetrics,
  createContractKnowledge,
  createObservationLedger,
} from '../src/lib/designer/agent-progress.js';

describe('complete turn evidence after removing task ceilings', () => {
  it('counts and classifies every call beyond128 while preserving duplicate settlement fences', () => {
    let now = 0;
    const metrics = createTurnMetrics(() => now);
    for (let index = 0; index < 300; index++)
      metrics.classify(`call-${index}`, index % 2 ? 'source' : 'knowledge');
    for (let index = 0; index < 300; index++) metrics.start(`call-${index}`, 'studio_screen_read');
    now = 1;
    for (let index = 0; index < 300; index++)
      metrics.finish(`call-${index}`, 'studio_screen_read', true);
    metrics.start('call-299', 'studio_screen_read');
    metrics.finish('call-299', 'studio_screen_read', true);
    expect(metrics.snapshot()).toMatchObject({
      toolCalls: 300,
      completedCalls: 300,
      toolElapsedMs: 300,
      toolActiveMs: 1,
      outsideToolMs: 0,
      categories: { knowledge: 150, source: 150 },
    });
  });
  it('retains every observation without combining unrelated source identities', () => {
    const cursor = { documentId: 'screen', revision: 'r1', digest: 'digest', epoch: 'epoch' };
    const ledger = createObservationLedger();
    for (let index = 0; index < 40; index++)
      ledger.record({
        cursor: index === 0 ? { ...cursor, revision: 'old' } : cursor,
        capturedAt: '2026-10-31T00:00:00Z',
        imageDigest: String(index),
        image: {
          width: 500,
          height: 300,
          sourceWidth: 500,
          sourceHeight: 5000,
          offsetLeft: 0,
          offsetTop: 2200,
          cropped: true,
        },
        viewport: { width: 500, height: 300, scrollLeft: 0, scrollTop: 2200, devicePixelRatio: 1 },
        preview: { mode: 'design', fingerprint: 'fingerprint' },
      });
    expect(ledger.snapshot(cursor)).toMatchObject({
      currentSourceObservations: 39,
      interactionsVerified: false,
    });
    expect(ledger.snapshot(cursor).regions).toHaveLength(40);
    expect(ledger.snapshot(cursor).regions[0]?.currentSource).toBe(false);
  });
  it('reports all complete knowledge identities rather than only the first30', () => {
    const knowledge = createContractKnowledge();
    for (let index = 0; index < 60; index++)
      knowledge.retain({
        ok: true,
        registryReady: true,
        items: [
          {
            id: `component.${index}`,
            revision: '1',
            digest: `digest${index}`,
            bodyIdentity: `body${index}`,
            contractJson: '{}',
            offset: 0,
            totalCharacters: 2,
          },
        ],
      });
    expect(knowledge.snapshot().complete).toHaveLength(60);
    expect(knowledge.snapshot().partialCount).toBe(0);
  });
});
