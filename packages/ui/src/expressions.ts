/**
 * Expression typing, scope checking and pure evaluation (API-SPEC §5).
 *
 * Scopes: `view.<field>` / `record.<field>`, `repeat.<itemName>.<field>`,
 * `prop.<name>`, `state.<key>`, `token.<id>`. Validation is lexical-scope
 * aware: inside a component definition registry only `prop.*` is visible;
 * at the instance/document level `prop.*` is not visible. Evaluation is a
 * pure function of the expression tree and the provided scope values — no
 * `eval`, no `Function`, no raw expression strings.
 */

import type {
  UiCatalogs,
  UiExpression,
  UiFieldTypes,
  UiPrimitiveType,
  UiValueType,
} from './document.js';
import { uiDiagnostic, type UiDiagnostic } from './diagnostics.js';

/** The lexical scopes visible at one position in a document. */
export interface UiScopeInfo {
  /** Visible repeat item names → field types (from declared templates). */
  readonly repeatItems: Readonly<Record<string, UiFieldTypes>>;
  /** True inside a definition registry (prop-only scope). */
  readonly inDefinition: boolean;
  /**
   * Declared type of `$output` in this scope (amendment §3.5), or undefined
   * when `$output` is not visible. Present ONLY inside output-binding
   * value/input expressions; any other occurrence of the `$output` ref is
   * `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID`.
   */
  readonly output?: UiPrimitiveType | UiValueType | 'void' | 'unknown';
}

export interface ResolvedRefType {
  readonly namespace: 'view' | 'record' | 'repeat' | 'prop' | 'state' | 'token';
  readonly type: UiPrimitiveType | 'unknown' | 'array' | 'any';
}

const PRIMITIVES: ReadonlySet<string> = new Set(['string', 'number', 'boolean']);

function literalType(value: string | number | boolean | null): UiPrimitiveType | 'null' {
  if (value === null) return 'null';
  return typeof value as UiPrimitiveType;
}

function typesCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'any' || actual === 'any' || actual === 'unknown') return true;
  if (actual === 'null') return true;
  if (expected === 'array') return actual === 'array';
  return PRIMITIVES.has(expected) && PRIMITIVES.has(actual) && expected === actual;
}

/** Reference-path split: `repeat.item.field` → ['repeat','item','field']. */
export function splitRef(path: string): readonly string[] {
  return path.split('.');
}

/** Walk an expression: type-check against the scope and catalogs. */
export function checkExpression(
  expression: UiExpression,
  catalogs: UiCatalogs,
  scope: UiScopeInfo,
  documentId: string,
  nodeId: string,
): UiDiagnostic[] {
  const issues: UiDiagnostic[] = [];
  const walk = (
    expr: UiExpression,
    localScope: UiScopeInfo,
  ): UiPrimitiveType | 'unknown' | 'array' | 'null' | 'any' => {
    switch (expr.type) {
      case 'literal':
        return literalType(expr.value);
      case 'ref': {
        return checkRef(expr.path, catalogs, localScope, documentId, nodeId, issues);
      }
      case 'compare': {
        const left = walk(expr.left, localScope);
        const right = walk(expr.right, localScope);
        if (
          left !== 'unknown' &&
          right !== 'unknown' &&
          left !== 'null' &&
          right !== 'null' &&
          !typesCompatible(left, right)
        ) {
          issues.push(
            uiDiagnostic('UI_EXPR_TYPE_MISMATCH', `Comparison compares ${left} with ${right}.`, {
              documentId,
              nodeId,
              expected: left,
              actual: right,
            }),
          );
        }
        return 'boolean';
      }
      case 'boolean': {
        for (const term of expr.terms) {
          const termType = walk(term, localScope);
          if (termType !== 'boolean' && termType !== 'unknown' && termType !== 'any') {
            issues.push(
              uiDiagnostic('UI_EXPR_TYPE_MISMATCH', `Boolean operator requires boolean terms.`, {
                documentId,
                nodeId,
                expected: 'boolean',
                actual: termType,
              }),
            );
          }
        }
        return 'boolean';
      }
      case 'conditionalValue': {
        const whenType = walk(expr.when, localScope);
        if (whenType !== 'boolean' && whenType !== 'unknown' && whenType !== 'any') {
          issues.push(
            uiDiagnostic('UI_EXPR_TYPE_MISMATCH', `Condition must be boolean.`, {
              documentId,
              nodeId,
              expected: 'boolean',
              actual: whenType,
            }),
          );
        }
        const thenType = walk(expr.then, localScope);
        walk(expr.otherwise, localScope);
        return thenType;
      }
      case 'op': {
        if (catalogs.opNames !== undefined && !catalogs.opNames.includes(expr.name)) {
          issues.push(
            uiDiagnostic(
              'UI_EXPR_UNKNOWN_REFERENCE',
              `Registered operation '${expr.name}' is not declared by the catalogs.`,
              { documentId, nodeId, path: `op:${expr.name}` },
            ),
          );
        }
        for (const arg of expr.args) walk(arg, localScope);
        return 'unknown';
      }
    }
  };
  walk(expression, scope);
  return issues;
}

