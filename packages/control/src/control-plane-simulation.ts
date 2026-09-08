import {
  createInMemoryAgentControlStores,
  createInMemoryStores,
  VictControlError,
  validateApplicationReleaseContent,
  type ActivationCatalog,
  type ActivationSelection,
  type AgentControlStores,
  type ApplicationReleaseRecord,
  type ChangeSetOperation,
  type ChangeSetRecord,
  type ControlRunOperationOutcome,
  type StoredActivation,
} from '@vict/runtime';
import type { ChangeSetSimulator } from './control-plane.js';

/**
 * The REAL VICT simulation boundary for ChangeSet `simulation` runs.
 *
 * The simulator executes the proposed behavior through SAFE DOUBLES: an
 * isolated in-memory store set and an overlay activation catalog seeded
 * from the CURRENT durable state. Nothing outside the sandbox mutates —
 * no release is published, no selection is applied, no audit is written,
 * no run is cancelled. The simulation is therefore a genuine execution of
 * the proposed operations (validation, identity, compatibility, and
 * state-transition checks run against real store semantics), never a
 * second copy of prevalidation.
 *
 * Every closed operation kind has a safe simulation route (they are
 * metadata selections and idempotent publications); if a future operation
 * kind lacks one, the simulation FAILS CLOSED as `blocked` for that
 * operation — it is never passed on assumption.
 */

/** The stable identity of the built-in sandbox simulator. */
export const SANDBOX_SIMULATOR_ID = 'vict.control-plane.sandbox@1';

export interface SandboxSimulatorOptions {
  /** The REAL durable store set (read-only seed source). */
  readonly stores: AgentControlStores;
  /** The REAL activation catalog (read-only seed source). */
  readonly catalog: ActivationCatalog;
}

/** Read-only overlay over the real catalog with in-memory selection state. */
class OverlayActivationCatalog implements ActivationCatalog {
  readonly #real: ActivationCatalog;
  readonly #selections = new Map<string, ActivationSelection>();

  constructor(real: ActivationCatalog) {
    this.#real = real;
  }

  async publish(): Promise<{ activationVersion: string; created: boolean }> {
    throw new VictControlError(
      'VICT_CONTROL_SIMULATION_PUBLISH_DENIED',
      'The simulation sandbox never publishes activations.',
    );
  }

  async get(activationVersion: string): Promise<StoredActivation | undefined> {
    return this.#real.get(activationVersion);
  }

  async list(): Promise<readonly StoredActivation[]> {
    return this.#real.list();
  }

  async select(command: {
    graphId: string;
    activationVersion: string;
    expectedSelectionRevision?: number;
  }): Promise<ActivationSelection> {
    const stored = await this.#real.get(command.activationVersion);
    if (stored === undefined || stored.graphId !== command.graphId) {
      throw new VictControlError(
        'VICT_CONTROL_OPERATION_INVALID',
        'The referenced activation does not exist for this graph.',
      );
    }
    const current = this.#selections.get(command.graphId);
    if (
      command.expectedSelectionRevision !== undefined &&
      (current?.selectionRevision ?? 0) !== command.expectedSelectionRevision
    ) {
      throw new VictControlError(
        'VICT_CONTROL_BASE_STALE',
        'The simulated selection revision is stale.',
      );
    }
    const next: ActivationSelection = {
      graphId: command.graphId,
      activationVersion: command.activationVersion,
      selectionRevision: (current?.selectionRevision ?? 0) + 1,
      selectedAt: 0,
    };
    this.#selections.set(command.graphId, next);
    return next;
  }

  async getSelection(graphId: string): Promise<ActivationSelection | undefined> {
    return this.#selections.get(graphId) ?? this.#real.getSelection(graphId);
  }

  async getSelected(graphId: string): Promise<StoredActivation | undefined> {
    const selection = await this.getSelection(graphId);
    if (selection === undefined) {
      return undefined;
    }
    return this.#real.get(selection.activationVersion);
  }

  async publishAndSelect(): Promise<
    { activationVersion: string; created: boolean } & {
      selection: ActivationSelection;
    }
  > {
    throw new VictControlError(
      'VICT_CONTROL_SIMULATION_PUBLISH_DENIED',
      'The simulation sandbox never publishes activations.',
    );
  }
}

/**
 * Build the built-in sandbox simulator over the real durable state. The
 * returned simulator composes into `ControlPlaneService` (`simulator`
 * option) and executes `simulation` runs through real safe doubles.
 */
