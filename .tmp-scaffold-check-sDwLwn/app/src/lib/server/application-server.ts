import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createSqliteApplicationData } from '@victframework/appdata-sqlite';
import { createRuntime } from '@victframework/runtime';
import { createSqliteStores } from '@victframework/store-sqlite';
import type { ApplicationDataAdapter, ApplicationPlan, ActionResult } from '@victframework/application';
import type { Contract } from '@victframework/sdk';
import {
  collectSurfaces,
  declaredSurfaceViewIds,
  resolveRoute,
  type ViewDatum,
  type VictPlanView,
} from '@victframework/ui-svelte';
import {
  compileAppPlan,
  resources,
  contracts,
  capabilities,
  capabilityEffects,
  grants,
} from '$lib/application/definition';

/**
 * GENERIC APPLICATION SERVER — scaffolder-owned host file, DOMAIN-FREE.
 *
 * This file contains NO application domain: every domain fact lives in the
 * author-owned src/lib/application/definition.ts (resources, contracts,
 * capabilities, grants). You never edit this file to change your domain.
 * Editing it anyway means leaving the scaffolder's no-edit host contract.
 *
 * Every non-local action crosses the explicit boundaries BELOW the UI:
 * - DECLARED input contracts are pre-validated HERE, before any governed
 *   run or durable mutation is attempted (an undeclared or malformed input,
 *   including unknown fields under a closed contract, is refused with a
 *   structured CONTRACT_REJECTED and NO run, NO events, NO state change);
 * - queries and mutations cross the application-data adapter with the
 *   server-side authorization profile and explicit effect;
 * - capability actions execute as REAL governed runs (pinned activation,
 *   declared contracts, effect policy, durable run/event records);
 * - local and navigation actions never reach this dispatcher at all.
 */

const DB_PATH = process.env.VICT_APPDATA_PATH ?? join('.data', 'appdata.sqlite');
const RUNS_PATH = process.env.VICT_RUNS_PATH ?? join('.data', 'vict-runs.sqlite');

