import {
  checkAllowedFields,
  fail,
  GIT_SHA_PATTERN,
  isPlainObject,
  issue,
  ok,
  requireString,
  requireStringArray,
  SHA256_PATTERN,
  type ValidationIssue,
  type ValidationResult,
} from './common.js';

/** Closed field vocabulary of `vict.builder.task-pack@1` (architecture §3.3). */
const TASK_PACK_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'packId',
  'basePackId',
  'basePackPath',
  'handoff',
  'baseTree',
  'inScopePaths',
  'ignoreManifest',
  'ignoreManifestDigest',
  'permissionProfile',
]);

/** Validate a `vict.builder.task-pack@1` document (closed vocabulary). */
export function validateTaskPack(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, TASK_PACK_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.task-pack@1$/,
  });
  requireString(document, 'packId', '(root)', issues, { pattern: SHA256_PATTERN });
  requireString(document, 'basePackId', '(root)', issues, { pattern: SHA256_PATTERN });
  requireString(document, 'basePackPath', '(root)', issues, { nonEmpty: true });
  requireString(document, 'baseTree', '(root)', issues, { pattern: GIT_SHA_PATTERN });
  requireString(document, 'ignoreManifestDigest', '(root)', issues, { pattern: SHA256_PATTERN });
  requireString(document, 'permissionProfile', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'inScopePaths', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'ignoreManifest', '(root)', issues);

  const handoff = document['handoff'];
  if (!isPlainObject(handoff)) {
    issues.push(issue('INVALID_TYPE', '(root).handoff', 'Expected an object.'));
  } else {
    checkAllowedFields(handoff, new Set(['path', 'sha256']), '(root).handoff', issues);
    requireString(handoff, 'path', '(root).handoff', issues, { nonEmpty: true });
    requireString(handoff, 'sha256', '(root).handoff', issues, { pattern: SHA256_PATTERN });
  }

  if (issues.length > 0) return fail(issues);
  return ok();
}
