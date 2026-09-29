import type {
  TargetConnectionState,
  TargetRegistryEntry,
  TargetStatusRow,
} from '../shared/contract.js';

/**
 * TARGET REGISTRY — deployment-provisioned (D-2/D-7).
 *
 * Targets and credentials NEVER come from user input: they are provisioned
 * by the deployment through environment configuration, with safe local-demo
 * defaults for the loopback journey. The credential token is server-held:
 * it never appears in any return value, log, or error message of this
 * module.
 *
 * Env:
 * - VICT_STUDIO_TARGETS: JSON array of {id,label,endpoint,credentialRef}
 * - VICT_STUDIO_CREDENTIALS: JSON map credentialRef -> {token,actorLabel,scopes[]}
 */

/** A server-held target credential (never leaves the server process). */
export interface TargetCredential {
  readonly token: string;
  readonly actorLabel: string;
  readonly scopes: readonly string[];
}

/** Demo target token constants — LOCAL DEMO ONLY, loopback fixture. */
const DEMO_OPERATOR_TOKEN = 'vict-studio-demo-operator';
const DEMO_DETAIL_TOKEN = 'vict-studio-demo-detail';
// Stage 9 G2 (S9-03 changeset browser journey): per-actor loopback fixture
// tokens for the separate-approver governance boundary. Author proposes/
// revises/appends evidence (NO changeset.approve — the self-approval
// negative is the target refusing decide on it); approver-a approves AND
// commits (the 'authorized operator commits' stand-in); approver-b approves

const DEMO_TARGETS: readonly TargetRegistryEntry[] = [
  {
    id: 'local',
    label: 'Local VICT target',
    endpoint: 'http://127.0.0.1:4310',
    credentialRef: 'studio-operator',
  },
];

const DEMO_CREDENTIALS: Readonly<Record<string, TargetCredential>> = {
  'studio-operator': {
    token: DEMO_OPERATOR_TOKEN,
    actorLabel: 'studio-operator',
    scopes: ['run.read', 'activation.read', 'audit.read', 'agent.stream.read'],
  },
  // A second credential with the protected-detail grant so the D-5
  // positive path can be demonstrated from the Studio.
  'studio-detail': {
    token: DEMO_DETAIL_TOKEN,
    actorLabel: 'operator-detail',
    scopes: ['run.read', 'activation.read', 'audit.read', 'agent.stream.read', 'run.detail'],
  },
  // Stage 9 G2 (S9-03): the changeset journey actors — strictly additive
  // fixture credentials; the existing reads/mutator grants are untouched.
  'studio-changeset-author': {
    token: 'vict-studio-demo-author',
    actorLabel: 'changeset-author',
    scopes: [
      'run.read',
      'activation.read',
      'audit.read',
      'agent.stream.read',
      'changeset.read',
      'changeset.propose',
      'changeset.revise',
    ],
  },
  'studio-changeset-approver-a': {
    token: 'vict-studio-demo-approver-a',
    actorLabel: 'changeset-approver-a',
    scopes: [
      'run.read',
      'activation.read',
      'audit.read',
      'changeset.read',
      'changeset.approve',
      'changeset.commit',
    ],
  },
  'studio-changeset-approver-b': {
    token: 'vict-studio-demo-approver-b',
    actorLabel: 'changeset-approver-b',
    scopes: ['run.read', 'activation.read', 'audit.read', 'changeset.read', 'changeset.approve'],
  },
};

function parseJsonEnv<T>(raw: string | undefined, fallback: T, what: string): T {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fail closed to the demo defaults: malformed provisioning is a
    // deployment error, but the Studio must never crash-loop over it.
    console.error(`VICT studio: invalid ${what} configuration; using defaults.`);
    return fallback;
  }
}

function parseTargets(): readonly TargetRegistryEntry[] {
  const raw = parseJsonEnv<unknown>(
    process.env['VICT_STUDIO_TARGETS'],
    DEMO_TARGETS,
    'VICT_STUDIO_TARGETS',
  );
  if (!Array.isArray(raw)) {
    return DEMO_TARGETS;
  }
  const entries: TargetRegistryEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const candidate = item as Record<string, unknown>;
    const { id, label, endpoint, credentialRef } = candidate;
    if (
      typeof id !== 'string' ||
      typeof label !== 'string' ||
      typeof endpoint !== 'string' ||
      typeof credentialRef !== 'string' ||
      id.length === 0 ||
      endpoint.length === 0
    ) {
      continue;
    }
    entries.push({ id, label, endpoint, credentialRef });
  }
  return entries.length > 0 ? entries : DEMO_TARGETS;
}

function parseCredentials(): Readonly<Record<string, TargetCredential>> {
  const raw = parseJsonEnv<unknown>(
    process.env['VICT_STUDIO_CREDENTIALS'],
    DEMO_CREDENTIALS,
    'VICT_STUDIO_CREDENTIALS',
  );
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEMO_CREDENTIALS;
  }
  const credentials: Record<string, TargetCredential> = {};
  for (const [ref, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) {
      continue;
    }
    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate['token'] !== 'string' ||
      typeof candidate['actorLabel'] !== 'string' ||
      !Array.isArray(candidate['scopes']) ||
      !candidate['scopes'].every((scope) => typeof scope === 'string')
    ) {
      continue;
    }
    credentials[ref] = {
      token: candidate['token'],
      actorLabel: candidate['actorLabel'],
      scopes: candidate['scopes'] as string[],
    };
  }
  return Object.keys(credentials).length > 0 ? credentials : DEMO_CREDENTIALS;
}

let targets: readonly TargetRegistryEntry[] = parseTargets();
let credentials: Readonly<Record<string, TargetCredential>> = parseCredentials();

