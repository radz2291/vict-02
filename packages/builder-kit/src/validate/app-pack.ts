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

/** Closed field vocabulary of `vict.builder.app-pack@1` (handoff WP-1 app-local base pack). */
const PACK_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'packId',
  'app',
  'generatedFrom',
  'permissionProfile',
  'verificationCommands',
  'stopConditions',
]);
const APP_FIELDS: ReadonlySet<string> = new Set(['name', 'version']);
const GENERATED_FROM_FIELDS: ReadonlySet<string> = new Set([
  'releaseSetId',
  'kitArtifact',
  'inputs',
]);
const KIT_ARTIFACT_FIELDS: ReadonlySet<string> = new Set(['spec', 'sha256']);
const INPUT_FIELDS: ReadonlySet<string> = new Set(['path', 'contentSha256']);
const PROFILES: ReadonlySet<string> = new Set([
  'builder.read',
  'builder.change',
  'builder.selfhost',
]);

function requireSha256(
  document: Record<string, unknown>,
  field: string,
  path: string,
  issues: ValidationIssue[],
): void {
  const value = document[field];
  if (typeof value !== 'string' || SHA256_PATTERN.test(value) === false) {
    issues.push(
      issue('INVALID_FORMAT', `${path}.${field}`, 'Expected a lowercase SHA-256 hex digest.'),
    );
  }
}

/** Validate an `vict.builder.app-pack@1` document (closed vocabulary; no invented content). */
export function validateAppPack(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, PACK_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.app-pack@1$/,
  });
  requireSha256(document, 'packId', '(root)', issues);

  const app = document['app'];
  if (!isPlainObject(app)) {
    issues.push(issue('INVALID_TYPE', '(root).app', 'Expected an object.'));
  } else {
    checkAllowedFields(app, APP_FIELDS, '(root).app', issues);
    requireString(app, 'name', '(root).app', issues);
    requireString(app, 'version', '(root).app', issues);
  }

  const generatedFrom = document['generatedFrom'];
  if (!isPlainObject(generatedFrom)) {
    issues.push(issue('INVALID_TYPE', '(root).generatedFrom', 'Expected an object.'));
  } else {
    checkAllowedFields(generatedFrom, GENERATED_FROM_FIELDS, '(root).generatedFrom', issues);
    requireString(generatedFrom, 'releaseSetId', '(root).generatedFrom', issues, {
      pattern: /^vict-release-set@1\//,
    });
    const kitArtifact = generatedFrom['kitArtifact'];
    if (!isPlainObject(kitArtifact)) {
      issues.push(issue('INVALID_TYPE', '(root).generatedFrom.kitArtifact', 'Expected an object.'));
    } else {
      checkAllowedFields(
        kitArtifact,
        KIT_ARTIFACT_FIELDS,
        '(root).generatedFrom.kitArtifact',
        issues,
      );
      requireString(kitArtifact, 'spec', '(root).generatedFrom.kitArtifact', issues);
      requireSha256(kitArtifact, 'sha256', '(root).generatedFrom.kitArtifact', issues);
    }
    const inputs = generatedFrom['inputs'];
    if (!Array.isArray(inputs) || inputs.length === 0) {
      issues.push(
        issue(
          'INVALID_TYPE',
          '(root).generatedFrom.inputs',
          'Expected a non-empty array of recorded inputs.',
        ),
      );
    } else {
      for (let index = 0; index < inputs.length; index += 1) {
        const input = inputs[index];
        const inputPath = `(root).generatedFrom.inputs[${String(index)}]`;
        if (!isPlainObject(input)) {
          issues.push(issue('INVALID_TYPE', inputPath, 'Expected an object.'));
          continue;
        }
        checkAllowedFields(input, INPUT_FIELDS, inputPath, issues);
        requireString(input, 'path', inputPath, issues);
        requireSha256(input, 'contentSha256', inputPath, issues);
      }
    }
  }

  const profile = document['permissionProfile'];
  if (typeof profile !== 'string' || PROFILES.has(profile) === false) {
    issues.push(
      issue('INVALID_VALUE', '(root).permissionProfile', 'Expected a known builder profile name.'),
    );
  }

  requireStringArray(document, 'verificationCommands', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'stopConditions', '(root)', issues, { nonEmpty: true });

  return issues.length === 0 ? ok() : fail(issues);
}
