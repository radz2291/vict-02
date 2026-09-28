/**
 * Authoring-tools slice — local `vict check` and `vict vocabulary`.
 *
 * `vict check <file>` compiles an author's Application Definition with the
 * SAME authoritative compiler the server uses (`compileApplication` from
 * `@victframework/application`) — server-free, store-free, governance-safe:
 * compilation never executes author handlers and never touches a database.
 *
 * Exit codes for the local commands (operator command codes 0/1/2/3 are
 * unchanged and reserved):
 * - 0: the definition is valid (or the vocabulary was printed);
 * - 1: usage error (missing argument, unreadable file, module without a
 *      recognizable definition export, malformed JSON);
 * - 4: the definition is INVALID — structured diagnostics were produced;
 * - 5: unexpected execution error (module load crash; always a bug or an
 *      environment problem, never an invalid definition).
 *
 * TypeScript loading: the packaged CLI consumes `.ts`/`.mts` definitions
 * through Node's built-in type stripping (Node >= 22.7 with
 * `--experimental-strip-types`, default-on from 23.6). Only ERASABLE
 * TypeScript is supported (no enums, namespaces, decorators, or parameter
 * properties). The `vict` bin re-execs itself with the flag when needed;
 * when the process cannot strip types and the bin was bypassed, the
 * command fails with exit 5 and an actionable message — it never claims
 * TypeScript support it cannot deliver.
 *
 * Module conventions (mirroring the generic application host):
 * - named `application` (+ optional named `resources`, `contracts`,
 *   `capabilities`, `components`) — the host shape; or
 * - a `default` export that is either the full input (`{ application, ... }`)
 *   or a bare ApplicationDefinition; or
 * - exactly one named export carrying a `vict.application@…` schema marker.
 *
 * Contracts and capabilities are reduced to the identity entries the
 * compiler consumes — full handler objects are never needed for a check.
 */

import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  compileApplication,
  describeApplicationVocabulary,
  type ApplicationIssue,
  type CompileApplicationInput,
} from '@victframework/application';

/** Stable machine-readable result of `vict check --json`. */
export interface VictCheckJson {
  readonly ok: boolean;
  readonly file: string;
  readonly schema: string | null;
  readonly applicationVersion: string | null;
  readonly issueCount: number;
  readonly issues: readonly {
    readonly code: string;
    readonly message: string;
    readonly path?: string;
    readonly allowedValues?: readonly string[];
  }[];
}

/** Stable machine-readable result of `vict vocabulary --json`. */
export type VictVocabularyJson = ReturnType<typeof describeApplicationVocabulary>;

const TYPE_SCRIPT_PATTERN = /\.(ts|mts|cts)$/i;
const SCHEMA_MARKER = /^vict\.application@(1|2)$/;

export function isTypeScriptPath(path: string): boolean {
  return TYPE_SCRIPT_PATTERN.test(path);
}

/** A module failed to load. The message is actionable, never an echo of author code. */
function loadErrorMessage(filePath: string, error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'ERR_MODULE_NOT_FOUND') {
    return (
      `the definition imports a package that is not installed. Install the ` +
      `Vict packages next to the definition (npm install @victframework/sdk @victframework/application).`
    );
  }
  if (code === 'ERR_UNKNOWN_FILE_EXTENSION') {
    return (
      `this process cannot load TypeScript. Run the check through the vict ` +
      `bin (it re-execs with Node's built-in type stripping, Node >= 22.7), ` +
      `or pass a compiled .js/.mjs file. File: ${filePath}`
    );
  }
  return `the definition module could not be loaded (${code ?? 'unknown error'}). File: ${filePath}`;
}

