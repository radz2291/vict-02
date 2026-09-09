import {
  createInMemoryAgentControlStores,
  AgentStreamHub,
  type AgentControlStores,
} from '@victframework/runtime';
import { ControlPlaneService, createControlPlaneSandboxSimulator } from '@victframework/control';
import {
  createLocalTestAuthenticator,
  createServerAuthenticator,
  createVictHttpServer,
  listenVictHttpServer,
  VictCommandService,
  type VictHttpServer,
} from '../src/index.js';
import {
  createInMemoryStores,
  type ActivationCatalog,
  type ActorDirectory,
  InMemoryActorDirectory,
} from '@victframework/runtime';
import type { ActorRecord as ActorRecordType } from '@victframework/runtime';

/**
 * The shared HTTP test composition: a REAL node:http server on an
 * ephemeral loopback port, the versioned command service over the neutral
 * in-memory stores, and the deterministic local test authenticator.
 */

export interface HttpFixture {
  readonly port: number;
  readonly stores: AgentControlStores;
  readonly hub: AgentStreamHub;
  readonly controlPlane: ControlPlaneService;
  readonly turnService: undefined;
  readonly commandService: VictCommandService;
  readonly directory: ActorDirectory;
  close(): Promise<void>;
}

export const TEST_ACTOR_TOKENS: Readonly<Record<string, string>> = {
  'vict-test-token-user': 'actor-user',
  'vict-test-token-operator': 'actor-operator',
  'vict-test-token-approver': 'actor-approver',
  'vict-test-token-viewer': 'actor-viewer',
  'vict-test-token-empty': 'actor-empty',
};

export const USER_ACTOR: ActorRecordType = {
  actorId: 'actor-user',
  status: 'active',
  roles: ['developer', 'approver', 'operator', 'administrator'],
  createdAt: 0,
};

export const OPERATOR_ACTOR: ActorRecordType = {
  actorId: 'actor-operator',
  status: 'active',
  roles: ['operator'],
  createdAt: 0,
};

export const APPROVER_ACTOR: ActorRecordType = {
  actorId: 'actor-approver',
  status: 'active',
  roles: ['approver'],
  createdAt: 0,
};

export const VIEWER_ACTOR: ActorRecordType = {
  actorId: 'actor-viewer',
  status: 'active',
  roles: ['viewer'],
  createdAt: 0,
};

/** An actor with NO roles: zero derived scopes (default-deny probe). */
export const NO_SCOPE_ACTOR: ActorRecordType = {
  actorId: 'actor-empty',
  status: 'active',
  roles: [],
  createdAt: 0,
};

/** Build and listen on a real ephemeral HTTP server. */
export async function httpFixture(): Promise<HttpFixture> {
  const stores = createInMemoryAgentControlStores();
  const catalog: ActivationCatalog = createInMemoryStores().catalog;
  const directory = new InMemoryActorDirectory();
  await directory.upsert(USER_ACTOR);
  await directory.upsert(OPERATOR_ACTOR);
  await directory.upsert(APPROVER_ACTOR);
  await directory.upsert(VIEWER_ACTOR);
  await directory.upsert(NO_SCOPE_ACTOR);
  const hub = new AgentStreamHub({ ledger: stores.streamLedger, clock: () => Date.now() });
  const ids = { n: 0 };
  const controlPlane = new ControlPlaneService({
    stores,
    catalog,
    clock: () => Date.now(),
    simulator: createControlPlaneSandboxSimulator({ stores, catalog }),
    ids: {
      changesetId: () => `cs-${(ids.n += 1)}`,
      changesetApprovalId: () => `csa-${(ids.n += 1)}`,
      auditId: () => `audit-${(ids.n += 1)}`,
      controlRunId: () => `run-${(ids.n += 1)}`,
    },
  });
  const commandService = new VictCommandService({
    stores,
    controlPlane,
    clock: () => Date.now(),
  });
  const auth = createServerAuthenticator({
    authenticator: createLocalTestAuthenticator(TEST_ACTOR_TOKENS),
    directory,
  });
  const composed: VictHttpServer = createVictHttpServer({
    commandService,
    auth,
    hub,
    stores,
  });
  const port = await listenVictHttpServer(composed);
  return {
    port,
    stores,
    hub,
    controlPlane,
    turnService: undefined,
    commandService,
    directory,
    close: composed.close,
  };
}

/** A convenience JSON request helper over real HTTP. */
export async function post(
  port: number,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

export async function get(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Record<string, unknown>; raw?: string }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }
  return { status: response.status, body, raw: text };
}

export function userToken(): string {
  return `Bearer vict-test-token-user`;
}

export function operatorToken(): string {
  return `Bearer vict-test-token-operator`;
}

export const bearer = (token: string): Record<string, string> => ({ authorization: token });
