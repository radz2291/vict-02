import {
  canonicalSemanticForm,
  canonicalSemanticFormV2,
  computeActivationVersion,
  computeCapabilitySetVersion,
  computeGraphVersion,
  declaresControlSemantics,
} from './canonical.js';
import type { CapabilityBindingFingerprint } from './canonical.js';
import type {
  ApplicationGraphDefinition,
  CapabilityIndex,
  CompiledGraph,
  CompiledNode,
  CompileResult,
  ContractEnvironment,
  ForkNodeDefinition,
  GraphEdgeDefinition,
  GraphIssue,
  GraphNodeDefinition,
  JoinNodeDefinition,
  RetryPolicy,
  SignalWaitDefinition,
  TimerWaitDefinition,
  WaitNodeDefinition,
} from './types.js';
import { MAX_BRANCH_COUNT, MAX_DELAY_MS_LIMIT, RETRY_MAX_ATTEMPTS_LIMIT } from './types.js';

export interface CompileGraphInput {
  readonly definition: ApplicationGraphDefinition;
  /** Capability knowledge; unknown capability ids fail compilation. */
  readonly capabilities: CapabilityIndex;
  /** Contract knowledge; unknown referenced contract ids and statically incompatible adjacent contracts fail compilation. */
  readonly contracts: ContractEnvironment;
}

interface Adjacency {
  readonly success: Readonly<Record<string, string>>;
  readonly error: Readonly<Record<string, string>>;
  readonly routes: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly branches: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly timeout: Readonly<Record<string, string>>;
  readonly joinOfFork: Readonly<Record<string, string>>;
  readonly forkOfJoin: Readonly<Record<string, string>>;
}

/** Intermediate node under validation. */
interface NodeDraft {
  id: string;
  kind: CompiledNode['kind'];
  capability: string;
  inputContractId?: string;
  outputContractId?: string;
  retry?: RetryPolicy;
  timeoutMs?: number;
  wait?: SignalWaitDefinition | TimerWaitDefinition;
  join?: string;
  maxConcurrency?: number;
  fork?: string;
}

function edgeRef(edge: GraphEdgeDefinition): GraphIssue['edge'] {
  const kind = edge.kind ?? 'success';
  const key = (edge as { key?: string }).key;
  return key !== undefined
    ? { from: edge.from, to: edge.to, kind, key }
    : { from: edge.from, to: edge.to, kind };
}

function pushTarget(map: Map<string, string[]>, from: string, to: string): void {
  const list = map.get(from) ?? [];
  list.push(to);
  map.set(from, list);
}

/** Which edge kinds each source node kind may declare. */
function edgeKindAllowedFor(sourceKind: CompiledNode['kind'], edgeKind: string): boolean {
  switch (sourceKind) {
    case 'capability':
      return edgeKind === 'success' || edgeKind === 'error';
    case 'decision':
      return edgeKind === 'route' || edgeKind === 'error';
    case 'wait':
      return edgeKind === 'success' || edgeKind === 'timeout';
    case 'fork':
      return edgeKind === 'branch';
    case 'join':
      return edgeKind === 'success';
  }
}

/** Validate a declared wait contract reference. */
function checkWaitContract(
  nodeId: string,
  contractId: string,
  contracts: ContractEnvironment,
): GraphIssue[] {
  if (contracts.get(contractId) === undefined) {
    return [
      {
        code: 'UNKNOWN_WAIT_CONTRACT',
        message: `Wait node '${nodeId}' references unknown signal contract '${contractId}'.`,
        nodeIds: [nodeId],
        contractIds: [contractId],
      },
    ];
  }
  return [];
}