/** Dynamically import the definition module from its absolute path. */
async function importDefinitionModule(filePath: string): Promise<Record<string, unknown>> {
  const url = pathToFileURL(filePath).href;
  return (await import(url)) as Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaMarkerOf(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  const schema = value['schema'];
  return typeof schema === 'string' && SCHEMA_MARKER.test(schema) ? schema : null;
}

/**
 * Extract the compiler input from a definition module following the host
 * conventions (see the module docblock). Returns a structured usage error
 * message when no recognizable definition export exists.
 */
export function extractCompileInput(
  moduleNamespace: Record<string, unknown>,
):
  | { ok: true; input: CompileApplicationInput; schema: string | null }
  | { ok: false; error: string } {
  // Full input object (default or named `checkInput`).
  const candidates: unknown[] = [moduleNamespace['default'], moduleNamespace['checkInput']];
  for (const candidate of candidates) {
    if (isPlainObject(candidate) && 'application' in candidate) {
      const input = normalizeInput(candidate as Partial<CompileApplicationInput>);
      return {
        ok: true,
        input,
        schema: schemaMarkerOf((candidate as Partial<CompileApplicationInput>)['application']),
      };
    }
  }
  // Default export that IS a bare application definition.
  if (schemaMarkerOf(moduleNamespace['default']) !== null) {
    const input = normalizeInput({
      application: moduleNamespace['default'] as CompileApplicationInput['application'],
    });
    return { ok: true, input, schema: schemaMarkerOf(moduleNamespace['default']) };
  }
  // Host shape: named `application` (+ optional bindings).
  const application = moduleNamespace['application'];
  if (application !== undefined) {
    const input = normalizeInput({
      application,
      resources: moduleNamespace['resources'],
      contracts: moduleNamespace['contracts'],
      capabilities: moduleNamespace['capabilities'],
      components: moduleNamespace['components'],
    } as Partial<CompileApplicationInput>);
    return { ok: true, input, schema: schemaMarkerOf(application) };
  }
  // Fallback: exactly one named export that looks like the definition.
  const flagged = Object.entries(moduleNamespace).filter(
    ([, value]) => schemaMarkerOf(value) !== null,
  );
  if (flagged.length === 1) {
    const [exportName, exportValue] = flagged[0] as [string, unknown];
    void exportName;
    const input = normalizeInput({
      application: exportValue as CompileApplicationInput['application'],
    });
    return { ok: true, input, schema: schemaMarkerOf(exportValue) };
  }
  return {
    ok: false,
    error:
      flagged.length === 0
        ? 'the module exports no recognizable Application Definition. Export `application` (with optional `resources`, `contracts`, `capabilities`, `components`), a default definition, or a default `{ application, resources }` input object.'
        : `the module exports ${flagged.length} definitions with a vict.application@ schema marker (${flagged
            .map(([name]) => name)
            .sort()
            .join(', ')}). Export exactly one, or name the primary one \`application\`.`,
  };
}

/** Reduce author bindings to the compiler's identity-entry inputs. */
function normalizeInput(partial: Partial<CompileApplicationInput>): CompileApplicationInput {
  const input: {
    application: CompileApplicationInput['application'];
    resources: CompileApplicationInput['resources'];
    contracts?: CompileApplicationInput['contracts'];
    capabilities?: CompileApplicationInput['capabilities'];
    components?: CompileApplicationInput['components'];
  } = {
    application: partial.application as CompileApplicationInput['application'],
    resources: Array.isArray(partial.resources)
      ? (partial.resources as CompileApplicationInput['resources'])
      : [],
  };
  const identityEntries = (value: unknown, key: 'id'): { id: string; revision: string }[] =>
    Array.isArray(value)
      ? value
          .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
          .filter(
            (entry) => typeof entry[key] === 'string' && typeof entry['revision'] === 'string',
          )
          .map((entry) => ({ id: entry['id'] as string, revision: entry['revision'] as string }))
      : [];
  const contracts = identityEntries(partial.contracts, 'id');
  if (contracts.length > 0) input.contracts = contracts;
  const capabilities = identityEntries(partial.capabilities, 'id');
  if (capabilities.length > 0) input.capabilities = capabilities;
  const components = Array.isArray(partial.components)
    ? partial.components
        .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
        .filter(
          (entry) =>
            typeof entry['componentId'] === 'string' && typeof entry['revision'] === 'string',
        )
        .map((entry) => ({
          componentId: entry['componentId'] as string,
          revision: entry['revision'] as string,
        }))
    : [];
  if (components.length > 0) input.components = components;
  return input as CompileApplicationInput;
}

/* ------------------------------------------------------------------ */
/* Diagnostic enrichment (allowed values, from the same vocabulary)    */
/* ------------------------------------------------------------------ */

type Vocabulary = ReturnType<typeof describeApplicationVocabulary>;

/** Normalize a diagnostic path for prefix matching: `a[0].b[x]` -> `a[].b[]`. */
function normalizePath(path: string): string {
  return path.replace(/\[[^\]]*\]/g, '[]');
}

