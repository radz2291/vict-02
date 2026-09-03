import { defineCapability } from '@vict/sdk';
import { createRuntime } from '@vict/runtime';
import type { ApplicationDataAdapter } from '@vict/application';
import {
  collectSurfaces,
  resolveRoute,
  type ActionResult,
  type ViewDatum,
  type VictPlanView,
} from '@vict/renderer-svelte';
import {
  analyzeInputContract,
  analyzeOutputContract,
  compileReferencePlan,
  messageInputContract,
  projectInputContract,
} from '$lib/application/definition.js';

/**
 * The reference application's in-process application server (local modular
 * monolith).
 *
 * Every non-local action crosses an explicit boundary BELOW the UI:
 * - queries and mutations go through the SQLite application-data adapter
 *   with an explicit authorization/effect context;
 * - the conversation send composes a REAL Vict run (runtime.activate/run)
 *   whose capability computes the assistant reply under declared input and
 *   output contracts with effect policy enforced;
 * - the dashboard analysis action starts its own real Vict run;
 * - local actions never leave the renderer boundary and never reach this
 *   dispatcher (there is deliberately no server-side local handler).
 *
 * The server holds the authorization profile. The UI cannot grant itself
 * anything: act.deleteProject requires 'projects.admin.delete', which this
 * deployment deliberately does NOT carry, so the boundary — not the
 * visibility of any button — denies it.
 */

/** The authorization profile of this deployment (server-side only). */
export const serverGrants = [
  'projects.read',
  'projects.write',
  'messages.read',
  'messages.write',
  'metrics.read',
  'metrics.write',
];

/* ------------------------------------------------------------------ */
/* Capabilities (real Vict-governed behavior)                          */
/* ------------------------------------------------------------------ */

/** Pure capability: computes the assistant reply for a user message. */
const replyCapability = defineCapability({
  id: 'refapp.reply',
  revision: '1',
  effect: 'pure',
  input: messageInputContract,
  output: analyzeOutputContract,
  invoke: (input: { id: string; text: string; author: string; participant: string }) => {
    const words = input.text.trim().split(/\s+/).length;
    return {
      metrics: [
        {
          id: 'reply',
          label: `Reply to ${input.author}`,
          value: `Received “${input.text.slice(0, 40)}” (${words} words).`,
        },
      ],
    };
  },
});

/** Pure capability: formats workspace metrics from raw project stats. */
const analyzeCapability = defineCapability({
  id: 'refapp.analyze',
  revision: '1',
  effect: 'pure',
  input: analyzeInputContract,
  output: analyzeOutputContract,
  invoke: (input: { projectCount: number; activeCount: number; totalBudget: number }) => ({
    metrics: [
      { id: 'm-total', label: 'Total projects', value: String(input.projectCount) },
      { id: 'm-active', label: 'Active projects', value: String(input.activeCount) },
      { id: 'm-budget', label: 'Total budget', value: String(Math.round(input.totalBudget)) },
    ],
  }),
});

function buildRuntime() {
  const runtime = createRuntime();
  runtime.registerCapability(replyCapability);
  runtime.registerCapability(analyzeCapability);
  runtime.registerContract(messageInputContract);
  runtime.registerContract(analyzeInputContract);
  return runtime;
}

/* ------------------------------------------------------------------ */
/* Application server                                                  */
/* ------------------------------------------------------------------ */

export interface CreateReferenceServerOptions {
  /** The application-data adapter (REQUIRED; production wiring in application-server.sqlite.ts). */
  readonly data: ApplicationDataAdapter;
  /** Applied-migration inspector override (tests). */
  readonly appliedMigrations?: () => readonly { readonly id: string; readonly version: number }[];
}