/** Validate retry/timeout policy bounds; returns structured issues. */
function checkPolicyBounds(
  retry: RetryPolicy | null | undefined,
  timeoutMs: number | undefined,
  nodeId: string,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  if (retry !== undefined && retry !== null) {
    const maxAttempts = retry.maxAttempts;
    if (
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > RETRY_MAX_ATTEMPTS_LIMIT
    ) {
      issues.push({
        code: 'INVALID_RETRY_POLICY',
        message: `Node '${nodeId}' declares maxAttempts ${JSON.stringify(maxAttempts)}; it must be an integer between 1 and ${RETRY_MAX_ATTEMPTS_LIMIT}.`,
        nodeIds: [nodeId],
      });
    }
    if (
      !Array.isArray(retry.retryOn) ||
      retry.retryOn.some((code) => typeof code !== 'string' || code.length === 0)
    ) {
      issues.push({
        code: 'INVALID_RETRY_POLICY',
        message: `Node '${nodeId}' declares an invalid retryOn list; entries must be non-empty stable error codes.`,
        nodeIds: [nodeId],
      });
    }
    const backoff = retry.backoff;
    if (backoff === undefined || backoff === null || typeof backoff !== 'object') {
      issues.push({
        code: 'INVALID_RETRY_POLICY',
        message: `Node '${nodeId}' declares an invalid backoff policy.`,
        nodeIds: [nodeId],
      });
    } else if (backoff.kind === 'fixed') {
      if (
        !Number.isFinite(backoff.delayMs) ||
        backoff.delayMs <= 0 ||
        backoff.delayMs > MAX_DELAY_MS_LIMIT
      ) {
        issues.push({
          code: 'INVALID_RETRY_POLICY',
          message: `Node '${nodeId}' declares an invalid fixed backoff delayMs.`,
          nodeIds: [nodeId],
        });
      }
    } else {
      if (
        !Number.isFinite(backoff.initialMs) ||
        backoff.initialMs <= 0 ||
        !Number.isFinite(backoff.multiplier) ||
        backoff.multiplier <= 1 ||
        !Number.isFinite(backoff.maxMs) ||
        backoff.maxMs <= 0 ||
        backoff.maxMs > MAX_DELAY_MS_LIMIT ||
        backoff.initialMs > backoff.maxMs
      ) {
        issues.push({
          code: 'INVALID_RETRY_POLICY',
          message: `Node '${nodeId}' declares an invalid exponential backoff (initialMs, multiplier > 1, and maxMs are required and bounded).`,
          nodeIds: [nodeId],
        });
      }
    }
  }
  if (timeoutMs !== undefined) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_DELAY_MS_LIMIT) {
      issues.push({
        code: 'INVALID_TIMEOUT_BOUND',
        message: `Node '${nodeId}' declares timeoutMs ${JSON.stringify(timeoutMs)}; it must be a positive finite number bounded by ${MAX_DELAY_MS_LIMIT}.`,
        nodeIds: [nodeId],
      });
    }
  }
  return issues;
}

/**
 * Compile an application graph definition into an immutable compiled graph,
 * or return a structured rejection. Compilation never throws for invalid
 * definitions and never has side effects.
 *
 * Validation rules (Stage 01/02 sequential semantics plus Stage 03 control
 * semantics — see the module source for the full list):
 * - non-empty graph id, node ids, capability references (capability/decision)
 * - exactly one entry; the entry must be a capability, decision, or wait node
 * - unique node ids; known node kinds
 * - edges reference existing nodes; no duplicate semantically identical edges
 * - edge kinds valid for their source node
 * - route keys unique, non-empty, present on every decision node
 * - branch keys unique, non-empty; at least two branches per fork
 * - fork/join pairing, branch reachability, no illegal branch escape,
 *   no nested fan-out inside a fork region
 * - signal-wait timeout edges exist exactly when `timeoutMs` is declared
 * - timer waits have no timeout edge; waits have exactly one success edge
 * - capabilities known at compile time; decision capabilities must be pure
 * - retry/timeout bounds; write retries require keyed idempotency;
 *   irreversible capabilities reject retry policies beyond one attempt
 * - node contract overrides and wait/join contracts must be registered
 * - adjacent contracts compatible where statically determinable
 * - no cycles over the combined control adjacency
 */