/** Re-read provisioning from the environment (used by tests; safe to call). */
export function reloadTargetConfigFromEnv(): void {
  targets = parseTargets();
  credentials = parseCredentials();
  probeCache.clear();
}

/** All deployment-provisioned targets. */
export function listTargets(): readonly TargetRegistryEntry[] {
  return targets;
}

/** One target by id; `undefined` truthfully means absent. */
export function getTarget(id: string): TargetRegistryEntry | undefined {
  return targets.find((entry) => entry.id === id);
}

/** The server-held credential for a registry entry (never client-visible). */
export function getCredential(credentialRef: string): TargetCredential | undefined {
  return credentials[credentialRef];
}

/* ------------------------------------------------------------------ */
/* Probe (truthful connection states, bounded, cached)                 */
/* ------------------------------------------------------------------ */

const PROBE_TIMEOUT_MS = 1500;
const PROBE_CACHE_TTL_MS = 5000;

const probeCache = new Map<string, { at: number; row: TargetStatusRow }>();

function stateRow(
  entry: TargetRegistryEntry,
  state: TargetConnectionState,
  detail: string,
  extra?: {
    actorId?: string;
    scopes?: readonly string[];
    selected?: Record<string, string> | null;
  },
): TargetStatusRow {
  return {
    id: entry.id,
    label: entry.label,
    endpoint: entry.endpoint,
    state,
    actorId: extra?.actorId ?? null,
    scopes: extra?.scopes ?? [],
    selected: extra?.selected ?? null,
    detail,
  };
}

/** The first selected graph's activation version, if the target reports one. */
function extractSelected(data: Record<string, unknown>): Record<string, string> | null {
  const selection = data['selection'] as Record<string, unknown> | undefined;
  const activation = data['activation'] as Record<string, unknown> | undefined;
  const selections = data['selections'];
  const first =
    selection ??
    (Array.isArray(selections) && typeof selections[0] === 'object' && selections[0] !== null
      ? (selections[0] as Record<string, unknown>)
      : undefined);
  const graphId =
    first !== undefined && typeof first['graphId'] === 'string' ? first['graphId'] : undefined;
  const activationVersion =
    activation !== undefined && typeof activation['activationVersion'] === 'string'
      ? activation['activationVersion']
      : first !== undefined && typeof first['activationVersion'] === 'string'
        ? first['activationVersion']
        : undefined;
  if (graphId === undefined || activationVersion === undefined) {
    return null;
  }
  return { [graphId]: activationVersion };
}

/** Probe one target with a bounded GET; truthful states, never a guess. */
export async function probeTarget(entry: TargetRegistryEntry): Promise<TargetStatusRow> {
  const cached = probeCache.get(entry.id);
  if (cached !== undefined && Date.now() - cached.at < PROBE_CACHE_TTL_MS) {
    return cached.row;
  }
  const row = await probeUncached(entry);
  probeCache.set(entry.id, { at: Date.now(), row });
  return row;
}

async function probeUncached(entry: TargetRegistryEntry): Promise<TargetStatusRow> {
  const credential = getCredential(entry.credentialRef);
  if (credential === undefined) {
    // Provisioning error: truthful absence, no credential material named.
    return stateRow(entry, 'absent', 'no credential provisioned for this target');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  let response: Response;
  try {
    // Bounded AUTH-ONLY probe path: /runs needs no required query params.
    // (An earlier draft probed /releases, which requires an applicationId
    // and 400s without one — a 400 there would have dishonestly looked
    // like an unreachable target.)
    response = await fetch(`${entry.endpoint}/vict/v1/runs?limit=1`, {
      method: 'GET',
      headers: { authorization: `Bearer ${credential.token}` },
      signal: controller.signal,
    });
  } catch {
    return stateRow(
      entry,
      'unreachable',
      'target unreachable (no response within the probe window)',
    );
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    return stateRow(entry, 'rejected', 'target rejected the credential');
  }
  if (!response.ok) {
    return stateRow(
      entry,
      'unreachable',
      `target answered with an unusable status (${response.status})`,
    );
  }
  // Connected: report which endpoint answered + the CONFIGURED scopes.
  let selected: Record<string, string> | null = null;
  const selectedController = new AbortController();
  const selectedTimer = setTimeout(() => selectedController.abort(), PROBE_TIMEOUT_MS);
  try {
    const selectedResponse = await fetch(`${entry.endpoint}/vict/v1/activations/selected`, {
      method: 'GET',
      headers: { authorization: `Bearer ${credential.token}` },
      signal: selectedController.signal,
    });
    if (selectedResponse.ok) {
      const body = (await selectedResponse.json()) as Record<string, unknown>;
      if (body['ok'] === true && typeof body['data'] === 'object' && body['data'] !== null) {
        selected = extractSelected(body['data'] as Record<string, unknown>);
      }
    }
    // NOTE: without a graphId the target answers 400 on /activations/selected
    // (per-graph semantics), so 'selected' stays truthfully null here; the
    // dashboard's selectedActivations VIEW carries selected-version visibility
    // via the integrator's per-graph composition in app-server.ts.
  } catch {
    /* selection probe failure does not change the connected verdict */
  } finally {
    clearTimeout(selectedTimer);
  }
  return stateRow(entry, 'connected', `connected; target responded at ${entry.endpoint}`, {
    actorId: credential.actorLabel,
    scopes: credential.scopes,
    selected,
  });
}

/** Probe every provisioned target (targetStatus rows; never proxied). */
export async function probeAllTargets(): Promise<readonly TargetStatusRow[]> {
  return Promise.all(listTargets().map((entry) => probeTarget(entry)));
}
