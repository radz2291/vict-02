/**
 * Stage 06B — the closed CLI command table.
 *
 * Each entry maps one operator/developer operation onto the versioned VICT
 * command surface (method + route + typed payload). The table is closed:
 * an operation absent here is absent from the CLI. Payload shapes mirror
 * `VictCommandService` exactly; the CLI only adds flag parsing.
 */

export interface CliCommandSpec {
  /** HTTP method for the mapped route. */
  readonly method: 'GET' | 'POST';
  /** Route template; `:name` segments are filled from flags/positionals. */
  readonly path: string;
  /** Payload fields sourced from flags (`--name value`). */
  readonly flags: readonly string[];
  /** Positional argument names in order. */
  readonly positionals: readonly string[];
  /** One-line operator description. */
  readonly description: string;
  /**
   * Stage 9 G2: the receipt-gated two-step confirmation contract. The
   * legacy one-step invocation is REPLACED: `--prepare` prints the
   * server-issued receipt (never auto-confirms), `--confirm <receiptId>
   * --key <Idempotency-Key>` posts the confirmed shape. Invoking without
   * either flag is a usage error with guidance naming the two steps.
   */
  readonly confirmation?: {
    /** The versioned command name declared at prepare. */
    readonly command: string;
    /** The single prepare endpoint (POST /vict/v1/confirmations). */
    readonly preparePath: string;
  };
}

/** The prepare-only CLI flag (truthful absence of a value). */
const PREPARE_FLAG = 'prepare';
/** The confirm receipt flag (`--confirm <receiptId>`). */
export const CONFIRM_FLAG = 'confirm';
/** The consume idempotency flag (`--key <Idempotency-Key>`). */
export const CONFIRM_KEY_FLAG = 'key';
/** The prepare-only revision expectation flag (contract §4.4). */
export const EXPECTED_REVISION_FLAG = 'expectedRevision';

