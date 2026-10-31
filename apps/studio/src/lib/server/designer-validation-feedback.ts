import { formatInputValidationFeedback } from '@victframework/mastra';
import type {
  InputValidationFeedbackPolicy,
  InputValidationFeedbackResolver,
  InputValidationRule,
  SafeInputValidationIssue,
} from '@victframework/mastra';
import { agentReadPresentation, readSections } from '../designer/agent-reads.js';
import { editPresentation as agentEditPresentation } from '../designer/agent-edit-presentation.js';
// Host feedback projects the registered tool schemas; it does not maintain a
// second operation vocabulary or validate canonical edits itself.
function declaredFields(...schemas: readonly unknown[]): string[] {
  const fields = new Set(['focus', 'part']);
  const seen = new Set<object>(),
    pending = [...schemas];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    const schema = value as Record<string, unknown>;
    if (
      schema.properties &&
      typeof schema.properties === 'object' &&
      !Array.isArray(schema.properties)
    )
      for (const key of Object.keys(schema.properties)) fields.add(key);
    pending.push(...Object.values(schema));
  }
  return [...fields];
}
const fields = declaredFields(agentReadPresentation, agentEditPresentation);
const READ = `section: ${readSections.join('|')}.`;
const READ_FIELDS =
  'Use only fields declared for the chosen section; omit ignored fields. Read the current tool input schema.';
const EDIT =
  'Provide expectedRevision, reason and operations; use exact op names and the fields declared for that op.';
const OBSERVE =
  'Provide focus; part requires nodeId. Observation checks visible appearance, not interactions.';
const TYPE = 'Use the field type declared in this tool input schema.';
const OP = 'Choose an exact op from the edit contract; each operation has a closed field set.';
const SCOPE =
  'Use scope schema vict.ui-slot-scope@1 and declared props, state, conditions and outputs.';
const INITIAL = 'initial must match its declared state type.';
const JSON_TYPES = {
  array: 'Use a JSON array, not quoted JSON text; omit optional fields rather than sending null.',
  object: 'Use a JSON object, not quoted JSON text; omit optional fields rather than sending null.',
  boolean:
    'Use a JSON boolean true or false, without quotes; omit optional fields rather than sending null.',
  integer:
    'Use a JSON integer number, without quotes; omit optional fields rather than sending null.',
  number: 'Use a JSON number, without quotes; omit optional fields rather than sending null.',
  string: 'Use a JSON string; omit optional fields rather than sending null.',
} as const;
// Repair guidance is derived from the trusted registered input schema, never parser values.
const editDefinitions = (
  agentEditPresentation as unknown as {
    $defs: Record<
      string,
      { oneOf?: readonly { $ref: string }[]; properties?: { type?: { const?: unknown } } }
    >;
  }
).$defs;
const expressionKinds = (editDefinitions.expression?.oneOf ?? [])
  .map((item) => editDefinitions[item.$ref.split('/').at(-1)!]?.properties?.type?.const)
  .filter((item): item is string => typeof item === 'string');
const EXPRESSION = `Expected exactly one expression object with type ${expressionKinds.join('|')}; use its declared required fields from the tool schema.`;
const HINTS = [
  READ,
  READ_FIELDS,
  EDIT,
  OBSERVE,
  TYPE,
  OP,
  SCOPE,
  INITIAL,
  EXPRESSION,
  ...Object.values(JSON_TYPES),
];
/** Only trusted host presentation is inspected. Parser values/messages/expected types
 * never supply these hints. Resolve local references with cycle-aware reference traversal. */
