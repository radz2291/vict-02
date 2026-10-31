import {
  applyGraphOperations,
  parseGraphOperations,
  type GraphDocument,
  type GraphIssue,
  type GraphOperation,
} from './model.js';

/** UI-neutral local graph intent. This protocol never authorizes application effects. */
export interface GraphCommand {
  schema: 'vict.flow-command@1';
  id: string;
  expectedRevision: number;
  operations: GraphOperation[];
}
export type GraphCommandParseResult =
  | { ok: true; command: GraphCommand }
  | { ok: false; issues: GraphIssue[] };

/**
 * Host-owned occurrence receipt, not graph state. Keep receipts across renderer
 * remounts; start a new ledger only when deliberately starting a new command
 * lifecycle. The full canonical payload detects reused IDs without hash collisions.
 */
export interface GraphCommandReceipt {
  id: string;
  signature: string;
  expectedRevision: number;
  resultingRevision: number;
  outcome: 'applied' | 'refused';
  issues?: GraphIssue[];
}
export type GraphCommandResult = (
  | { ok: true; graph: GraphDocument }
  | { ok: false; issues: GraphIssue[] }
) & {
  receipts: readonly GraphCommandReceipt[];
  receipt?: GraphCommandReceipt;
  replayed: boolean;
};

// Receipts remain for the entire explicit command lifecycle; never evict an ID.
const problem = (code: string, path: string, message: string): GraphIssue => ({
  code,
  path,
  message,
});
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function jsonValue(value: unknown): boolean {
  const active = new Set<object>();
  const stack: { value: unknown; exit?: boolean }[] = [{ value }];
  while (stack.length) {
    const item = stack.pop()!, current = item.value;
    if (current === null || typeof current === 'string' || typeof current === 'boolean') continue;
    if (typeof current === 'number') { if (!Number.isFinite(current)) return false; continue; }
    if (typeof current !== 'object') return false;
    if (item.exit) { active.delete(current); continue; }
    if (active.has(current) || (!Array.isArray(current) && ![Object.prototype, null].includes(Object.getPrototypeOf(current)))) return false;
    active.add(current); stack.push({value:current,exit:true});
    for (const child of Array.isArray(current) ? Array.from(current) : Object.values(current)) stack.push({value:child});
  }
  return true;
}

/** Object-key order is not part of a command's identity; array order is. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export function parseGraphCommand(input: unknown): GraphCommandParseResult {
  let value = input;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Supply valid command JSON.')] };
    }
  }
  if (!object(value) || !jsonValue(value))
    return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Supply a serializable command object.')] };
  const issues: GraphIssue[] = [];
  for (const key of Object.keys(value))
    if (!['schema', 'id', 'expectedRevision', 'operations'].includes(key))
      issues.push(problem('GRAPH_COMMAND', `command.${key}`, 'Unknown command field.'));
  if (value.schema !== 'vict.flow-command@1')
    issues.push(problem('GRAPH_COMMAND', 'command.schema', 'Use vict.flow-command@1.'));
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    ['__proto__', 'prototype', 'constructor'].includes(value.id)
  )
    issues.push(problem('GRAPH_COMMAND', 'command.id', 'Supply a nonempty safe stable command ID.'));
  if (!Number.isSafeInteger(value.expectedRevision) || (value.expectedRevision as number) < 0)
    issues.push(problem('GRAPH_COMMAND', 'command.expectedRevision', 'Supply a nonnegative safe integer revision.'));
  const operations = parseGraphOperations(value.operations);
  if (!operations.ok) issues.push(...operations.issues);
  if (issues.length || !operations.ok) return { ok: false, issues };
  return {
    ok: true,
    command: {
      schema: 'vict.flow-command@1',
      id: value.id as string,
      expectedRevision: value.expectedRevision as number,
      operations: operations.operations,
    },
  };
}

/**
 * Pure command reduction. Retain returned receipts for both model success and
 * refusal; commit an accepted graph and its receipt together. Replay returns the
 * current graph, never an old snapshot. Keep one receipt ledger per graph
 * occurrence. Read-only and domain policy remain host duties.
 */
export function applyGraphCommand(
  graph: GraphDocument,
  input: unknown,
  receipts: readonly GraphCommandReceipt[] = [],
): GraphCommandResult {
  const parsed = parseGraphCommand(input);
  if (!parsed.ok) return { ...parsed, receipts, replayed: false };
  const command = parsed.command;
  const signature = canonical(command);
  const previous = receipts.find((receipt) => receipt.id === command.id);
  if (previous) {
    if (previous.signature !== signature)
      return {
        ok: false,
        issues: [problem('GRAPH_COMMAND_ID_REUSED', 'command.id', 'This command ID already identifies a different payload. Use a new ID for a new intent.')],
        receipts,
        replayed: false,
      };
    return previous.outcome === 'applied'
      ? { ok: true, graph, receipts, receipt: previous, replayed: true }
      : { ok: false, issues: [...(previous.issues ?? [])], receipts, receipt: previous, replayed: true };
  }
  const result = applyGraphOperations(graph, command.operations, command.expectedRevision);
  const receipt: GraphCommandReceipt = {
    id: command.id,
    signature,
    expectedRevision: command.expectedRevision,
    resultingRevision: result.ok ? result.graph.revision : graph.revision,
    outcome: result.ok ? 'applied' : 'refused',
    ...(!result.ok ? { issues: result.issues.map((issue) => ({ ...issue })) } : {}),
  };
  return { ...result, receipts: [...receipts, receipt], receipt, replayed: false };
}
