import type { RunRecord, RunRepository } from './types.js';

/**
 * In-memory run repository for the Night 01 milestone. Traces are held in
 * memory and returned with run results; there is no durable persistence yet.
 */
export function createInMemoryRunRepository(): RunRepository {
  const runs = new Map<string, RunRecord>();
  return {
    record(record: RunRecord): void {
      runs.set(record.runId, record);
    },
    get(runId: string): RunRecord | undefined {
      return runs.get(runId);
    },
    list(): readonly RunRecord[] {
      return [...runs.values()];
    },
  };
}