interface VocabObject {
  readonly fields?: readonly string[];
  readonly fieldsV2?: readonly string[];
  readonly fieldsByKey?: Readonly<Record<string, readonly string[]>>;
  readonly fieldsByKeyV1?: Readonly<Record<string, readonly string[]>>;
}

/** All allowed member names of a vocabulary object (V1 + V2, sorted). */
function allowedFieldsOf(object: VocabObject): string[] {
  return [...new Set([...(object.fields ?? []), ...(object.fieldsV2 ?? [])])].sort();
}

/** Union of every role's fields (used when a path cannot name the role). */
function unionOfByKey(object: VocabObject): string[] {
  const all = Object.values(object.fieldsByKey ?? {})
    .concat(Object.values(object.fieldsByKeyV1 ?? {}))
    .flat();
  return [...new Set(all)].sort();
}

/**
 * Path templates -> vocabulary object, matched longest-prefix first against
 * the normalized diagnostic path. Derived from the vocabulary itself.
 */
function buildPathTemplates(vocabulary: Vocabulary): { prefix: string; object: VocabObject }[] {
  const objects = vocabulary.objects;
  const templates: [string, VocabObject | undefined][] = [
    ['application', objects['application']],
    ['application.routes[]', objects['route']],
    ['application.routes[].nav', objects['routeNav']],
    ['application.screens[]', objects['screen']],
    ['application.screens[].breadcrumbs[]', objects['breadcrumb']],
    ['application.screens[].layout[]', objects['region']],
    ['application.screens[].layout[].surfaces[]', objects['surface']],
    ['application.screens[].states', objects['screenStates']],
    ['application.screens[].tabs[]', objects['tab']],
    ['application.screens[].tabs[].surfaces[]', objects['surface']],
    ['application.views[]', objects['view']],
    ['application.forms[]', objects['form']],
    ['application.forms[].fields[]', objects['formField']],
    ['application.actions[]', objects['action']],
    ['application.resources[]', objects['resourceDefinition']],
    ['application.resources[].fields[]', objects['resourceField']],
    ['application.theme', objects['theme']],
    ['application.theme.tokens[]', objects['themeTokenAssignment']],
  ];
  return templates
    .filter((entry): entry is [string, VocabObject] => entry[1] !== undefined)
    .map(([prefix, object]) => ({ prefix, object }))
    .sort((a, b) => b.prefix.length - a.prefix.length);
}

/**
 * Attach `allowedValues` to an issue when this package's vocabulary can
 * speak for it. Deterministic; conservative (no values when unsure).
 */
