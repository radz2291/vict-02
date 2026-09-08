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
}

export const CLI_COMMANDS: Readonly<Record<string, CliCommandSpec>> = {
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
    flags: ['applicationId', 'releaseVersion'],
    positionals: [],
    description: 'Select the active release for an application.',
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
    flags: ['applicationId', 'targetReleaseVersion'],
    positionals: [],
    description: 'Roll back an application to a prior immutable release.',
  },
  'activation select': {
    method: 'POST',
    path: '/vict/v1/activations/select',
    flags: ['graphId', 'activationVersion'],
    positionals: [],
    description: 'Select an activation version for a graph (operator).',
  },
  'run cancel': {
    method: 'POST',
    path: '/vict/v1/runs/cancel',
    flags: ['runId', 'reasonCode'],
    positionals: [],
    description: 'Cancel a run (durable, authorized).',
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

/** Serialize a payload as a bounded query string for GET commands. */
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
