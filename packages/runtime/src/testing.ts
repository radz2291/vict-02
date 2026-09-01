/**
 * Testing utilities for `@vict/runtime`. Import from `@vict/runtime/testing`.
 *
 * Includes the adapter-neutral store conformance suite: every conforming
 * store backend (in-memory, SQLite, future adapters) must pass the same
 * behavioral source.
 */
export { runStoreConformanceSuite } from './store-conformance.js';
export {
  runOrchestrationConformanceSuite,
  stringContract,
  recordContract,
  decisionGraph,
  fanoutGraph,
  signalWaitGraph,
  timerWaitGraph,
  retryGraph,
  unsafeWriteGraph,
} from './orchestration-conformance.js';
export { runOrchestrationJoinSuite } from './orchestration-join-conformance.js';
export { runOrchestrationRaceSuite } from './orchestration-race-conformance.js';
export type {
  OrchestrationRaceFixture,
  OrchestrationRaceStores,
} from './orchestration-race-conformance.js';
export type {
  ConformanceTestRunner as OrchestrationConformanceRunner,
  ConformanceExpect as OrchestrationConformanceExpect,
  OrchestrationConformanceFixture,
  OrchestrationConformanceStores,
} from './orchestration-conformance.js';
export type {
  StoreConformanceFactory,
  ConformanceTestRunner,
  ConformanceStores,
  ConformanceExpect,
} from './store-conformance.js';
export { runDurableBoundarySuite } from './boundary-conformance.js';
export type { BoundaryConformanceFactory, BoundaryGates } from './boundary-conformance.js';
export { RECOVERY_CODE, RECOVERY_REASON, RECOVERY_REMEDIATION } from './runtime.js';