export interface AppServer {
  readonly plan: ApplicationPlan;
  readonly data: ApplicationDataAdapter;
  dispatch(actionId: string, input?: unknown): Promise<ActionResult>;
  loadRoute(path: string): Promise<{
    readonly plan: Record<string, unknown>;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null>;
  close(): void;
}

/** The async application factory: the generated host routes await it. */
export async function createAppServer(): Promise<AppServer> {
  // The data directory is a platform convention (gitignored); the storage
  // drivers create files but never directories.
  mkdirSync(dirname(DB_PATH), { recursive: true });
  mkdirSync(dirname(RUNS_PATH), { recursive: true });
  const plan = compileAppPlan();
  // Durable governed runs: activation catalog + run/event records persist
  // across restarts in their own Vict-operational store.
  const runtime = createRuntime({ stores: createSqliteStores({ path: RUNS_PATH }) });
  for (const contract of contracts) {
    runtime.registerContract(contract);
  }
  for (const capability of capabilities) {
    runtime.registerCapability(capability);
  }
  const data = createSqliteApplicationData({
    path: DB_PATH,
    resources,
    contracts: contracts as readonly Contract<unknown>[],
  });

  const contractsById = new Map<string, Contract<unknown>>(contracts.map((c) => [c.id, c]));
  const activationVersions = new Map<string, string>();

  /**
   * Boundary pre-validation: the action's declared input contract runs
   * BEFORE the adapter or runtime is touched. Failures are structured and
   * safe: contract id, field NAMES only, never raw input values.
   */
  function preValidate(
    action: { readonly id: string; readonly inputContractId?: string },
    input: unknown,
  ):
    | { readonly ok: true; readonly value: unknown }
    | { readonly ok: false; readonly failure: ActionResult } {
    const contractId = action.inputContractId;
    if (typeof contractId !== 'string' || contractId.length === 0) {
      return { ok: true, value: input };
    }
    const contract = contractsById.get(contractId);
    if (contract === undefined) {
      return {
        ok: false,
        failure: {
          ok: false,
          code: 'CONTRACT_UNAVAILABLE',
          message: `The contract '${contractId}' required by action '${action.id}' is not bound in this deployment.`,
        },
      };
    }
    const parsed = contract.parse(input ?? {});
    if (parsed.ok) {
      return { ok: true, value: parsed.value };
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.issues.slice(0, 8)) {
      const field = String(issue.path ?? '(root)').split(/[.[]/)[0] ?? '';
      if (field.length > 0 && field !== '(root)' && fieldErrors[field] === undefined) {
        fieldErrors[field] = 'This field was rejected by the declared contract.';
      }
    }
    return {
      ok: false,
      failure: {
        ok: false,
        code: 'CONTRACT_REJECTED',
        message: `The action input was rejected by contract '${contract.id}@${contract.revision}'; no run or mutation was performed.`,
        fieldErrors,
      },
    };
  }

  async function dispatchQuery(
    action: { readonly resourceId: string },
    input: unknown,
  ): Promise<ActionResult> {
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
      { permissions: grants, effect: 'read' },
    );
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return { ok: true, value: { rows: result.rows ?? [], total: result.total } };
  }

  async function dispatchMutation(
    action: { readonly resourceId: string; readonly op: string },
    input: unknown,
  ): Promise<ActionResult> {
    const raw = (input ?? {}) as Record<string, unknown>;
    // __identity is renderer-internal transport metadata (the edit form's
    // update target); it never reaches a domain contract. Domain 'id' stays.
    const identity =
      typeof raw.__identity === 'string' && raw.__identity.length > 0
        ? raw.__identity
        : typeof raw.id === 'string' && raw.id.length > 0
          ? raw.id
          : undefined;
    const domainInput: Record<string, unknown> = { ...raw };
    delete domainInput.__identity;
    const pre = preValidate(action, domainInput);
    if (!pre.ok) {
      return pre.failure;
    }
    const parsedInput = (pre.value ?? {}) as Record<string, unknown>;
    const mutation = resources
      .find((resource) => resource.id === action.resourceId)
      ?.mutations?.find((candidate) => candidate.op === action.op);
    const idempotencyKey =
      mutation?.idempotency === 'keyed' &&
      action.op === 'create' &&
      typeof parsedInput.id === 'string'
        ? `create:${parsedInput.id}`
        : undefined;
    const result = await data.mutate(
      {
        resourceId: action.resourceId,
        op: action.op,
        input: pre.value,
        ...(identity !== undefined ? { id: identity } : {}),
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      },
      { permissions: grants, effect: 'write' },
    );
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return { ok: true, value: result.row };
  }

  async function ensureActivation(capabilityId: string, inputContractId: string): Promise<string> {
    const graphId = `g.${capabilityId}`;
    const cached = activationVersions.get(graphId);
    if (cached !== undefined) {
      return cached;
    }
    const activation = await runtime.activate({
      id: graphId,
      entry: 'only',
      nodes: [{ id: 'only', capability: capabilityId, input: inputContractId }],
      edges: [],
    });
    if (!activation.ok) {
      throw new Error('capability activation failed');
    }
    activationVersions.set(graphId, activation.activationVersion);
    return activation.activationVersion;
  }

  async function dispatchCapability(
    action: {
      readonly id: string;
      readonly capabilityId: string;
      readonly inputContractId?: string;
      readonly outputContractId?: string;
    },
    input: unknown,
  ): Promise<ActionResult> {
    const pre = preValidate(action, input ?? {});
    if (!pre.ok) {
      return pre.failure;
    }
    await ensureActivation(action.capabilityId, String(action.inputContractId ?? ''));
    const runResult = await runtime.run(pre.value, { mode: 'normal' });
    if (runResult.status !== 'completed' || runResult.output === undefined) {
      return {
        ok: false,
        code: 'ACTION_FAILED',
        message: 'The governed action did not complete; this safe failure is server-generated.',
      };
    }
    let output: unknown = runResult.output;
    const outputContractId = action.outputContractId;
    if (typeof outputContractId === 'string' && outputContractId.length > 0) {
      const outputContract = contractsById.get(outputContractId);
      const checked = outputContract?.parse(output);
      if (checked === undefined || !checked.ok) {
        return {
          ok: false,
          code: 'CONTRACT_REJECTED',
          message: `The action output was rejected by contract '${outputContractId}'.`,
        };
      }
      output = checked.value;
    }
    // AUTHOR-OWNED EFFECT HOOK (the one declared extension seam): persist
    // the governed run's validated output through the data adapter. A
    // failing effect is fail-closed (the action reports ACTION_FAILED).
    const effect = capabilityEffects.find((candidate) => candidate.actionId === action.id);
    if (effect !== undefined) {
      await effect.run(output, data);
    }
    return { ok: true, value: output };
  }

  async function dispatch(actionId: string, input?: unknown): Promise<ActionResult> {
    const action = plan.actions[actionId];
    if (action === undefined) {
      return { ok: false, code: 'UNKNOWN_ACTION', message: 'The action is not declared.' };
    }
    try {
      if (action.kind === 'query') {
        return await dispatchQuery(action, input);
      }
      if (action.kind === 'mutation') {
        return await dispatchMutation(action, input);
      }
      if (action.kind === 'capability') {
        return await dispatchCapability(action, input);
      }
      // navigation / local: renderer-side; neither reaches this boundary.
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
  }

  /**
   * Plan-driven view loading for ANY route: every declared view of the
   * resolved screen is read with its declared filters/sort/projection;
   * parameterized routes get their declared record through the same port.
   */
  async function loadRoute(path: string): Promise<{
    readonly plan: Record<string, unknown>;
    readonly viewData: Record<string, ViewDatum>;
    readonly record: Record<string, unknown> | null;
  } | null> {
    const planView = plan.toJSON() as unknown as VictPlanView;
    const resolved = resolveRoute(planView, path);
    if (resolved === null || resolved.screen === null) {
      return null;
    }
    const viewIds = new Set<string>(declaredSurfaceViewIds(resolved.screen));
    const formResourceIds = new Set<string>();
    for (const { surface } of collectSurfaces(resolved.screen)) {
      const formId = (surface as { formId?: unknown }).formId;
      if (typeof formId === 'string') {
        const boundResource = (plan.toJSON().forms as Record<string, { resourceId?: string } | undefined>)[formId];
        if (typeof boundResource?.resourceId === 'string') {
          formResourceIds.add(boundResource.resourceId);
        }
      }
    }
    interface LoadedView {
      readonly resourceId: string;
      readonly fields?: readonly string[];
      readonly filters?: Readonly<Record<string, string | number | boolean>>;
      readonly sort?: readonly { readonly field: string; readonly direction: 'asc' | 'desc' }[];
    }
    const views = plan.toJSON().views as Record<string, LoadedView | undefined>;
    const viewData: Record<string, ViewDatum> = {};
    let record: Record<string, unknown> | null = null;
    const identity = resolved.params.id;
    for (const viewId of viewIds) {
      const view = views[viewId];
      if (view === undefined) {
        continue;
      }
      const result = await data.query(
        {
          op: 'list',
          resourceId: view.resourceId,
          ...(view.filters !== undefined ? { filters: view.filters } : {}),
          ...(view.sort !== undefined && view.sort.length > 0 ? { sort: view.sort } : {}),
          ...(Array.isArray(view.fields) && view.fields.length > 0
            ? { projection: view.fields }
            : {}),
        },
        { permissions: grants, effect: 'read' },
      );
      if (!result.ok) {
        continue;
      }
      viewData[viewId] = {
        rows: (result.rows ?? []) as Record<string, unknown>[],
        total: result.total ?? (result.rows?.length ?? 0),
      };
      const identity = resolved.params.id;
      if (identity !== undefined && record === null) {
        const got = await data.query(
          { op: 'get', resourceId: view.resourceId, id: identity },
          { permissions: grants, effect: 'read' },
        );
        if (got.ok && got.row !== undefined) {
          record = got.row as Record<string, unknown>;
          viewData[viewId] = { ...viewData[viewId], record };
        }
      }
    }
    // Parameterized routes on form-only screens (e.g. a record edit form
    // without a view surface): the declared form's bound resource is the
    // generic record source for the route's :id parameter.
    if (identity !== undefined && record === null) {
      for (const resourceId of formResourceIds) {
        const got = await data.query(
          { op: 'get', resourceId, id: identity },
          { permissions: grants, effect: 'read' },
        );
        if (got.ok && got.row !== undefined) {
          record = got.row as Record<string, unknown>;
          break;
        }
      }
    }
    return { plan: planView, viewData, record };
  }

  return {
    plan,
    data,
    dispatch,
    loadRoute,
    close(): void {
      (data as { close?: () => void }).close?.();
    },
  };
}

let serverPromise: Promise<AppServer> | undefined;

/** Awaitable app singleton: generated host routes await this promise. */
export function getAppServer(): Promise<AppServer> {
  if (serverPromise === undefined) {
    serverPromise = createAppServer();
  }
  return serverPromise;
}
