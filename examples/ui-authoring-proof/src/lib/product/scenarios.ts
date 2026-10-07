/**
 * The frozen eight-scenario matrix (PROOF-DESIGN §2) as `vict.ui-scenario@1`
 * definitions for the existing preview orchestration (API-SPEC §6.2).
 *
 * Deterministic reset: a scenario's seed rebuilds the SAME domain state and
 * reset() creates a NEW session identity, so re-running a scenario always
 * reproduces the same run. Implementation modes are DECLARED per operation —
 * the coverage matrix is truthful by construction.
 *
 * The seeds come from the SAME scenario builders the product server uses, and
 * the sessions dispatch data operations through the SAME conforming
 * inspection adapter (shared rule core) — one domain, one boundary.
 */

import type { UiScenario, ScenarioActor } from '@victframework/ui';
import type { ApplicationDataAdapter } from '@victframework/application';
import {
  createPreviewSession,
  type PreviewSession,
  type PreviewDataAdapterPort,
} from '@victframework/ui-preview';
import { InspectionDataAdapter, roleGrants } from './domain.js';
import { SCENARIO_IDS, scenarioSeed, type ScenarioId } from './scenario-seeds.js';

export { SCENARIO_IDS };
export type { ScenarioId };

export const SCENARIO_LABELS: Readonly<Record<ScenarioId, string>> = {
  normal: 'Normal submitted inspections',
  empty: 'Empty queue',
  long: 'Long content — 40 findings, unbroken strings',
  latency: 'Latency — approve settles after the configured 800 ms',
  failure: 'Operation failure — declared failed outcome',
  missing: 'Missing implementation — approve unavailable',
  denied: 'Insufficient permissions — technician attempts a decision',
  conflict: 'Conflicting/stale decision — old expectedDomainRevision',
};

const ACTORS: readonly ScenarioActor[] = [
  { actorId: 's.hart', role: 'supervisor', permissions: [...roleGrants.supervisor] },
  { actorId: 't.nguyen', role: 'technician', permissions: [...roleGrants.technician] },
];

const DATA_OPERATIONS = [
  { op: 'inspection:list', implementation: 'simulated' },
  { op: 'inspection:get', implementation: 'simulated' },
  { op: 'inspection:approve', implementation: 'simulated' },
  { op: 'inspection:reject', implementation: 'simulated' },
  { op: 'inspection:revise', implementation: 'simulated' },
  { op: 'inspection:submit', implementation: 'simulated' },
  { op: 'finding:add', implementation: 'simulated' },
  { op: 'evidence:add', implementation: 'simulated' },
] as const;

function scenarioOperations(id: ScenarioId): UiScenario['operations'] {
  return DATA_OPERATIONS.map((operation) => {
    if (operation.op !== 'inspection:approve') return { ...operation };
    switch (id) {
      case 'latency':
        // Scenario 4: approve settles after the configured 800 ms delay.
        return { ...operation, outcome: { kind: 'success', delayMs: 800 } };
      case 'failure':
        // Scenario 5: declared failed outcome; the domain state must not move.
        return {
          ...operation,
          outcome: {
            kind: 'failure',
            code: 'SIMULATED_FAILURE',
            message: 'The decision service could not record the approval (declared outcome).',
          },
        };
      case 'missing':
        // Scenario 6: approve declared unavailable — a coverage denial, and
        // no handler of any kind runs.
        return { ...operation, implementation: 'unavailable' as const };
      case 'denied':
        // Scenario 7: declared denial (and the acting technician also lacks
        // the grant at the adapter — both layers agree).
        return {
          ...operation,
          outcome: {
            kind: 'denied',
            code: 'insufficient_role',
            message: 'A technician may not record decisions.',
          },
        };
      default:
        return { ...operation };
    }
  });
}

function buildScenario(id: ScenarioId): UiScenario {
  const seed = scenarioSeed(id);
  return {
    schema: 'vict.ui-scenario@1',
    scenarioId: `scn.${id}`,
    references: {
      application: { id: 'app.inspection', revision: '1' },
      documents: { 'doc.inspection-detail': '1' },
    },
    seeds: {
      domain: {
        rows: {
          inspection: seed.inspections as unknown as readonly Readonly<Record<string, unknown>>[],
          finding: seed.findings as unknown as readonly Readonly<Record<string, unknown>>[],
          evidence: seed.evidence as unknown as readonly Readonly<Record<string, unknown>>[],
          activity: seed.activity as unknown as readonly Readonly<Record<string, unknown>>[],
        },
      },
    },
    actors: ACTORS,
    operations: scenarioOperations(id),
    resetBoundary: 'session',
  };
}

export const SCENARIOS: Readonly<Record<ScenarioId, UiScenario>> = {
  normal: buildScenario('normal'),
  empty: buildScenario('empty'),
  long: buildScenario('long'),
  latency: buildScenario('latency'),
  failure: buildScenario('failure'),
  missing: buildScenario('missing'),
  denied: buildScenario('denied'),
  conflict: buildScenario('conflict'),
};

/** Which actor the scenario's decision probe runs as (truthful denial demo). */
export function decisionActor(id: ScenarioId): 's.hart' | 't.nguyen' {
  return id === 'denied' ? 't.nguyen' : 's.hart';
}

/** Stale-revision input for the conflict probe (scenario 8). */
export function decisionInput(
  id: ScenarioId,
  record: Record<string, unknown>,
): Record<string, unknown> {
  if (id === 'conflict') {
    return { id: record['id'], expectedDomainRevision: Number(record['domainRevision'] ?? 1) - 1 };
  }
  return { id: record['id'], expectedDomainRevision: record['domainRevision'] };
}

/** The adapter port a console session uses (fresh adapter per session). */
export function scenarioAdapterPort(adapter: ApplicationDataAdapter): PreviewDataAdapterPort {
  return {
    adapter,
    context: (actor) => ({
      permissions: actor.permissions,
      effect: 'write',
      actor: actor.actorId,
    }),
  };
}

/** One console session: the PreviewSession plus ITS adapter (the source of
 * truth for domain reads — the session orchestrates, the adapter stores). */
export interface ScenarioSession {
  readonly session: PreviewSession;
  readonly adapter: InspectionDataAdapter;
}

/** Create a scenario session (fresh adapter per session; deterministic seed). */
export function createScenarioSession(id: ScenarioId): ScenarioSession {
  const adapter = new InspectionDataAdapter(scenarioSeed(id));
  const session = createPreviewSession({
    scenario: SCENARIOS[id],
    actorId: decisionActor(id),
    dataAdapter: scenarioAdapterPort(adapter),
  });
  return { session, adapter };
}