export interface ReferenceAppServer {
  readonly plan: ReturnType<typeof compileReferencePlan>;
  readonly data: ApplicationDataAdapter;
  readonly appliedMigrations: () => readonly { readonly id: string; readonly version: number }[];
  dispatch(actionId: string, input?: unknown): Promise<ActionResult>;
  loadRoute(
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
  close(): void;
}

export function createReferenceServer(
  options: CreateReferenceServerOptions = {},
): ReferenceAppServer {
  const plan = compileReferencePlan();
  const runtime = buildRuntime();
  // The adapter is injected: production wiring (the SQLite application-domain
  // adapter with its separate migrations) lives in application-server.sqlite.ts
  // and keeps node:sqlite out of browser-like module graphs. The server core
  // itself depends only on the storage-neutral port.
  if (options.data === undefined) {
    throw new Error(
      'createReferenceServer requires an application-data adapter (see application-server.sqlite.ts for the production wiring).',
    );
  }
  const data: ApplicationDataAdapter = options.data;

  const activationVersions = new Map<string, string>();
  async function ensureActivation(graphId: string): Promise<string> {
    const cached = activationVersions.get(graphId);
    if (cached !== undefined) {
      return cached;
    }
    const graph =
      graphId === 'g.refapp.reply'
        ? {
            id: graphId,
            entry: 'only',
            nodes: [{ id: 'only', capability: 'refapp.reply', input: 'refapp.message.input' }],
            edges: [],
          }
        : {
            id: graphId,
            entry: 'only',
            nodes: [{ id: 'only', capability: 'refapp.analyze', input: 'refapp.analyze.input' }],
            edges: [],
          };
    const activation = await runtime.activate(graph);
    if (!activation.ok) {
      throw new Error('capability activation failed');
    }
    activationVersions.set(graphId, activation.activationVersion);
    return activation.activationVersion;
  }

  async function runCapability<T>(graphId: string, input: unknown): Promise<T> {
    await ensureActivation(graphId);
    // The run executes against the runtime's selected activation of the
    // graph: pinned execution meaning, declared contracts, effect policy.
    const result = await runtime.run(input, { mode: 'normal' });
    if (result.status !== 'completed' || result.output === undefined) {
      throw new Error('capability run failed');
    }
    return result.output as T;
  }

  let messageCounter = 0;
  function nextId(prefix: string): string {
    messageCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${messageCounter}`;
  }

  async function listRows(
    resourceId: string,
    options: { sort?: { field: string; direction: 'asc' | 'desc' } } = {},
  ): Promise<Record<string, unknown>[]> {
    const result = await data.query(
      { op: 'list', resourceId, ...(options.sort !== undefined ? { sort: [options.sort] } : {}) },
      { permissions: serverGrants, effect: 'read' },
    );
    if (!result.ok) {
      return [];
    }
    return (result.rows ?? []) as Record<string, unknown>[];
  }

  async function upsertMetric(metric: { id: string; label: string; value: string }): Promise<void> {
    const existing = await data.query(
      { op: 'get', resourceId: 'metrics', id: metric.id },
      { permissions: serverGrants, effect: 'read' },
    );
    if (existing.ok) {
      await data.mutate(
        { resourceId: 'metrics', op: 'update', id: metric.id, input: metric },
        { permissions: serverGrants, effect: 'write' },
      );
      return;
    }
    await data.mutate(
      { resourceId: 'metrics', op: 'create', input: metric, idempotencyKey: `metric:${metric.id}` },
      { permissions: serverGrants, effect: 'write' },
    );
  }

  const dispatch = async (actionId: string, input?: unknown): Promise<ActionResult> => {
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
          { permissions: serverGrants, effect: 'read' },
        );
        if (!result.ok) {
          return { ok: false, code: result.code, message: result.message };
        }
        return { ok: true, value: { rows: result.rows ?? [], total: result.total } };
      }

      if (action.kind === 'mutation') {
        const payload = (input ?? {}) as Record<string, unknown>;
        const identity =
          typeof payload.id === 'string' && payload.id.length > 0
            ? payload.id
            : typeof payload.__identity === 'string' && payload.__identity.length > 0
              ? payload.__identity
              : undefined;

        if (action.resourceId === 'projects' && action.op !== 'delete') {
          const parsed = projectInputContract.parse(payload);
          if (!parsed.ok) {
            return {
              ok: false,
              code: 'CONTRACT_REJECTED',
              message: 'The submitted project is invalid.',
            };
          }
          const createResult = await data.mutate(
            {
              resourceId: 'projects',
              op: action.op,
              input: parsed.value,
              ...(identity !== undefined ? { id: identity } : {}),
              ...(action.op === 'create' && parsed.value.id !== undefined
                ? { idempotencyKey: `project:${parsed.value.id}` }
                : {}),
            },
            { permissions: serverGrants, effect: 'write' },
          );
          if (!createResult.ok) {
            return { ok: false, code: createResult.code, message: createResult.message };
          }
          return { ok: true, value: createResult.row };
        }

        if (action.resourceId === 'messages' && action.op === 'create') {
          const id =
            typeof payload.id === 'string' && payload.id.length > 0 ? payload.id : nextId('msg');
          const parsed = messageInputContract.parse({
            id,
            text: payload.text,
            author: payload.author,
            participant: payload.participant,
          });
          if (!parsed.ok) {
            return { ok: false, code: 'CONTRACT_REJECTED', message: 'The message is invalid.' };
          }
          const stored = await data.mutate(
            {
              resourceId: 'messages',
              op: 'create',
              input: { ...parsed.value, createdAt: new Date().toISOString() },
              idempotencyKey: `message:${parsed.value.id}`,
            },
            { permissions: serverGrants, effect: 'write' },
          );
          if (!stored.ok) {
            return { ok: false, code: stored.code, message: stored.message };
          }
          // Durable VICT processing: the reply is computed by a REAL Vict
          // run (pinned activation, declared contracts, effect policy) and
          // stored as an assistant message.
          const reply = await runCapability<{
            metrics: { id: string; label: string; value: string }[];
          }>('g.refapp.reply', parsed.value);
          const replyText = reply.metrics[0]?.value ?? 'Done.';
          await data.mutate(
            {
              resourceId: 'messages',
              op: 'create',
              input: {
                id: nextId('reply'),
                text: replyText,
                author: 'Assistant',
                participant: 'assistant',
                createdAt: new Date().toISOString(),
              },
              idempotencyKey: `reply:${parsed.value.id}`,
            },
            { permissions: serverGrants, effect: 'write' },
          );
          return { ok: true, value: stored.row };
        }

        // delete and any other declared mutation op.
        const deleteResult = await data.mutate(
          {
            resourceId: action.resourceId,
            op: action.op,
            ...(identity !== undefined ? { id: identity } : {}),
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!deleteResult.ok) {
          return { ok: false, code: deleteResult.code, message: deleteResult.message };
        }
        return { ok: true, value: null };
      }

      if (action.kind === 'capability') {
        if (action.capabilityId === 'refapp.analyze') {
          const projects = await listRows('projects');
          const runInput = {
            projectCount: projects.length,
            activeCount: projects.filter((project) => project.status === 'active').length,
            totalBudget: projects.reduce(
              (sum, project) => sum + (typeof project.budget === 'number' ? project.budget : 0),
              0,
            ),
          };
          const parsed = analyzeInputContract.parse(runInput);
          if (!parsed.ok) {
            return {
              ok: false,
              code: 'CONTRACT_REJECTED',
              message: 'The analysis input is invalid.',
            };
          }
          const output = await runCapability<{
            metrics: { id: string; label: string; value: string }[];
          }>('g.refapp.analyze', parsed.value);
          const outChecked = analyzeOutputContract.parse(output);
          if (!outChecked.ok) {
            return {
              ok: false,
              code: 'CONTRACT_REJECTED',
              message: 'The analysis output is invalid.',
            };
          }
          for (const metric of outChecked.value.metrics) {
            await upsertMetric(metric);
          }
          return { ok: true, value: outChecked.value };
        }
        return {
          ok: false,
          code: 'UNSUPPORTED_ACTION',
          message: 'The capability action is not wired.',
        };
      }

      // navigation / local: navigation is client-side routing; local is
      // renderer-only. Neither reaches this dispatcher through the host.
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
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null> => {
    const planView = plan.toJSON() as unknown as VictPlanView;
    const resolved = resolveRoute(planView, path);
    if (resolved === null || resolved.screen === null) {
      return null; // unknown route → structured 404 by the caller
    }
    const stale = searchParams?.get('demo') === 'stale';
    const partial = searchParams?.get('demo') === 'partial';

    const viewData: Record<string, ViewDatum> = {};
    let record: Record<string, unknown> | null = null;

    // Nested surfaces (tabs/dialogs/drawers) declare view bindings too.
    const viewIds = new Set<string>();
    for (const { surface } of collectSurfaces(resolved.screen)) {
      const viewId = (surface as { viewId?: unknown }).viewId;
      if (typeof viewId === 'string') {
        viewIds.add(viewId);
      }
    }

    for (const viewId of viewIds) {
      const view = plan.views[viewId];
      if (view === undefined) {
        continue;
      }
      if (view.resourceId === 'messages') {
        const rows = await listRows('messages', { sort: { field: 'createdAt', direction: 'asc' } });
        viewData[viewId] = { rows, loading: false, stale, partial };
        continue;
      }
      if (view.resourceId === 'projects') {
        const rows = await listRows('projects', { sort: { field: 'name', direction: 'asc' } });
        viewData[viewId] = { rows, loading: false, stale, partial };
        const identity = resolved.params.id;
        if (identity !== undefined) {
          const got = await data.query(
            { op: 'get', resourceId: 'projects', id: identity },
            { permissions: serverGrants, effect: 'read' },
          );
          if (got.ok && got.row !== undefined) {
            record = got.row as Record<string, unknown>;
            viewData[viewId] = { rows, record, loading: false, stale, partial };
          }
        }
        continue;
      }
      if (view.resourceId === 'metrics') {
        const rows = await listRows('metrics', { sort: { field: 'id', direction: 'asc' } });
        viewData[viewId] = { rows, loading: false, stale, partial };
      }
    }

    return { plan: planView, viewData, record };
  };

  return {
    plan,
    data,
    appliedMigrations: () =>
      options.appliedMigrations?.() ??
      ('appliedMigrations' in data
        ? (
            data as { appliedMigrations?: () => readonly { id: string; version: number }[] }
          ).appliedMigrations?.()
        : []) ??
      [],
    dispatch,
    loadRoute,
    close() {
      (data as { close?: () => void }).close?.();
    },
  };
}

let singleton: ReferenceAppServer | undefined;

export function getReferenceServer(): ReferenceAppServer {
  if (singleton === undefined) {
    singleton = createReferenceServer();
  }
  return singleton;
}

/** Test helper: dispose the singleton (close the database handle). */
export function resetReferenceServer(): void {
  singleton?.close();
  singleton = undefined;
}
