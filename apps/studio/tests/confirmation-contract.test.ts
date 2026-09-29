//
// S9-04 confirmation journey CONTRACT SHAPES (node environment; server-side
// pure helpers in isolation). Integration expectations live here BY NAME
// (route paths, envelope shapes, stable codes) against the frozen G2
// proposal — the actual G2 core/transport code is built in parallel and is
// NEVER imported by this test.
import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_COMMANDS,
  UNAVAILABLE_AUDIT_READ,
  UNAVAILABLE_SUBJECT_READ,
  UNAVAILABLE_WAITS_READ,
  asExecutorResult,
  buildConfirmedRequest,
  buildPrepareBody,
  failureBannerText,
  isValidConfirmationId,
  parseAuditRead,
  parseConfirmationStatus,
  parseRunSubjectRead,
  parseRunWaitsRead,
} from '$lib/confirmation/confirmation.js';

describe('confirmation journey contract shapes (proposal §4/§5 pins)', () => {
  it('maps every receipt-gated command to its canonical consume route', () => {
    expect(CONFIRMATION_COMMANDS['run.cancel'].route({ runId: 'r1' })).toBe('/vict/v1/runs/cancel');
    expect(CONFIRMATION_COMMANDS['run.resolve'].route({ runId: 'r9' })).toBe(
      '/vict/v1/runs/r9/resolve',
    );
    expect(CONFIRMATION_COMMANDS['run.signal'].route({ runId: 'r9' })).toBe(
      '/vict/v1/runs/r9/signal',
    );
    expect(CONFIRMATION_COMMANDS['activation.select'].route({})).toBe(
      '/vict/v1/activations/select',
    );
    expect(CONFIRMATION_COMMANDS['release.select'].route({})).toBe('/vict/v1/releases/select');
    expect(CONFIRMATION_COMMANDS['release.rollback'].route({})).toBe('/vict/v1/releases/rollback');
    // Exactly the six receipt-gated commands — nothing invented.
    expect(Object.keys(CONFIRMATION_COMMANDS).sort()).toEqual([
      'activation.select',
      'release.rollback',
      'release.select',
      'run.cancel',
      'run.resolve',
      'run.signal',
    ]);
  });

  it('builds the prepare body with command, payload and expectedRevision', () => {
    const body = buildPrepareBody('run.cancel', { runId: 'run-1', reasonCode: 'demo.reason' }, 7);
    expect(body).not.toBeNull();
    expect(body?.command).toBe('run.cancel');
    expect(body?.payload).toEqual({ runId: 'run-1', reasonCode: 'demo.reason' });
    expect(body?.expectedRevision).toBe(7);
    expect(buildPrepareBody('unknown.command', {}, 7)).toBeNull();
    expect(buildPrepareBody('run.cancel', { runId: 'run-1' }, 7)).toBeNull();
  });

  it('builds the single canonical CONFIRMED consumption shape', () => {
    const confirmed = buildConfirmedRequest(
      'run.cancel',
      { runId: 'run-1', reasonCode: 'demo.reason' },
      'rcpt-x',
    );
    expect(confirmed).toEqual({
      path: '/vict/v1/runs/cancel',
      body: {
        payload: { runId: 'run-1', reasonCode: 'demo.reason' },
        confirmation: { receiptId: 'rcpt-x' },
      },
    });
    expect(
      buildConfirmedRequest('run.signal', { runId: 'run-1', signalName: 'demo.resume' }, 'rcpt-x')
        ?.path,
    ).toBe('/vict/v1/runs/run-1/signal');
    // Fail closed before fetch: missing/hostile receipt or fields.
    expect(buildConfirmedRequest('run.cancel', { runId: 'run-1' }, 'rcpt')).toBeNull();
    expect(
      buildConfirmedRequest('run.cancel', { runId: 'run-1', reasonCode: 'ok' }, '../etc'),
    ).toBeNull();
  });

  it('hosts truthfully bounded identifiers only', () => {
    expect(isValidConfirmationId('run-demo-blocked')).toBe(true);
    expect(isValidConfirmationId('../secret')).toBe(false);
    expect(isValidConfirmationId('')).toBe(false);
    expect(isValidConfirmationId('a'.repeat(129))).toBe(false);
  });

  it('parses receipt status truthfully; unknown shapes are non-echoing unavailable', () => {
    expect(parseConfirmationStatus({ status: 'consumed', command: 'run.cancel' })).toEqual({
      name: 'consumed',
      command: 'run.cancel',
    });
    expect(parseConfirmationStatus({ status: 'prepared' }).name).toBe('prepared');
    expect(parseConfirmationStatus({ status: 'weird' })).toEqual({ name: 'unavailable' });
    expect(parseConfirmationStatus(null)).toEqual({ name: 'unavailable' });
  });

  it('banner texts restate the frozen Phase-2 outcome codes truthfully', () => {
    expect(failureBannerText('VICT_CONFIRMATION_REQUIRED')).toContain(
      'prepare → human review → confirm',
    );
    expect(failureBannerText('VICT_CONFIRMATION_EXPIRED')).toContain('Prepare again');
    expect(failureBannerText('VICT_CONFIRMATION_SPENT')).toContain('No second effect');
    expect(failureBannerText('VICT_CONFIRMATION_STALE')).toContain('prepare again');
    expect(failureBannerText('VICT_CONFIRMATION_MISMATCH')).toContain('Nothing was changed');
    expect(failureBannerText('SOME_OTHER_TARGET_CODE')).toContain('judge the outcome');
  });
});

