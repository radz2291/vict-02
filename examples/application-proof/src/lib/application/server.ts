import { defineCapability } from '@vict/sdk';
import {
  createInMemoryApplicationData,
  type ApplicationDataAdapter,
  type ActionResult,
  type FrozenApplicationRelease,
} from '@vict/application';
import { createRuntime } from '@vict/runtime';
import { compileProofPlan, noteInputContract, noteResource, summaryOutputContract } from './definition.js';
import { compileProofRelease } from './release.js';
import { createProofComponentRegistry, createProofRenderer } from '$lib/host/proof-renderer.js';

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

/**
 * The proof's REAL VICT capability. CONT-001: it declares BOTH an input
 * contract (the neutral note contract) and an output contract; the runtime
 * validates both. Invalid capability output fails safely before reaching
 * HTTP or the DOM.
 */
const summarize = defineCapability({
  id: 'proof.summarize',
  revision: '1',
  effect: 'pure',
  input: noteInputContract,
  output: summaryOutputContract,
  invoke: (input: { id: string; title: string }) => ({
    summary: `${input.title} (${input.title.length} chars)`,
  }),
});

/** Capabilities the runtime exposes to the proof. */
function buildRuntime() {
  const runtime = createRuntime();
  runtime.registerCapability(summarize);
  // The node-level input override makes the run cross the SAME declared
  // neutral contract the form uses.
  runtime.registerContract(noteInputContract);
  return runtime;
}

/** The authorization profile of this deployment (server-side only). */
export const serverGrants = ['notes.create'];

export function createProofServer() {
  const runtime = buildRuntime();
  // The adapter receives EXPLICIT contract bindings: it parses mutation
  // input through the declared exact contract itself — the typed boundary
  // is preserved even for direct adapter calls, never only at the server.
  const data: ApplicationDataAdapter = createInMemoryApplicationData([noteResource], {
    contracts: [noteInputContract],
  });

  /** The compiled plan (immutable) shared with the generic host. */
  const activeGraphId = 'g.proof.summarize';
  let activationReady = false;
  let selectedActivationVersion: string | undefined;

  const ensureActivation = async (): Promise<string> => {
    if (activationReady) {
      return selectedActivationVersion as string;
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
    selectedActivationVersion = activation.activationVersion;
    activationReady = true;
    return selectedActivationVersion;
  };

  /**
   * The ONLY way actions execute below the UI. Errors are mapped to SAFE
   * structured results; raw thrown content never crosses back.
   */
  const dispatch = async (actionId: string, input?: unknown): Promise<ActionResult> => {
    try {
      // NOTE: `act.clear` is `kind: 'local'` — it is handled entirely inside
      // the renderer boundary (APP-011 / MED-04-G) and NEVER reaches this
      // dispatcher. There is deliberately no server-side local handler.
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
        // The run output already crossed the capability's DECLARED output
        // contract inside the runtime (the kernel validates the node's
        // output contract before the run completes). A hostile or malformed
        // capability output can never reach HTTP or the DOM.
        return { ok: true, value: run.output };
      }
      return { ok: false, code: 'UNKNOWN_ACTION', message: `Unknown action '${actionId}'.` };
    } catch {
      return { ok: false, code: 'INTERNAL', message: 'The action failed safely.' };
    }
  };

  /**
   * The proof's compiled release: identities are taken from the ACTUAL
   * renderer, component registry, adapter, and activation selection —
   * never copied from the manifest (RE-AUDIT MED-04-G-R trust boundary).
   */
  let compiledRelease: FrozenApplicationRelease | undefined;
  const release = async (): Promise<FrozenApplicationRelease> => {
    const activationVersion = await ensureActivation();
    compiledRelease ??= compileProofRelease({
      plan: compileProofPlan(),
      renderer: createProofRenderer(dispatch),
      componentRegistry: createProofComponentRegistry(),
      dataAdapter: data as Pick<ApplicationDataAdapter, 'id' | 'revision'>,
      selectedActivationVersion: activationVersion,
    });
    return compiledRelease;
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
    release,
    dataAdapter: data as Pick<ApplicationDataAdapter, 'id' | 'revision'>,
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