function checkRef(
  path: string,
  catalogs: UiCatalogs,
  scope: UiScopeInfo,
  documentId: string,
  nodeId: string,
  issues: UiDiagnostic[],
): ResolvedRefType['type'] {
  const parts = splitRef(path);
  const head = parts[0];
  const unknown = (): 'unknown' => {
    issues.push(
      uiDiagnostic(
        'UI_EXPR_UNKNOWN_REFERENCE',
        `Reference '${path}' does not resolve in this scope.`,
        {
          documentId,
          nodeId,
          path,
        },
      ),
    );
    return 'unknown';
  };
  if (head === 'view' || head === 'record') {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          'UI_EXPR_SCOPE_VIOLATION',
          `view/record data is not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path },
        ),
      );
      return 'unknown';
    }
    const fields: UiFieldTypes = catalogs.viewFields ?? {};
    const fieldType = parts.length === 2 ? fields[parts[1] as string] : undefined;
    if (fieldType === undefined) return unknown();
    return fieldType;
  }
  if (head === 'repeat') {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          'UI_EXPR_SCOPE_VIOLATION',
          `repeat items are not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path },
        ),
      );
      return 'unknown';
    }
    if (parts.length !== 3) return unknown();
    const itemType = scope.repeatItems[parts[1] as string];
    if (itemType === undefined) return unknown();
    const fieldType = itemType[parts[2] as string];
    if (fieldType === undefined) return unknown();
    return fieldType;
  }
  if (head === 'prop') {
    if (!scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          'UI_EXPR_SCOPE_VIOLATION',
          `prop.* is only visible inside a component definition registry (typed props).`,
          { documentId, nodeId, scope: path },
        ),
      );
      return 'unknown';
    }
    return 'any'; // prop types are checked against the definition's prop schema at expansion
  }
  if (head === 'state') {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          'UI_EXPR_SCOPE_VIOLATION',
          `document-level state is not visible inside a definition registry (use typed props).`,
          { documentId, nodeId, scope: path },
        ),
      );
      return 'unknown';
    }
    return 'any'; // state type known at validation via document.localState (checked by the caller's scope build)
  }
  if (head === 'token') {
    if (scope.inDefinition) {
      issues.push(
        uiDiagnostic(
          'UI_EXPR_SCOPE_VIOLATION',
          `token.* is a document-level scope, not visible inside a definition registry.`,
          { documentId, nodeId, scope: path },
        ),
      );
      return 'unknown';
    }
    return 'string';
  }
  if (head === '$output') {
    // Amendment §3.5/§5.1: `$output` resolves ONLY inside output-binding
    // value/input templates (scope.output present). Elsewhere it is a
    // payload-scope violation with a path-annotated diagnostic. The
    // payload type maps onto the expression-side vocabulary (lists are
    // arrays; ISO date/time markers carry strings).
    if (scope.output === undefined) {
      issues.push(
        uiDiagnostic(
          'UI_COMPONENT_OUTPUT_PAYLOAD_INVALID',
          `'$output' resolves only inside output binding value/input expressions.`,
          { documentId, nodeId, path },
        ),
      );
      return 'unknown';
    }
    if (scope.output === 'void' || scope.output === 'unknown') return 'unknown';
    if (scope.output === 'stringList' || scope.output === 'numberList') return 'array';
    if (scope.output === 'isoDate' || scope.output === 'isoTime') return 'string';
    return scope.output;
  }
  return unknown();
}

