/**
 * Testing utilities for `@vict/runtime`. Import from `@vict/runtime/testing`.
 *
 * Includes the adapter-neutral store conformance suite: every conforming
 * store backend (in-memory, SQLite, future adapters) must pass the same
 * behavioral source.
 */
export { runStoreConformanceSuite } from './store-conformance.js';
export type {
  StoreConformanceFactory,
  ConformanceTestRunner,
  ConformanceStores,
  ConformanceExpect,
} from './store-conformance.js';
export { RECOVERY_CODE, RECOVERY_REASON, RECOVERY_REMEDIATION } from './runtime.js';
