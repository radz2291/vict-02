import { defineCapability } from '@victframework/sdk';
import { createRuntime } from '@victframework/runtime';
import { createInMemoryApplicationData } from '@victframework/application';
import type { ApplicationDataAdapter } from '@victframework/application';
import {
  collectSurfaces,
  resolveRoute,
  type ActionResult,
  type ViewDatum,
  type VictPlanView,
} from '@victframework/ui-svelte';
import { compileAgentPlan } from '$lib/application/agent.js';
import {
  agentDataContracts,
  agentMessageInputContract,
  agentReplyOutputContract,
  agentResourceList,
  agentSeeds,
} from '$lib/application/agent-data.js';

/**
 * The deterministic local server of the coding-agent product proof.
 *
 * It stands in for the real agent backend of a later phase: every state
 * change is a fixed, reproducible transition on the in-memory application
 * data (a dev-server restart resets the demo). All non-local actions still
 * cross the same explicit boundary as any Vict application:
 *
 * - queries and mutations go through the in-memory application-data
 *   adapter with an explicit authorization/effect context;
 * - conversation sends are real mutations whose handling composes a real
 *   Vict capability run (pinned activation, declared contracts) for the
 *   deterministic assistant reply;
 * - the `agentConsole` ops are the session state machine: approve,
 *   decline, advance, fail, retry and reset.
 *
 * Session identity comes from the ROUTE the action was issued from
 * (`?path=`), resolved against the plan's own route table — the same
 * record identity a form would receive. An explicit `input.id` is
 * accepted and wins, so the boundary never guesses.
 */

/** The authorization profile of this deployment (server-side only). */
export const agentServerGrants = ['agent.read', 'agent.write'];

/* ------------------------------------------------------------------ */
/* Real VICT capability: the deterministic assistant reply             */
/* ------------------------------------------------------------------ */

const agentReplyCapability = defineCapability({
  id: 'agent.assistant.reply',
  revision: '1',
  effect: 'pure',
  input: agentMessageInputContract,
  output: agentReplyOutputContract,
  invoke: (input: { id: string; text: string; author: string; participant: string }) => {
    const subject = input.text.trim().replace(/\s+/g, ' ').slice(0, 64);
    return {
      metrics: [
        {
          id: 'reply',
          label: `Reply to ${input.author}`,
          value: `Noted: “${subject}”. I logged it to the session activity and will fold it into the next step.`,
        },
      ],
    };
  },
});