/** Values available to the evaluator at one render position. */
export interface UiScopeValues {
  readonly view?: Readonly<Record<string, unknown>>;
  readonly record?: Readonly<Record<string, unknown>>;
  readonly repeat?: Readonly<Record<string, readonly unknown[]>>;
  readonly repeatItem?: {
    readonly name: string;
    readonly value: Readonly<Record<string, unknown>>;
  };
  readonly props?: Readonly<Record<string, unknown>>;
  readonly state?: Readonly<Record<string, unknown>>;
  readonly tokens?: Readonly<Record<string, string>>;
  /**
   * The emitted payload inside output-binding value/input templates
   * (amendment §3.5). `$output` resolves to it; absent elsewhere.
   */
  readonly output?: unknown;
}

/** Pure evaluation. Unknown references evaluate to `undefined` (validation is the gate). */
export function evaluateExpression(
  expression: UiExpression,
  values: UiScopeValues,
  ops: Readonly<Record<string, (args: readonly unknown[]) => unknown>> = {},
): unknown {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'ref': {
      const parts = splitRef(expression.path);
      const head = parts[0] as string;
      if ((head === 'view' || head === 'record') && parts.length === 2) {
        const bag = head === 'view' ? values.view : values.record;
        return bag?.[parts[1] as string];
      }
      if (head === 'repeat' && parts.length === 3) {
        if (values.repeatItem !== undefined && values.repeatItem.name === parts[1]) {
          return values.repeatItem.value[parts[2] as string];
        }
        return undefined;
      }
      if (head === 'prop' && parts.length === 2) return values.props?.[parts[1] as string];
      if (head === 'state' && parts.length === 2) return values.state?.[parts[1] as string];
      if (head === 'token' && parts.length === 2) return values.tokens?.[parts[1] as string];
      if (head === '$output' && parts.length === 1) return values.output;
      return undefined;
    }
    case 'compare': {
      const left = evaluateExpression(expression.left, values, ops);
      const right = evaluateExpression(expression.right, values, ops);
      switch (expression.op) {
        case 'eq':
          return left === right;
        case 'ne':
          return left !== right;
        case 'lt':
          return (left as number) < (right as number);
        case 'lte':
          return (left as number) <= (right as number);
        case 'gt':
          return (left as number) > (right as number);
        case 'gte':
          return (left as number) >= (right as number);
      }
      return undefined;
    }
    case 'boolean': {
      const evaluated = expression.terms.map((term) =>
        Boolean(evaluateExpression(term, values, ops)),
      );
      if (expression.op === 'not') return !evaluated[0];
      if (expression.op === 'and') return evaluated.every(Boolean);
      return evaluated.some(Boolean);
    }
    case 'conditionalValue':
      return Boolean(evaluateExpression(expression.when, values, ops))
        ? evaluateExpression(expression.then, values, ops)
        : evaluateExpression(expression.otherwise, values, ops);
    case 'op': {
      const op = ops[expression.name];
      if (op === undefined) return undefined;
      return op(expression.args.map((arg) => evaluateExpression(arg, values, ops)));
    }
  }
}
