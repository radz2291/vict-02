import { defineCapability } from '@vict/sdk';
import { createInMemoryApplicationData } from '@vict/application';
import type {
  ActionResult,
  ApplicationDataAdapter,
} from '@vict/application';
import { createRuntime } from '@vict/runtime';
import { noteInputContract, noteResource } from './definition.js';

/**
 * The proof's in-process application server (local modular monolith).
 *
 * Every non-local action crosses an explicit boundary BELOW the UI:
 * - mutations go through the application-data adapter with an explicit
 *   authorization/effect context;
 * - the capability action starts a REAL Vict run through the public
 *   `@vict/runtime` APIs (contract-validated, effect-policy enforced);
 * - local actions never leave the renderer boundary and never become
 *   graph nodes.
 *
 * The server holds the authorization profile. The UI cannot grant itself
 * anything: `act.adminDelete` requires 'notes.admin.delete', which this
 * deployment deliberately does NOT carry, so the boundary (not the
 * visibility of any button) denies it.
 */

const summarize = defineCapability({
  id: 'proof.summarize',
  revision: '1',
  effect: 'pure',
  input: undefined,
  output: undefined,
  invoke: (input: { id: string; title: string }) => ({
    summary: `${input.title} (${input.title.length} chars)`,
  }),
});

/** Capabilities the runtime exposes to the proof. */
function buildRuntime() {
  const runtime = createRuntime();
  runtime.registerCapability(summarize as never);
  // The node-level input override makes the run cross the SAME declared
  // neutral contract the form uses.
  runtime.registerContract(noteInputContract);
  return runtime;
}

/** The authorization profile of this deployment (server-side only). */
export const serverGrants = ['notes.create'];

export function createProofServer() {
  const runtime = buildRuntime();
  const data: ApplicationDataAdapter = createInMemoryApplicationData([noteResource]);

  /** The compiled plan (immutable) shared with the generic host. */
  const activeGraphId = 'g.proof.summarize';
  let activationReady = false;

  const ensureActivation = async (): Promise<void> => {
    if (activationReady) {
      return;
    }
    const activation = await runtime.activate({
      id: activeGraphId,
      entry: 'only',
      nodes: [{ id: 'only', capability: 'proof.summarize', input: 'proof.note.input' }],
      edges: [],
    });
    if (!activation.ok) {
      throw new Error('proof capability activation failed');
    }
    activationReady = true;
  };

  /**
   * The ONLY way actions execute below the UI. Errors are mapped to SAFE
   * structured results; raw thrown content never crosses back.
   */
  const dispatch = async (actionId: string, input?: unknown): Promise<ActionResult> => {
    try {
      if (actionId === 'act.clear') {
        // Local presentation action: stays local, never a graph node.
        return { ok: true, value: { local: 'cleared' } };
      }
      if (actionId === 'act.create') {
        // Contract boundary first: the declared neutral input contract.
        const parsed = noteInputContract.parse(input);
        if (!parsed.ok) {
          return { ok: false, code: 'CONTRACT_REJECTED', message: 'The submitted note is invalid.' };
        }
        const result = await data.mutate(
          {
            resourceId: 'notes',
            op: 'create',
            input: parsed.value,
            idempotencyKey: `create:${parsed.value.id}`,
          },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!result.ok) {
          return { ok: false, code: result.code, message: result.message };
        }
        return { ok: true, value: result.row };
      }
      if (actionId === 'act.adminDelete') {
        // Requires 'notes.admin.delete' — NOT in serverGrants. The boundary
        // denies this regardless of what the UI renders.
        const result = await data.mutate(
          { resourceId: 'notes', op: 'delete', id: 'nonexistent' },
          { permissions: serverGrants, effect: 'write' },
        );
        if (!result.ok) {
          return { ok: false, code: result.code, message: result.message };
        }
        return { ok: true, value: null };
      }
      if (actionId === 'act.summarize') {
        await ensureActivation();
        const parsed = noteInputContract.parse(input);
        if (!parsed.ok) {
          return { ok: false, code: 'CONTRACT_REJECTED', message: 'Summarize needs a valid note.' };
        }
        const run = await runtime.run(parsed.value, { mode: 'normal' });
        if (run.status !== 'completed') {
          return { ok: false, code: 'RUN_FAILED', message: `The Vict run ended '${run.status}'.` };
        }
        return { ok: true, value: run.output };
      }
      return { ok: false, code: 'UNKNOWN_ACTION', message: `Unknown action '${actionId}'.` };
    } catch {
      return { ok: false, code: 'INTERNAL', message: 'The action failed safely.' };
    }
  };

  const listNotes = async () => {
    const result = await data.query(
      { op: 'list', resourceId: 'notes', sort: [{ field: 'title', direction: 'asc' }] },
      { permissions: serverGrants, effect: 'read' },
    );
    if (!result.ok) {
      return [];
    }
    return result.rows ?? [];
  };

  return {
    runtime,
    dispatch,
    listNotes,
    runCount: async (): Promise<number> => (await runtime.listRuns()).length,
  };
}

export type ProofServer = ReturnType<typeof createProofServer>;

/** Process-wide proof server (one local runtime owner, one data adapter). */
let singleton: ProofServer | undefined;
export function getProofServer(): ProofServer {
  singleton ??= createProofServer();
  return singleton;
}

// The neutral definition module is the sole source of truth for the surface.
export { noteResource };