export const CLI_COMMANDS: Readonly<Record<string, CliCommandSpec>> = {
  'confirmation get': {
    method: 'GET',
    path: '/vict/v1/confirmations/:receiptId',
    flags: [],
    positionals: ['receiptId'],
    description: 'Read one confirmation receipt status (its command mutation scope).',
  },
  whoami: {
    method: 'POST',
    path: '/vict/v1/actor/whoami',
    flags: [],
    positionals: [],
    description: 'Show the authenticated actor, roles and scopes.',
  },
  health: {
    method: 'GET',
    path: '/vict/v1/health',
    flags: [],
    positionals: [],
    description: 'Inspect endpoint health and composed executor state.',
  },
  compatibility: {
    method: 'GET',
    path: '/vict/v1/compatibility',
    flags: [],
    positionals: [],
    description: 'Inspect command and stream schema versions.',
  },
  'changeset get': {
    method: 'GET',
    path: '/vict/v1/changesets/:changesetId',
    flags: [],
    positionals: ['changesetId'],
    description: 'Read one ChangeSet.',
  },
  'changeset list': {
    method: 'GET',
    path: '/vict/v1/changesets',
    flags: [],
    positionals: [],
    description: 'List ChangeSets.',
  },
  'changeset propose': {
    method: 'POST',
    path: '/vict/v1/changesets',
    flags: [],
    positionals: [],
    description: 'Propose a ChangeSet from a JSON payload file.',
  },
  'changeset revise': {
    method: 'POST',
    path: '/vict/v1/changesets/revise',
    flags: ['changesetId'],
    positionals: ['changesetId'],
    description: 'Revise a ChangeSet (invalidates evidence and approvals).',
  },
  'changeset check': {
    method: 'POST',
    path: '/vict/v1/changesets/check',
    flags: ['changesetId', 'kind'],
    positionals: ['changesetId'],
    description: 'Execute an authoritative validation or simulation run (trusted boundary).',
  },
  'changeset evidence': {
    method: 'POST',
    path: '/vict/v1/changesets/evidence',
    flags: ['changesetId'],
    positionals: ['changesetId'],
    description: 'Attach evidence DERIVED from an executed run (runId references the run).',
  },
  'changeset decide': {
    method: 'POST',
    path: '/vict/v1/changesets/decide',
    flags: ['changesetId', 'decision'],
    positionals: ['changesetId'],
    description: 'Approve or decline a ChangeSet (approver role).',
  },
  'changeset commit': {
    method: 'POST',
    path: '/vict/v1/changesets/commit',
    flags: ['changesetId'],
    positionals: ['changesetId'],
    description: 'Commit an approved ChangeSet into immutable versions.',
  },
  'release publish': {
    method: 'POST',
    path: '/vict/v1/releases/publish',
    flags: [],
    positionals: [],
    description: 'Publish an immutable Application Release from a JSON file.',
  },
  'release select': {
    method: 'POST',
    path: '/vict/v1/releases/select',
    flags: ['applicationId', 'releaseVersion', EXPECTED_REVISION_FLAG],
    positionals: [],
    description:
      'Select the active release for an application (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'release.select', preparePath: '/vict/v1/confirmations' },
  },
  'release selected': {
    method: 'GET',
    path: '/vict/v1/releases/selected',
    flags: ['applicationId'],
    positionals: [],
    description: 'Show the currently selected release for an application.',
  },
  'release rollback': {
    method: 'POST',
    path: '/vict/v1/releases/rollback',
    flags: ['applicationId', 'targetReleaseVersion', EXPECTED_REVISION_FLAG],
    positionals: [],
    description:
      'Roll back an application to a prior immutable release (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'release.rollback', preparePath: '/vict/v1/confirmations' },
  },
  'activation select': {
    method: 'POST',
    path: '/vict/v1/activations/select',
    flags: ['graphId', 'activationVersion', EXPECTED_REVISION_FLAG],
    positionals: [],
    description: 'Select an activation version for a graph (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'activation.select', preparePath: '/vict/v1/confirmations' },
  },
  // ---- Stage 9 operator reads (WP-1/WP-4): read parity entries ----
  'run list': {
    method: 'GET',
    path: '/vict/v1/runs',
    flags: ['status', 'graphId', 'activationVersion', 'limit', 'offset'],
    positionals: [],
    description: 'List runs (safe summaries; bounded, ordered page).',
  },
  'run get': {
    method: 'GET',
    path: '/vict/v1/runs/:runId',
    flags: [],
    positionals: ['runId'],
    description: 'Read one run (safe summary; no protected bytes).',
  },
  'run events': {
    method: 'GET',
    path: '/vict/v1/runs/:runId/events',
    flags: ['afterSeq', 'limit'],
    positionals: ['runId'],
    description: "Read a run's ordered event timeline (identity fields).",
  },
  'run waits': {
    method: 'GET',
    path: '/vict/v1/runs/:runId/waits',
    flags: [],
    positionals: ['runId'],
    description: "Read a run's waits/timers (safe descriptors).",
  },
  'run detail': {
    method: 'GET',
    path: '/vict/v1/runs/:runId/detail',
    flags: [],
    positionals: ['runId'],
    description: 'PROTECTED run detail (run.detail scope; per-access audited).',
  },
  'activation list': {
    method: 'GET',
    path: '/vict/v1/activations',
    flags: ['graphId', 'limit'],
    positionals: [],
    description: 'List published activations (identity view).',
  },
  'activation get': {
    method: 'GET',
    path: '/vict/v1/activations/:activationVersion',
    flags: [],
    positionals: ['activationVersion'],
    description: 'Read one activation (identity + content summary).',
  },
  'activation selected': {
    method: 'GET',
    path: '/vict/v1/graphs/:graphId/activations/selected',
    flags: [],
    positionals: ['graphId'],
    description: 'Show the activation currently selected for a graph (truthful absence = null).',
  },
  'release list': {
    method: 'GET',
    path: '/vict/v1/releases',
    flags: ['applicationId'],
    positionals: [],
    description: 'List published releases for an application.',
  },
  'release selections': {
    method: 'GET',
    path: '/vict/v1/releases/selections',
    flags: ['applicationId'],
    positionals: [],
    description: 'Show the release selection history for an application.',
  },
  'audit search': {
    method: 'GET',
    path: '/vict/v1/audit',
    flags: ['subjectType', 'subjectId', 'limit'],
    positionals: [],
    description: 'Search the governance audit trail (safe summaries).',
  },
  'run cancel': {
    method: 'POST',
    path: '/vict/v1/runs/cancel',
    flags: ['runId', 'reasonCode', EXPECTED_REVISION_FLAG],
    positionals: [],
    description: 'Cancel a run (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'run.cancel', preparePath: '/vict/v1/confirmations' },
  },
  // ---- Stage 9 G2: the new receipt-gated intervention commands ----
  'run resolve': {
    method: 'POST',
    path: '/vict/v1/runs/:runId/resolve',
    flags: ['resolution', EXPECTED_REVISION_FLAG],
    positionals: ['runId'],
    description: 'Resolve a blocked run (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'run.resolve', preparePath: '/vict/v1/confirmations' },
  },
  'run signal': {
    method: 'POST',
    path: '/vict/v1/runs/:runId/signal',
    flags: ['signalName', EXPECTED_REVISION_FLAG],
    positionals: ['runId'],
    description: 'Deliver a durable run signal (receipt-gated: --prepare / --confirm).',
    confirmation: { command: 'run.signal', preparePath: '/vict/v1/confirmations' },
  },
  'turn start': {
    method: 'POST',
    path: '/vict/v1/turns',
    flags: ['threadId', 'input'],
    positionals: [],
    description: 'Start an agent turn (durable intent first).',
  },
  'turn get': {
    method: 'GET',
    path: '/vict/v1/turns/:turnId',
    flags: [],
    positionals: ['turnId'],
    description: 'Inspect one agent turn.',
  },
  'turn cancel': {
    method: 'POST',
    path: '/vict/v1/turns/cancel',
    flags: ['turnId', 'reasonCode'],
    positionals: [],
    description: 'Cancel an agent turn (durable, authorized).',
  },
  'approval approve': {
    method: 'POST',
    path: '/vict/v1/approvals/:approvalId',
    flags: ['decision'],
    positionals: ['approvalId'],
    description: 'Approve a pending protected tool operation.',
  },
  'approval decline': {
    method: 'POST',
    path: '/vict/v1/approvals/:approvalId',
    flags: ['decision'],
    positionals: ['approvalId'],
    description: 'Decline a pending protected tool operation.',
  },
  'stream inspect': {
    method: 'POST',
    path: '/vict/v1/streams/inspect',
    flags: ['streamId'],
    positionals: [],
    description: 'Inspect stream state (latest sequence, known streams).',
  },
  'app query': {
    method: 'GET',
    path: '/vict/v1/app/query',
    flags: ['resourceId', 'releaseVersion'],
    positionals: [],
    description: 'Query an authorized application resource.',
  },
  'app mutate': {
    method: 'POST',
    path: '/vict/v1/app/actions',
    flags: [],
    positionals: [],
    description: 'Mutate an authorized application resource from a JSON file.',
  },
};