export function createControlPlaneSandboxSimulator(
  options: SandboxSimulatorOptions,
): ChangeSetSimulator {
  return {
    simulatorId: SANDBOX_SIMULATOR_ID,
    async simulate({ record, operationIdentities }) {
      // ---- Safe doubles seeded from the CURRENT durable state ----------
      const sandboxStores = createInMemoryAgentControlStores();
      const sandboxCatalog = new OverlayActivationCatalog(options.catalog);
      const touchedApps = new Set<string>();
      for (const operation of record.operations) {
        if (operation.kind === 'publish-and-select-release') {
          touchedApps.add(operation.release.applicationId);
        } else if (operation.kind === 'select-release') {
          touchedApps.add(operation.applicationId);
        } else if (operation.kind === 'rollback-release') {
          touchedApps.add(operation.applicationId);
        }
      }
      if (record.base.kind === 'release') {
        touchedApps.add(record.base.subjectId);
      }
      // Seed the releases and CURRENT selection of every touched
      // application from the authoritative stores (exact release inputs).
      for (const applicationId of touchedApps) {
        for (const release of await options.stores.control.listReleases(applicationId)) {
          await sandboxStores.control.publishRelease(release);
        }
        const selected = await options.stores.control.getSelectedRelease(applicationId);
        if (selected !== undefined) {
          await sandboxStores.control.publishRelease(selected);
          await sandboxStores.control.selectRelease({
            applicationId,
            releaseVersion: selected.releaseVersion,
            actorId: 'simulation-seed',
            at: 0,
            reason: 'select',
          });
        }
      }
      // ---- Execute the proposed behavior in the sandbox ----------------
      const operations: ControlRunOperationOutcome[] = [];
      let outcome: 'passed' | 'failed' | 'blocked' = 'passed';
      for (let index = 0; index < record.operations.length; index += 1) {
        const operation = record.operations[index] as ChangeSetOperation;
        const operationDigest = operationIdentities[index] ?? `index:${index}`;
        try {
          await simulateOperation(sandboxStores, sandboxCatalog, record, operation);
          operations.push({ operationIndex: index, operationDigest, outcome: 'applied' });
        } catch (error) {
          const code =
            error instanceof VictControlError ? error.code : 'VICT_CONTROL_SIMULATION_FAILED';
          const blockedClass =
            code === 'VICT_CONTROL_RELEASE_MISSING' ||
            code === 'VICT_CONTROL_BASE_STALE' ||
            code === 'VICT_CONTROL_RELEASE_INVALID' ||
            code === 'VICT_CONTROL_OPERATION_INVALID' ||
            code === 'VICT_CONTROL_SIMULATION_UNSAFE';
          operations.push({
            operationIndex: index,
            operationDigest,
            outcome: blockedClass ? 'blocked' : 'failed',
            code,
          });
          if (outcome === 'passed') {
            outcome = blockedClass ? 'blocked' : 'failed';
          }
        }
      }
      return { outcome, operations };
    },
  };
}

/** Execute ONE closed operation against the sandbox doubles. */
async function simulateOperation(
  stores: AgentControlStores,
  catalog: ActivationCatalog,
  record: ChangeSetRecord,
  operation: ChangeSetOperation,
): Promise<void> {
  switch (operation.kind) {
    case 'select-activation': {
      await catalog.select({
        graphId: operation.graphId,
        activationVersion: operation.activationVersion,
      });
      return;
    }
    case 'rollback-activation': {
      await catalog.select({
        graphId: operation.graphId,
        activationVersion: operation.targetActivationVersion,
      });
      return;
    }
    case 'publish-and-select-release': {
      const content = validateApplicationReleaseContent(operation.release);
      const release: ApplicationReleaseRecord = {
        ...content,
        publishedByActorId: record.authorActorId,
        publishedAt: 0,
        contentHash: `simulation:${content.releaseVersion}`,
      };
      await stores.control.publishRelease(release);
      await stores.control.selectRelease({
        applicationId: release.applicationId,
        releaseVersion: release.releaseVersion,
        actorId: record.authorActorId,
        at: 0,
        reason: 'select',
      });
      return;
    }
    case 'select-release': {
      await stores.control.selectRelease({
        applicationId: operation.applicationId,
        releaseVersion: operation.releaseVersion,
        actorId: record.authorActorId,
        at: 0,
        reason: 'select',
      });
      return;
    }
    case 'rollback-release': {
      await stores.control.selectRelease({
        applicationId: operation.applicationId,
        releaseVersion: operation.targetReleaseVersion,
        actorId: record.authorActorId,
        at: 0,
        reason: 'rollback',
      });
      return;
    }
    default: {
      // An operation kind WITHOUT a safe simulation route fails closed.
      throw new VictControlError(
        'VICT_CONTROL_SIMULATION_UNSAFE',
        'The operation kind has no safe simulation route; the run blocks instead of passing.',
      );
    }
  }
}

// Re-export for compositions that seed catalog doubles in tests.
export { createInMemoryStores };
