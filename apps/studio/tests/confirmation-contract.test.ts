//
// S9-04 confirmation journey CONTRACT SHAPES (node environment; server-side
// pure helpers in isolation). Integration expectations live here BY NAME
// (route paths, envelope shapes, stable codes) against the frozen G2
// proposal — the actual G2 core/transport code is built in parallel and is
// NEVER imported by this test.
import { describe, expect, it } from 'vitest';
import {
  CONFIRMATION_COMMANDS,
  buildConfirmedRequest,
  buildPrepareBody,
  failureBannerText,
  isValidConfirmationId,
  parseConfirmationStatus,
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
    const body = buildPrepareBody('run.cancel', { runId: 'run-1', reasonCode: 'demo.reason' }, '7');
    expect(body).not.toBeNull();
    expect(body?.command).toBe('run.cancel');
    expect(body?.payload).toEqual({ runId: 'run-1', reasonCode: 'demo.reason' });
    expect(body?.expectedRevision).toBe('7');
    expect(buildPrepareBody('unknown.command', {}, '7')).toBeNull();
    expect(buildPrepareBody('run.cancel', { runId: 'run-1' }, '7')).toBeNull();
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
        runId: 'run-1',
        reasonCode: 'demo.reason',
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
