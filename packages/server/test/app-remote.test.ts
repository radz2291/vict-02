import { describe, expect, it } from 'vitest';
import { authenticatedActorContext, VictControlError, type ActorRecord } from '@vict/runtime';
import {
  createServerAuthenticator,
  createLocalTestAuthenticator,
  remoteAction,
  remoteMutate,
  remoteQuery,
  type ApplicationDataPortLike,
} from '../src/index.js';
import type { ServerActorContext } from '../src/index.js';

/**
 * Stage 06B — the remote Application data/action boundary:
 * resource identity/revision/release preservation, same-boundary
 * authorization, local-action refusal, stale-release denial, and hostile
 * filter containment.
 */

function actor(): ServerActorContext {
  const record: ActorRecord = {
    actorId: 'actor-user',
    status: 'active',
    roles: ['operator', 'developer'],
    createdAt: 0,
  };
  return {
    ...authenticatedActorContext(record, 'actor-user'),
    presentedTokenKind: 'local-test' as const,
  };
}

const data: ApplicationDataPortLike & { calls: unknown[] } = {
  calls: [],
  async query(request) {
    this.calls.push(request);
    return { rows: [], requestId: (request as { requestId?: string }).requestId ?? 'rq-1' };
  },
  async mutate(request) {
    this.calls.push(request);
    return { committed: true, revision: 2 };
  },
};

const options = { data };

describe('remote Application data boundary', () => {
  it('resource queries preserve the declared resource ID, revision, and release binding', async () => {
    data.calls.length = 0;
    const result = (await remoteQuery(actor(), options, {
      resourceId: 'res.projects',
      releaseVersion: 'release-1',
      filters: { status: 'open' },
    })) as { requestId: string };
    expect(result.requestId).toBe('rq-1');
    const forwarded = data.calls[0] as Record<string, unknown>;
    expect(forwarded.resourceId).toBe('res.projects');
    expect(forwarded.releaseVersion).toBe('release-1');
    expect(forwarded.actorId).toBe('actor-user');
  });

  it('stale-release access fails closed', async () => {
    const stale = { ...options, expectedReleaseVersion: 'release-2' };
    await expect(
      remoteQuery(actor(), stale, { resourceId: 'res.projects', releaseVersion: 'release-1' }),
    ).rejects.toThrow(/release/i);
    await expect(
      remoteMutate(actor(), stale, {
        resourceId: 'res.projects',
        releaseVersion: 'release-1',
        expectedRevision: '1',
      }),
    ).rejects.toThrow(VictControlError);
  });

  it('local actions never cross the server boundary', async () => {
    data.calls.length = 0;
    await expect(
      remoteMutate(actor(), options, {
        resourceId: 'res.projects',
        releaseVersion: 'release-1',
        actionKind: 'local',
      }),
    ).rejects.toThrow(/client-local/);
    await expect(
      remoteAction(actor(), options, {
        actionKind: 'local',
        resourceId: 'r',
        releaseVersion: 'release-1',
      }),
    ).rejects.toThrow(/client-local/);
    expect(data.calls.length).toBe(0);
  });

  it('hostile filter containers produce structured non-echoing errors', async () => {
    data.calls.length = 0;
    // A hostile Proxy whose key enumeration throws (LOW-C-1 class).
    const hostileProxy = new Proxy(
      {},
      {
        ownKeys(): string[] {
          throw new Error('HOSTILE-CANARY-9c31f');
        },
        getOwnPropertyDescriptor() {
          return { configurable: true, enumerable: true, value: 1 };
        },
        get(): string {
          throw new Error('HOSTILE-CANARY-9c31f');
        },
      },
    );
    await expect(
      remoteQuery(actor(), options, {
        resourceId: 'res.projects',
        releaseVersion: 'release-1',
        filters: hostileProxy,
      }),
    ).rejects.toThrow(/safely/);
    // Non-object filters are rejected structurally.
    await expect(
      remoteQuery(actor(), options, {
        resourceId: 'res.projects',
        releaseVersion: 'release-1',
        filters: [1, 2, 3],
      }),
    ).rejects.toThrow(/plain object/);
    expect(data.calls.length).toBe(0);
  });

  it('the authenticator derives the context and denies mismatched actors (fail closed)', async () => {
    const auth = createServerAuthenticator({
      authenticator: createLocalTestAuthenticator({ token: 'actor-user' }),
      directory: {
        async get(actorId) {
          return actorId === 'actor-user'
            ? {
                actorId: 'actor-user',
                status: 'active' as const,
                roles: ['operator' as const],
                createdAt: 0,
              }
            : undefined;
        },
        async list() {
          return [];
        },
        async upsert() {
          return undefined;
        },
      },
    });
    const context = await auth.resolve('token');
    expect(context.actorId).toBe('actor-user');
    expect(context.mastraResourceId).toBe('vict-actor-actor-user');
    await expect(auth.resolve('wrong-token')).rejects.toThrow(/Authentication failed/);
    await expect(auth.resolve(undefined)).rejects.toThrow(/Authentication failed/);
  });
});
