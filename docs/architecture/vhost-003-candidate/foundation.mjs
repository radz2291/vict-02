import { AsyncLocalStorage } from 'node:async_hooks';

export const schemaName = 'vhost003_indexed';

export function createFoundation({ Driver, Coordination, runtime }, options) {
  const { HostedCoordinationError } = runtime;
  const failure = (code) => new HostedCoordinationError(code);
  const context = new AsyncLocalStorage();

  function requireRoundTrip(...ids) {
    // The pinned coordination SQL uses PostgreSQL text. Node replaces lone
    // surrogates on that wire, which would otherwise alias different scopes.
    if (ids.some((id) => typeof id === 'string' && !id.isWellFormed())) {
      throw failure('HOSTED_INVALID_INPUT');
    }
  }

  function captureScope(input, fields) {
    try {
      const captured = Object.fromEntries(fields.map((field) => [field, input[field]]));
      requireRoundTrip(captured.scopeId, captured.actorId, captured.ownerId);
      return captured;
    } catch {
      throw failure('HOSTED_INVALID_INPUT');
    }
  }

  const requestFields = ['scopeId', 'actorId', 'ownerId', 'leaseMs'];
  const leaseFields = ['scopeId', 'actorId', 'ownerId', 'fence', 'expiresAt', 'purpose'];
  const { writerEpoch, ...poolOptions } = options;
  const { connectionString, namespace } = poolOptions;

  if (
    typeof connectionString !== 'string' ||
    !/^postgresql:\/\/vhostbench@127\.0\.0\.1:[1-9]\d{0,4}\/postgres$/u.test(connectionString) ||
    typeof namespace !== 'string' || !namespace.isWellFormed() ||
    !Number.isSafeInteger(writerEpoch) || writerEpoch < 1 ||
    'migrate' in poolOptions || 'schema' in poolOptions || 'tls' in poolOptions
  ) {
    throw failure('HOSTED_INVALID_INPUT');
  }

  class IndexedDatabase extends Driver {
    transaction(work) {
      if (context.getStore()?.active) {
        return Promise.reject(failure('HOSTED_INVALID_INPUT'));
      }
      return super.transaction(async (client) => {
        await client.query(
          "SELECT set_config('transaction_timeout', $1, true), set_config('search_path', 'pg_catalog', true)",
          [String(poolOptions.statementTimeoutMs ?? 10_000)]
        );
        const admission = await client.query(
          `SELECT version, purpose, writer_epoch FROM ${this.schema}.metadata
            CROSS JOIN ${this.schema}.namespaces WHERE singleton AND namespace=$1
            FOR SHARE OF namespaces`,
          [namespace]
        );
        const row = admission.rows[0];
        if (row?.version !== 2 || row.purpose !== 'VHOST-004 disposable receipts fixture') {
          throw failure('HOSTED_SCHEMA_MISMATCH');
        }
        if (row.writer_epoch !== String(writerEpoch)) throw failure('HOSTED_FENCED');
        const scope = { client, active: true };
        try {
          return await context.run(scope, () => work(client));
        } finally {
          scope.active = false;
        }
      });
    }

    async lockNamespace(client) {
      const lock = await client.query(
        `SELECT 1 FROM ${this.schema}.callback_admission WHERE namespace=$1 FOR UPDATE`,
        [namespace]
      );
      if (lock.rowCount !== 1) throw failure('HOSTED_SCHEMA_MISMATCH');
    }
  }

  class IndexedCoordination extends Coordination {
    async acquire(request) {
      return super.acquire(captureScope(request, requestFields));
    }

    async tombstone(request) {
      return super.tombstone(captureScope(request, requestFields));
    }

    runWithLease(lease, work) {
      return super.runWithLease(captureScope(lease, leaseFields), work);
    }

    async withFence(lease, work) {
      return super.withFence(captureScope(lease, leaseFields), work);
    }

    async assertInTransaction(client, lease) {
      const scope = context.getStore();
      if (!scope?.active || scope.client !== client) throw failure('HOSTED_FENCED');
      return super.assertInTransaction(client, captureScope(lease, leaseFields));
    }

    async release(lease) {
      return super.release(captureScope(lease, leaseFields));
    }

    async beginEffect(lease, id, digest) {
      requireRoundTrip(id, digest);
      return super.beginEffect(captureScope(lease, leaseFields), id, digest);
    }

    async settleEffect(lease, id, digest, status) {
      requireRoundTrip(id, digest);
      return super.settleEffect(captureScope(lease, leaseFields), id, digest, status);
    }

    async getEffect(scope, actor, effect) {
      requireRoundTrip(scope, actor, effect);
      return super.getEffect(scope, actor, effect);
    }
  }

  const db = new IndexedDatabase({
    ...poolOptions,
    schema: schemaName,
    tls: 'disable-loopback-only'
  });
  const coordination = new IndexedCoordination(db);
  const verify = () => db.transaction(async (client) => {
    const tables = [
      'actors', 'turn_head', 'cancel_intents', 'stream_clock', 'stream_events',
      'coordination', 'effects', 'tool_slot_head', 'tool_slot', 'tool_invocation',
      'agent_approval', 'command_receipt', 'confirmation_receipt'
    ];
    const { rows } = await client.query(
      'SELECT to_regclass(name) AS present FROM unnest($1::text[]) AS name',
      [tables.map((name) => schemaName + '.' + name)]
    );
    if (rows.some((row) => !row.present)) throw failure('HOSTED_SCHEMA_MISMATCH');
    const mutex = await client.query(
      `SELECT 1 FROM ${db.schema}.callback_admission WHERE namespace=$1`, [namespace]
    );
    if (mutex.rowCount !== 1) throw failure('HOSTED_SCHEMA_MISMATCH');
  });
  const execute = (lease, work) => db.transaction(async (client) => {
    if (lease) await coordination.assertInTransaction(client, lease);
    const value = await work(client);
    if (lease) await coordination.assertInTransaction(client, lease);
    return value;
  });
  return { db, coordination, verify, execute };
}
