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

// Match the existing graph/portable-selection resource envelope. A ledger is
// explicitly bounded and refuses new commands when full; it never silently
// evicts a receipt and makes a previously observed ID eligible again.
const MAX_COMMAND_CHARACTERS = 1_000_000;
const MAX_RECEIPTS = 128;
const problem = (code: string, path: string, message: string): GraphIssue => ({
  code,
  path,
  message,
});
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function jsonValue(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || depth > 64 || seen.has(value)) return false;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return false;
  seen.add(value);
  const valid = (Array.isArray(value) ? value : Object.values(value)).every((child) =>
    jsonValue(child, seen, depth + 1),
  );
  seen.delete(value);
  return valid;
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
    if (value.length > MAX_COMMAND_CHARACTERS)
      return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Command exceeds the graph resource envelope.')] };
    try {
      value = JSON.parse(value);
    } catch {
      return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Supply valid command JSON.')] };
    }
  }
  if (!object(value) || !jsonValue(value))
    return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Supply a serializable command object.')] };
  if (JSON.stringify(value).length > MAX_COMMAND_CHARACTERS)
    return { ok: false, issues: [problem('GRAPH_COMMAND', 'command', 'Command exceeds the graph resource envelope.')] };
  const issues: GraphIssue[] = [];
  for (const key of Object.keys(value))
    if (!['schema', 'id', 'expectedRevision', 'operations'].includes(key))
      issues.push(problem('GRAPH_COMMAND', `command.${key}`, 'Unknown command field.'));
  if (value.schema !== 'vict.flow-command@1')
    issues.push(problem('GRAPH_COMMAND', 'command.schema', 'Use vict.flow-command@1.'));
  if (
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    value.id.length > 200 ||
    ['__proto__', 'prototype', 'constructor'].includes(value.id)
  )
    issues.push(problem('GRAPH_COMMAND', 'command.id', 'Supply a nonempty stable command ID of at most 200 characters.'));
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
  if (receipts.length >= MAX_RECEIPTS)
    return {
      ok: false,
      issues: [problem('GRAPH_COMMAND_LEDGER_FULL', 'receipts', 'The occurrence command ledger is full. The host must explicitly finish this command lifecycle before starting another.')],
      receipts,
      replayed: false,
    };
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
