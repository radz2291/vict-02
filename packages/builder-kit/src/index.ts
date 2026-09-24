/**
 * Vict Builder Kit — public API.
 *
 * Host-neutral bootstrap documents, generated context/task packs, the
 * capability catalog, typed tools with permission profiles, and the
 * `verify:builder-kit` freshness gate (Stage 08, architecture §§3–4).
 * The kit supplies documents, typed tools, schemas, and verification —
 * never an agent loop or model calls.
 */

export {
  canonicalJsonBytes,
  packIdentity,
  packIdentityFromBytes,
  sha256Hex,
  sortKeysDeep,
  containsFunction,
} from './canonical.js';
export {
  ALL_SCHEMA_MARKERS,
  AUDIT_SCHEMA,
  BOOTSTRAP_PROTOCOL,
  CATALOG_SCHEMA,
  CONTEXT_PACK_SCHEMA,
  HANDOFF_SCHEMA,
  PROFILE_SCHEMA,
  RESULT_SCHEMA,
  TASK_PACK_SCHEMA,
  TOOLS_SCHEMA,
} from './markers.js';
export { validateDocument } from './validate/index.js';
export type { ValidationIssue, ValidationResult, Validator } from './validate/index.js';
export { validateAudit, validateHandoff, validateResult } from './validate/evidence.js';
export { validateCatalog } from './validate/catalog.js';
export { validateContextPack } from './validate/context-pack.js';
export { validateProfile, validateTools } from './validate/protocol.js';
export { validateTaskPack } from './validate/task-pack.js';
export { scanFirstPartySources } from './catalog/static-scan.js';
export type {
  StaticDeclaration,
  StaticScanResult,
  UnresolvedDeclaration,
} from './catalog/static-scan.js';
export { CatalogGenerationError, generateCatalog } from './catalog/generate.js';
export {
  buildContextPack,
  contextPackBytes,
  CONTEXT_PACK_PATH,
  CATALOG_PATH,
  PACK_MD_PATH,
  BOOTSTRAP_PATH,
  VERIFICATION_COMMANDS,
  STOP_CONDITIONS,
} from './generate/context-pack.js';
export { generateStableLayer } from './generate/generate.js';
export { renderBootstrap, renderPackMd } from './generate/render.js';
export { buildTaskPack, taskPackDirectory, writeTaskPack } from './generate/task-pack.js';
export { initExternalApp } from './generate/init-app.js';
export { verifyBuilderKit } from './verify/verify.js';
export type { CheckResult, VerifyReport } from './verify/verify.js';
export { compareBaseline, loadTaskPack } from './verify/baseline.js';
export {
  defaultDenialsFile,
  executeTool,
  ABSENT_TOOLS,
  IMPLEMENTED_TOOLS,
} from './runtime/wrapper.js';
export type { DenialRecord, ProfileDocument, ToolContext, ToolOutcome } from './runtime/wrapper.js';
export { runCli } from './cli.js';
export { globToRegExp, matchesAny } from './glob.js';
