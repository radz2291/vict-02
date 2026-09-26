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
import { compileFoundationPlan, foundationSeeds } from '$lib/application/foundation.js';
import { compileShowcasePlan } from '$lib/application/definition.js';
import {
  dataContracts,
  demoInputContract,
  messageInputContract,
  replyOutputContract,
  resourceList,
  seeds,
  stressInputContract,
  ticketInputContract,
  galleryInputContract,
} from '$lib/application/data.js';

/**
 * The showcase application server (in-process; local modular monolith).
 *
 * Every non-local action crosses an explicit boundary BELOW the UI:
 * - queries and mutations go through the in-memory application-data adapter
 *   (the Stage 04 reference adapter) with an explicit authorization/effect
 *   context and DETERMINISTIC seeds;
 * - conversation sends are real mutations whose handling composes a REAL
 *   Vict capability run (pinned activation, declared contracts) for the
 *   assistant reply;
 * - the `demo` resource hosts the structured demo-state mutations
 *   (validation/denied/failure/success + the deterministic demo decisions);
 * - local and navigation actions never reach this dispatcher.
 *
 * The server holds the authorization profile. `tickets.admin.delete` is
 * deliberately NOT carried, so the destructive ops action is denied by the
 * boundary — not by button visibility.
 */

/** The authorization profile of this deployment (server-side only). */
export const serverGrants = [
  'tickets.read',
  'tickets.write',
  'instruments.read',
  'signals.read',
  'agent.read',
  'agent.write',
  'world.read',
  'world.write',
  'workflow.read',
  'workflow.write',
  'analytics.read',
  'gallery.read',
  'gallery.write',
  'stress.read',
  'stress.write',
  'demo.read',
  'demo.write',
];

/* ------------------------------------------------------------------ */
/* Real VICT capability: the conversation reply                        */
/* ------------------------------------------------------------------ */

const replyCapability = defineCapability({
  id: 'showcase.reply',
  revision: '1',
  effect: 'pure',
  input: messageInputContract,
  output: replyOutputContract,
  invoke: (input: { id: string; text: string; author: string; participant: string }) => {
    const words = input.text.trim().split(/\s+/).length;
    return {
      metrics: [
        {
          id: 'reply',
          label: `Balasan kepada ${input.author}`,
          value: `Mesej diterima: “${input.text.slice(0, 60)}” (${words} patah perkataan).`,
        },
      ],
    };
  },
});

