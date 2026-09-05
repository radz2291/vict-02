/**
 * Structured, safe errors for persistence concerns.
 *
 * Rules (Stage 02 error model):
 * - Raw driver/database error messages, SQL text and bound values never
 *   enter the public `message` or `details` of a store error.
 * - Raw driver detail is attached only to `driverCause`, a protected
 *   development-only field that must never be serialized into run records,
 *   events, or ordinary `RunResult`/`VictError` data.
 * - Database file paths do not appear in ordinary public errors.
 */
export type StoreErrorCode =
  | 'VICT_STORE_UNSUPPORTED_SCHEMA'
  | 'VICT_STORE_MIGRATION_FAILED'
  | 'VICT_STORE_ACTIVATION_NOT_FOUND'
  | 'VICT_STORE_ACTIVATION_MISMATCH'
  | 'VICT_STORE_ACTIVATION_COLLISION'
  | 'VICT_STORE_SELECTION_CONFLICT'
  | 'VICT_STORE_RUN_NOT_FOUND'
  | 'VICT_STORE_RUN_CONFLICT'
  | 'VICT_STORE_EVENT_SEQUENCE_CONFLICT'
  | 'VICT_STORE_INVALID_RECORD'
  | 'VICT_STORE_BUSY'
  | 'VICT_STORE_UNAVAILABLE'
  | 'VICT_STORE_INVALID_COMMAND'
  // Stage 03 durable orchestration conflicts and lookups.
  | 'VICT_STORE_ATTEMPT_FENCE_CONFLICT'
  | 'VICT_STORE_ATTEMPT_STATE_CONFLICT'
  | 'VICT_STORE_TOKEN_CONFLICT'
  | 'VICT_STORE_WAIT_NOT_FOUND'
  | 'VICT_STORE_WAIT_CONFLICT'
  | 'VICT_STORE_SIGNAL_NAME_MISMATCH'
  | 'VICT_STORE_SIGNAL_CONFLICT'
  | 'VICT_STORE_TIMER_NOT_FOUND'
  | 'VICT_STORE_TIMER_CONFLICT'
  | 'VICT_STORE_CANCELLATION_CONFLICT'
  | 'VICT_STORE_RESOLUTION_CONFLICT'
  | 'VICT_STORE_INVARIANT';

/** Safe details carried by store errors: operation plus relevant safe identifiers. */
export interface StoreErrorDetails {
  readonly operation: string;
  readonly activationVersion?: string;
  readonly graphId?: string;
  readonly runId?: string;
  readonly expectedRecordRevision?: number;
  readonly actualRecordRevision?: number;
  readonly expectedEventSeq?: number;
  readonly actualEventSeq?: number;
  readonly expectedSelectionRevision?: number;
  readonly actualSelectionRevision?: number;
  readonly schemaVersion?: number;
  readonly [key: string]: unknown;
}

export class VictStoreError extends Error {
  readonly code: StoreErrorCode;
  readonly details: StoreErrorDetails;
  /**
   * Protected development-only cause (raw driver error). Never copy this
   * value into persisted data or ordinary public errors.
   *
   * DIAGNOSTIC-SAFETY SHAPE (enforced by construction, not convention):
   * the property is defined NON-ENUMERABLE, NON-WRITABLE, and
   * NON-CONFIGURABLE, so it is absent from `JSON.stringify(error)`,
   * `Object.keys(error)`, object spread, structured-clone snapshots, and
   * every ordinary serialized/persisted diagnostic surface. Authorized
   * programmatic access (`error.driverCause`) for local development
   * diagnostics still works. The raw cause is deliberately NOT copied to
   * the standard `Error.cause` (which would create another observable
   * serialization/persistence path).
   */
  readonly driverCause?: unknown;

  constructor(
    code: StoreErrorCode,
    message: string,
    details: StoreErrorDetails,
    driverCause?: unknown,
  ) {
    super(message);
    this.name = 'VictStoreError';
    this.code = code;
    this.details = details;
    // Define — never assign — the raw cause: enumerability is the property
    // that leaks it into default serialization, so the safety boundary is
    // enforced by the property's shape itself.
    Object.defineProperty(this, 'driverCause', {
      value: driverCause,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
}

/** Wrap an unknown driver failure into a safe, structured store error. */
export function storeUnavailable(operation: string, cause: unknown): VictStoreError {
  const errCode = (cause as { code?: unknown } | null)?.code;
  const sqliteErrCode = (cause as { errcode?: unknown } | null)?.errcode;
  // SQLite result codes: 5 = SQLITE_BUSY / SQLITE_BUSY_SNAPSHOT variants.
  if (
    sqliteErrCode === 5 ||
    (errCode === 'ERR_SQLITE_ERROR' &&
      sqliteErrCode === undefined &&
      String((cause as Error | null)?.message ?? '').includes('busy'))
  ) {
    return new VictStoreError(
      'VICT_STORE_BUSY',
      'The store is busy; the operation did not complete within the configured busy timeout.',
      { operation },
      cause,
    );
  }
  return new VictStoreError(
    'VICT_STORE_UNAVAILABLE',
    'The store could not complete the operation.',
    { operation },
    cause,
  );
}
