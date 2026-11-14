import {
  toCanonicalJson,
  validateAgentExchangeIntent,
  validateAgentExchangeReceipt,
} from '@victframework/runtime';
import type {
  AgentExchangeIntent,
  AgentExchangeReceipt,
  AgentExchangeRecord,
  AgentExchangeStore,
} from '@victframework/runtime';
import { inTransaction, openDatabase, safeRun } from './driver.js';

/** Dedicated opt-in receipt storage. Existing control database schemas are unchanged. */
export function createSqliteAgentExchangeStore(options: {
  readonly path: string;
}): AgentExchangeStore & { close(): void } {
  const handle = openDatabase({ path: options.path });
  const { db } = handle;
  try {
    safeRun('agentExchange.initialize', () =>
      db.exec(`
      CREATE TABLE IF NOT EXISTS vict_agent_exchange_v1 (
        operation_id TEXT PRIMARY KEY,
        intent TEXT NOT NULL,
        receipt TEXT
      )
    `),
    );
  } catch (error) {
    handle.close();
    throw error;
  }
  const readRow = db.prepare(
    'SELECT intent, receipt FROM vict_agent_exchange_v1 WHERE operation_id = ?',
  );
  const insert = db.prepare(
    'INSERT OR IGNORE INTO vict_agent_exchange_v1 (operation_id, intent) VALUES (?, ?)',
  );
  const update = db.prepare(
    'UPDATE vict_agent_exchange_v1 SET receipt = ? WHERE operation_id = ? AND receipt IS NULL',
  );
  function row(operationId: string): { intent: string; receipt: string | null } | undefined {
    return readRow.get(operationId) as { intent: string; receipt: string | null } | undefined;
  }
  function settle(receipt: AgentExchangeReceipt): AgentExchangeReceipt {
    const intent: AgentExchangeIntent = {
      operationId: receipt.operationId,
      bindingId: receipt.bindingId,
      question: receipt.question,
      asker: receipt.asker,
      answerer: receipt.answerer,
      holdingInvocationId: receipt.holdingInvocationId,
      askInvocationId: receipt.askInvocationId,
      askerToolCalls: receipt.askerToolCalls,
      answererModelSteps: receipt.answererModelSteps,
      startedAt: receipt.startedAt,
    };
    return safeRun('agentExchange.settle', () =>
      inTransaction(db, () => {
        const serialized = toCanonicalJson(receipt);
        if (!validateAgentExchangeReceipt(JSON.parse(serialized)))
          throw new Error('Invalid exchange receipt');
        const expected = toCanonicalJson(intent);
        const current = row(receipt.operationId);
        if (!current || current.intent !== expected) throw new Error('Exchange intent mismatch');
        if (current.receipt !== null) {
          if (current.receipt !== serialized) throw new Error('Exchange receipt mismatch');
          return JSON.parse(current.receipt) as AgentExchangeReceipt;
        }
        if (update.run(serialized, receipt.operationId).changes !== 1)
          throw new Error('Exchange settlement lost its claim');
        return receipt;
      }),
    );
  }
  return {
    read(operationId): AgentExchangeRecord | undefined {
      return safeRun('agentExchange.read', () => {
        const current = row(operationId);
        if (!current) return undefined;
        if (current.receipt === null) {
          const intent = JSON.parse(current.intent) as AgentExchangeIntent;
          if (!validateAgentExchangeIntent(intent) || intent.operationId !== operationId)
            throw new Error('Invalid exchange intent');
          return { state: 'pending', intent };
        }
        const receipt = JSON.parse(current.receipt) as AgentExchangeReceipt;
        if (!validateAgentExchangeReceipt(receipt) || receipt.operationId !== operationId)
          throw new Error('Invalid exchange receipt');
        return { state: 'settled', receipt };
      });
    },
    listPending() {
      return safeRun('agentExchange.listPending', () => {
        const rows = db
          .prepare(
            'SELECT operation_id, intent FROM vict_agent_exchange_v1 WHERE receipt IS NULL ORDER BY operation_id',
          )
          .all();
        return rows.map((row) => {
          const intent = JSON.parse(String(row.intent)) as AgentExchangeIntent;
          if (!validateAgentExchangeIntent(intent) || intent.operationId !== row.operation_id)
            throw new Error('Invalid exchange intent');
          return intent;
        });
      });
    },
    claim(intent) {
      return safeRun('agentExchange.claim', () => {
        const serialized = toCanonicalJson(intent);
        if (!validateAgentExchangeIntent(JSON.parse(serialized)))
          throw new Error('Invalid exchange intent');
        return insert.run(intent.operationId, serialized).changes === 1;
      });
    },
    settle,
    reconcileAbandoned(operationId, settledAt) {
      const current = this.read(operationId);
      if (!current || current.state === 'settled') return current?.receipt;
      return settle({
        ...current.intent,
        schema: 'vict.agent-exchange-receipt@1',
        status: 'refused',
        code: 'VICT_EXCHANGE_OUTCOME_UNKNOWN',
        settledAt,
        answererProviderAttempts: current.intent.answererModelSteps === 0 ? 0 : null,
      });
    },
    close: () => handle.close(),
  };
}
