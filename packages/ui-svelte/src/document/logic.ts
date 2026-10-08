/**
 * Render-plan → DOM view-model helpers for the document renderer.
 *
 * Pure functions over the compiled `vict.ui-render-plan@1`; the Svelte
 * components consume these. No global state, no hidden registries.
 */

import {
  evaluateExpression,
  isUiValueOfType,
  type UiPropDecl,
  type UiExpression,
  type UiScopeValues,
  type UiRenderInstruction,
  type UiRenderPlan,
  type UiResolvedValue,
} from '@victframework/ui';

/** Resolved dynamic scope at one render position. */
export interface DocumentScope {
  readonly view?: Readonly<Record<string, unknown>>;
  readonly record?: Readonly<Record<string, unknown>>;
  readonly props?: Readonly<Record<string, unknown>>;
  readonly state: Readonly<Record<string, unknown>>;
  readonly tokens: Readonly<Record<string, string>>;
  readonly repeatItem?: {
    readonly name: string;
    readonly value: Readonly<Record<string, unknown>>;
  };
  readonly repeatItems?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** The emitted payload while resolving an output-binding template. */
  readonly output?: unknown;
}

export function toScopeValues(scope: DocumentScope): UiScopeValues {
  return {
    ...(scope.view !== undefined ? { view: scope.view } : {}),
    ...(scope.record !== undefined ? { record: scope.record } : {}),
    ...(scope.props !== undefined ? { props: scope.props } : {}),
    state: scope.state,
    tokens: scope.tokens,
    ...(scope.repeatItem !== undefined ? { repeatItem: scope.repeatItem } : {}),
    ...(scope.repeatItems !== undefined ? { repeatItems: scope.repeatItems } : {}),
    ...(scope.output !== undefined ? { output: scope.output } : {}),
  };
}

/** The U1 default pure-operation registry (declared in catalogs via opNames). */
export const DEFAULT_UI_OPS: Readonly<Record<string, (args: readonly unknown[]) => unknown>> = {
  concat: (args) => args.map((arg) => String(arg ?? '')).join(''),
};

/** Evaluate a resolved attribute/text value to its render-time value. */
export function resolveValue(value: UiResolvedValue, scope: DocumentScope): unknown {
  if (value.type === 'literal') return value.value;
  if (value.type === 'token') return scope.tokens[value.id];
  return evaluateExpression(value.expression, toScopeValues(scope), DEFAULT_UI_OPS);
}

/** The occurrence key at render time: base key + repeat record keys. */
/**
 * U2-02 duplicate-key rejection: the FIRST occurrence of a repeat key keeps
 * the canonical identity; later duplicates get a stable positional fallback
 * (key#dupN) so every rendered record keeps a unique occurrence identity,
 * and each duplicate is REPORTED (UI_RENDER_DUPLICATE_KEY) through the
 * renderer diagnostic channel instead of silently collapsing.
 */
export function uniqueRepeatKeys(
  keys: readonly string[],
  nodeId: string,
  reportDiagnostic?: (diagnostic: {
    code: string;
    message: string;
    detail?: Record<string, unknown>;
  }) => void,
): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return key;
    reportDiagnostic?.({
      code: 'UI_RENDER_DUPLICATE_KEY',
      message: `Duplicate repeat key '${key}' in repeat '${nodeId}' — occurrence identity made unique (key#dup${count}).`,
      detail: { nodeId, key, duplicateIndex: count },
    });
    return `${key}#dup${count}`;
  });
}

export function occurrenceKey(baseKey: string, repeatKeys: readonly string[]): string {
  if (repeatKeys.length === 0) return baseKey;
  return `${baseKey}|${repeatKeys.join('|')}`;
}

/** Condition records by id. */
export function conditionsOf(
  plan: UiRenderPlan,
): Readonly<Record<string, (typeof plan.dynamic.conditions)[number]>> {
  return Object.fromEntries(plan.dynamic.conditions.map((condition) => [condition.id, condition]));
}