/** Resolve the confirmation mode for a receipt-gated CLI command.
 *
 * `prepare` and `confirm` are mutually exclusive; a confirmed invocation
 * requires both the receipt and the bounded Idempotency-Key. `usage`
 * means the caller must be shown the two-step guidance (exit non-zero,
 * NO network call).
 */
export function resolveConfirmationMode(
  flags: Readonly<Record<string, string>>,
): 'prepare' | 'confirm' | 'usage' {
  const prepareRequested = flags[PREPARE_FLAG] !== undefined;
  const receiptId = flags[CONFIRM_FLAG];
  if (prepareRequested && receiptId !== undefined) {
    return 'usage';
  }
  if (prepareRequested) {
    return 'prepare';
  }
  if (receiptId !== undefined && flags[CONFIRM_KEY_FLAG] !== undefined) {
    return 'confirm';
  }
  return 'usage';
}

/** The two-step usage guidance (stderr; exit 1; no network call). */
export function confirmationUsageGuidance(commandKey: string): string {
  return [
    `vict: '${commandKey}' is a receipt-gated command. Exactly one of the two steps is required:`,
    `vict:  1) vict ${commandKey} <flags> --prepare --expectedRevision <currentRevision>`,
    'vict:     (prints the server-issued receipt summary — receiptId, payloadDigest, expiryAt; never auto-confirms)',
    `vict:  2) vict ${commandKey} <flags> --confirm <receiptId> --key <Idempotency-Key>`,
    'vict:     (executes the command under the reviewed receipt)',
  ].join('\n');
}

