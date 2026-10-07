/**
 * `@victframework/ui-preview` — scenario orchestration + session/reset
 * fencing (API-SPEC §6.2). Runtime access is a PORT; nothing here reaches
 * into real handler registries.
 */
export { PreviewSession, createPreviewSession } from './session.js';
export type {
  CoverageEntry,
  PreviewDataAdapterPort,
  PreviewResult,
  PreviewRuntimePort,
  PreviewSessionOptions,
} from './session.js';
