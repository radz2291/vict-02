import { createSqliteApplicationData } from '@vict/appdata-sqlite';
import { defineResource, RESOURCE_DEFINITION_SCHEMA } from '@vict/sdk';

/**
 * Application-data restart worker (Stage 05). Invoked as a REAL child
 * process; stages:
 * - `write`  create two rows through the adapter, exit (handle closed)
 * - `read`   reopen the SAME database in a fresh process and verify both
 *            rows plus the keyed-idempotency reconciliation survived
 */

const [stage, dbPath] = process.argv.slice(2);

const resource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'title', type: 'string', required: true },
  ],
  mutations: [{ op: 'create', effect: 'write', idempotency: 'keyed', permissions: ['n.create'] }],
  authorization: { effect: 'read' },
});

const grants = { permissions: ['n.create'], effect: 'write' as const };
const reads = { permissions: [], effect: 'read' as const };

if (stage === 'write') {
  const adapter = createSqliteApplicationData({ path: dbPath, resources: [resource] });
  const a = await adapter.mutate(
    {
      resourceId: 'notes',
      op: 'create',
      input: { id: 'n-1', title: 'restart alpha' },
      idempotencyKey: 'k1',
    },
    grants,
  );
  const b = await adapter.mutate(
    {
      resourceId: 'notes',
      op: 'create',
      input: { id: 'n-2', title: 'restart beta' },
      idempotencyKey: 'k2',
    },
    grants,
  );
  if (!a.ok || !b.ok) {
    console.error('seed writes failed');
    process.exit(1);
  }
  adapter.close();
  process.exit(0);
}

if (stage === 'read') {
  const adapter = createSqliteApplicationData({ path: dbPath, resources: [resource] });
  const listed = await adapter.query({ op: 'list', resourceId: 'notes' }, reads);
  if (!listed.ok || listed.total !== 2) {
    console.error(`restart rows lost: ${JSON.stringify(listed)}`);
    process.exit(1);
  }
  // Keyed idempotency survives restart: the same key reconciles to the SAME
  // committed row instead of creating a duplicate.
  const replay = await adapter.mutate(
    {
      resourceId: 'notes',
      op: 'create',
      input: { id: 'n-1', title: 'restart alpha' },
      idempotencyKey: 'k1',
    },
    grants,
  );
  if (!replay.ok) {
    console.error('keyed reconciliation failed across restart');
    process.exit(1);
  }
  const after = await adapter.query({ op: 'list', resourceId: 'notes' }, reads);
  if (!after.ok || after.total !== 2) {
    console.error('replay created a duplicate row across restart');
    process.exit(1);
  }
  adapter.close();
  process.exit(0);
}

console.error(`unknown stage ${String(stage)}`);
process.exit(1);
