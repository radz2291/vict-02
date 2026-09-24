import {
  checkAllowedFields,
  fail,
  isPlainObject,
  issue,
  ok,
  requireString,
  requireStringArray,
  type ValidationIssue,
  type ValidationResult,
} from './common.js';

/** Closed vocabularies of `vict.builder.tools@1` and `vict.builder.profile@1` (architecture §3.5/§3.7). */

const TOOLS_FIELDS: ReadonlySet<string> = new Set(['schemaMarker', 'tools', 'absent']);
const TOOL_FIELDS: ReadonlySet<string> = new Set(['name', 'summary', 'input', 'enforcement']);
const ABSENT_FIELDS: ReadonlySet<string> = new Set(['name', 'reason']);
const TOOL_NAMES: ReadonlySet<string> = new Set([
  'fs.read',
  'fs.write',
  'shell.run',
  'git.status',
  'git.diff',
  'git.log',
  'git.commit',
  'kit.verify',
  'kit.validate',
  'kit.generate',
]);
const ENFORCEMENTS: ReadonlySet<string> = new Set([
  'read-only',
  'in-scope-write',
  'listed-scripts',
  'working-branch',
  'kit-gate',
]);

/** Validate a `vict.builder.tools@1` manifest (closed vocabulary). */
export function validateTools(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, TOOLS_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.tools@1$/,
  });

  const tools = document['tools'];
  if (!Array.isArray(tools)) {
    issues.push(issue('INVALID_TYPE', '(root).tools', 'Expected an array.'));
  } else {
    for (let index = 0; index < tools.length; index += 1) {
      const tool = tools[index];
      const toolPath = `(root).tools[${String(index)}]`;
      if (!isPlainObject(tool)) {
        issues.push(issue('INVALID_TYPE', toolPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(tool, TOOL_FIELDS, toolPath, issues);
      requireString(tool, 'name', toolPath, issues);
      const name = tool['name'];
      if (typeof name === 'string' && !TOOL_NAMES.has(name)) {
        issues.push(issue('UNKNOWN_TOOL', `${toolPath}.name`, 'Tool outside the declared set.'));
      }
      requireString(tool, 'summary', toolPath, issues, { nonEmpty: true });
      requireStringArray(tool, 'input', toolPath, issues);
      requireString(tool, 'enforcement', toolPath, issues);
      const enforcement = tool['enforcement'];
      if (typeof enforcement === 'string' && !ENFORCEMENTS.has(enforcement)) {
        issues.push(
          issue(
            'INVALID_VALUE',
            `${toolPath}.enforcement`,
            'Enforcement class outside the closed vocabulary.',
          ),
        );
      }
    }
  }

  const absent = document['absent'];
  if (!Array.isArray(absent)) {
    issues.push(issue('INVALID_TYPE', '(root).absent', 'Expected an array.'));
  } else {
    for (let index = 0; index < absent.length; index += 1) {
      const entry = absent[index];
      const entryPath = `(root).absent[${String(index)}]`;
      if (!isPlainObject(entry)) {
        issues.push(issue('INVALID_TYPE', entryPath, 'Expected an object.'));
        continue;
      }
      checkAllowedFields(entry, ABSENT_FIELDS, entryPath, issues);
      requireString(entry, 'name', entryPath, issues, { nonEmpty: true });
      requireString(entry, 'reason', entryPath, issues, { nonEmpty: true });
    }
  }

  if (issues.length > 0) return fail(issues);
  return ok();
}

const PROFILE_FIELDS: ReadonlySet<string> = new Set([
  'schemaMarker',
  'name',
  'read',
  'write',
  'scripts',
  'control',
  'denials',
  'stopOnDenial',
]);

/** Validate a `vict.builder.profile@1` declaration (closed vocabulary). */
export function validateProfile(document: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isPlainObject(document))
    return fail([issue('INVALID_TYPE', '(root)', 'Expected an object.')]);
  checkAllowedFields(document, PROFILE_FIELDS, '(root)', issues);
  requireString(document, 'schemaMarker', '(root)', issues, {
    pattern: /^vict\.builder\.profile@1$/,
  });
  requireString(document, 'name', '(root)', issues, {
    pattern: /^builder\.(read|change|selfhost)$/,
  });
  requireStringArray(document, 'read', '(root)', issues);
  requireStringArray(document, 'write', '(root)', issues);
  requireStringArray(document, 'scripts', '(root)', issues);
  requireStringArray(document, 'control', '(root)', issues);
  requireStringArray(document, 'denials', '(root)', issues, { nonEmpty: true });
  requireStringArray(document, 'stopOnDenial', '(root)', issues);
  if (issues.length > 0) return fail(issues);
  return ok();
}
