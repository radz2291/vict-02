import {
  checkAllowedFields,
  fail,
  isPlainObject,
  issue,
  ok,
  requireBoolean,
  requireString,
  requireStringArray,
  SHA256_PATTERN,
  type ValidationIssue,
  type ValidationResult,
} from './common.js';

/**
 * Closed field vocabulary of `vict.builder.catalog@1` (architecture §4.1).
 *
 * The catalog records exactly the metadata the real pack manifest closed
 * vocabulary carries. There is NO per-capability summary field in the
 * manifest vocabulary; the catalog records `summary: null` explicitly
 * where a description is absent — none may be invented.
 */
const CATALOG_FIELDS: ReadonlySet<string> = new Set(['schemaMarker', 'generatedFrom', 'packs']);
const GENERATED_FROM_FIELDS: ReadonlySet<string> = new Set(['sourceModules']);
const SOURCE_MODULE_FIELDS: ReadonlySet<string> = new Set(['package', 'module', 'contentSha256']);
const PACK_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'version',
  'victCompatibility',
  'documentation',
  'contracts',
  'permissions',
  'configuration',
  'secrets',
  'doubles',
  'evaluations',
  'provenance',
  'capabilities',
]);
const CAPABILITY_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'revision',
  'effect',
  'input',
  'output',
  'summary',
  'idempotency',
  'retry',
  'permissions',
  'configuration',
  'requiredConfiguration',
  'secrets',
  'requiredSecrets',
  'ambiguity',
  'module',
  'contentSha256',
]);
const CONTRACT_REF_FIELDS: ReadonlySet<string> = new Set(['contractId', 'revision']);
const EFFECTS: ReadonlySet<string> = new Set(['pure', 'read', 'write', 'irreversible']);
const AMBIGUITY: ReadonlySet<string> = new Set(['block', 'keyedRetry']);

function validateObjectArray(
  value: unknown,
  path: string,
  allowed: ReadonlySet<string>,
  issues: ValidationIssue[],
  validateEntry: (entry: Record<string, unknown>, entryPath: string) => void,
): void {
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
    checkAllowedFields(entry, allowed, entryPath, issues);
    validateEntry(entry, entryPath);
  }
}

function validateContractRef(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value === null) return;
  if (!isPlainObject(value)) {
    issues.push(issue('INVALID_TYPE', path, 'Expected an object or null.'));
    return;
  }
  checkAllowedFields(value, CONTRACT_REF_FIELDS, path, issues);
  requireString(value, 'contractId', path, issues, { nonEmpty: true });
  requireString(value, 'revision', path, issues, { nonEmpty: true });
}

function validateCapability(value: unknown, path: string, issues: ValidationIssue[]): void {
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
    checkAllowedFields(entry, CAPABILITY_FIELDS, entryPath, issues);
    requireString(entry, 'id', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'revision', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'effect', entryPath, issues);
    const effect = entry['effect'];
    if (typeof effect === 'string' && !EFFECTS.has(effect)) {
      issues.push(
        issue('INVALID_VALUE', `${entryPath}.effect`, 'Effect outside the closed vocabulary.'),
      );
    }
    validateContractRef(entry['input'], `${entryPath}.input`, issues);
    validateContractRef(entry['output'], `${entryPath}.output`, issues);
    // The manifest vocabulary has no per-capability description; the
    // catalog records `summary: null` explicitly — a string here would be
    // invented knowledge.
    if (entry['summary'] !== undefined && entry['summary'] !== null) {
      issues.push(
        issue(
          'INVENTED_SUMMARY',
          `${entryPath}.summary`,
          'Capability summaries do not exist in the manifest vocabulary; only null is valid.',
        ),
      );
    }
    if (entry['idempotency'] !== undefined && entry['idempotency'] !== 'keyed') {
      issues.push(
        issue('INVALID_VALUE', `${entryPath}.idempotency`, "Expected 'keyed' when present."),
      );
    }
    if (entry['ambiguity'] !== undefined) {
      const ambiguity = entry['ambiguity'];
      if (typeof ambiguity !== 'string' || !AMBIGUITY.has(ambiguity)) {
        issues.push(
          issue(
            'INVALID_VALUE',
            `${entryPath}.ambiguity`,
            'Ambiguity class outside the closed vocabulary.',
          ),
        );
      }
    }
    for (const listField of [
      'permissions',
      'configuration',
      'requiredConfiguration',
      'secrets',
      'requiredSecrets',
    ] as const) {
      if (entry[listField] !== undefined) {
        requireStringArray(entry, listField, entryPath, issues, { nonEmpty: true });
      }
    }
    requireString(entry, 'module', entryPath, issues, { nonEmpty: true });
    requireString(entry, 'contentSha256', entryPath, issues, { pattern: SHA256_PATTERN });
  }
}

