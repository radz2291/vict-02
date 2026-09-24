import { CONTEXT_PACK_SCHEMA } from '../markers.js';
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

/** Closed field vocabulary of `vict.builder.context-pack@1` (architecture §3.3). */
const PACK_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'packId',
  'generatedFrom',
  'constitution',
  'repositoryMap',
  'verifiedBaseline',
  'toolManifestRef',
  'permissionProfilesRef',
  'verificationCommands',
  'stopConditions',
]);

const GENERATED_FROM_FIELDS: ReadonlySet<string> = new Set([
  'referenceVersion',
  'releaseSetId',
  'workspaceIdentity',
  'inputs',
]);

const WORKSPACE_IDENTITY_FIELDS: ReadonlySet<string> = new Set(['name', 'version', 'workspaces']);
const INPUT_FIELDS: ReadonlySet<string> = new Set(['path', 'contentSha256']);
const CONSTITUTION_FIELDS: ReadonlySet<string> = new Set([
  'sourcePath',
  'anchor',
  'contentSha256',
  'excerpt',
]);
const REPOSITORY_MAP_FIELDS: ReadonlySet<string> = new Set([
  'name',
  'version',
  'main',
  'types',
  'private',
  'internalDependencies',
  'externalDependencies',
]);
const BASELINE_FIELDS: ReadonlySet<string> = new Set([
  'sourcePath',
  'anchor',
  'contentSha256',
  'extract',
]);
const REF_FIELDS: ReadonlySet<string> = new Set(['schemaMarker', 'sourcePath', 'contentSha256']);

function validateInputs(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue('INVALID_TYPE', path, 'Expected an array.'));
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    const entryPath = `${path}[${String(index)}]`;
    if (!isPlainObject(entry)) {
      issues.push(issue('INVALID_TYPE', entryPath, 'Expected an object.'));
      continue;
    }
    checkAllowedFields(entry, INPUT_FIELDS, entryPath, issues);
    requireString(entry, 'path', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'contentSha256', entryPath, issues, { pattern: SHA256_PATTERN });
  }
}

function validateInputsMember(
  value: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): void {
  validateInputs(value['inputs'], `${path}.inputs`, issues);
}

function validateConstitution(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue('INVALID_TYPE', `${path}.constitution`, 'Expected an array.'));
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    const entryPath = `${path}.constitution[${String(index)}]`;
    if (!isPlainObject(entry)) {
      issues.push(issue('INVALID_TYPE', entryPath, 'Expected an object.'));
      continue;
    }
    checkAllowedFields(entry, CONSTITUTION_FIELDS, entryPath, issues);
    requireString(entry, 'sourcePath', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'anchor', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'contentSha256', entryPath, issues, { pattern: SHA256_PATTERN });
    requireString(entry, 'excerpt', entryPath, issues, { nonEmpty: true });
  }
}

function validateRepositoryMap(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue('INVALID_TYPE', `${path}.repositoryMap`, 'Expected an array.'));
    return;
  }
  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    const entryPath = `${path}.repositoryMap[${String(index)}]`;
    if (!isPlainObject(entry)) {
      issues.push(issue('INVALID_TYPE', entryPath, 'Expected an object.'));
      continue;
    }
    checkAllowedFields(entry, REPOSITORY_MAP_FIELDS, entryPath, issues);
    requireString(entry, 'name', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'version', entryPath, issues, { nonEmpty: true });
    // Entry points may be absent from a member manifest (recorded as '').
    requireString(entry, 'main', entryPath, issues);
    requireString(entry, 'types', entryPath, issues);
    if (typeof entry['private'] !== 'boolean') {
      issues.push(issue('INVALID_TYPE', `${entryPath}.private`, 'Expected a boolean.'));
    }
    requireStringArray(entry, 'internalDependencies', entryPath, issues);
    requireStringArray(entry, 'externalDependencies', entryPath, issues);
  }
}

/** Validate a `vict.builder.context-pack@1` document (closed vocabulary). */
export function validateContextPack(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, PACK_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.context-pack@1$/,
  });
  requireString(document, 'packId', '(root)', issues, { pattern: SHA256_PATTERN });

  const generatedFrom = document['generatedFrom'];
  if (!isPlainObject(generatedFrom)) {
    issues.push(issue('INVALID_TYPE', '(root).generatedFrom', 'Expected an object.'));
  } else {
    checkAllowedFields(generatedFrom, GENERATED_FROM_FIELDS, '(root).generatedFrom', issues);
    requireString(generatedFrom, 'referenceVersion', '(root).generatedFrom', issues, {
      pattern: /^[0-9]+\.[0-9]+\.[0-9]+$/,
    });
    requireString(generatedFrom, 'releaseSetId', '(root).generatedFrom', issues, {
      pattern: /^vict-release-set@1\/.+$/,
    });
    const identity = generatedFrom['workspaceIdentity'];
    const identityPath = '(root).generatedFrom.workspaceIdentity';
    if (!isPlainObject(identity)) {
      issues.push(issue('INVALID_TYPE', identityPath, 'Expected an object.'));
    } else {
      checkAllowedFields(identity, WORKSPACE_IDENTITY_FIELDS, identityPath, issues);
      requireString(identity, 'name', identityPath, issues, { nonEmpty: true });
      requireString(identity, 'version', identityPath, issues, { nonEmpty: true });
      requireStringArray(identity, 'workspaces', identityPath, issues, { nonEmpty: true });
    }
    validateInputsMember(generatedFrom, '(root).generatedFrom', issues);
  }

  validateConstitution(document['constitution'], '(root)', issues);
  validateRepositoryMap(document['repositoryMap'], '(root)', issues);

  const baseline = document['verifiedBaseline'];
  if (!isPlainObject(baseline)) {
    issues.push(issue('INVALID_TYPE', '(root).verifiedBaseline', 'Expected an object.'));
  } else {
    checkAllowedFields(baseline, BASELINE_FIELDS, '(root).verifiedBaseline', issues);
    requireString(baseline, 'sourcePath', '(root).verifiedBaseline', issues, { nonEmpty: true });
    requireString(baseline, 'anchor', '(root).verifiedBaseline', issues, { nonEmpty: true });
    requireString(baseline, 'contentSha256', '(root).verifiedBaseline', issues, {
      pattern: SHA256_PATTERN,
    });
    requireString(baseline, 'extract', '(root).verifiedBaseline', issues, { nonEmpty: true });
  }

  for (const field of ['toolManifestRef', 'permissionProfilesRef'] as const) {
    const ref = document[field];
    if (!isPlainObject(ref)) {
      issues.push(issue('INVALID_TYPE', `(root).${field}`, 'Expected an object.'));
      continue;
    }
    checkAllowedFields(ref, REF_FIELDS, `(root).${field}`, issues);
    requireString(ref, 'schemaMarker', `(root).${field}`, issues, { nonEmpty: true });
    requireString(ref, 'sourcePath', `(root).${field}`, issues, { nonEmpty: true });
    requireString(ref, 'contentSha256', `(root).${field}`, issues, { pattern: SHA256_PATTERN });
  }

  requireStringArray(document, 'verificationCommands', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'stopConditions', '(root)', issues, { nonEmpty: true });

  if (issues.length > 0) return fail(issues);
  if (document['schemaMarker'] !== CONTEXT_PACK_SCHEMA) {
    return fail([issue('WRONG_MARKER', '(root).schemaMarker', 'Unexpected schema marker.')]);
  }
  return ok();
}
