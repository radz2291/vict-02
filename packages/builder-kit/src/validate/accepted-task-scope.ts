import {
  checkAllowedFields,
  fail,
  isPlainObject,
  issue,
  ok,
  requireString,
  requireStringArray,
  SHA256_PATTERN,
  type ValidationIssue,
  type ValidationResult,
} from './common.js';

/** Closed field vocabulary of `vict.builder.accepted-task-scope@1`. */
const ACCEPTED_TASK_SCOPE_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'packId',
  'handoff',
  'inScopePaths',
  'permissionProfiles',
  'ignoreManifest',
  'ignoreManifestDigest',
  'notes',
]);

/**
 * Validate an accepted-task-scope document (closed vocabulary). This is
 * the machine-checkable representation of a handoff's accepted scope and
 * profiles: committed, identity-bound, and the ONLY source from which an
 * active task pack's authority may be established (the handoff is the
 * sole task authority, architecture §3.3; the pack merely carries the
 * handoff's scope).
 */
export function validateAcceptedTaskScope(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, ACCEPTED_TASK_SCOPE_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.accepted-task-scope@1$/,
  });
  requireString(document, 'packId', '(root)', issues, { pattern: SHA256_PATTERN });
  requireStringArray(document, 'inScopePaths', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'permissionProfiles', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'ignoreManifest', '(root)', issues);
  requireString(document, 'ignoreManifestDigest', '(root)', issues, { pattern: SHA256_PATTERN });
  requireString(document, 'notes', '(root)', issues, { nonEmpty: true });

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