export function buildRuntime() {
  const runtime = createRuntime();
  runtime.registerCapability(replyCapability);
  runtime.registerContract(messageInputContract);
  return runtime;
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

export interface ShowcaseAppServer {
  readonly plan: ReturnType<typeof compileShowcasePlan>;
  readonly data: ApplicationDataAdapter;
  dispatch(actionId: string, input?: unknown): Promise<ActionResult>;
  loadRoute(
    path: string,
    searchParams?: URLSearchParams,
  ): Promise<{
    readonly plan: VictPlanView;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
}

/** Deterministic default sort per resource id. */
const defaultSorts: Record<string, { field: string; direction: 'asc' | 'desc' }> = {
  tickets: { field: 'createdAt', direction: 'desc' },
  instruments: { field: 'id', direction: 'asc' },
  signals: { field: 'id', direction: 'asc' },
  instrumentSeries: { field: 'session', direction: 'asc' },
  agentSessions: { field: 'id', direction: 'asc' },
  agentFiles: { field: 'path', direction: 'asc' },
  agentMessages: { field: 'createdAt', direction: 'asc' },
  quellightMessages: { field: 'createdAt', direction: 'asc' },
  galleryMessages: { field: 'createdAt', direction: 'asc' },
  stressMessages: { field: 'createdAt', direction: 'asc' },
  emptyInbox: { field: 'createdAt', direction: 'asc' },
  worldEntries: { field: 'id', direction: 'asc' },
  worldChanges: { field: 'id', direction: 'asc' },
  workflowInstances: { field: 'id', direction: 'asc' },
  workflowEvents: { field: 'at', direction: 'asc' },
  kpi: { field: 'id', direction: 'asc' },
  deals: { field: 'id', direction: 'asc' },
  galleryChartZero: { field: 'id', direction: 'asc' },
  galleryChartOne: { field: 'id', direction: 'asc' },
  galleryChartWide: { field: 'id', direction: 'asc' },
  galleryChartMixed: { field: 'id', direction: 'asc' },
  gallerySubmissions: { field: 'id', direction: 'asc' },
  stressRows: { field: 'id', direction: 'asc' },
  demo: { field: 'id', direction: 'asc' },
};

/** Parameter routes → the resource whose record the parameter identifies. */
const paramResources: Record<string, string> = {
  'ops-ticket-detail': 'tickets',
  'trading-instrument': 'instruments',
  'agent-session': 'agentSessions',
  'quellight-entry': 'worldEntries',
  'workflow-instance': 'workflowInstances',
};

/** Static detail paths (no route parameters): path → { resource, id }. */
const staticRecords: Record<string, { readonly resource: string; readonly id: string }> = {
  '/trading/instruments/xauusd': { resource: 'instruments', id: 'XAUUSD' },
  '/trading/instruments/eurusd': { resource: 'instruments', id: 'EURUSD' },
  '/trading/instruments/btcusd': { resource: 'instruments', id: 'BTCUSD' },
  '/quellight': { resource: 'worldEntries', id: 'QL-0042' },
  '/gallery/forms/prefilled': { resource: 'tickets', id: 'OPS-1042' },
};

/**
 * Server-side view scoping: these views show ONLY the rows belonging to the
 * route's record (e.g. one instrument's price series inside its detail
 * screen). Applied only when the route carries a record.
 */
const viewScopeFilters: Record<string, (row: Record<string, unknown>, id: string) => boolean> = {
  'v.series': (row, id) => row.instrumentId === id,
  'v.signalsForInstrument': (row, id) => row.instrumentId === id,
  'v.agentFiles': (row, id) => row.sessionId === id,
  'v.workflowEvents': (row, id) => row.instanceId === id,
};

/** Dedicated demo-state routes (equivalent to ?demo=stale / ?demo=partial). */
const STALE_PATHS = new Set(['/gallery/states/stale']);
const PARTIAL_PATHS = new Set(['/gallery/states/partial']);

const MESSAGE_RESOURCES = new Set([
  'agentMessages',
  'quellightMessages',
  'galleryMessages',
  'stressMessages',
  'emptyInbox',
]);

export function createShowcaseServer(
  options: {
    readonly data?: ApplicationDataAdapter;
    readonly foundation?: boolean;
    readonly plan?: ShowcaseAppServer['plan'];
  } = {},
): ShowcaseAppServer {
  const foundation = options.foundation ?? process.env.VICT_FOUNDATION === '1';
  const plan = options.plan ?? (foundation ? compileFoundationPlan() : compileShowcasePlan());
  const runtime = buildRuntime();
  const data: ApplicationDataAdapter =
    options.data ??
    createInMemoryApplicationData(resourceList, {
      id: 'vict.showcase-data',
      revision: '1',
      seeds: { ...seeds, ...(foundation ? foundationSeeds : {}) } as Record<
        string,
        readonly Record<string, unknown>[]
      >,
      contracts: dataContracts,
    });

  const activationVersions = new Map<string, string>();
  async function ensureActivation(graphId: string): Promise<string> {
    const cached = activationVersions.get(graphId);
    if (cached !== undefined) {
      return cached;
    }
    const activation = await runtime.activate({
      id: graphId,
      entry: 'only',
      nodes: [{ id: 'only', capability: 'showcase.reply', input: 'showcase.message.input' }],
      edges: [],
    });
    if (!activation.ok) {
      throw new Error('capability activation failed');
    }
    activationVersions.set(graphId, activation.activationVersion);
    return activation.activationVersion;
  }

  let counter = 0;
  function nextId(prefix: string): string {
    counter += 1;
    return `${prefix}-${String(counter).padStart(5, '0')}`;
  }

  async function runReply(input: unknown): Promise<string> {
    await ensureActivation('g.showcase.reply');
    const result = await runtime.run(input, { mode: 'normal' });
    if (result.status !== 'completed' || result.output === undefined) {
      throw new Error('capability run failed');
    }
    const checked = replyOutputContract.parse(result.output);
    if (!checked.ok) {
      throw new Error('capability reply output invalid');
    }
    return checked.value.metrics[0]?.value ?? 'Selesai.';
  }

  async function listRows(
    resourceId: string,
    sort?: { field: string; direction: 'asc' | 'desc' },
  ): Promise<Record<string, unknown>[]> {
    const result = await data.query(
      {
        op: 'list',
        resourceId,
        ...(sort !== undefined ? { sort: [sort] } : {}),
      },
      { permissions: serverGrants, effect: 'read' },
    );
    if (!result.ok) {
      return [];
    }
    return (result.rows ?? []) as Record<string, unknown>[];
  }

  async function firstMatchingRow(
    resourceId: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown> | undefined> {
    const rows = await listRows(resourceId, defaultSorts[resourceId]);
    return rows.find(predicate);
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
        // ---- demo resource: the structured demo-state mutations ----------
        if (action.resourceId === 'demo') {
          return await dispatchDemoMutation(action.op, input);
        }
        const payload = (input ?? {}) as Record<string, unknown>;
        const identity =
          typeof payload.id === 'string' && payload.id.length > 0
            ? payload.id
            : typeof payload.__identity === 'string' && payload.__identity.length > 0
              ? payload.__identity
              : undefined;

        // ---- tickets: real contract-validated create/update/delete -------
        if (action.resourceId === 'tickets') {
          if (action.op !== 'delete') {
            const parsed = ticketInputContract.parse(payload);
            if (!parsed.ok) {
              return {
                ok: false,
                code: 'CONTRACT_REJECTED',
                message: 'The submitted ticket is invalid.',
              };
            }
            const mutation = await data.mutate(
              {
                resourceId: 'tickets',
                op: action.op,
                input: parsed.value,
                ...(identity !== undefined ? { id: identity } : {}),
                ...(action.op === 'create' && parsed.value.id !== undefined
                  ? { idempotencyKey: `ticket:${parsed.value.id}` }
                  : {}),
              },
              { permissions: serverGrants, effect: 'write' },
            );
            if (!mutation.ok) {
              return { ok: false, code: mutation.code, message: mutation.message };
            }
            return { ok: true, value: mutation.row };
          }
          const deleted = await data.mutate(
            {
              resourceId: 'tickets',
              op: 'delete',
              ...(identity !== undefined ? { id: identity } : {}),
            },
            { permissions: serverGrants, effect: 'write' },
          );
          if (!deleted.ok) {
            return { ok: false, code: deleted.code, message: deleted.message };
          }
          return { ok: true, value: null };
        }

        // ---- conversation sends: mutation + a REAL capability reply -------
        if (MESSAGE_RESOURCES.has(action.resourceId) && action.op === 'create') {
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
              resourceId: action.resourceId,
              op: 'create',
              input: { ...parsed.value, createdAt: isoNow() },
              idempotencyKey: `message:${parsed.value.id}`,
            },
            { permissions: serverGrants, effect: 'write' },
          );
          if (!stored.ok) {
            return { ok: false, code: stored.code, message: stored.message };
          }
          const replyText = await runReply(parsed.value);
          await data.mutate(
            {
              resourceId: action.resourceId,
              op: 'create',
              input: {
                id: nextId('reply'),
                text: replyText,
                author: 'Assistant',
                participant: 'assistant',
                createdAt: isoNow(),
              },
              idempotencyKey: `reply:${parsed.value.id}`,
            },
            { permissions: serverGrants, effect: 'write' },
          );
          return { ok: true, value: stored.row };
        }

        // ---- gallery submissions (create-form demo) -----------------------
        if (action.resourceId === 'gallerySubmissions' && action.op === 'create') {
          const parsed = galleryInputContract.parse({
            ...payload,
            id: payload.id ?? nextId('request'),
          });
          if (!parsed.ok) {
            return {
              ok: false,
              code: 'CONTRACT_REJECTED',
              message: 'The request could not be saved. Check its details and try again.',
              fieldErrors: Object.fromEntries(
                parsed.issues
                  .filter((issue) =>
                    ['name', 'rank', 'zeroCheck', 'startDate', 'payload', 'comment'].includes(
                      issue.path,
                    ),
                  )
                  .map((issue) => [issue.path, issue.message]),
              ),
            };
          }
          const created = await data.mutate(
            {
              resourceId: 'gallerySubmissions',
              op: 'create',
              input: parsed.value,
              idempotencyKey: `submission:${parsed.value.id}`,
            },
            { permissions: serverGrants, effect: 'write' },
          );
          if (!created.ok) {
            return { ok: false, code: created.code, message: created.message };
          }
          return { ok: true, value: created.row };
        }

        // ---- generic declared updates (contract-parsed) -------------------
        const parsedGeneric = demoInputContract.parse(payload);
        if (!parsedGeneric.ok) {
          return {
            ok: false,
            code: 'CONTRACT_REJECTED',
            message: 'The submitted update is invalid.',
          };
        }
        const updated = await data.mutate(
          {
            resourceId: action.resourceId,
            op: action.op,
            input: { ...parsedGeneric.value },
            ...(identity !== undefined ? { id: identity } : {}),
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!updated.ok) {
          return { ok: false, code: updated.code, message: updated.message };
        }
        return { ok: true, value: updated.row };
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

  /** The deterministic demo-state mutations on the `demo` resource. */
  async function dispatchDemoMutation(op: string, input?: unknown): Promise<ActionResult> {
    const payload = (input ?? {}) as Record<string, unknown>;
    const note = typeof payload.note === 'string' ? payload.note : '';
    switch (op) {
      case 'succeed':
        return { ok: true, value: { demo: 'succeed', ...(note !== '' ? { note } : {}) } };
      case 'validate':
        return {
          ok: false,
          code: 'CONTRACT_REJECTED',
          message: 'The demo validation boundary rejected this input (demo kegagalan pengesahan).',
        };
      case 'deny':
        return {
          ok: false,
          code: 'DATA_UNAUTHORIZED',
          message:
            'The demo action was denied by the authorization boundary (demo keengganan akses).',
        };
      case 'fail':
        return {
          ok: false,
          code: 'ACTION_FAILED',
          message: 'The demo action failed safely (demo kegagalan umum).',
        };
      case 'note':
        return { ok: true, value: { recorded: note } };
      case 'stress': {
        const parsed = stressInputContract.parse(payload);
        if (!parsed.ok) {
          return {
            ok: false,
            code: 'CONTRACT_REJECTED',
            message: parsed.issues[0]?.message ?? 'The stress submission was rejected.',
          };
        }
        return { ok: true, value: { accepted: true, fields: Object.keys(parsed.value).length } };
      }
      case 'decideChange': {
        // Accept the FIRST pending change (deterministic) through the real
        // write boundary.
        const pending = await firstMatchingRow('worldChanges', (row) => row.status === 'pending');
        if (pending === undefined) {
          return { ok: true, value: { decided: null, note: 'Tiada cadangan menunggu (demo).' } };
        }
        const updated = await data.mutate(
          {
            resourceId: 'worldChanges',
            op: 'update',
            id: String(pending.id),
            input: { status: 'accepted', reviewedBy: 'Demo Approver (P6D)' },
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!updated.ok) {
          return { ok: false, code: updated.code, message: updated.message };
        }
        return { ok: true, value: { decided: String(pending.id) } };
      }
      case 'approveSession': {
        const waiting = await firstMatchingRow(
          'agentSessions',
          (row) => row.status === 'awaiting_approval',
        );
        if (waiting === undefined) {
          return { ok: true, value: { approved: null, note: 'Tiada sesi menunggu (demo).' } };
        }
        const updated = await data.mutate(
          {
            resourceId: 'agentSessions',
            op: 'update',
            id: String(waiting.id),
            input: { status: 'running' },
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!updated.ok) {
          return { ok: false, code: updated.code, message: updated.message };
        }
        return { ok: true, value: { approved: String(waiting.id) } };
      }
      case 'advanceStage': {
        const oldest = await firstMatchingRow(
          'workflowInstances',
          (row) => row.stage === 'approval',
        );
        if (oldest === undefined) {
          return {
            ok: true,
            value: { advanced: null, note: 'Tiada instans peringkat kelulusan (demo).' },
          };
        }
        const updated = await data.mutate(
          {
            resourceId: 'workflowInstances',
            op: 'update',
            id: String(oldest.id),
            input: { stage: 'execution' },
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!updated.ok) {
          return { ok: false, code: updated.code, message: updated.message };
        }
        return { ok: true, value: { advanced: String(oldest.id) } };
      }
      default:
        return {
          ok: false,
          code: 'MUTATION_NOT_DECLARED',
          message: 'The demo mutation is not implemented by the showcase dispatcher.',
        };
    }
  }

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
    const stale = searchParams?.get('demo') === 'stale' || STALE_PATHS.has(path);
    const partial = searchParams?.get('demo') === 'partial' || PARTIAL_PATHS.has(path);

    const viewData: Record<string, ViewDatum> = {};
    let record: Record<string, unknown> | null = null;

    // Record resolution: route parameter or the static demo-record map.
    const routeId = resolved.route.id;
    const paramResource = paramResources[routeId];
    let recordResource: string | undefined;
    let recordId: string | undefined;
    if (paramResource !== undefined) {
      const firstParam = Object.values(resolved.params)[0];
      if (typeof firstParam === 'string' && firstParam.length > 0) {
        recordResource = paramResource;
        recordId = firstParam;
      }
    }
    const staticRecord = staticRecords[path];
    if (recordId === undefined && staticRecord !== undefined) {
      recordResource = staticRecord.resource;
      recordId = staticRecord.id;
    }
    if (recordResource !== undefined && recordId !== undefined) {
      const got = await data.query(
        { op: 'get', resourceId: recordResource, id: recordId },
        { permissions: serverGrants, effect: 'read' },
      );
      if (got.ok && got.row !== undefined) {
        record = got.row as Record<string, unknown>;
      }
    }

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
      const resourceId = view.resourceId as string;
      let rows = await listRows(resourceId, defaultSorts[resourceId]);
      const scopeFilter = viewScopeFilters[viewId];
      if (record !== null && recordId !== undefined && scopeFilter !== undefined) {
        rows = rows.filter((row) => scopeFilter(row, recordId as string));
      }
      viewData[viewId] = {
        rows,
        loading: false,
        stale,
        partial,
        ...(record !== null && resourceId === recordResource ? { record } : {}),
      };
    }

    return { plan: planView, viewData, record };
  };

  return {
    plan,
    data,
    dispatch,
    loadRoute,
  };
}

/** Deterministic timestamp for NEW messages (fixed base + running counter). */
let messageSequence = 0;
function isoNow(): string {
  messageSequence += 1;
  return `2026-09-26T09:00:${String(messageSequence % 60).padStart(2, '0')}+08:00`;
}

let singleton: ShowcaseAppServer | undefined;

export function getShowcaseServer(): ShowcaseAppServer {
  if (singleton === undefined) {
    singleton = createShowcaseServer();
  }
  return singleton;
}

/** Test helper: dispose the singleton. */
export function resetShowcaseServer(): void {
  singleton = undefined;
}
