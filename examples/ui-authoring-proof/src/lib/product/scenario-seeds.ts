/**
 * Deterministic scenario seeds (PROOF-DESIGN §2) — SHARED by the server-side
 * product singleton and the client-side scenario console. Behavioral
 * scenarios (latency/failure/missing/denied/conflict) share the normal seed;
 * their behavior is declared in the scenario coverage, not in different data.
 */

import { seedDomain, type SeedInput } from './domain.js';

export type ScenarioId =
  'normal' | 'empty' | 'long' | 'latency' | 'failure' | 'missing' | 'denied' | 'conflict';

export const SCENARIO_IDS: readonly ScenarioId[] = [
  'normal',
  'empty',
  'long',
  'latency',
  'failure',
  'missing',
  'denied',
  'conflict',
];

export function scenarioSeed(id: ScenarioId): SeedInput {
  if (id === 'empty') {
    return { inspections: [], findings: [], evidence: [], activity: [] };
  }
  if (id === 'long') {
    const now = '2026-10-06T09:00:00.000Z';
    const longText =
      'Vibration reading exceeds the corridor band near the upper bearing housing'.repeat(4);
    return {
      inspections: [
        {
          id: 'i-201',
          title: longText,
          status: 'submitted',
          technician: 't.nguyen',
          supervisor: 's.hart',
          submittedAt: now,
          decidedAt: null,
          rejectionReason: null,
          domainRevision: 7,
        },
      ],
      findings: Array.from({ length: 40 }, (_, index) => ({
        id: `lf-${index + 1}`,
        inspectionId: 'i-201',
        severity: (index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low') as
          'high' | 'medium' | 'low',
        description: `${String(index + 1).padStart(2, '0')} — ${longText}`,
      })),
      evidence: [
        { id: 'le-1', inspectionId: 'i-201', label: longText, kind: 'image-ref' as const },
      ],
      activity: [
        {
          id: 'la-1',
          inspectionId: 'i-201',
          at: now,
          actor: 't.nguyen',
          entry: 'Inspection submitted for decision',
        },
      ],
    };
  }
  return seedDomain();
}