/** Evaluate a localState condition for branch selection. */
export function evaluateCondition(
  conditionId: string,
  conditions: ReturnType<typeof conditionsOf>,
  scope: DocumentScope,
): boolean {
  const condition = conditions[conditionId];
  if (condition === undefined || condition.kind !== 'localState') return false;
  return Boolean(evaluateExpression(condition.when, toScopeValues(scope)));
}

/** Escape a class selector's identifier characters, preserving the leading dot. */
const escapeCss = (selector: string): string => {
  let out = '';
  for (let index = 0; index < selector.length; index += 1) {
    const ch = selector[index] as string;
    const isSafe =
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= '0' && ch <= '9') ||
      ch === '_' ||
      ch === '-';
    const isLeadingDot = index === 0 && ch === '.';
    if (isSafe || isLeadingDot) {
      out += ch;
    } else {
      out += String.fromCharCode(92); // backslash
      out += ch;
    }
  }
  return out;
};

/**
 * Assemble the plan's style rules into CSS text, scoped under a root
 * class so documents never leak globally. Layer order follows the frozen
 * cascade: token → componentBase → componentVariant → source → local.
 */
export function styleRulesToCss(plan: UiRenderPlan, rootClass: string): string {
  const conditions = conditionsOf(plan);
  const layerOrder = plan.style.layers;
  const escapedRoot = escapeCss(rootClass);
  const sorted = [...plan.style.rules].sort(
    (a, b) => layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer),
  );
  const mediaBuckets = new Map<string, string[]>();
  const containerBuckets = new Map<string, string[]>();
  const plain: string[] = [];
  for (const rule of sorted) {
    const lines: string[] = [];
    for (const [index, declaration] of rule.declarations.entries()) {
      if (declaration.value.type === 'literal') {
        lines.push(`  ${declaration.property}: ${String(declaration.value.value)};`);
      } else if (declaration.value.type === 'token') {
        lines.push(
          `  ${declaration.property}: var(--ui-token-${sanitizeTokenId(declaration.value.id)});`,
        );
      }
      if (declaration.value.type === 'expression') lines.push(`  ${declaration.property}: var(${bindingVariable(rule.ruleId, index)});`);
    }
    const declarations = lines.join('\n');
    if (declarations === '') continue;
    const selector =
      rule.selector === ':root'
        ? `.${escapedRoot}`
        : // The pseudo suffix is appended AFTER escaping: a pseudo colon is
          // selector syntax, not a character to escape (F1 — an escaped
          // `\:hover` matches nothing).
          rule.pseudo !== undefined
          ? `.${escapedRoot} ${escapeCss(rule.selector)}:${rule.pseudo}`
          : `.${escapedRoot} ${escapeCss(rule.selector)}`;
    const css = `${selector} {\n${declarations}\n}`;
    if (rule.containerConditionId !== undefined) {
      const condition = conditions[rule.containerConditionId];
      if (condition?.kind === 'container') {
        const bucket = containerBuckets.get(`${condition.name} ${condition.query}`) ?? [];
        bucket.push(css);
        containerBuckets.set(`${condition.name} ${condition.query}`, bucket);
        continue;
      }
      plain.push(css);
    } else if (rule.mediaConditionId !== undefined) {
      const condition = conditions[rule.mediaConditionId];
      const query = condition?.kind === 'media' ? condition.query : undefined;
      if (query === undefined) {
        plain.push(css);
        continue;
      }
      const bucket = mediaBuckets.get(query) ?? [];
      bucket.push(css);
      mediaBuckets.set(query, bucket);
    } else {
      plain.push(css);
    }
  }
  let css = plain.join('\n\n');
  for (const [query, rules] of mediaBuckets) {
    css += `\n\n@media ${query} {\n${rules.join('\n\n')}\n}`;
  }
  for (const [containerQuery, rules] of containerBuckets) {
    css += `\n\n@container ${containerQuery} {\n${rules.join('\n\n')}\n}`;
  }
  return css;
}

/** CSS custom-property-safe token id (declared ids may contain dots). */
export function sanitizeTokenId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

