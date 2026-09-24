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

/** Closed vocabularies of the evidence schemas: handoff, result, audit (architecture §3.6). */

const HANDOFF_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'objective',
  'requirementIds',
  'baseTree',
  'inScopePaths',
  'ignoreManifest',
  'outOfScopeStopList',
  'requiredCommands',
  'negativeControls',
  'profile',
  'stopConditions',
  'deliverables',
  'exitGate',
]);

/** Validate a `vict.builder.handoff@1` document (closed vocabulary). */
export function validateHandoff(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, HANDOFF_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.handoff@1$/,
  });
  requireString(document, 'objective', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'requirementIds', '(root)', issues, { nonEmpty: true });
  requireString(document, 'baseTree', '(root)', issues, { pattern: GIT_SHA_PATTERN });
  requireStringArray(document, 'inScopePaths', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'ignoreManifest', '(root)', issues);
  requireStringArray(document, 'outOfScopeStopList', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'requiredCommands', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'negativeControls', '(root)', issues);
  requireString(document, 'profile', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'stopConditions', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'deliverables', '(root)', issues);
  requireString(document, 'exitGate', '(root)', issues, { nonEmpty: true });
  if (issues.length > 0) return fail(issues);
  return ok();
}

const RESULT_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'session',
  'commits',
  'commands',
  'observedCounts',
  'filesChanged',
  'requirementClaims',
  'deviations',
  'knownDebt',
  'stopPoint',
]);
const SESSION_FIELDS: ReadonlySet<string> = new Set(['host', 'startedAt', 'endedAt']);
const COMMIT_FIELDS: ReadonlySet<string> = new Set(['sha', 'message']);
const COMMAND_FIELDS: ReadonlySet<string> = new Set(['command', 'exitCode', 'observed']);
const COUNT_FIELDS: ReadonlySet<string> = new Set(['name', 'value', 'source']);
const CLAIM_FIELDS: ReadonlySet<string> = new Set(['id', 'classification', 'evidence']);
const CLAIM_CLASSES: ReadonlySet<string> = new Set(['implemented', 'exercised', 'not-done']);
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Validate a `vict.builder.result@1` document (closed vocabulary). */
export function validateResult(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, RESULT_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.result@1$/,
  });

  const session = document['session'];
  if (!isPlainObject(session)) {
    issues.push(issue('INVALID_TYPE', '(root).session', 'Expected an object.'));
  } else {
    checkAllowedFields(session, SESSION_FIELDS, '(root).session', issues);
    requireString(session, 'host', '(root).session', issues, { nonEmpty: true });
    requireString(session, 'startedAt', '(root).session', issues, { pattern: ISO_PATTERN });
    requireString(session, 'endedAt', '(root).session', issues, { pattern: ISO_PATTERN });
  }

  const commits = document['commits'];
  if (!Array.isArray(commits)) {
    issues.push(issue('INVALID_TYPE', '(root).commits', 'Expected an array.'));
  } else {
    for (let index = 0; index < commits.length; index += 1) {
      const commit = commits[index];
      const commitPath = `(root).commits[${String(index)}]`;
      if (!isPlainObject(commit)) {
        issues.push(issue('INVALID_TYPE', commitPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(commit, COMMIT_FIELDS, commitPath, issues);
      requireString(commit, 'sha', commitPath, issues, { pattern: GIT_SHA_PATTERN });
      requireString(commit, 'message', commitPath, issues, { nonEmpty: true });
    }
  }

  const commands = document['commands'];
  if (!Array.isArray(commands)) {
    issues.push(issue('INVALID_TYPE', '(root).commands', 'Expected an array.'));
  } else {
    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];
      const commandPath = `(root).commands[${String(index)}]`;
      if (!isPlainObject(command)) {
        issues.push(issue('INVALID_TYPE', commandPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(command, COMMAND_FIELDS, commandPath, issues);
      requireString(command, 'command', commandPath, issues, { nonEmpty: true });
      if (typeof command['exitCode'] !== 'number' || !Number.isInteger(command['exitCode'])) {
        issues.push(
          issue('INVALID_TYPE', `${commandPath}.exitCode`, 'Expected an integer exit code.'),
        );
      }
      requireString(command, 'observed', commandPath, issues, { nonEmpty: true });
    }
  }

  const counts = document['observedCounts'];
  if (!Array.isArray(counts)) {
    issues.push(issue('INVALID_TYPE', '(root).observedCounts', 'Expected an array.'));
  } else {
    for (let index = 0; index < counts.length; index += 1) {
      const count = counts[index];
      const countPath = `(root).observedCounts[${String(index)}]`;
      if (!isPlainObject(count)) {
        issues.push(issue('INVALID_TYPE', countPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(count, COUNT_FIELDS, countPath, issues);
      requireString(count, 'name', countPath, issues, { nonEmpty: true });
      if (typeof count['value'] !== 'number' || !Number.isFinite(count['value'])) {
        issues.push(issue('INVALID_TYPE', `${countPath}.value`, 'Expected a finite number.'));
      }
      requireString(count, 'source', countPath, issues, { nonEmpty: true });
    }
  }

  requireStringArray(document, 'filesChanged', '(root)', issues);
  const claims = document['requirementClaims'];
  if (!Array.isArray(claims)) {
    issues.push(issue('INVALID_TYPE', '(root).requirementClaims', 'Expected an array.'));
  } else {
    for (let index = 0; index < claims.length; index += 1) {
      const claim = claims[index];
      const claimPath = `(root).requirementClaims[${String(index)}]`;
      if (!isPlainObject(claim)) {
        issues.push(issue('INVALID_TYPE', claimPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(claim, CLAIM_FIELDS, claimPath, issues);
      requireString(claim, 'id', claimPath, issues, { nonEmpty: true });
      requireString(claim, 'classification', claimPath, issues);
      const classification = claim['classification'];
      if (typeof classification === 'string' && !CLAIM_CLASSES.has(classification)) {
        issues.push(
          issue(
            'INVALID_VALUE',
            `${claimPath}.classification`,
            'Classification outside the closed vocabulary.',
          ),
        );
      }
      requireStringArray(claim, 'evidence', claimPath, issues);
    }
  }
  requireStringArray(document, 'deviations', '(root)', issues);
  requireStringArray(document, 'knownDebt', '(root)', issues);
  requireString(document, 'stopPoint', '(root)', issues, { nonEmpty: true });

  if (issues.length > 0) return fail(issues);
  return ok();
}

const AUDIT_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'auditor',
  'reDerived',
  'findings',
  'disposition',
  'evidenceCommits',
]);
const FINDING_FIELDS: ReadonlySet<string> = new Set(['id', 'classification', 'description']);
const FINDING_CLASSES: ReadonlySet<string> = new Set([
  'gating',
  'corrective',
  'deferred',
  'rejected',
]);
const DISPOSITIONS: ReadonlySet<string> = new Set([
  'PASS',
  'PASS WITH ISSUES',
  'FAIL',
  'INCONCLUSIVE',
]);

/** Validate a `vict.builder.audit@1` document (closed vocabulary). */
export function validateAudit(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, AUDIT_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.audit@1$/,
  });
  requireString(document, 'auditor', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'reDerived', '(root)', issues);
  const findings = document['findings'];
  if (!Array.isArray(findings)) {
    issues.push(issue('INVALID_TYPE', '(root).findings', 'Expected an array.'));
  } else {
    for (let index = 0; index < findings.length; index += 1) {
      const finding = findings[index];
      const findingPath = `(root).findings[${String(index)}]`;
      if (!isPlainObject(finding)) {
        issues.push(issue('INVALID_TYPE', findingPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(finding, FINDING_FIELDS, findingPath, issues);
      requireString(finding, 'id', findingPath, issues, { nonEmpty: true });
      requireString(finding, 'classification', findingPath, issues);
      const classification = finding['classification'];
      if (typeof classification === 'string' && !FINDING_CLASSES.has(classification)) {
        issues.push(
          issue(
            'INVALID_VALUE',
            `${findingPath}.classification`,
            'Classification outside the closed vocabulary.',
          ),
        );
      }
      requireString(finding, 'description', findingPath, issues, { nonEmpty: true });
    }
  }
  requireString(document, 'disposition', '(root)', issues);
  const disposition = document['disposition'];
  if (typeof disposition === 'string' && !DISPOSITIONS.has(disposition)) {
    issues.push(
      issue('INVALID_VALUE', '(root).disposition', 'Disposition outside the closed vocabulary.'),
    );
  }
  if (Array.isArray(document['evidenceCommits'])) {
    requireStringArray(document, 'evidenceCommits', '(root)', issues, { nonEmpty: true });
    const commits = document['evidenceCommits'] as unknown[];
    for (let index = 0; index < commits.length; index += 1) {
      const commit = commits[index];
      if (
        typeof commit === 'string' &&
        !GIT_SHA_PATTERN.test(commit) &&
        !SHA256_PATTERN.test(commit)
      ) {
        issues.push(
          issue(
            'INVALID_FORMAT',
            `(root).evidenceCommits[${String(index)}]`,
            'Expected a commit SHA.',
          ),
        );
      }
    }
  } else {
    issues.push(issue('INVALID_TYPE', '(root).evidenceCommits', 'Expected an array.'));
  }
  if (issues.length > 0) return fail(issues);
  return ok();
}