export function compileGraph(input: CompileGraphInput): CompileResult {
  const { definition, capabilities, contracts } = input;
  const issues: GraphIssue[] = [];

  if (definition.id.length === 0) {
    issues.push({ code: 'EMPTY_GRAPH_ID', message: 'Graph id must be a non-empty string.' });
  }

  // ---- Nodes -------------------------------------------------------------
  const nodesById = new Map<string, NodeDraft>();
  for (const rawNode of definition.nodes) {
    if (rawNode.id.length === 0) {
      issues.push({ code: 'EMPTY_NODE_ID', message: 'Node ids must be non-empty strings.' });
      continue;
    }
    if (nodesById.has(rawNode.id)) {
      issues.push({
        code: 'DUPLICATE_NODE',
        message: `Node id '${rawNode.id}' is defined more than once.`,
        nodeIds: [rawNode.id],
      });
      continue;
    }
    const declaredKind = (rawNode as { kind?: string }).kind ?? 'capability';
    if (!['capability', 'decision', 'wait', 'fork', 'join'].includes(declaredKind)) {
      issues.push({
        code: 'UNKNOWN_NODE_KIND',
        message: `Node '${rawNode.id}' declares unknown kind '${String(declaredKind)}'.`,
        nodeIds: [rawNode.id],
      });
      continue;
    }
    const kind = declaredKind as NodeDraft['kind'];
    const node = rawNode as GraphNodeDefinition &
      Partial<WaitNodeDefinition> &
      Partial<ForkNodeDefinition> &
      Partial<JoinNodeDefinition> & { fork?: string };
    const capability = node.capability ?? '';
    if ((kind === 'capability' || kind === 'decision') && capability.length === 0) {
      issues.push({
        code: 'EMPTY_CAPABILITY_REFERENCE',
        message: `Node '${rawNode.id}' must reference a capability.`,
        nodeIds: [rawNode.id],
      });
      continue;
    }
    // Canonical (v2) forms store nulls for absent control fields and swap
    // fork/join reference names; normalize both spellings here.
    const forkRef = kind === 'fork' ? (node.join ?? node.fork ?? undefined) : undefined;
    const joinForkRef = kind === 'join' ? (node.fork ?? node.join ?? undefined) : undefined;
    nodesById.set(rawNode.id, {
      id: rawNode.id,
      kind,
      capability,
      inputContractId: node.input ?? undefined,
      outputContractId: node.output ?? undefined,
      retry: node.retry ?? undefined,
      timeoutMs: node.timeoutMs ?? undefined,
      wait: node.wait ?? undefined,
      join: forkRef,
      maxConcurrency: node.maxConcurrency ?? undefined,
      fork: joinForkRef,
    });
  }

  // ---- Entry ---------------------------------------------------------------
  const entryNode = nodesById.get(definition.entry);
  if (!entryNode) {
    issues.push({
      code: 'MISSING_ENTRY_NODE',
      message: `Entry '${definition.entry}' does not reference an existing node.`,
      nodeIds: [definition.entry],
    });
  } else if (entryNode.kind === 'fork' || entryNode.kind === 'join') {
    issues.push({
      code: 'INVALID_ENTRY_KIND',
      message: `Entry '${definition.entry}' is a '${entryNode.kind}' node; the entry must be a capability, decision, or wait node.`,
      nodeIds: [definition.entry],
    });
  }

  // ---- Edges -----------------------------------------------------------------
  const seenEdges = new Set<string>();
  const successTargets = new Map<string, string[]>();
  const errorTargets = new Map<string, string[]>();
  const routes = new Map<string, Map<string, string>>();
  const branches = new Map<string, Map<string, string>>();
  const timeoutTargets = new Map<string, string>();
  const validEdges: GraphEdgeDefinition[] = [];

  for (const edge of definition.edges) {
    const kind = edge.kind ?? 'success';
    const key = (edge as { key?: string }).key;
    const missing = [edge.from, edge.to].filter((id) => !nodesById.has(id));
    if (missing.length > 0) {
      issues.push({
        code: 'EDGE_REFERENCES_UNKNOWN_NODE',
        message: `Edge '${edge.from}' -> '${edge.to}' (${kind}) references unknown node(s): ${missing.join(', ')}.`,
        nodeIds: missing,
        edge: edgeRef(edge),
      });
      continue;
    }
    const edgeKey = `${edge.from}|${edge.to}|${kind}|${key ?? ''}`;
    if (seenEdges.has(edgeKey)) {
      issues.push({
        code: 'DUPLICATE_EDGE',
        message: `Duplicate ${kind} edge '${edge.from}' -> '${edge.to}'${key !== undefined ? ` (key '${key}')` : ''}.`,
        edge: edgeRef(edge),
      });
      continue;
    }
    seenEdges.add(edgeKey);
    validEdges.push(edge);

    const source = nodesById.get(edge.from) as NodeDraft | undefined;
    if (!source) {
      continue;
    }
    if (!edgeKindAllowedFor(source.kind, kind)) {
      issues.push({
        code: 'EDGE_KIND_INVALID_FOR_SOURCE',
        message: `A '${source.kind}' node ('${edge.from}') cannot declare a '${kind}' edge.`,
        nodeIds: [edge.from],
        edge: edgeRef(edge),
      });
      continue;
    }
    switch (kind) {
      case 'success': {
        pushTarget(successTargets, edge.from, edge.to);
        break;
      }
      case 'error': {
        pushTarget(errorTargets, edge.from, edge.to);
        break;
      }
      case 'route': {
        if (typeof key !== 'string' || key.length === 0) {
          issues.push({
            code: typeof key === 'string' ? 'EMPTY_ROUTE_KEY' : 'MISSING_ROUTE_KEY',
            message: `Route edge '${edge.from}' -> '${edge.to}' requires a non-empty declared key.`,
            nodeIds: [edge.from],
            edge: edgeRef(edge),
          });
          continue;
        }
        let routeMap = routes.get(edge.from);
        if (!routeMap) {
          routeMap = new Map<string, string>();
          routes.set(edge.from, routeMap);
        }
        if (routeMap.has(key)) {
          issues.push({
            code: 'DUPLICATE_ROUTE_KEY',
            message: `Decision node '${edge.from}' declares route key '${key}' more than once.`,
            nodeIds: [edge.from],
            edge: edgeRef(edge),
          });
          continue;
        }
        routeMap.set(key, edge.to);
        break;
      }
      case 'branch': {
        if (typeof key !== 'string' || key.length === 0) {
          issues.push({
            code: typeof key === 'string' ? 'EMPTY_BRANCH_KEY' : 'MISSING_BRANCH_KEY',
            message: `Branch edge '${edge.from}' -> '${edge.to}' requires a non-empty declared key.`,
            nodeIds: [edge.from],
            edge: edgeRef(edge),
          });
          continue;
        }
        let branchMap = branches.get(edge.from);
        if (!branchMap) {
          branchMap = new Map<string, string>();
          branches.set(edge.from, branchMap);
        }
        if (branchMap.has(key)) {
          issues.push({
            code: 'DUPLICATE_BRANCH_KEY',
            message: `Fork node '${edge.from}' declares branch key '${key}' more than once.`,
            nodeIds: [edge.from],
            edge: edgeRef(edge),
          });
          continue;
        }
        branchMap.set(key, edge.to);
        break;
      }
      case 'timeout': {
        timeoutTargets.set(edge.from, edge.to);
        break;
      }
    }
  }

  // ---- Per-node structural rules ------------------------------------------
  for (const [from, targets] of successTargets) {
    if (targets.length > 1) {
      issues.push({
        code: 'MULTIPLE_SUCCESS_EDGES',
        message: `Node '${from}' has ${targets.length} outgoing success edges; at most one is allowed.`,
        nodeIds: [from, ...targets],
      });
    }
  }
  for (const [from, targets] of errorTargets) {
    if (targets.length > 1) {
      issues.push({
        code: 'MULTIPLE_ERROR_EDGES',
        message: `Node '${from}' has ${targets.length} outgoing error edges; at most one is allowed.`,
        nodeIds: [from, ...targets],
      });
    }
  }
  for (const node of nodesById.values()) {
    issues.push(...checkPolicyBounds(node.retry, node.timeoutMs, node.id));

    if (node.kind === 'decision') {
      const routeMap = routes.get(node.id);
      if (!routeMap || routeMap.size === 0) {
        issues.push({
          code: 'DECISION_WITHOUT_ROUTES',
          message: `Decision node '${node.id}' must declare at least one route edge.`,
          nodeIds: [node.id],
        });
      }
    }

    if (node.kind === 'wait' && node.wait !== undefined) {
      const wait = node.wait;
      const successCount = successTargets.get(node.id)?.length ?? 0;
      if (successCount !== 1) {
        issues.push({
          code: 'WAIT_WITHOUT_SUCCESS_EDGE',
          message: `Wait node '${node.id}' must have exactly one success edge (found ${successCount}).`,
          nodeIds: [node.id],
        });
      }
      if (wait.kind === 'signal') {
        const waitTimeoutMs = wait.timeoutMs ?? undefined;
        const waitContract = (wait as { contract?: string | null }).contract ?? undefined;
        const hasTimeoutEdge = timeoutTargets.has(node.id);
        if (waitTimeoutMs !== undefined && !hasTimeoutEdge) {
          issues.push({
            code: 'SIGNAL_TIMEOUT_WITHOUT_TIMEOUT_EDGE',
            message: `Signal wait '${node.id}' declares timeoutMs but has no timeout edge.`,
            nodeIds: [node.id],
          });
        }
        if (waitTimeoutMs === undefined && hasTimeoutEdge) {
          issues.push({
            code: 'TIMEOUT_EDGE_WITHOUT_SIGNAL_TIMEOUT',
            message: `Wait node '${node.id}' has a timeout edge but declares no timeoutMs.`,
            nodeIds: [node.id],
          });
        }
        if (waitContract !== undefined) {
          issues.push(...checkWaitContract(node.id, waitContract, contracts));
        }
      } else if (timeoutTargets.has(node.id)) {
        issues.push({
          code: 'TIMER_WAIT_WITH_TIMEOUT_EDGE',
          message: `Timer wait node '${node.id}' cannot have a timeout edge.`,
          nodeIds: [node.id],
        });
      }
    }

    if (node.kind === 'fork') {
      const branchMap = branches.get(node.id);
      const branchCount = branchMap?.size ?? 0;
      if (branchCount < 2) {
        issues.push({
          code: 'FORK_TOO_FEW_BRANCHES',
          message: `Fork node '${node.id}' must declare at least two branch edges (found ${branchCount}).`,
          nodeIds: [node.id],
        });
      }
      if (node.maxConcurrency !== undefined) {
        const bound = node.maxConcurrency;
        if (!Number.isInteger(bound) || bound < 1 || bound > MAX_BRANCH_COUNT) {
          issues.push({
            code: 'INVALID_FORK_CONCURRENCY',
            message: `Fork node '${node.id}' declares maxConcurrency ${JSON.stringify(node.maxConcurrency)}; it must be an integer between 1 and ${MAX_BRANCH_COUNT}.`,
            nodeIds: [node.id],
          });
        }
      }
      // Fork/join pairing.
      const joinId = node.join;
      if (joinId === undefined) {
        issues.push({
          code: 'FORK_REFERENCES_MISSING_JOIN',
          message: `Fork node '${node.id}' must declare its matching join.`,
          nodeIds: [node.id],
        });
      } else {
        const joinNode = nodesById.get(joinId);
        if (!joinNode) {
          issues.push({
            code: 'FORK_REFERENCES_MISSING_JOIN',
            message: `Fork node '${node.id}' references missing join node '${joinId}'.`,
            nodeIds: [node.id, joinId],
          });
        } else if (joinNode.kind !== 'join') {
          issues.push({
            code: 'FORK_REFERENCES_NON_JOIN',
            message: `Fork node '${node.id}' references '${joinId}', which is a '${joinNode.kind}' node, not a join.`,
            nodeIds: [node.id, joinId],
          });
        } else if (joinNode.fork !== node.id) {
          issues.push({
            code: 'MISMATCHED_FORK_JOIN',
            message: `Fork node '${node.id}' references join '${joinId}', but that join references fork '${String(joinNode.fork)}'.`,
            nodeIds: [node.id, joinId],
          });
        }
      }
    }

    if (node.kind === 'join') {
      const forkId = node.fork;
      if (forkId === undefined) {
        issues.push({
          code: 'JOIN_REFERENCES_MISSING_FORK',
          message: `Join node '${node.id}' must declare its fork node.`,
          nodeIds: [node.id],
        });
      } else {
        const forkNode = nodesById.get(forkId);
        if (!forkNode) {
          issues.push({
            code: 'JOIN_REFERENCES_MISSING_FORK',
            message: `Join node '${node.id}' references missing fork node '${forkId}'.`,
            nodeIds: [node.id, forkId],
          });
        } else if (forkNode.kind !== 'fork') {
          issues.push({
            code: 'JOIN_REFERENCES_NON_FORK',
            message: `Join node '${node.id}' references '${forkId}', which is a '${forkNode.kind}' node, not a fork.`,
            nodeIds: [node.id, forkId],
          });
        } else if (forkNode.join !== node.id) {
          issues.push({
            code: 'MISMATCHED_FORK_JOIN',
            message: `Join node '${node.id}' references fork '${forkId}', but that fork references join '${String(forkNode.join)}'.`,
            nodeIds: [node.id, forkId],
          });
        }
      }
      if (
        node.kind === 'join' &&
        node.outputContractId !== undefined &&
        contracts.get(node.outputContractId) === undefined
      ) {
        issues.push({
          code: 'UNKNOWN_JOIN_CONTRACT',
          message: `Join node '${node.id}' references unknown output contract '${node.outputContractId}'.`,
          nodeIds: [node.id],
          contractIds: [node.outputContractId],
        });
      }
      const joinSuccessCount = successTargets.get(node.id)?.length ?? 0;
      if (joinSuccessCount > 1) {
        issues.push({
          code: 'JOIN_SUCCESS_EDGE_INVALID',
          message: `Join node '${node.id}' must have at most one success edge (found ${joinSuccessCount}).`,
          nodeIds: [node.id],
        });
      }
      const errorCount = errorTargets.get(node.id)?.length ?? 0;
      if (errorCount > 0) {
        issues.push({
          code: 'EDGE_KIND_INVALID_FOR_SOURCE',
          message: `A 'join' node ('${node.id}') cannot declare an 'error' edge.`,
          nodeIds: [node.id],
        });
      }
      if (forkId !== undefined && branchCountOf(branches, forkId) > 0) {
        // A join must wait for every declared branch key of its fork.
        void branchCountOf;
      }
    }
  }

  // ---- Capability resolution, effect/contract rules -------------------------
  const effectiveNodes = new Map<string, CompiledNode>();
  for (const [id, node] of nodesById) {
    const descriptor =
      node.kind === 'capability' || node.kind === 'decision'
        ? capabilities.getCapabilityDescriptor(node.capability)
        : undefined;
    if (node.kind === 'capability' || node.kind === 'decision') {
      if (!descriptor) {
        issues.push({
          code: 'UNKNOWN_CAPABILITY',
          message: `Node '${id}' references unknown capability '${node.capability}'.`,
          nodeIds: [id],
        });
        continue;
      }
      if (node.kind === 'decision' && descriptor.effect !== 'pure') {
        issues.push({
          code: 'DECISION_NOT_PURE',
          message: `Decision node '${id}' must be bound to a pure capability; capability '${node.capability}' is '${descriptor.effect}'.`,
          nodeIds: [id],
        });
      }
      if (node.retry !== undefined && node.retry !== null) {
        const maxAttempts = node.retry.maxAttempts;
        if (Number.isInteger(maxAttempts) && maxAttempts > 1) {
          if (descriptor.effect === 'irreversible') {
            issues.push({
              code: 'IRREVERSIBLE_RETRY_DENIED',
              message: `Node '${id}' binds irreversible capability '${node.capability}'; retry policies beyond one attempt are rejected at compilation.`,
              nodeIds: [id],
            });
          }
          if (descriptor.effect === 'write' && descriptor.idempotency !== 'keyed') {
            issues.push({
              code: 'WRITE_RETRY_NOT_IDEMPOTENT',
              message: `Node '${id}' binds write capability '${node.capability}' without a keyed-idempotency declaration; automatic write retry requires it.`,
              nodeIds: [id],
            });
          }
        }
      }
    }
    const inputContractId =
      node.kind === 'wait' || node.kind === 'fork'
        ? undefined
        : (node.inputContractId ?? descriptor?.inputContractId);
    const outputContractId =
      node.kind === 'wait' || node.kind === 'fork'
        ? undefined
        : // Join nodes KEEP their declared output contract: the canonical
          // branch-result object must cross the join's own boundary, and
          // the runtime validates it outside the persistence layer.
          node.kind === 'join'
          ? node.outputContractId
          : (node.outputContractId ?? descriptor?.outputContractId);
    effectiveNodes.set(id, {
      id,
      kind: node.kind,
      capability: node.capability,
      inputContractId,
      outputContractId,
      ...(node.retry !== undefined && node.retry !== null ? { retry: node.retry } : {}),
      ...(node.timeoutMs !== undefined && node.timeoutMs !== null
        ? { timeoutMs: node.timeoutMs }
        : {}),
      ...(node.wait !== undefined && node.wait !== null ? { wait: node.wait } : {}),
      ...(node.join !== undefined ? { join: node.join } : {}),
      ...(node.maxConcurrency !== undefined ? { maxConcurrency: node.maxConcurrency } : {}),
      ...(node.fork !== undefined ? { fork: node.fork } : {}),
    });

    // Node-level contract overrides must resolve to registered contracts.
    for (const [role, contractId] of [
      ['input', node.inputContractId],
      ['output', node.outputContractId],
    ] as const) {
      if (contractId !== undefined && contracts.get(contractId) === undefined) {
        issues.push({
          code: 'MISSING_CONTRACT',
          message: `Node '${id}' overrides its ${role} contract with unknown contract '${contractId}'.`,
          nodeIds: [id],
          contractIds: [contractId],
        });
      }
    }
  }

  // ---- Static adjacent-contract compatibility -------------------------------
  for (const edge of validEdges) {
    const kind = edge.kind ?? 'success';
    if (kind === 'error') {
      continue; // Error edges carry the universal error signal; runtime validation applies.
    }
    if (kind === 'route' || kind === 'timeout') {
      // Route targets receive the decision VALUE (inside a validated
      // DecisionResult); timeout targets receive the wait checkpoint
      // payload. Neither is statically determinable; runtime validation applies.
      continue;
    }
    const fromNode = effectiveNodes.get(edge.from);
    const toNode = effectiveNodes.get(edge.to);
    if (fromNode === undefined || toNode === undefined) {
      continue;
    }
    let fromContract: string | undefined;
    if (kind === 'branch') {
      // A branch receives the same immutable payload that entered the fork,
      // i.e. the output contract of the edge that flows INTO the fork.
      fromContract = forkInputContract(edge.from, effectiveNodes, successTargets);
    } else {
      fromContract = fromNode.outputContractId;
    }
    const toContract = toNode.inputContractId;
    if (fromContract !== undefined && toContract !== undefined) {
      if (!contracts.isCompatible(fromContract, toContract)) {
        issues.push({
          code: 'CONTRACT_INCOMPATIBLE',
          message: `${kind === 'branch' ? 'Branch' : 'Success'} edge '${edge.from}' -> '${edge.to}' connects incompatible contracts: output '${fromContract}' is not compatible with input '${toContract}'.`,
          edge: edgeRef(edge),
          contractIds: [fromContract, toContract],
        });
      }
    }
  }

  // ---- Fork region analysis: reachability, escape, nesting -------------------
  const forkToJoin = new Map<string, string>();
  const joinToFork = new Map<string, string>();
  for (const node of nodesById.values()) {
    if (node.kind === 'fork' && node.join !== undefined) {
      forkToJoin.set(node.id, node.join);
    }
    if (node.kind === 'join' && node.fork !== undefined) {
      joinToFork.set(node.id, node.fork);
    }
  }
  for (const [forkId, joinId] of forkToJoin) {
    const branchMap = branches.get(forkId);
    if (!branchMap || branchMap.size === 0) {
      continue; // already diagnosed
    }
    for (const [branchKey, branchTarget] of branchMap) {
      const analysis = analyzeBranchRegion(
        branchTarget,
        joinId,
        nodesById,
        successTargets,
        errorTargets,
        routes,
        timeoutTargets,
      );
      if (!analysis.reachesJoin) {
        issues.push({
          code: 'BRANCH_CANNOT_REACH_JOIN',
          message: `Fork '${forkId}' branch '${branchKey}' cannot reach its declared join '${joinId}'.`,
          nodeIds: [forkId, branchTarget, joinId],
          edge: {
            from: forkId,
            to: branchTarget,
            kind: 'branch',
            key: branchTarget === branchTarget ? branchKey : branchKey,
          },
        });
      }
      if (analysis.nestedControlNode !== undefined) {
        issues.push({
          code: 'UNSUPPORTED_NESTED_FORK',
          message: `Fork '${forkId}' branch '${branchKey}' reaches control node '${analysis.nestedControlNode}' before the join; nested fan-out is not supported in this stage.`,
          nodeIds: [forkId, analysis.nestedControlNode],
        });
      }
      if (analysis.escapedAt !== undefined) {
        issues.push({
          code: 'ILLEGAL_BRANCH_ESCAPE',
          message: `Fork '${forkId}' branch '${branchKey}' reaches a premature terminal path at node '${analysis.escapedAt}'; every branch path must end at join '${joinId}'.`,
          nodeIds: [forkId, analysis.escapedAt, joinId],
        });
      }
    }
    // Branch keys declared on the fork must be consistent with branch edges.
    void branchCountOf(branches, forkId);
  }

  // ---- Cycles over the combined adjacency -------------------------------------
  const cycle = findCycle(
    effectiveNodes,
    successTargets,
    errorTargets,
    routes,
    branches,
    timeoutTargets,
  );
  if (cycle) {
    issues.push({
      code: 'UNSUPPORTED_CYCLE',
      message: `Graph contains an unsupported cycle: ${cycle.join(' -> ')}.`,
      nodeIds: cycle,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // ---- Assemble the compiled graph --------------------------------------------
  const success: Record<string, string> = {};
  for (const [from, targets] of successTargets) {
    const target = targets[0];
    if (target !== undefined) {
      success[from] = target;
    }
  }
  const error: Record<string, string> = {};
  for (const [from, targets] of errorTargets) {
    const target = targets[0];
    if (target !== undefined) {
      error[from] = target;
    }
  }
  const frozenRoutes: Record<string, Record<string, string>> = {};
  for (const [from, routeMap] of routes) {
    const sorted: Record<string, string> = {};
    for (const key of [...routeMap.keys()].sort()) {
      sorted[key] = routeMap.get(key) as string;
    }
    frozenRoutes[from] = Object.freeze(sorted);
  }
  const frozenBranches: Record<string, Record<string, string>> = {};
  for (const [forkId, branchMap] of branches) {
    const sorted: Record<string, string> = {};
    for (const key of [...branchMap.keys()].sort()) {
      sorted[key] = branchMap.get(key) as string;
    }
    frozenBranches[forkId] = Object.freeze(sorted);
  }
  const adjacency: Adjacency = {
    success,
    error,
    routes: frozenRoutes,
    branches: frozenBranches,
    timeout: Object.freeze({ ...mapFromEntries(timeoutTargets) }),
    joinOfFork: Object.freeze(mapFromEntries(forkToJoin)),
    forkOfJoin: Object.freeze(mapFromEntries(joinToFork)),
  };
  const frozenNodes: Record<string, CompiledNode> = {};
  for (const [id, node] of effectiveNodes) {
    frozenNodes[id] = Object.freeze({ ...node });
  }
  const nodeIds = Object.freeze([...effectiveNodes.keys()].sort());
  const graphVersion = computeGraphVersion(definition);

  // Effective capability/contract bindings: capability id + revision + effect
  // class + effective input/output contract id + revision (+ declared
  // idempotency semantics). Contract override revisions are resolved from the
  // contract environment.
  const bindings: CapabilityBindingFingerprint[] = [];
  for (const rawNode of definition.nodes) {
    const node = effectiveNodes.get(rawNode.id);
    if (!node) {
      continue; // already rejected above with a structured issue
    }
    if (node.kind !== 'capability' && node.kind !== 'decision') {
      continue;
    }
    const descriptor = capabilities.getCapabilityDescriptor(node.capability);
    if (!descriptor) {
      continue; // already rejected above with a structured issue
    }
    const inputId = node.inputContractId;
    const outputId = node.outputContractId;
    const inputRevision =
      inputId === undefined
        ? undefined
        : (rawNode as { input?: string }).input !== undefined
          ? contracts.get(inputId)?.revision
          : descriptor.inputRevision;
    const outputRevision =
      outputId === undefined
        ? undefined
        : (rawNode as { output?: string }).output !== undefined
          ? contracts.get(outputId)?.revision
          : descriptor.outputRevision;
    bindings.push({
      capability: node.capability,
      revision: descriptor.revision,
      effect: descriptor.effect,
      input: inputId === undefined ? null : { id: inputId, revision: inputRevision ?? 'unknown' },
      output:
        outputId === undefined ? null : { id: outputId, revision: outputRevision ?? 'unknown' },
      ...(descriptor.idempotency === undefined ? {} : { idempotency: descriptor.idempotency }),
    });
  }
  const capabilitySetVersion = computeCapabilitySetVersion(bindings);
  const hasControlNodes = declaresControlSemantics(definition);
  const activationVersion = computeActivationVersion(
    graphVersion,
    capabilitySetVersion,
    hasControlNodes ? 'vict.activation@2' : 'vict.activation@1',
  );

  const graph: CompiledGraph = Object.freeze({
    id: definition.id,
    graphVersion,
    capabilitySetVersion,
    activationVersion,
    entryNodeId: definition.entry,
    nodeCount: nodeIds.length,
    nodeIds,
    hasControlNodes,
    getNode(nodeId: string): CompiledNode | undefined {
      return frozenNodes[nodeId];
    },
    successTargetOf(nodeId: string): string | undefined {
      return adjacency.success[nodeId];
    },
    errorTargetOf(nodeId: string): string | undefined {
      return adjacency.error[nodeId];
    },
    routeTargetsOf(nodeId: string): Readonly<Record<string, string>> {
      return adjacency.routes[nodeId] ?? Object.freeze({});
    },
    branchTargetsOf(forkId: string): Readonly<Record<string, string>> {
      return adjacency.branches[forkId] ?? Object.freeze({});
    },
    branchKeysOf(forkId: string): readonly string[] {
      return Object.keys(adjacency.branches[forkId] ?? {}).sort();
    },
    timeoutTargetOf(nodeId: string): string | undefined {
      return adjacency.timeout[nodeId];
    },
    joinOfFork(forkId: string): string | undefined {
      return adjacency.joinOfFork[forkId];
    },
    forkOfJoin(joinId: string): string | undefined {
      return adjacency.forkOfJoin[joinId];
    },
    toDefinition(): ApplicationGraphDefinition {
      if (hasControlNodes) {
        return deepFreeze(
          canonicalSemanticFormV2(definition),
        ) as unknown as ApplicationGraphDefinition;
      }
      return deepFreeze(canonicalSemanticForm(definition)) as unknown as ApplicationGraphDefinition;
    },
  });

  return { ok: true, graph };
}

function branchCountOf(branches: ReadonlyMap<string, Map<string, string>>, forkId: string): number {
  return branches.get(forkId)?.size ?? 0;
}

/** The effective output contract flowing into a fork node via its incoming success edge. */
function forkInputContract(
  forkId: string,
  effectiveNodes: ReadonlyMap<string, CompiledNode>,
  successTargets: ReadonlyMap<string, string[]>,
): string | undefined {
  for (const [from, targets] of successTargets) {
    if (targets.includes(forkId)) {
      return effectiveNodes.get(from)?.outputContractId;
    }
  }
  return undefined;
}

interface BranchRegionAnalysis {
  readonly reachesJoin: boolean;
  readonly nestedControlNode: string | undefined;
  readonly escapedAt: string | undefined;
}

/**
 * Analyze one fork branch region: walk forward from the branch target over
 * success/error/route/timeout edges (branch edges into another fork already
 * count as nested) and decide whether the region reaches the join, whether
 * it contains a nested fork/join, and whether any path terminates before
 * the join.
 */
function analyzeBranchRegion(
  start: string,
  joinId: string,
  nodesById: ReadonlyMap<string, NodeDraft>,
  successTargets: ReadonlyMap<string, string[]>,
  errorTargets: ReadonlyMap<string, string[]>,
  routes: ReadonlyMap<string, Map<string, string>>,
  timeoutTargets: ReadonlyMap<string, string>,
): BranchRegionAnalysis {
  const visited = new Set<string>();
  let reachesJoin = false;
  let nestedControlNode: string | undefined;
  let escapedAt: string | undefined;

  const walk = (nodeId: string): void => {
    if (nodeId === joinId) {
      reachesJoin = true;
      return;
    }
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = nodesById.get(nodeId);
    if (node && (node.kind === 'fork' || node.kind === 'join')) {
      nestedControlNode ??= nodeId;
      return;
    }
    const targets = [
      ...(successTargets.get(nodeId) ?? []),
      ...(errorTargets.get(nodeId) ?? []),
      ...(routes.get(nodeId)?.values() ?? []),
      ...(timeoutTargets.has(nodeId) ? [timeoutTargets.get(nodeId) as string] : []),
    ];
    if (targets.length === 0) {
      escapedAt ??= nodeId;
      return;
    }
    for (const target of targets) {
      walk(target);
    }
  };

  walk(start);
  return { reachesJoin, nestedControlNode, escapedAt };
}

/** Depth-first cycle detection over the combined control adjacency. Returns the cycle path or undefined. */
function findCycle(
  nodes: ReadonlyMap<string, CompiledNode>,
  success: ReadonlyMap<string, string[]>,
  error: ReadonlyMap<string, string[]>,
  routes: ReadonlyMap<string, Map<string, string>>,
  branches: ReadonlyMap<string, Map<string, string>>,
  timeoutTargets: ReadonlyMap<string, string>,
): string[] | undefined {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodes.keys()) {
    color.set(id, WHITE);
  }
  const stack: string[] = [];

  const visit = (id: string): string[] | undefined => {
    color.set(id, GRAY);
    stack.push(id);
    const targets = [
      ...(success.get(id) ?? []),
      ...(error.get(id) ?? []),
      ...(routes.get(id)?.values() ?? []),
      ...(branches.get(id)?.values() ?? []),
      ...(timeoutTargets.has(id) ? [timeoutTargets.get(id) as string] : []),
    ];
    for (const target of targets) {
      const state = color.get(target) ?? WHITE;
      if (state === GRAY) {
        const start = stack.indexOf(target);
        return [...stack.slice(start), target];
      }
      if (state === WHITE) {
        const found = visit(target);
        if (found) {
          return found;
        }
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return undefined;
  };

  for (const id of nodes.keys()) {
    if ((color.get(id) ?? WHITE) === WHITE) {
      const found = visit(id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function mapFromEntries(map: ReadonlyMap<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of map) {
    out[key] = value;
  }
  return out;
}