/** Build the prepare envelope `{ command, payload, expectedRevision? }`. */
export function buildPrepareEnvelope(
  spec: CliCommandSpec,
  flags: Readonly<Record<string, string>>,
  fileJson: unknown,
): { command: string; payload: Record<string, unknown>; expectedRevision?: number | null } {
  const payload = buildPayload(spec, flags, fileJson);
  return {
    command: spec.confirmation?.command ?? '',
    payload,
    ...(parsePrepareRevision(flags[EXPECTED_REVISION_FLAG]) !== undefined
      ? { expectedRevision: parsePrepareRevision(flags[EXPECTED_REVISION_FLAG]) }
      : {}),
  };
}

/** Parse the prepared revision flag: a bounded non-negative integer or the
 * literal `null` (truthfully no selection). */
export function parsePrepareRevision(value: string | undefined): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'null') {
    return null;
  }
  if (!/^\d{1,15}$/.test(value)) {
    throw new Error('--expectedRevision must be a non-negative integer or the literal null.');
  }
  return Number(value);
}

/** Fill `:name` segments from the parsed flags. */
export function fillPath(spec: CliCommandSpec, flags: Readonly<Record<string, string>>): string {
  return spec.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (whole, name: string) => {
    const value = flags[name];
    if (value === undefined || !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/.test(value)) {
      throw new Error(`Missing or invalid --${name} for this command.`);
    }
    return value;
  });
}

/** Build the request payload for a command invocation.
 *
 * POST commands send `{ payload: { ...flags, ...fileJson } }` (the versioned
 * HTTP command envelope); GET commands carry the same fields as bounded
 * query parameters. Route path parameters are filled separately from flags.
 */
export function buildPayload(
  spec: CliCommandSpec,
  flags: Readonly<Record<string, string>>,
  fileJson: unknown,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of spec.flags) {
    if (flags[field] !== undefined) {
      payload[field] = flags[field];
    }
  }
  if (fileJson !== undefined) {
    if (typeof fileJson !== 'object' || fileJson === null || Array.isArray(fileJson)) {
      throw new Error('The payload file must contain a JSON object.');
    }
    Object.assign(payload, fileJson);
  }
  return payload;
}

/** Build the CONFIRMED consume payload: the command's own fields only —
 * prepare-only flags (`expectedRevision`) and the confirmation flow flags
 * never enter the payload (the receipt crosses at the envelope level). */
export function buildConfirmedPayload(
  spec: CliCommandSpec,
  flags: Readonly<Record<string, string>>,
  fileJson: unknown,
): Record<string, unknown> {
  return buildPayload(
    { ...spec, flags: spec.flags.filter((flag) => flag !== EXPECTED_REVISION_FLAG) },
    flags,
    fileJson,
  );
}
export function payloadToQuery(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9 ._:@/-]{0,199}$/.test(value)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query.length > 0 ? `?${query}` : '';
}