function readTypeHint(path: readonly (string | number)[]): string | undefined {
  const root = agentReadPresentation as unknown as Record<string, unknown>;
  const object = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const resolve = (value: unknown) => {
    let current = object(value);
    const seen = new Set<object>();
    while (current && typeof current.$ref === 'string') {
      if (seen.has(current)) return;
      seen.add(current);
      if (!current.$ref.startsWith('#/')) return;
      let target: unknown = root;
      for (const part of current.$ref.slice(2).split('/')) {
        const record = object(target),
          key = part.replace(/~1/g, '/').replace(/~0/g, '~');
        if (!record || !Object.hasOwn(record, key)) return;
        target = record[key];
      }
      current = object(target);
    }
    return current && typeof current.$ref !== 'string' ? current : undefined;
  };
  let current: Record<string, unknown> | undefined = root;
  for (const part of path) {
    current = resolve(current);
    if (!current) return;
    if (typeof part === 'number') current = resolve(current.items);
    else {
      const properties = object(current.properties);
      current =
        properties && Object.hasOwn(properties, part) ? resolve(properties[part]) : undefined;
    }
  }
  current = resolve(current);
  const type = current?.type;
  return typeof type === 'string' && Object.hasOwn(JSON_TYPES, type)
    ? JSON_TYPES[type as keyof typeof JSON_TYPES]
    : undefined;
}
const allowedRules = new Set([
  'invalid',
  'invalid_type',
  'missing_field',
  'unknown_field',
  'invalid_enum',
  'invalid_union',
  'too_small',
  'too_big',
  'invalid_format',
  'invalid_value',
]);
/** Neutral parse diagnostics contain no received values or schema-author messages. */
export function studioContractValidationIssues(
  issues: readonly { readonly code: string; readonly path: readonly PropertyKey[] }[],
) {
  return issues.map((issue) => ({
    code:
      issue.code === 'unrecognized_keys'
        ? 'unknown_field'
        : allowedRules.has(issue.code)
          ? issue.code
          : 'invalid',
    path: issue.path
      .filter(
        (part): part is string | number => typeof part === 'string' || typeof part === 'number',
      )
      .join('.'),
    message: 'Input does not match its declared contract.',
  }));
}
function policy(kind: 'read' | 'edit' | 'observe'): InputValidationFeedbackPolicy {
  const fallback =
    kind === 'read'
      ? { path: ['section'], rule: 'invalid_union' as InputValidationRule, expected: READ }
      : kind === 'edit'
        ? { path: ['operations'], rule: 'invalid_union' as InputValidationRule, expected: EDIT }
        : { path: ['focus'], rule: 'invalid_type' as InputValidationRule, expected: OBSERVE };
  return {
    fields,
    expectedHints: HINTS,
    format: (issues: readonly SafeInputValidationIssue[]) => ({
      code: 'VICT_TOOL_INPUT_INVALID',
      issues: issues.length
        ? issues.map((issue) => {
            if (!issue.path.length) return fallback;
            const last = issue.path.at(-1),
              expected =
                kind === 'edit' && issue.path.includes('expression')
                  ? EXPRESSION
                  : kind === 'read' && (last === 'section' || issue.rule === 'invalid_union')
                    ? READ
                    : kind === 'read' && issue.rule === 'invalid'
                      ? READ_FIELDS
                      : last === 'scope'
                        ? SCOPE
                        : last === 'initial'
                          ? INITIAL
                          : issue.rule === 'invalid_union'
                            ? kind === 'read'
                              ? READ
                              : OP
                            : TYPE;
            return {
              ...issue,
              expected:
                kind === 'read' && issue.rule === 'invalid_type'
                  ? (readTypeHint(issue.path) ?? expected)
                  : expected,
            };
          })
        : [fallback],
    }),
  };
}
const policies = {
  'studio.screen.read': policy('read'),
  'studio.screen.edit': policy('edit'),
  'studio.screen.observe': policy('observe'),
} as const;
/** Static host opt-in; resolver never receives arguments, parser messages or values. */
export function createStudioInputValidationFeedback(
  capabilities: readonly { readonly id: string; readonly revision: string }[],
): InputValidationFeedbackResolver {
  const pins = new Map(capabilities.map((capability) => [capability.id, capability.revision]));
  return (id, revision) =>
    pins.get(id) === revision ? policies[id as keyof typeof policies] : undefined;
}

/** Public parser-evaluation receipt uses the same non-echoing closed details. */
export function studioValidationRejection(
  id: string,
  issues: Parameters<typeof studioContractValidationIssues>[0],
) {
  const value = formatInputValidationFeedback(
    studioContractValidationIssues(issues),
    policies[id as keyof typeof policies],
  );
  return value
    ? (JSON.parse(value) as {
        code: 'VICT_TOOL_INPUT_INVALID';
        issues: readonly {
          path: readonly (string | number)[];
          rule: InputValidationRule;
          expected?: string;
        }[];
      })
    : { code: 'VICT_TOOL_INPUT_INVALID' as const, issues: [] };
}
