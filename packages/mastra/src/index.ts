/**
 * `@vict/mastra` — the optional Mastra-backed implementation of the
 * neutral VICT ProductAgent boundary (Stage 06A foundation).
 *
 * Dependency direction (AI-002): this package imports the neutral VICT
 * packages and the pinned Mastra packages. NO neutral VICT package imports
 * this package, and no neutral declaration mentions Mastra. Mastra
 * package names/versions live only inside this package (see
 * `compatibility.ts`).
 *
 * Stage 06A scope: adapter foundation — profile snapshots, the offline
 * deterministic model proof, pure helper tools, dedicated storage,
 * payload-safe tracing, retention/pruning, governed deletion/export, and
 * the version-upgrade harness. The full tool bridge, approvals, the final
 * `vict.agent-stream@1` wire schema, and SSE/HTTP transport are Stage 06B
 * (OPEN-015 stays open).
 */

// ---- Adapter compatibility marker + version-upgrade harness (MSTR-002) -----
export {
  MASTRA_ADAPTER_ID,
  MASTRA_ADAPTER_REVISION,
  MASTRA_PINNED_VERSIONS,
  MASTRA_ADAPTER_COMPATIBILITY,
  MASTRA_LICENSE_BOUNDARIES,
  mastraCompatibilityFingerprint,
  verifyMastraAdapterCompatibility,
} from './compatibility.js';
export type {
  MastraCompatibilityCheck,
  MastraCompatibilityReport,
  MastraPinnedPackageName,
} from './compatibility.js';

// ---- Deterministic offline model fixture (MSTR-010) -------------------------
export {
  createDeterministicOfflineModel,
  OFFLINE_MODEL_ID,
  OFFLINE_MODEL_IDENTITY,
  OFFLINE_MODEL_PROVIDER,
} from './offline-model.js';
export type {
  DeterministicOfflineModel,
  OfflineModelRecord,
  OfflineModelRecordedCallOptions,
  OfflineModelScript,
  OfflineModelStep,
  OfflineModelTextStep,
  OfflineModelToolCallStep,
  OfflineModelToolChainStep,
  OfflineModelThrowStep,
} from './offline-model.js';

// ---- The ProductAgentPort implementation ------------------------------------
export { GUARDRAIL_REJECTED_CODE, MastraProductAgent, VictMastraAdapterError } from './adapter.js';
export type {
  MastraAdapterErrorCode,
  MastraAdapterMetadata,
  MastraProductAgentConfig,
  MastraTracingPolicy,
} from './adapter.js';

// ---- Helper-tool bridge (§6.5) ----------------------------------------------
export {
  bridgeHelperToolToMastra,
  describeHelperToolBinding,
  sanitizeToolName,
} from './helper-tools.js';
export type { HelperToolFailure, HelperToolFailureCode } from './helper-tools.js';

// ---- Dedicated storage (MSTR-003, §8.2 envelope) ----------------------------
export {
  assertPlainStoreFileName,
  createDedicatedMastraStore,
  MAX_RETENTION_AGE_MS,
  resolveProtectedStoreDir,
  restrictStorePathPermissions,
  VictMastraStorageError,
} from './storage.js';
export type { DedicatedMastraStore, DedicatedMastraStoreOptions } from './storage.js';

// ---- Memory lifecycle (MSTR-011) ---------------------------------------------
export {
  MastraConversationExportPort,
  MastraMemoryDeletionPort,
  MastraThreadCoordinator,
  MastraThreadFenceError,
  conversationIdForThreadId,
  executeMemoryPrune,
  mastraResourceIdForActor,
  mastraThreadIdForConversation,
} from './memory.js';
export type { MastraMemoryLifecycleOptions, MastraMemoryPruneResult } from './memory.js';