describe('S9-04 effect panel mapping (truthful read-back rendering)', () => {
  it('narrow the run record read truthfully; non-ok reads are explicit unavailable states', () => {
    expect(
      parseRunSubjectRead('ok', {
        run: { runId: 'r', status: 'cancelled', recordRevision: 4 },
      }),
    ).toEqual({ available: true, status: 'cancelled', recordRevision: '4', note: '' });
    // A non-ok transport result claims nothing.
    expect(parseRunSubjectRead('envelope-error', null)).toEqual({
      available: false,
      status: null,
      recordRevision: null,
      note: expect.stringContaining('No before/after state is claimed'),
    });
    // A malformed run member claims nothing.
    expect(parseRunSubjectRead('ok', { run: 'garbage' }).available).toBe(false);
    // A missing/invalid member stays null — never fabricated.
    expect(parseRunSubjectRead('ok', { run: { status: 'running', recordRevision: 1.5 } })).toEqual({
      available: true,
      status: 'running',
      recordRevision: null,
      note: '',
    });
  });

  it('narrow the waits read truthfully, wait by wait, keeping identity only', () => {
    const result = parseRunWaitsRead('ok', {
      runId: 'r',
      waits: [
        {
          waitId: 'w1',
          status: 'resolved',
          signalName: 'demo.resume',
          resolvedBy: 'eff-key',
          extraFieldShouldBeKeptOut: 'secret-ish',
        },
        { waitId: 'w2' },
        'garbage',
      ],
    });
    expect(result.available).toBe(true);
    expect(result.waits).toEqual([
      { waitId: 'w1', status: 'resolved', signalName: 'demo.resume', resolvedBy: 'eff-key' },
    ]);
    expect(parseRunWaitsRead('unreachable', null)).toEqual({
      available: false,
      waits: [],
      note: expect.stringContaining('No wait state is claimed'),
    });
  });

  it('narrow the audit read truthfully; every row carries actor/action/at/summary', () => {
    const result = parseAuditRead('ok', {
      events: [
        {
          auditId: 'audit-1',
          at: 1_700,
          action: 'confirmation.consumed',
          actorId: 'actor-a',
          summary: 'command=run.cancel actor=actor-a outcome=consumed',
        },
        { auditId: 'audit-2', action: 'x', actorId: 'a' }, // missing at → still shown with the truthful marker
        'garbage',
      ],
      total: 3,
    });
    expect(result.available).toBe(true);
    expect(result.events).toEqual([
      {
        auditId: 'audit-1',
        at: '1700',
        action: 'confirmation.consumed',
        actorId: 'actor-a',
        summary: 'command=run.cancel actor=actor-a outcome=consumed',
      },
      { auditId: 'audit-2', at: '(unreadable)', action: 'x', actorId: 'a', summary: '' },
    ]);
    expect(parseAuditRead('http-error', null)).toEqual({
      available: false,
      events: [],
      note: expect.stringContaining('No audit claim is made'),
    });
  });

  it('serializes the executor result verbatim; absent members stay null', () => {
    expect(
      asExecutorResult({ result: { runId: 'r', status: 'accepted', runRecordRevision: 4 } }),
    ).toBe('{"runId":"r","status":"accepted","runRecordRevision":4}');
    expect(asExecutorResult({})).toBeNull();
    expect(asExecutorResult(null)).toBeNull();
  });

  it('unavailable constants claim nothing (panel fail-closed states)', () => {
    expect(UNAVAILABLE_SUBJECT_READ.status).toBeNull();
    expect(UNAVAILABLE_SUBJECT_READ.available).toBe(false);
    expect(UNAVAILABLE_WAITS_READ.available).toBe(false);
    expect(UNAVAILABLE_AUDIT_READ.available).toBe(false);
  });
});