/** Validate a `vict.builder.catalog@1` document (closed vocabulary). */
export function validateCatalog(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, CATALOG_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.catalog@1$/,
  });

  const generatedFrom = document['generatedFrom'];
  if (!isPlainObject(generatedFrom)) {
    issues.push(issue('INVALID_TYPE', '(root).generatedFrom', 'Expected an object.'));
  } else {
    checkAllowedFields(generatedFrom, GENERATED_FROM_FIELDS, '(root).generatedFrom', issues);
    validateObjectArray(
      generatedFrom['sourceModules'],
      '(root).generatedFrom.sourceModules',
      SOURCE_MODULE_FIELDS,
      issues,
      (entry, entryPath) => {
        requireString(entry, 'package', entryPath, issues, { nonEmpty: true });
        requireString(entry, 'module', entryPath, issues, { nonEmpty: true });
        requireString(entry, 'contentSha256', entryPath, issues, { pattern: SHA256_PATTERN });
      },
    );
  }

  const packs = document['packs'];
  if (!Array.isArray(packs)) {
    issues.push(issue('INVALID_TYPE', '(root).packs', 'Expected an array.'));
  } else {
    for (let index = 0; index < packs.length; index += 1) {
      const pack = packs[index];
      const packPath = `(root).packs[${String(index)}]`;
      if (!isPlainObject(pack)) {
        issues.push(issue('INVALID_TYPE', packPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(pack, PACK_FIELDS, packPath, issues);
      requireString(pack, 'id', packPath, issues, { nonEmpty: true });
      requireString(pack, 'version', packPath, issues, { nonEmpty: true });
      requireString(pack, 'victCompatibility', packPath, issues, { nonEmpty: true });

      const documentation = pack['documentation'];
      if (documentation !== undefined && documentation !== null) {
        if (!isPlainObject(documentation)) {
          issues.push(issue('INVALID_TYPE', `${packPath}.documentation`, 'Expected an object.'));
        } else {
          checkAllowedFields(
            documentation,
            new Set(['summary']),
            `${packPath}.documentation`,
            issues,
          );
          if (typeof documentation['summary'] !== 'string') {
            issues.push(
              issue('INVALID_TYPE', `${packPath}.documentation.summary`, 'Expected a string.'),
            );
          }
        }
      }
      validateObjectArray(
        pack['contracts'] ?? [],
        `${packPath}.contracts`,
        new Set(['id', 'revision']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'id', entryPath, issues, { nonEmpty: true });
          requireString(entry, 'revision', entryPath, issues, { nonEmpty: true });
        },
      );
      validateObjectArray(
        pack['permissions'] ?? [],
        `${packPath}.permissions`,
        new Set(['id', 'description']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'id', entryPath, issues, { nonEmpty: true });
          if (entry['description'] !== undefined) {
            requireString(entry, 'description', entryPath, issues, { nonEmpty: true });
          }
        },
      );
      validateObjectArray(
        pack['configuration'] ?? [],
        `${packPath}.configuration`,
        new Set(['name', 'required', 'description', 'sensitive']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'name', entryPath, issues, { nonEmpty: true });
          if (entry['required'] !== undefined) requireBoolean(entry, 'required', entryPath, issues);
          if (entry['sensitive'] !== undefined)
            requireBoolean(entry, 'sensitive', entryPath, issues);
          if (entry['description'] !== undefined) {
            requireString(entry, 'description', entryPath, issues, { nonEmpty: true });
          }
        },
      );
      validateObjectArray(
        pack['secrets'] ?? [],
        `${packPath}.secrets`,
        new Set(['name', 'required', 'description']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'name', entryPath, issues, { nonEmpty: true });
          if (entry['required'] !== undefined) requireBoolean(entry, 'required', entryPath, issues);
          if (entry['description'] !== undefined) {
            requireString(entry, 'description', entryPath, issues, { nonEmpty: true });
          }
        },
      );
      validateObjectArray(
        pack['doubles'] ?? [],
        `${packPath}.doubles`,
        new Set(['capabilityId', 'revision', 'modes']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'capabilityId', entryPath, issues, { nonEmpty: true });
          requireString(entry, 'revision', entryPath, issues, { nonEmpty: true });
          if (entry['modes'] !== undefined) {
            requireStringArray(entry, 'modes', entryPath, issues, { nonEmpty: true });
          }
        },
      );
      validateObjectArray(
        pack['evaluations'] ?? [],
        `${packPath}.evaluations`,
        new Set(['id', 'capabilityId', 'description']),
        issues,
        (entry, entryPath) => {
          requireString(entry, 'id', entryPath, issues, { nonEmpty: true });
          requireString(entry, 'capabilityId', entryPath, issues, { nonEmpty: true });
          if (entry['description'] !== undefined) {
            requireString(entry, 'description', entryPath, issues, { nonEmpty: true });
          }
        },
      );
      const provenance = pack['provenance'];
      if (provenance !== undefined && provenance !== null) {
        if (!isPlainObject(provenance)) {
          issues.push(issue('INVALID_TYPE', `${packPath}.provenance`, 'Expected an object.'));
        } else {
          checkAllowedFields(
            provenance,
            new Set(['author', 'license', 'source']),
            `${packPath}.provenance`,
            issues,
          );
          for (const field of ['author', 'license', 'source'] as const) {
            if (provenance[field] !== undefined) {
              requireString(provenance, field, `${packPath}.provenance`, issues, {
                nonEmpty: true,
              });
            }
          }
        }
      }
      validateCapability(pack['capabilities'], `${packPath}.capabilities`, issues);
    }
  }

  if (issues.length > 0) return fail(issues);
  return ok();
}