function enrichIssue(
  issue: ApplicationIssue,
  vocabulary: Vocabulary,
  templates: { prefix: string; object: VocabObject }[],
): { code: string; message: string; path?: string; allowedValues?: readonly string[] } {
  const base = {
    code: issue.code,
    message: issue.message,
    ...(issue.path !== undefined ? { path: issue.path } : {}),
  };
  const allowed = (values: readonly string[]) => ({ ...base, allowedValues: values });

  switch (issue.code) {
    case 'UNKNOWN_SURFACE_ROLE':
      return allowed(vocabulary.closedValues.surfaceRoles.v2);
    case 'INVALID_THEME_TOKEN':
      return allowed(vocabulary.closedValues.themeTokenNames);
    case 'INVALID_ACTION_FEEDBACK':
      return allowed(vocabulary.closedValues.actionFeedbackOutcomes);
    case 'INVALID_UI_COMPOSITION': {
      const merged = new Set<string>();
      for (const table of [
        vocabulary.closedValues.composition.application,
        vocabulary.closedValues.composition.page,
        vocabulary.closedValues.composition.regionPresentation,
      ]) {
        for (const values of Object.values(table)) for (const value of values) merged.add(value);
      }
      return allowed([...merged].sort());
    }
    case 'INVALID_VIEW_DECLARATION':
      if (/sort direction/i.test(issue.message))
        return allowed(vocabulary.closedValues.sortDirections);
      break;
    case 'INVALID_CHART_DECLARATION':
      if (/\bkind\b/i.test(issue.message)) return allowed(vocabulary.closedValues.chartKinds);
      break;
    case 'INVALID_STATUS_DECLARATION':
      if (/\btone\b/i.test(issue.message)) return allowed(vocabulary.closedValues.statusTones);
      break;
    case 'APPLICATION_UNKNOWN_FIELD':
    case 'UNKNOWN_FIELD':
    case 'APPLICATION_EMBEDDED_VALUE_FIELD': {
      if (issue.path === undefined) break;
      const normalized = normalizePath(issue.path);
      // Surface diagnostics carry the inline form `screens[X] (surface 'id').field`;
      // the role is not recoverable from the path, so offer the union over the
      // closed per-role field sets.
      if (/ \(surface /.test(issue.path) || normalized.endsWith('.surfaces[]')) {
        const surfaceTemplate = templates.find((entry) => entry.prefix.endsWith('.surfaces[]'));
        if (surfaceTemplate !== undefined) return allowed(unionOfByKey(surfaceTemplate.object));
      }
      // Action unknown fields: same treatment over the per-kind field sets.
      if (normalized.startsWith('application.actions[]')) {
        const actionTemplate = templates.find((entry) => entry.prefix === 'application.actions[]');
        if (actionTemplate !== undefined) return allowed(unionOfByKey(actionTemplate.object));
      }
      for (const template of templates) {
        if (normalized === template.prefix || normalized.startsWith(`${template.prefix}.`)) {
          const fields = allowedFieldsOf(template.object);
          if (fields.length > 0) return allowed(fields);
          break;
        }
      }
      break;
    }
    default:
      break;
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

const CHECK_MODULE_CONVENTIONS = `Module conventions (same as the generic application host):
  export const application = defineApplication({ ... });
  export const resources = [ ... ];            // optional
  export const contracts = [ ... ];            // optional (identity entries are read)
  export const capabilities = [ ... ];         // optional (identity entries are read)
  export const components = [ ... ];           // optional ({ componentId, revision })
A default export may instead be the definition itself or { application, resources }.`;

/** Run `vict check <file> [--json]`. Returns the process exit code. */
export async function runCheckCommand(
  args: readonly string[],
  io: { readonly stdout: (line: string) => void; readonly stderr: (line: string) => void },
  options: { readonly jsonOut?: boolean } = {},
): Promise<number> {
  const positionals = args.filter((arg) => arg !== '--json');
  const jsonOut = options.jsonOut === true || args.length !== positionals.length;
  if (positionals.length !== 1) {
    io.stderr('vict check: exactly one definition file is required.');
    io.stderr('Usage: vict check <definition.ts|definition.js> [--json]');
    return 1;
  }
  const filePath = positionals[0] as string;
  let moduleNamespace: Record<string, unknown>;
  try {
    statSync(filePath);
  } catch {
    io.stderr(`vict check: the file does not exist or is not readable: ${filePath}`);
    return 1;
  }
  try {
    moduleNamespace = await importDefinitionModule(filePath);
  } catch (error) {
    io.stderr(`vict check: ${loadErrorMessage(filePath, error)}`);
    return 5;
  }
  const extracted = extractCompileInput(moduleNamespace);
  if (!extracted.ok) {
    io.stderr(`vict check: ${extracted.error}`);
    io.stderr(CHECK_MODULE_CONVENTIONS);
    return 1;
  }
  const vocabulary = describeApplicationVocabulary();
  const templates = buildPathTemplates(vocabulary);
  let result;
  try {
    result = compileApplication(extracted.input);
  } catch (error) {
    // compileApplication never throws for invalid definitions; reaching here
    // is an unexpected execution error (exit 5), never "invalid".
    io.stderr(`vict check: unexpected compiler failure: ${(error as Error).message}`);
    return 5;
  }
  if (result.ok) {
    if (jsonOut) {
      const payload: VictCheckJson = {
        ok: true,
        file: filePath,
        schema: extracted.schema,
        applicationVersion: result.plan.applicationVersion,
        issueCount: 0,
        issues: [],
      };
      io.stdout(JSON.stringify(payload, null, 2));
    } else {
      io.stdout(`vict check: OK — ${filePath}`);
      io.stdout(`  schema:              ${extracted.schema ?? 'unknown'}`);
      io.stdout(
        `  application id:      ${result.plan.applicationId} @ ${result.plan.applicationRevision}`,
      );
      io.stdout(`  applicationVersion:  ${result.plan.applicationVersion}`);
    }
    return 0;
  }
  const issues = result.issues.map((issue) => enrichIssue(issue, vocabulary, templates));
  if (jsonOut) {
    const payload: VictCheckJson = {
      ok: false,
      file: filePath,
      schema: extracted.schema,
      applicationVersion: null,
      issueCount: issues.length,
      issues,
    };
    io.stdout(JSON.stringify(payload, null, 2));
  } else {
    io.stderr(
      `vict check: INVALID — ${filePath} (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    );
    for (const issue of issues) {
      const location = issue.path !== undefined ? ` [${issue.path}]` : '';
      const values =
        issue.allowedValues !== undefined ? ` (allowed: ${issue.allowedValues.join(', ')})` : '';
      io.stderr(`  ${issue.code}${location}: ${issue.message}${values}`);
    }
    io.stderr('Exit code 4 (invalid definition). Fix the issues above and re-run.');
  }
  return 4;
}

/** Run `vict vocabulary [--json]`. Returns the process exit code. */
export function runVocabularyCommand(
  args: readonly string[],
  io: { readonly stdout: (line: string) => void; readonly stderr: (line: string) => void },
  options: { readonly jsonOut?: boolean } = {},
): number {
  const jsonOut = options.jsonOut === true || args.includes('--json');
  const vocabulary = describeApplicationVocabulary();
  if (jsonOut) {
    io.stdout(JSON.stringify(vocabulary, null, 2));
    return 0;
  }
  io.stdout('vict vocabulary — the closed Application Definition vocabulary (vict.application@2)');
  io.stdout('');
  io.stdout(`Surface roles (@2): ${vocabulary.closedValues.surfaceRoles.v2.join(', ')}`);
  io.stdout(`Action kinds:       ${vocabulary.closedValues.actionKinds.join(', ')}`);
  io.stdout(`Chart kinds:        ${vocabulary.closedValues.chartKinds.join(', ')}`);
  io.stdout(`Status tones:       ${vocabulary.closedValues.statusTones.join(', ')}`);
  io.stdout(`Sort directions:    ${vocabulary.closedValues.sortDirections.join(', ')}`);
  io.stdout(`Screen layouts:     ${vocabulary.closedValues.screenLayoutModes.join(', ')}`);
  io.stdout(`Form widgets:       ${vocabulary.closedValues.formFieldWidgets.join(', ')}`);
  io.stdout(`Theme tokens:       ${vocabulary.closedValues.themeTokenNames.join(', ')}`);
  io.stdout('');
  io.stdout('Per-object allowed fields, per-role/per-kind field sets, composition choices,');
  io.stdout('and every diagnostic code: vict vocabulary --json');
  io.stdout('(machine-readable, derived from the compiler’s own enforcement constants).');
  return 0;
}
