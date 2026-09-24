import {
  ACCEPTED_TASK_SCOPE_SCHEMA,
  APP_PACK_SCHEMA,
  AUDIT_SCHEMA,
  CATALOG_SCHEMA,
  CONTEXT_PACK_SCHEMA,
  HANDOFF_SCHEMA,
  PROFILE_SCHEMA,
  RESULT_SCHEMA,
  TASK_PACK_SCHEMA,
  TOOLS_SCHEMA,
} from '../markers.js';
import type { ValidationResult } from './common.js';
import { validateAcceptedTaskScope } from './accepted-task-scope.js';
import { validateAppPack } from './app-pack.js';
import { validateAudit, validateHandoff, validateResult } from './evidence.js';
import { validateCatalog } from './catalog.js';
import { validateContextPack } from './context-pack.js';
import { validateProfile, validateTools } from './protocol.js';
import { validateTaskPack } from './task-pack.js';

export type { ValidationIssue, ValidationResult } from './common.js';

export { validateAcceptedTaskScope } from './accepted-task-scope.js';
export { validateAppPack } from './app-pack.js';
export { validateAudit, validateHandoff, validateResult } from './evidence.js';
export { validateCatalog } from './catalog.js';
export { validateContextPack } from './context-pack.js';
export { validateProfile, validateTools } from './protocol.js';
export { validateTaskPack } from './task-pack.js';

export type Validator = (document: unknown) => ValidationResult;

/** Validator registry keyed by the document's `schemaMarker`. */
export const VALIDATORS: Readonly<Record<string, Validator>> = {
  [CONTEXT_PACK_SCHEMA]: validateContextPack,
  [ACCEPTED_TASK_SCOPE_SCHEMA]: validateAcceptedTaskScope,
  [APP_PACK_SCHEMA]: validateAppPack,
  [TASK_PACK_SCHEMA]: validateTaskPack,
  [CATALOG_SCHEMA]: validateCatalog,
  [TOOLS_SCHEMA]: validateTools,
  [PROFILE_SCHEMA]: validateProfile,
  [HANDOFF_SCHEMA]: validateHandoff,
  [RESULT_SCHEMA]: validateResult,
  [AUDIT_SCHEMA]: validateAudit,
};

/**
 * Validate a Builder Kit document by detecting its `schemaMarker`.
 * Unknown or missing markers fail closed.
 */
export function validateDocument(
  document: unknown,
): ValidationResult & { readonly marker?: string } {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_TYPE',
          path: '(root)',
          message: 'Expected an object with a schemaMarker.',
        },
      ],
    };
  }
  const marker = (document as Record<string, unknown>)['schemaMarker'];
  if (typeof marker !== 'string') {
    return {
      ok: false,
      issues: [
        {
          code: 'MISSING_MARKER',
          path: '(root).schemaMarker',
          message: 'schemaMarker is required.',
        },
      ],
    };
  }
  const validator = VALIDATORS[marker];
  if (validator === undefined) {
    return {
      ok: false,
      issues: [
        {
          code: 'UNKNOWN_MARKER',
          path: '(root).schemaMarker',
          message: 'No validator for this schema marker.',
        },
      ],
    };
  }
  const result = validator(document);
  return result.ok ? { ...result, marker } : result;
}
