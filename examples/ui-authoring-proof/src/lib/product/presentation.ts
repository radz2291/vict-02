import type { ActivityRow } from './domain.js';

/** Derived display data only. Domain facts and transition enforcement stay in the server. */
export function detailView(
  record: Record<string, unknown>,
  activity: readonly ActivityRow[],
  actorRole: string,
) {
  const actorId = actorRole === 'supervisor' ? 's.hart' : 't.nguyen';
  const findings = (record.findings ?? []) as readonly unknown[];
  const evidence = (record.evidence ?? []) as readonly unknown[];
  return {
    actorRole,
    actorId,
    findings,
    evidence,
    findingCount: findings.length,
    evidenceCount: evidence.length,
    hasFindings: findings.length > 0,
    hasEvidence: evidence.length > 0,
    activity: [...activity]
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((row) => ({
        ...row,
        at:
          new Date(row.at).toLocaleString('en-GB', {
            timeZone: 'Asia/Kuala_Lumpur',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }) + ' MYT',
      })),
  };
}
