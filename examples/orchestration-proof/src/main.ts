import { runProof } from './proof.js';
import { StringContract } from './contracts.js';

/**
 * Executable Stage 03 proof: deterministic decision routing, fixed fan-out
 * with a real overlap barrier, a join that fires exactly once, a durable
 * signal wait across a genuine teardown/rebuild restart boundary, an
 * idempotent signal, and a keyed-idempotent write that fails once and
 * reconciles to exactly one external mutation through a durable retry.
 * Runs fully offline with injected ids and clock.
 *
 *   npm run demo
 */
async function main(): Promise<void> {
  const report = await runProof();

  console.log('=== Stage 03 orchestration proof ===');
  console.log(`Topology: ${report.topology.nodes} nodes, ${report.topology.edges} edges (decision, fork, join, signal wait with timeout, keyed write)`);
  console.log(`Activation version: ${report.activationVersion}`);
  console.log(`Run id: ${report.runId}`);
  console.log(`Semantic events: ${report.eventCount}`);
  console.log(`Durable run-record revisions (atomic transitions): ${report.durableTransitions}`);
  console.log(`Node attempts: ${report.attempts} (the keyed write failed once, then reconciled)`);
  console.log(`External mutations in the disposable proof ledger: ${report.externalMutations} (exactly one)`);
  console.log(`Branch overlap proven by barrier: ${report.branchOverlapProven}`);
  console.log(`Deterministic across independent runs: ${report.deterministicAcrossRuns}`);
  console.log(`Final output (contract '${StringContract.id}'): ${report.finalOutput}`);

  if (
    !report.branchOverlapProven ||
    report.externalMutations !== 1 ||
    !report.deterministicAcrossRuns ||
    report.finalOutput !== 'applied:resumed'
  ) {
    console.error('PROOF FAILED');
    process.exit(1);
  }
  console.log('PROOF PASSED');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});