/** Stable root class per plan (document+revision scoped). */
export function rootClassFor(plan: UiRenderPlan): string {
  const docHash = plan.documentId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `uv-root-${docHash}-${plan.revision.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** Depth-first walk of the instruction tree. */
export function walkInstructions(
  instruction: UiRenderInstruction,
  visit: (instruction: UiRenderInstruction) => void,
): void {
  visit(instruction);
  switch (instruction.kind) {
    case 'element':
      instruction.children.forEach((child) => walkInstructions(child, visit));
      break;
    case 'component':
      walkInstructions(instruction.body, visit);
      Object.values(instruction.slots).forEach((children) =>
        children.forEach((child) => walkInstructions(child, visit)),
      );
      break;
    case 'repeat':
      walkInstructions(instruction.template, visit);
      break;
    case 'conditional':
      instruction.branches.forEach((branch) =>
        branch.children.forEach((child) => walkInstructions(child, visit)),
      );
      break;
    case 'slot':
      instruction.fallback.forEach((child) => walkInstructions(child, visit));
      break;
    case 'unsupported':
      instruction.children.forEach((child) => walkInstructions(child, visit));
      break;
    case 'extension':
      Object.values(instruction.slots ?? {}).forEach(children => children.forEach(child => walkInstructions(child, visit)));
      break;
    case 'text':
      break;
  }
}

/** All node ids in the plan (editor canvas tooling). */
export function nodeIdsOf(plan: UiRenderPlan): readonly string[] {
  const ids: string[] = [];
  for (const structure of plan.structure) {
    walkInstructions(structure, (instruction) => ids.push(instruction.nodeId));
  }
  return [...new Set(ids)];
}

/** Coerce a repeat record to a field record. */
export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** Evaluate a component/extension instruction's declared props (typed, with defaults). */
export function evaluatedComponentProps(
  instruction: {
    readonly propDecls: readonly UiPropDecl[];
    readonly propValues: Readonly<Record<string, UiExpression>>;
  },
  scope: DocumentScope,
): Record<string, unknown> {
  return evaluateComponentPropValues(instruction, scope).values;
}

/** Invalid evaluated props refuse rendering rather than falling through to adapter defaults. */
export function evaluateComponentPropValues(
  instruction: { readonly propDecls: readonly UiPropDecl[]; readonly propValues: Readonly<Record<string, UiExpression>>; readonly rejectedProps?: readonly string[] },
  scope: DocumentScope,
): { readonly values: Record<string, unknown>; readonly invalidNames: readonly string[] } {
  const out: Record<string, unknown> = {};
  const invalidNames: string[] = [...(instruction.rejectedProps ?? [])];
  for (const declaration of instruction.propDecls) {
    if (invalidNames.includes(declaration.name)) continue;
    const declared = instruction.propValues[declaration.name];
    const value =
      declared !== undefined
        ? resolveValue({ type: 'expression', expression: declared }, scope)
        : declaration.default;
    if (value === undefined && declared === undefined && declaration.default === undefined) continue;
    if (declaration.type === 'array' ? Array.isArray(value) : isUiValueOfType(value, declaration.type)) {
      out[declaration.name] = Array.isArray(value) ? value.slice() : value;
    } else invalidNames.push(declaration.name);
  }
  return { values: out, invalidNames };
}

function bindingVariable(ruleId: string, index: number): string {
  return `--ui-binding-${ruleId.replace(/[^A-Za-z0-9_-]/g, '_')}-${index}`;
}
/** Runtime CSS variables preserve static cascade/gating for authored binding values. */
export function bindingStyleVariables(ids: readonly string[], plan: UiRenderPlan, scope: DocumentScope): string {
  const declarations: string[] = [];
  for (const rule of plan.style.rules) {
    if (!ids.includes(rule.ruleId)) continue;
    rule.declarations.forEach((decl, index) => {
      if (decl.value.type !== 'expression') return;
      const value = resolveValue(decl.value, scope);
      if ((typeof value === 'string' && !/[;{}<>]/.test(value)) || (typeof value === 'number' && Number.isFinite(value))) {
        declarations.push(`${bindingVariable(rule.ruleId, index)}: ${String(value)};`);
      }
    });
  }
  return declarations.join(' ');
}
