import { createFoundation } from './foundation.mjs';
import { createValueCodec, fromKey, hash, keyBytes, readKey } from './values.mjs';

import { createReceiptPorts } from './indexed-receipts.mjs';
import { createControlPorts } from './indexed-control.mjs';
import { createRunPorts } from './indexed-runs.mjs';

const PAGE = 128;
const cursorName = 'vhost003_page';

async function readPages(client, sql, values, project, limit = Infinity) {
  if (limit === 0) return [];
  if (limit <= PAGE) {
    const page = await client.query(sql + ` LIMIT ${limit}`, values);
    return page.rows.map(project);
  }
  // A single PostgreSQL cursor pins one query snapshot across pages at READ
  // COMMITTED, including inside a transaction that already asserted a lease.
  await client.query(`DECLARE ${cursorName} NO SCROLL CURSOR FOR ${sql}`, values);
  const result = [];
  while (result.length < limit) {
    const size = Math.min(PAGE, limit - result.length);
    const { rows } = await client.query(`FETCH FORWARD ${size} FROM ${cursorName}`);
    for (const row of rows) result.push(project(row));
    if (rows.length < size) break;
  }
  // The cursor is transaction-local and every facade call has its own tx.
  return result;
}

export async function createIndexedHotPathForTests(oracle, options) {
  const { runtime } = oracle;
  const { db, coordination, verify, execute } = createFoundation(oracle, options);
  try {
    await verify();
  } catch (error) {
    await db.close();
    throw error;
  }

  const codec = createValueCodec(oracle, db);
  const { captureArguments, encode, decode, captureRuntimeStoreSnapshot } = codec;
  const { InMemoryActorDirectory, InMemoryAgentTurnStore, isDurableStreamKind, validateStreamLedgerAppend } = runtime;
  const namespace = db.namespace;
  const q = (table) => db.schema + '.' + table;
  const selectTurn = `FROM ${q('turn_head')} WHERE namespace=$1 AND key_digest=$2 AND key_bytes=$3`;

  function turnKey(id) {
    if (typeof id !== 'string') throw new Error('VICT_STORE_SNAPSHOT_INVALID');
    const bytes = keyBytes(id);
    return [namespace, hash(bytes), bytes];
  }

  async function findTurn(client, id, projection) {
    if (typeof id !== 'string') return undefined;
    const { rows } = await client.query(`SELECT ${projection} ${selectTurn}`, turnKey(id));
    return rows[0];
  }

  async function lockTurnKey(client, id) {
    const [, digest] = turnKey(id);
    const guard = hash(Buffer.concat([Buffer.from(namespace + '/turn/'), digest]));
    // An advisory hash collision only serializes unrelated turns. The actual
    // lookup still checks complete bytes under the full digest bucket.
    await client.query('SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
      [guard.readInt32BE(0), guard.readInt32BE(4)]);
  }

  async function makeTurnHead(client, id, payload, open) {
    const values = turnKey(id);
    const { rows } = await client.query(
      `INSERT INTO ${q('turn_head')} (namespace,key_digest,key_bytes,key_prefix,payload,is_open)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [...values, values[2].subarray(0, 256), payload, open]
    );
    return rows[0].id;
  }

  function portsFor(boundLease) {
    const call = (work) => async (...args) => {
      const captured = captureArguments(args);
      return execute(boundLease ?? coordination.currentLease(), (client) => work(client, ...captured));
    };

    function changeTurn(method, identity) {
      return call(async (client, ...args) => {
        const id = identity(args[0]);
        if (typeof id === 'string') await lockTurnKey(client, id);
        const prior = await findTurn(client, id, 'id,payload');
        const record = prior?.payload ? decode(prior.payload) : undefined;
        const turns = new Map(record === undefined ? [] : [[id, record]]);
        const engine = new InMemoryAgentTurnStore(captureRuntimeStoreSnapshot(
          'InMemoryAgentTurnStore@1', { turns, cancels: new Map() }
        ));
        const result = await engine[method](...args);
        const next = await engine.getTurn(id);
        if (next === undefined) return result;
        const data = encode(next);
        if (prior?.payload?.equals(data)) return result;
        const open = (await engine.listOpenTurns()).length === 1;
        if (prior) {
          await client.query(
            `UPDATE ${q('turn_head')} SET payload=$3,is_open=$4 WHERE namespace=$1 AND id=$2`,
            [namespace, prior.id, data, open]
          );
        } else {
          await makeTurnHead(client, id, data, open);
        }
        return result;
      });
    }

    const listTurns = (predicate) => call((client) => readPages(client,
      `SELECT payload FROM ${q('turn_head')} WHERE namespace=$1 AND ${predicate}
       ORDER BY key_prefix,key_bytes`, [namespace], (row) => decode(row.payload)));

    const actors = Object.freeze({
      get: call(async (client, id) => {
        const { rows } = await client.query(
          `SELECT payload FROM ${q('actors')} WHERE namespace=$1 AND actor_key=$2`,
          [namespace, readKey(id)]
        );
        return rows[0] ? decode(rows[0].payload) : undefined;
      }),
      list: call((client) => readPages(client,
        `SELECT payload FROM ${q('actors')} WHERE namespace=$1 ORDER BY actor_key`,
        [namespace], (row) => decode(row.payload))),
      upsert: call(async (client, record) => {
        const engine = new InMemoryActorDirectory();
        await engine.upsert(record);
        // Legacy actors live outside the tagged engine snapshots and go
        // through JSON serialization. In particular optional undefined drops.
        const json = JSON.stringify(await engine.get(record.actorId));
        const { rows: [{ actor }] } = await client.query('SELECT $1::jsonb AS actor', [json]);
        await client.query(
          `INSERT INTO ${q('actors')} (namespace,actor_key,status,payload) VALUES($1,$2,$3,$4)
           ON CONFLICT (namespace,actor_key) DO UPDATE SET status=excluded.status,payload=excluded.payload`,
          [namespace, keyBytes(record.actorId), actor.status, encode(actor)]
        );
      })
    });

    const turns = Object.freeze({
      createTurnIntent: changeTurn('createTurnIntent', (record) => record.turnId),
      getTurn: call(async (client, id) => {
        const row = await findTurn(client, id, 'payload');
        return row?.payload ? decode(row.payload) : undefined;
      }),
      listTurns: listTurns('payload IS NOT NULL'),
      listOpenTurns: listTurns('is_open'),
      startTurn: changeTurn('startTurn', (id) => id),
      awaitApproval: changeTurn('awaitApproval', (id) => id),
      resumeTurn: changeTurn('resumeTurn', (id) => id),
      recordTurnCorrelation: changeTurn('recordTurnCorrelation', (id) => id),
      completeTurn: changeTurn('completeTurn', (command) => command.turnId),
      reconcileTurn: changeTurn('reconcileTurn', (command) => command.turnId),
      recordCancelIntent: call(async (client, command) => {
        const { turnId, cancelId, actorId, reasonCode, at } = command;
        await lockTurnKey(client, turnId);
        const prior = await findTurn(client, turnId, 'id');
        const turn = prior?.id ?? await makeTurnHead(client, turnId, null, null);
        const key = keyBytes(cancelId);
        const identity = [namespace, turn, hash(key), key];
        const existing = await client.query(
          `SELECT 1 FROM ${q('cancel_intents')}
           WHERE namespace=$1 AND turn=$2 AND key_digest=$3 AND key_bytes=$4`, identity
        );
        if (existing.rowCount) return { accepted: false, duplicate: true };
        await client.query(
          `INSERT INTO ${q('cancel_intents')} (namespace,turn,key_digest,key_bytes,payload)
           VALUES ($1,$2,$3,$4,$5)`, [...identity, encode({ cancelId, actorId, reasonCode, at })]
        );
        return { accepted: true, duplicate: false };
      }),
      hasCancelIntent: call(async (client, turnId) => {
        if (typeof turnId !== 'string') return false;
        const { rows: [row] } = await client.query(
          `SELECT EXISTS (
             SELECT 1 FROM ${q('cancel_intents')} AS cancel WHERE cancel.namespace=$1
               AND cancel.turn IN (SELECT id ${selectTurn})
           ) AS present`, turnKey(turnId)
        );
        return row.present;
      }),
      listCancelIntents: call((client, turnId) => {
        if (typeof turnId !== 'string') return [];
        return readPages(client,
          `SELECT payload FROM ${q('cancel_intents')} WHERE namespace=$1
             AND turn IN (SELECT id ${selectTurn}) ORDER BY ordinal`,
          turnKey(turnId), (row) => decode(row.payload)
        );
      })
    });

    const streamLedger = Object.freeze({
      appendEvent: call(async (client, command) => {
        const { streamId, kind, payload, at } = command;
        // Validation and both writes commit or roll back together. Invalid
        // input leaves no stream clock, sequence advancement or durable row.
        runtime.assertControlId(streamId, 'streamId');
        const key = keyBytes(streamId);
        const { rows: [head] } = await client.query(
          `INSERT INTO ${q('stream_clock')} AS clock VALUES ($1,$2,1)
           ON CONFLICT (namespace,stream_key) DO UPDATE SET seq=clock.seq+1 RETURNING seq`,
          [namespace, key]
        );
        const seq = Number(head.seq);
        validateStreamLedgerAppend({ streamId, kind, payload, assignedSeq: seq });
        const persisted = isDurableStreamKind(kind);
        if (persisted) {
          const data = encode({ streamId, seq, kind, payload, createdAt: at });
          await client.query(`INSERT INTO ${q('stream_events')} VALUES ($1,$2,$3,$4)`,
            [namespace, key, seq, data]);
        }
        return { seq, persisted };
      }),
      latestSeq: call(async (client, streamId) => {
        const { rows: [row] } = await client.query(
          `SELECT seq FROM ${q('stream_clock')} WHERE namespace=$1 AND stream_key=$2`,
          [namespace, readKey(streamId)]
        );
        return row ? Number(row.seq) : 0;
      }),
      listEventsFrom: call((client, streamId, afterSeq, limit) => {
        const cursor = Number(afterSeq);
        if (Number.isNaN(cursor) || cursor >= Number.MAX_SAFE_INTEGER) return [];
        const take = limit === undefined ? Infinity : Math.floor(Math.max(0, Number(limit))) || 0;
        return readPages(client, `SELECT payload FROM ${q('stream_events')}
            WHERE namespace=$1 AND stream_key=$2 AND seq>$3 ORDER BY seq`,
          [namespace, readKey(streamId), Math.max(0, Math.floor(cursor))],
          (row) => decode(row.payload), take
        );
      }),
      listStreamIds: call((client) => readPages(client,
        `SELECT stream_key FROM ${q('stream_clock')} WHERE namespace=$1 ORDER BY stream_key`,
        [namespace], (row) => fromKey(row.stream_key)))
    });
    const receipts = createReceiptPorts({ runtime, codec, namespace, q, call, readPages });
    const control = createControlPorts({ runtime, serialization: oracle.serialization, codec, namespace, q, call, readPages });
    const runs = createRunPorts({ ...oracle, codec, namespace, q, call, readPages, options });
    return Object.freeze({ actors, turns, streamLedger, ...receipts, ...control, ...runs });
  }

  return Object.freeze({
    ...portsFor(),
    forLease: (lease) => portsFor(Object.freeze({ ...lease })),
    coordination,
    close: () => db.close(),
    dispose: () => db.close()
  });
}
