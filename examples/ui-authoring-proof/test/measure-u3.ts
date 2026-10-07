/**
 * U3 measurement harness (frozen STAGES §8 budgets, U3-affected surfaces).
 *
 * Measures, 30 iterations after warm-up, p95 = sorted[floor(0.95*n)]:
 * - edit feedback: a finding.add dispatch round trip through the product
 *   server boundary (simulated implementation);
 * - scenario reset: product-server reset to settled seeded UI data
 *   (list re-dispatched; excluding configured latency — none in reset);
 * - preview session reset: PreviewSession.reset() + first list dispatch;
 * - durable decision write: inspection.approve round trip through the
 *   durable SQLite adapter (transactional write-through included).
 *
 * Run: npx tsx test/measure-u3.ts   (from examples/ui-authoring-proof)
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InspectionDataAdapter,
  createInspectionServer,
  seedDomain,
} from '../src/lib/product/domain.js';
import { getProductServer } from '../src/lib/server/inspection.js';
import { openDurableInspectionStore } from '../src/lib/server/inspection-durable.js';
import { createScenarioSession } from '../src/lib/product/scenarios.js';

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(0.95 * sorted.length)];
}

const ITERATIONS = 30;
const supervisor = { role: 'supervisor', actorId: 's.hart' };
const technician = { role: 'technician', actorId: 't.nguyen' };

async function main(): Promise<void> {
  // ---- 1. Edit feedback: finding.add through the product boundary --------
  const product = getProductServer();
  product.reset('normal', 'simulated');
  for (let i = 0; i < 5; i += 1) {
    await product.dispatch(
      'finding.add',
      { id: `warm-${i}`, inspectionId: 'i-101', severity: 'low', description: `warm ${i}` },
      technician,
    );
  }
  const editSamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    const result = await product.dispatch(
      'finding.add',
      {
        id: `f-measure-${i}`,
        inspectionId: 'i-101',
        severity: 'low',
        description: `measurement ${i}`,
      },
      technician,
    );
    const elapsed = performance.now() - start;
    if (!result.ok) throw new Error('edit dispatch failed');
    editSamples.push(elapsed);
  }

  // ---- 2. Scenario reset (product server): reset + settled list ----------
  const resetSamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    product.reset(i % 2 === 0 ? 'normal' : 'long');
    const list = await product.dispatch('inspection.list', {}, supervisor);
    const elapsed = performance.now() - start;
    if (!list.ok) throw new Error('reset list failed');
    resetSamples.push(elapsed);
  }

  // ---- 3. Preview session reset + first dispatch -------------------------
  const previewSamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    const start = performance.now();
    const { session } = createScenarioSession('normal');
    const list = await session.run('inspection:list');
    const elapsed = performance.now() - start;
    if (!list.ok) throw new Error('preview reset failed');
    previewSamples.push(elapsed);
  }

  // ---- 4. Durable decision write (transactional write-through) -----------
  const durableFile = join(mkdtempSync(join(tmpdir(), 'u3-measure-')), 'measure.sqlite');
  const opened = openDurableInspectionStore(durableFile, 'normal');
  const durableServer = createInspectionServer(opened.adapter);
  const durableSamples: number[] = [];
  for (let i = 0; i < ITERATIONS; i += 1) {
    // Each iteration runs the reject -> revise -> submit write cycle against
    // the CURRENT revision (read through the adapter, like the product does).
    const current = await durableServer.dispatch('inspection.get', { id: 'i-101' }, supervisor);
    if (!current.ok) throw new Error('get failed');
    const start = performance.now();
    const result = await durableServer.dispatch(
      'inspection.reject',
      {
        id: 'i-101',
        expectedDomainRevision: (current.value as Record<string, unknown>)['domainRevision'],
        rejectionReason: `measure ${i}`,
      },
      supervisor,
    );
    const elapsed = performance.now() - start;
    if (!result.ok) throw new Error(`durable write failed: ${JSON.stringify(result)}`);
    durableSamples.push(elapsed);
    const revise = await durableServer.dispatch('inspection.revise', { id: 'i-101' }, technician);
    if (!revise.ok) throw new Error('durable revise failed');
    const submit = await durableServer.dispatch('inspection.submit', { id: 'i-101' }, technician);
    if (!submit.ok) throw new Error('durable submit failed');
  }
  opened.adapter.close();
  rmSync(join(tmpdir(), 'u3-measure-'), { recursive: true, force: true });

  const report = {
    schema: 'vict.u3-measurement@1',
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      runtime: 'node (same-process; no browser GPU/paint included)',
    },
    method:
      '30 iterations after 5 warm-ups; p95 = sorted[floor(0.95*n)]; edit = finding.add dispatch round trip through the product boundary; scenario reset = product reset + settled list; preview reset = PreviewSession creation + first dispatch; durable write = transactional decision round trip (reject/revise/submit loop per iteration)',
    budgets: {
      editFeedbackP95Ms: 100,
      scenarioResetP95Ms: 1000,
    },
    results: {
      editFeedbackP95Ms: Number(p95(editSamples).toFixed(2)),
      scenarioResetP95Ms: Number(p95(resetSamples).toFixed(2)),
      previewSessionResetP95Ms: Number(p95(previewSamples).toFixed(2)),
      durableDecisionWriteP95Ms: Number(p95(durableSamples).toFixed(2)),
      samples: {
        editFeedback: editSamples.map((s) => Number(s.toFixed(2))),
        scenarioReset: resetSamples.map((s) => Number(s.toFixed(2))),
        previewReset: previewSamples.map((s) => Number(s.toFixed(2))),
        durableWrite: durableSamples.map((s) => Number(s.toFixed(2))),
      },
    },
  };
  console.log(JSON.stringify(report, null, 2));
}

await main();