function buildAgentRuntime() {
  const runtime = createRuntime();
  runtime.registerCapability(agentReplyCapability);
  runtime.registerContract(agentMessageInputContract);
  return runtime;
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

export interface AgentAppServer {
  readonly plan: ReturnType<typeof compileAgentPlan>;
  readonly data: ApplicationDataAdapter;
  dispatch(actionId: string, input?: unknown, path?: string | null): Promise<ActionResult>;
  loadRoute(
    path: string,
    _searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
}

const STATUS_LABELS: Record<string, string> = {
  running: 'running',
  completed: 'completed',
  failed: 'failed',
  awaiting_approval: 'waiting for your approval',
};

/** Views scoped to the route's session record. */
const scopedViews = new Set(['v.agentMessages', 'v.agentFiles', 'v.agentActivity', 'v.agentLog']);

/** Deterministic default sort per resource id. */
const defaultSorts: Record<string, { field: string; direction: 'asc' | 'desc' }> = {
  agentProjects: { field: 'id', direction: 'asc' },
  agentSessions: { field: 'updatedAt', direction: 'desc' },
  agentFiles: { field: 'path', direction: 'asc' },
  agentMessages: { field: 'createdAt', direction: 'asc' },
  agentActivity: { field: 'at', direction: 'asc' },
  agentLog: { field: 'at', direction: 'asc' },
  agentConsole: { field: 'id', direction: 'asc' },
};

export function createAgentServer(): AgentAppServer {
  const plan = compileAgentPlan();
  const runtime = buildAgentRuntime();

  // The adapter lives in a mutable box so `act.reset` can re-seed the
  // whole demo without restarting the server (restarts also reset, which
  // the product copy says out loud).
  let data = createAdapter();
  function createAdapter(): ApplicationDataAdapter {
    return createInMemoryApplicationData(agentResourceList, {
      id: 'vict.agent-workspace-data',
      revision: '1',
      seeds: agentSeeds,
      contracts: agentDataContracts,
    });
  }

  const activationVersions = new Map<string, string>();
  async function ensureActivation(graphId: string): Promise<string> {
    const cached = activationVersions.get(graphId);
    if (cached !== undefined) return cached;
    const activation = await runtime.activate({
      id: graphId,
      entry: 'only',
      nodes: [{ id: 'only', capability: 'agent.assistant.reply', input: 'agent.message.input' }],
      edges: [],
    });
    if (!activation.ok) throw new Error('capability activation failed');
    activationVersions.set(graphId, activation.activationVersion);
    return activation.activationVersion;
  }

  let counter = 0;
  function nextId(prefix: string): string {
    counter += 1;
    return `${prefix}-${String(counter).padStart(4, '0')}-D`;
  }

  /** Fixed wall-clock for appended demo entries (advances deterministically). */
  let clockMinutes = 0;
  function isoNow(): string {
    clockMinutes += 1;
    const total = 9 * 60 + clockMinutes;
    const day = 26 + Math.floor(total / (24 * 60));
    const hh = Math.floor((total % (24 * 60)) / 60);
    const mm = total % 60;
    return `2026-09-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`;
  }

  async function listRows(
    resourceId: string,
    sort?: { field: string; direction: 'asc' | 'desc' },
  ): Promise<Record<string, unknown>[]> {
    const result = await data.query(
      { op: 'list', resourceId, ...(sort !== undefined ? { sort: [sort] } : {}) },
      { permissions: agentServerGrants, effect: 'read' },
    );
    if (!result.ok) return [];
    return (result.rows ?? []) as Record<string, unknown>[];
  }

  async function patchSession(id: string, patch: Record<string, unknown>): Promise<ActionResult> {
    const updated = await data.mutate(
      { resourceId: 'agentSessions', op: 'update', id, input: patch },
      { permissions: agentServerGrants, effect: 'write' },
    );
    if (!updated.ok) {
      return { ok: false, code: updated.code, message: updated.message };
    }
    return { ok: true, value: updated.row };
  }

  async function appendActivity(sessionId: string, summary: string): Promise<void> {
    await data.mutate(
      {
        resourceId: 'agentActivity',
        op: 'create',
        input: { id: nextId('act'), sessionId, at: isoNow(), actor: 'Victor', summary },
      },
      { permissions: agentServerGrants, effect: 'write' },
    );
  }

  async function appendLog(
    sessionId: string,
    level: 'info' | 'command' | 'warn' | 'error',
    tool: string,
    line: string,
  ): Promise<void> {
    await data.mutate(
      {
        resourceId: 'agentLog',
        op: 'create',
        input: { id: nextId('log'), sessionId, at: isoNow(), level, tool, line },
      },
      { permissions: agentServerGrants, effect: 'write' },
    );
  }

  async function appendMessage(sessionId: string, text: string): Promise<void> {
    await data.mutate(
      {
        resourceId: 'agentMessages',
        op: 'create',
        input: {
          id: nextId('msg'),
          sessionId,
          text,
          author: 'Victor',
          participant: 'assistant',
          createdAt: isoNow(),
        },
        idempotencyKey: `message:${sessionId}:${clockMinutes}`,
      },
      { permissions: agentServerGrants, effect: 'write' },
    );
  }

  async function runReply(input: unknown): Promise<string> {
    await ensureActivation('g.agent.reply');
    const result = await runtime.run(input, { mode: 'normal' });
    if (result.status !== 'completed' || result.output === undefined) {
      throw new Error('capability run failed');
    }
    const checked = agentReplyOutputContract.parse(result.output);
    if (!checked.ok) throw new Error('capability reply output invalid');
    return checked.value.metrics[0]?.value ?? 'Noted.';
  }

  /** The session an action refers to: route identity first, input id second. */
  async function targetSession(
    input: unknown,
    path?: string | null,
  ): Promise<{
    session: Record<string, unknown> | null;
    error?: ActionResult;
  }> {
    let id: string | undefined;
    const candidate = (input ?? {}) as Record<string, unknown>;
    if (typeof candidate.id === 'string' && candidate.id.length > 0) {
      id = candidate.id;
    } else if (path !== undefined && path !== null && path.length > 0) {
      const resolved = resolveRoute(plan.toJSON() as unknown as VictPlanView, path);
      const first = resolved?.params ? Object.values(resolved.params)[0] : undefined;
      if (typeof first === 'string' && first.length > 0) id = first;
    }
    if (id === undefined) {
      return {
        session: null,
        error: {
          ok: false,
          code: 'DATA_UNKNOWN_IDENTITY',
          message: 'No session was identified for this action.',
        },
      };
    }
    const rows = await listRows('agentSessions', { field: 'id', direction: 'asc' });
    const session = rows.find((row) => row.id === id);
    if (session === undefined) {
      return {
        session: null,
        error: {
          ok: false,
          code: 'DATA_UNKNOWN_IDENTITY',
          message: 'That session does not exist in this workspace.',
        },
      };
    }
    return { session };
  }

  function stateError(session: Record<string, unknown>, message: string): ActionResult {
    const status = String(session.status ?? 'unknown');
    return {
      ok: false,
      code: 'ACTION_FAILED',
      message: `${message} This session is ${STATUS_LABELS[status] ?? status}.`,
    };
  }

  /** The deterministic session state machine (console ops). */
  async function dispatchConsoleOp(
    op: string,
    input?: unknown,
    path?: string | null,
  ): Promise<ActionResult> {
    // The demo restart is global by design: it needs no session identity.
    if (op === 'reset') {
      data = createAdapter();
      activationVersions.clear();
      counter = 0;
      clockMinutes = 0;
      return { ok: true, value: { reset: true } };
    }
    const found = await targetSession(input, path);
    if (found.error !== undefined) return found.error;
    const session = found.session!;
    const id = String(session.id);
    const status = String(session.status);
    const progress = typeof session.progress === 'number' ? session.progress : 0;

    switch (op) {
      case 'approve': {
        if (status !== 'awaiting_approval') {
          return stateError(session, 'Only a waiting session can be approved.');
        }
        const patched = await patchSession(id, {
          status: 'running',
          progress: Math.max(progress, 45),
          updatedAt: isoNow(),
        });
        if (!patched.ok) return patched;
        await appendActivity(id, 'Approval received — work resumed');
        await appendLog(id, 'info', 'review', 'approval granted; resuming the task');
        await appendMessage(id, 'Approval received. Resuming the task from the facade change.');
        return { ok: true, value: { id, status: 'running' } };
      }
      case 'decline': {
        if (status !== 'awaiting_approval') {
          return stateError(session, 'Only a waiting session can be declined.');
        }
        const patched = await patchSession(id, {
          status: 'completed',
          progress: Math.max(progress, 45),
          updatedAt: isoNow(),
        });
        if (!patched.ok) return patched;
        await appendActivity(id, 'Change declined — session closed');
        await appendLog(
          id,
          'warn',
          'review',
          'change declined; the session closed without applying it',
        );
        await appendMessage(
          id,
          'Change declined. I closed the session without applying the pending work; the branch keeps what was already committed.',
        );
        return { ok: true, value: { id, status: 'completed' } };
      }
      case 'advance': {
        if (status !== 'running') {
          return stateError(session, 'Only a running session can advance.');
        }
        const next = Math.min(100, progress + 25);
        const finished = next >= 100;
        const patched = await patchSession(id, {
          progress: next,
          ...(finished ? { status: 'completed' } : {}),
          updatedAt: isoNow(),
        });
        if (!patched.ok) return patched;
        await appendLog(id, 'info', 'task', `step complete (${next}% of the task plan)`);
        await appendActivity(
          id,
          finished ? 'Final step complete — session finished' : `Step complete (${next}%)`,
        );
        if (finished) {
          await appendMessage(
            id,
            'That was the last step. The session is complete; the transcript and changed files remain available for review.',
          );
        }
        return {
          ok: true,
          value: { id, progress: next, status: finished ? 'completed' : 'running' },
        };
      }
      case 'fail': {
        if (status !== 'running') {
          return stateError(session, 'Only a running session can fail.');
        }
        const patched = await patchSession(id, { status: 'failed', updatedAt: isoNow() });
        if (!patched.ok) return patched;
        await appendLog(id, 'error', 'verify', 'injected demo failure: typecheck exited 1');
        await appendLog(id, 'error', 'stop', 'stopping at the last checkpoint; nothing was pushed');
        await appendActivity(id, 'Typecheck failed — session stopped');
        await appendMessage(
          id,
          'The typecheck failed on the current step, so I stopped at the last checkpoint. Nothing was pushed. Use “Retry from checkpoint” when you are ready.',
        );
        return { ok: true, value: { id, status: 'failed' } };
      }
      case 'retry': {
        if (status !== 'failed') {
          return stateError(session, 'Only a failed session can be retried.');
        }
        const patched = await patchSession(id, { status: 'running', updatedAt: isoNow() });
        if (!patched.ok) return patched;
        await appendLog(id, 'info', 'task', 'retrying from the last checkpoint');
        await appendActivity(id, 'Retried from the last checkpoint');
        await appendMessage(
          id,
          'Retrying from the last checkpoint; I will report back after this step.',
        );
        return { ok: true, value: { id, status: 'running' } };
      }
      case 'reset':
        // Handled before identity resolution (global op).
        return { ok: true, value: { reset: true } };
      default:
        return {
          ok: false,
          code: 'MUTATION_NOT_DECLARED',
          message: 'The console op is not implemented by the agent server.',
        };
    }
  }

  const dispatch = async (
    actionId: string,
    input?: unknown,
    path?: string | null,
  ): Promise<ActionResult> => {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return {
        ok: false,
        code: 'UNKNOWN_ACTION',
        message: 'The action is not declared by the application.',
      };
    }
    try {
      if (action.kind === 'query') {
        const payload = (input ?? {}) as {
          filters?: Record<string, string>;
          search?: { text: string; fields: string[] };
          sort?: { field: string; direction: 'asc' | 'desc' }[];
          limit?: number;
          offset?: number;
        };
        const result = await data.query(
          {
            op: 'list',
            resourceId: action.resourceId,
            ...(payload.filters !== undefined ? { filters: payload.filters } : {}),
            ...(payload.search !== undefined ? { search: payload.search } : {}),
            ...(payload.sort !== undefined ? { sort: payload.sort } : {}),
            ...(payload.limit !== undefined ? { limit: payload.limit } : {}),
            ...(payload.offset !== undefined ? { offset: payload.offset } : {}),
          },
          { permissions: agentServerGrants, effect: 'read' },
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: { rows: result.rows ?? [], total: result.total } };
      }

      if (action.kind === 'mutation') {
        if (action.resourceId === 'agentConsole') {
          return await dispatchConsoleOp(action.op, input, path);
        }

        // Conversation send: mutation + a REAL deterministic capability reply.
        if (action.resourceId === 'agentMessages' && action.op === 'create') {
          const found = await targetSession(input, path);
          if (found.error !== undefined) return found.error;
          const session = found.session!;
          const status = String(session.status);
          if (status !== 'running' && status !== 'awaiting_approval') {
            return {
              ok: false,
              code: 'ACTION_FAILED',
              message: `Victor is not listening while the session is ${STATUS_LABELS[status] ?? status}.`,
            };
          }
          const payload = (input ?? {}) as Record<string, unknown>;
          const parsed = agentMessageInputContract.parse({
            id: nextId('msg'),
            sessionId: String(session.id),
            text: payload.text,
            author: payload.author,
            participant: payload.participant,
          });
          if (!parsed.ok) {
            return { ok: false, code: 'CONTRACT_REJECTED', message: 'The message is invalid.' };
          }
          const stored = await data.mutate(
            {
              resourceId: 'agentMessages',
              op: 'create',
              input: { ...parsed.value, createdAt: isoNow() },
              idempotencyKey: `message:${parsed.value.id}`,
            },
            { permissions: agentServerGrants, effect: 'write' },
          );
          if (!stored.ok) return { ok: false, code: stored.code, message: stored.message };
          const replyText = await runReply(parsed.value);
          await data.mutate(
            {
              resourceId: 'agentMessages',
              op: 'create',
              input: {
                id: nextId('reply'),
                sessionId: String(session.id),
                text: replyText,
                author: 'Victor',
                participant: 'assistant',
                createdAt: isoNow(),
              },
              idempotencyKey: `reply:${parsed.value.id}`,
            },
            { permissions: agentServerGrants, effect: 'write' },
          );
          return { ok: true, value: stored.row };
        }
      }

      return {
        ok: false,
        code: 'UNSUPPORTED_ACTION',
        message: `Actions of kind '${action.kind}' do not cross the server boundary.`,
      };
    } catch {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The action could not be completed; this safe failure is server-generated.',
      };
    }
  };

  const loadRoute = async (
    path: string,
    _searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null> => {
    const planView = plan.toJSON() as unknown as VictPlanView;
    const resolved = resolveRoute(planView, path);
    if (resolved === null || resolved.screen === null) return null;

    const viewData: Record<string, ViewDatum> = {};
    let record: Record<string, unknown> | null = null;

    // Route parameter → the session record the workspace is about.
    const routeId = resolved.route.id;
    let sessionId: string | undefined;
    if (routeId === 'session') {
      const first = Object.values(resolved.params)[0];
      if (typeof first === 'string' && first.length > 0) sessionId = first;
    }
    if (sessionId !== undefined) {
      const got = await data.query(
        { op: 'get', resourceId: 'agentSessions', id: sessionId },
        { permissions: agentServerGrants, effect: 'read' },
      );
      if (got.ok && got.row !== undefined) {
        record = got.row as Record<string, unknown>;
      }
    }

    const viewIds = new Set<string>();
    for (const { surface } of collectSurfaces(resolved.screen)) {
      const viewId = (surface as { viewId?: unknown }).viewId;
      if (typeof viewId === 'string') viewIds.add(viewId);
    }

    for (const viewId of viewIds) {
      const view = plan.views[viewId];
      if (view === undefined) continue;
      const resourceId = view.resourceId as string;
      const rows = await listRows(resourceId, defaultSorts[resourceId]);
      viewData[viewId] = {
        rows:
          record !== null && scopedViews.has(viewId)
            ? rows.filter((row) => row.sessionId === (record as { id: unknown }).id)
            : rows,
        loading: false,
      };
    }

    return { plan: planView, viewData, record };
  };

  return {
    plan,
    get data() {
      return data;
    },
    dispatch,
    loadRoute,
  };
}
