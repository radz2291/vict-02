import { RESOURCE_DEFINITION_SCHEMA, defineContract, defineResource } from '@victframework/sdk';

/**
 * Framework-neutral domain module for the coding-agent product proof
 * (`app.agent-workspace`). Like the rest of the showcase data modules it
 * contains NO Svelte, NO renderer code and NO host styling: contracts,
 * resources and DETERMINISTIC seeds only. The visible product is authored
 * in ./agent.ts as an ordinary Application Definition; the deterministic
 * local session behaviour lives in ../server/agent-server.ts.
 *
 * This module stands in for the real agent backend of a later phase. The
 * seeds are fixed constants and index formulas so the owner always
 * inspects the same workspace, and a restart resets them.
 */

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

function failContract(
  message: string,
  path = '(root)',
): { ok: false; issues: { code: string; path: string; message: string }[] } {
  return { ok: false as const, issues: [{ code: 'invalid_value', path, message }] };
}

/** Conversation input for the agent session transcript. */
export const agentMessageInputContract = defineContract<{
  id: string;
  sessionId: string;
  text: string;
  author: string;
  participant: string;
  createdAt?: string;
}>({
  id: 'agent.message.input',
  revision: '1',
  expected: '{ id, sessionId, text, author, participant, createdAt? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a message record is required');
    }
    const text = candidate.text;
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 2000) {
      return failContract('text is required (1-2000 characters)');
    }
    const id = candidate.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      return failContract('id is required');
    }
    const sessionId = candidate.sessionId;
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return failContract('sessionId is required');
    }
    const author =
      typeof candidate.author === 'string' && candidate.author.length > 0
        ? candidate.author
        : 'You';
    const participant = candidate.participant === 'assistant' ? 'assistant' : 'user';
    if (
      candidate.createdAt !== undefined &&
      (typeof candidate.createdAt !== 'string' || candidate.createdAt.length === 0)
    ) {
      return failContract('createdAt must be a non-empty string when present');
    }
    return {
      ok: true as const,
      value: {
        id,
        sessionId,
        text,
        author,
        participant,
        ...(typeof candidate.createdAt === 'string' ? { createdAt: candidate.createdAt } : {}),
      },
    };
  },
});

/** Output of the deterministic assistant-reply capability. */
export const agentReplyOutputContract = defineContract<{
  metrics: { id: string; label: string; value: string }[];
}>({
  id: 'agent.reply.output',
  revision: '1',
  expected: '{ metrics: [{ id, label, value }] }',
  parse: (input) => {
    const candidate = input as { metrics?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      Array.isArray(candidate.metrics) &&
      candidate.metrics.every(
        (metric) =>
          metric !== null &&
          typeof metric === 'object' &&
          typeof (metric as { id?: unknown }).id === 'string' &&
          typeof (metric as { label?: unknown }).label === 'string' &&
          typeof (metric as { value?: unknown }).value === 'string',
      )
    ) {
      return {
        ok: true as const,
        value: {
          metrics: candidate.metrics.map((metric) => ({
            id: (metric as { id: string }).id,
            label: (metric as { label: string }).label,
            value: (metric as { value: string }).value,
          })),
        },
      };
    }
    return failContract('a reply result with metrics is required');
  },
});

/**
 * Console input for the deterministic session controls (approve / decline
 * / advance / fail / retry / reset). The session identity normally comes
 * from the route context; an explicit `id` is accepted and validated.
 */
export const agentConsoleInputContract = defineContract<{ id?: string; note?: string }>({
  id: 'agent.console.input',
  revision: '1',
  expected: '{ id?, note? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate !== null && typeof candidate === 'object') {
      const id = candidate.id;
      if (id !== undefined && (typeof id !== 'string' || id.trim().length === 0)) {
        return failContract('id must be a non-empty string when present');
      }
      const note = candidate.note;
      if (note !== undefined && typeof note !== 'string') {
        return failContract('note must be a string when present');
      }
      return {
        ok: true as const,
        value: {
          ...(typeof id === 'string' ? { id } : {}),
          ...(typeof note === 'string' ? { note } : {}),
        },
      };
    }
    return { ok: true as const, value: {} };
  },
});

/**
 * The closed patch vocabulary the agent server may write to a session
 * through the data adapter's update boundary. Anything else is rejected
 * or stripped by the declared contract, never merged silently.
 */
export const agentSessionPatchContract = defineContract<{
  status?: string;
  progress?: number;
  updatedAt?: string;
  durationMin?: number;
  filesChanged?: number;
  tokens?: number;
}>({
  id: 'agent.session.patch',
  revision: '1',
  expected: '{ status?, progress?, updatedAt?, durationMin?, filesChanged?, tokens? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return failContract('a session patch object is required');
    }
    const patch: Record<string, unknown> = {};
    const status = candidate.status;
    if (status !== undefined) {
      if (
        typeof status !== 'string' ||
        !SESSION_STATUSES.includes(status as (typeof SESSION_STATUSES)[number])
      ) {
        return failContract(
          'status must be one of: running, completed, failed, awaiting_approval',
          'status',
        );
      }
      patch.status = status;
    }
    for (const key of ['progress', 'durationMin', 'filesChanged', 'tokens'] as const) {
      const value = candidate[key];
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        return failContract(`${key} must be a non-negative finite number when present`, key);
      }
      patch[key] = value;
    }
    const updatedAt = candidate.updatedAt;
    if (updatedAt !== undefined) {
      if (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt)) {
        return failContract('updatedAt must be an ISO timestamp when present', 'updatedAt');
      }
      patch.updatedAt = updatedAt;
    }
    return { ok: true as const, value: patch };
  },
});

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

const SESSION_STATUSES = ['running', 'completed', 'failed', 'awaiting_approval'] as const;

export const agentProjectResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentProjects',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Project' },
    { name: 'name', type: 'string', required: true, label: 'Name' },
    { name: 'description', type: 'string', required: true, label: 'Description' },
    { name: 'repository', type: 'string', required: true, label: 'Repository' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentSessionResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentSessions',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Session' },
    { name: 'projectId', type: 'string', required: true, label: 'Project' },
    { name: 'task', type: 'string', required: true, label: 'Task' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'progress', type: 'number', required: true, label: 'Progress (%)' },
    { name: 'model', type: 'string', required: true, label: 'Model' },
    { name: 'branch', type: 'string', required: true, label: 'Branch' },
    { name: 'startedAt', type: 'date', required: true, label: 'Started' },
    { name: 'updatedAt', type: 'date', required: true, label: 'Updated' },
    { name: 'durationMin', type: 'number', required: true, label: 'Duration (min)' },
    { name: 'filesChanged', type: 'number', required: true, label: 'Files changed' },
    { name: 'tokens', type: 'number', required: true, label: 'Tokens' },
  ],
  queries: {
    list: { filters: ['projectId', 'status'], sort: ['updatedAt', 'id'] },
    detail: {},
  },
  mutations: [
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'agent.session.patch',
      permissions: ['agent.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentFileResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentFiles',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'sessionId', type: 'string', required: true, label: 'Session' },
    { name: 'path', type: 'string', required: true, label: 'File' },
    { name: 'status', type: 'string', required: true, label: 'Change' },
    { name: 'additions', type: 'number', required: true, label: 'Additions' },
    { name: 'deletions', type: 'number', required: true, label: 'Deletions' },
  ],
  queries: {
    list: { filters: ['sessionId', 'status'], sort: ['path'] },
  },
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentMessageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentMessages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'sessionId', type: 'string', required: true, label: 'Session' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: {
    list: { filters: ['sessionId'], sort: ['createdAt'] },
  },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'agent.message.input',
      idempotency: 'keyed',
      permissions: ['agent.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentActivityResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentActivity',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'sessionId', type: 'string', required: true, label: 'Session' },
    { name: 'at', type: 'date', required: true, label: 'At' },
    { name: 'actor', type: 'string', required: true, label: 'Actor' },
    { name: 'summary', type: 'string', required: true, label: 'Summary' },
  ],
  queries: {
    list: { filters: ['sessionId'], sort: ['at'] },
  },
  mutations: [{ op: 'create', effect: 'write', permissions: ['agent.write'] }],
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentLogResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentLog',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'sessionId', type: 'string', required: true, label: 'Session' },
    { name: 'at', type: 'date', required: true, label: 'At' },
    { name: 'level', type: 'string', required: true, label: 'Level' },
    { name: 'tool', type: 'string', required: true, label: 'Tool' },
    { name: 'line', type: 'string', required: true, label: 'Line' },
  ],
  queries: {
    list: { filters: ['sessionId', 'level'], sort: ['at', 'id'] },
  },
  mutations: [{ op: 'create', effect: 'write', permissions: ['agent.write'] }],
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

/**
 * The deterministic console resource: a small write boundary whose ops the
 * agent server interprets as session state transitions (approve, decline,
 * advance, fail, retry, reset). It carries no durable rows of its own.
 */
export const agentConsoleResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentConsole',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'note', type: 'string', label: 'Note' },
  ],
  queries: { list: {} },
  mutations: ['approve', 'decline', 'advance', 'fail', 'retry', 'reset'].map((op) => ({
    op,
    effect: 'write' as const,
    inputContractId: 'agent.console.input',
    permissions: ['agent.write'],
  })),
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

/* ------------------------------------------------------------------ */
/* Compile/adapter bindings                                            */
/* ------------------------------------------------------------------ */

export const agentRegistryContracts = [
  { id: 'agent.message.input', revision: '1' },
  { id: 'agent.console.input', revision: '1' },
  { id: 'agent.session.patch', revision: '1' },
  { id: 'agent.reply.output', revision: '1' },
] as const;

/** The contracts bound to the data adapter (mutation validation). */
export const agentDataContracts = [
  agentMessageInputContract,
  agentConsoleInputContract,
  agentSessionPatchContract,
  agentReplyOutputContract,
];

export const agentResourceList = [
  agentProjectResource,
  agentSessionResource,
  agentFileResource,
  agentMessageResource,
  agentActivityResource,
  agentLogResource,
  agentConsoleResource,
];

/* ------------------------------------------------------------------ */
/* Deterministic seeds                                                 */
/* ------------------------------------------------------------------ */

/** Fixed epoch base: 2026-09-26T09:00:00+08:00 plus minute offsets. */
const BASE_MINUTES = 9 * 60; // 09:00 on the fixed demo day
function iso(minutesFromBase: number): string {
  const total = BASE_MINUTES + minutesFromBase;
  const day = 26 + Math.floor(total / (24 * 60));
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `2026-09-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`;
}

const agentProjectsSeed: Record<string, unknown>[] = [
  {
    id: 'vict-02',
    name: 'vict-02',
    description: 'The VICT platform monorepo: renderer, application packages and the showcase.',
    repository: 'radz2291/vict-02',
  },
  {
    id: 'quellight-web',
    name: 'quellight-web',
    description: 'Public site and account area for the shared-world product.',
    repository: 'radz2291/quellight-web',
  },
  {
    id: 'ops-console',
    name: 'ops-console',
    description: 'Internal service-desk operations console.',
    repository: 'radz2291/ops-console',
  },
];

const agentSessionsSeed: Record<string, unknown>[] = [
  {
    id: 'AGW-101',
    projectId: 'vict-02',
    task: 'Migrate the app shell navigation to the shared ui-svelte surfaces',
    status: 'awaiting_approval',
    progress: 40,
    model: 'vict-agent-local',
    branch: 'pi/ui-shell-nav',
    startedAt: iso(-42),
    updatedAt: iso(-4),
    durationMin: 38,
    filesChanged: 3,
    tokens: 214_880,
  },
  {
    id: 'AGW-102',
    projectId: 'vict-02',
    task: 'Add regression fixtures for the drawer focus-restore path',
    status: 'running',
    progress: 55,
    model: 'vict-agent-local',
    branch: 'qa/drawer-focus',
    startedAt: iso(-14),
    updatedAt: iso(-2),
    durationMin: 12,
    filesChanged: 2,
    tokens: 96_410,
  },
  {
    id: 'AGW-103',
    projectId: 'quellight-web',
    task: 'Draft the provenance drawer content model from the knowledge schema',
    status: 'running',
    progress: 25,
    model: 'vict-agent-local',
    branch: 'ql/provenance-drawer',
    startedAt: iso(-33),
    updatedAt: iso(-6),
    durationMin: 27,
    filesChanged: 1,
    tokens: 58_240,
  },
  {
    id: 'AGW-104',
    projectId: 'ops-console',
    task: 'Backfill the service-desk seeds with district naming and SLA date rules',
    status: 'completed',
    progress: 100,
    model: 'vict-agent-local',
    branch: 'ops/bm-seeds',
    startedAt: iso(-380),
    updatedAt: iso(-346),
    durationMin: 34,
    filesChanged: 4,
    tokens: 412_770,
  },
  {
    id: 'AGW-105',
    projectId: 'vict-02',
    task: 'Split the release evidence aggregator so candidate artifacts stop sharing the frozen order',
    status: 'failed',
    progress: 70,
    model: 'vict-agent-local',
    branch: 'release/evidence-split',
    startedAt: iso(-96),
    updatedAt: iso(-9),
    durationMin: 87,
    filesChanged: 3,
    tokens: 233_150,
  },
];

const agentFilesSeed: Record<string, unknown>[] = [
  {
    id: 'AGF-1011',
    sessionId: 'AGW-101',
    path: 'packages/ui-svelte/src/AppShell.svelte',
    status: 'modified',
    additions: 64,
    deletions: 31,
  },
  {
    id: 'AGF-1012',
    sessionId: 'AGW-101',
    path: 'examples/ui-showcase/src/routes/+page.svelte',
    status: 'modified',
    additions: 12,
    deletions: 4,
  },
  {
    id: 'AGF-1013',
    sessionId: 'AGW-101',
    path: 'packages/renderer-svelte/src/index.ts',
    status: 'modified',
    additions: 2,
    deletions: 2,
  },
  {
    id: 'AGF-1021',
    sessionId: 'AGW-102',
    path: 'packages/ui-svelte/test/overlay.test.ts',
    status: 'new',
    additions: 142,
    deletions: 0,
  },
  {
    id: 'AGF-1022',
    sessionId: 'AGW-102',
    path: 'packages/ui-svelte/src/Overlay.svelte',
    status: 'modified',
    additions: 9,
    deletions: 3,
  },
  {
    id: 'AGF-1031',
    sessionId: 'AGW-103',
    path: 'quellight-web/src/lib/world/provenance.ts',
    status: 'new',
    additions: 118,
    deletions: 0,
  },
  {
    id: 'AGF-1041',
    sessionId: 'AGW-104',
    path: 'ops-console/src/lib/seeds/districts.ts',
    status: 'new',
    additions: 214,
    deletions: 0,
  },
  {
    id: 'AGF-1042',
    sessionId: 'AGW-104',
    path: 'ops-console/src/lib/seeds/sla.ts',
    status: 'modified',
    additions: 33,
    deletions: 12,
  },
  {
    id: 'AGF-1043',
    sessionId: 'AGW-104',
    path: 'ops-console/README.md',
    status: 'modified',
    additions: 8,
    deletions: 1,
  },
  {
    id: 'AGF-1044',
    sessionId: 'AGW-104',
    path: 'ops-console/src/lib/seeds/legacy.ts',
    status: 'deleted',
    additions: 0,
    deletions: 96,
  },
  {
    id: 'AGF-1051',
    sessionId: 'AGW-105',
    path: 'scripts/release-evidence.mjs',
    status: 'modified',
    additions: 61,
    deletions: 48,
  },
  {
    id: 'AGF-1052',
    sessionId: 'AGW-105',
    path: 'scripts/lib/release-set.mjs',
    status: 'modified',
    additions: 12,
    deletions: 30,
  },
  {
    id: 'AGF-1053',
    sessionId: 'AGW-105',
    path: 'scripts/publish-release.mjs',
    status: 'modified',
    additions: 4,
    deletions: 4,
  },
];

const agentMessagesSeed: Record<string, unknown>[] = [
  {
    id: 'AGM-1011',
    sessionId: 'AGW-101',
    text: 'Migrate the shell navigation to the shared ui-svelte surfaces. Keep renderer-svelte a pure facade and list every file you touch.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-42),
  },
  {
    id: 'AGM-1012',
    sessionId: 'AGW-101',
    text: 'Plan accepted: AppShell plus the showcase host page. I will run the renderer suite after the move and report the diff file by file.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-41),
  },
  {
    id: 'AGM-1013',
    sessionId: 'AGW-101',
    text: 'The shell move is done and the suites pass (70/70). Before I touch the facade re-export list I need your approval — the diff keeps renderer-svelte a pure compatibility facade.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-4),
  },
  {
    id: 'AGM-1021',
    sessionId: 'AGW-102',
    text: 'Add regression coverage for the drawer focus-restore path after the overlay close event.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-14),
  },
  {
    id: 'AGM-1022',
    sessionId: 'AGW-102',
    text: 'Writing the fixtures now; I will reuse the overlay test harness so the cases stay readable.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-12),
  },
  {
    id: 'AGM-1023',
    sessionId: 'AGW-102',
    text: 'Fixture file added and the suite is green locally. Continuing with the rapid-toggle edge cases.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-2),
  },
  {
    id: 'AGM-1031',
    sessionId: 'AGW-103',
    text: 'Draft the provenance drawer content model from the knowledge schema.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-33),
  },
  {
    id: 'AGM-1032',
    sessionId: 'AGW-103',
    text: 'Schema read complete. Drafting the model with a source link per entry so provenance stays checkable.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-27),
  },
  {
    id: 'AGM-1041',
    sessionId: 'AGW-104',
    text: 'Backfill the service-desk seeds with district naming and SLA date rules.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-380),
  },
  {
    id: 'AGM-1042',
    sessionId: 'AGW-104',
    text: 'Done: districts and SLA rules are in (214 new lines). The console suites pass and the branch is ready for your review.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-346),
  },
  {
    id: 'AGM-1051',
    sessionId: 'AGW-105',
    text: 'Split the evidence aggregator so candidate artifacts stop sharing the frozen order.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-96),
  },
  {
    id: 'AGM-1052',
    sessionId: 'AGW-105',
    text: 'The refactor typechecks, but the packaging ladder failed on the frozen manifest check. I stopped before pushing anything.',
    author: 'Victor',
    participant: 'assistant',
    createdAt: iso(-9),
  },
];

const agentActivitySeed: Record<string, unknown>[] = [
  {
    id: 'AGA-1011',
    sessionId: 'AGW-101',
    at: iso(-40),
    actor: 'Victor',
    summary: 'Read the shell navigation call sites',
  },
  {
    id: 'AGA-1012',
    sessionId: 'AGW-101',
    at: iso(-38),
    actor: 'Victor',
    summary: 'Edited AppShell.svelte and the showcase host page',
  },
  {
    id: 'AGA-1013',
    sessionId: 'AGW-101',
    at: iso(-5),
    actor: 'Victor',
    summary: 'Renderer suites passed (70/70)',
  },
  {
    id: 'AGA-1014',
    sessionId: 'AGW-101',
    at: iso(-4),
    actor: 'Victor',
    summary: 'Requested approval for the facade change',
  },
  {
    id: 'AGA-1021',
    sessionId: 'AGW-102',
    at: iso(-13),
    actor: 'Victor',
    summary: 'Opened the overlay test harness',
  },
  {
    id: 'AGA-1022',
    sessionId: 'AGW-102',
    at: iso(-7),
    actor: 'Victor',
    summary: 'Added overlay.test.ts fixtures',
  },
  {
    id: 'AGA-1023',
    sessionId: 'AGW-102',
    at: iso(-2),
    actor: 'Victor',
    summary: 'Local suite green',
  },
  {
    id: 'AGA-1031',
    sessionId: 'AGW-103',
    at: iso(-32),
    actor: 'Victor',
    summary: 'Read the knowledge schema',
  },
  {
    id: 'AGA-1032',
    sessionId: 'AGW-103',
    at: iso(-27),
    actor: 'Victor',
    summary: 'Drafted provenance.ts',
  },
  {
    id: 'AGA-1041',
    sessionId: 'AGW-104',
    at: iso(-360),
    actor: 'Victor',
    summary: 'Committed the district seeds',
  },
  {
    id: 'AGA-1042',
    sessionId: 'AGW-104',
    at: iso(-352),
    actor: 'Victor',
    summary: 'Applied the SLA date rules',
  },
  {
    id: 'AGA-1043',
    sessionId: 'AGW-104',
    at: iso(-346),
    actor: 'Victor',
    summary: 'Session completed',
  },
  {
    id: 'AGA-1051',
    sessionId: 'AGW-105',
    at: iso(-60),
    actor: 'Victor',
    summary: 'Refactored the evidence aggregator',
  },
  {
    id: 'AGA-1052',
    sessionId: 'AGW-105',
    at: iso(-12),
    actor: 'Victor',
    summary: 'Ran the packaging ladder',
  },
  {
    id: 'AGA-1053',
    sessionId: 'AGW-105',
    at: iso(-9),
    actor: 'Victor',
    summary: 'Frozen manifest check failed — stopped',
  },
];

const agentLogSeed: Record<string, unknown>[] = [
  {
    id: 'AGL-1011',
    sessionId: 'AGW-101',
    at: iso(-40),
    level: 'info',
    tool: 'read',
    line: 'reading packages/ui-svelte/src/AppShell.svelte (93 lines)',
  },
  {
    id: 'AGL-1012',
    sessionId: 'AGW-101',
    at: iso(-38),
    level: 'command',
    tool: 'shell',
    line: 'npm run test -w @victframework/ui-svelte',
  },
  {
    id: 'AGL-1013',
    sessionId: 'AGW-101',
    at: iso(-5),
    level: 'info',
    tool: 'test',
    line: 'renderer suites: 70/70 passed',
  },
  {
    id: 'AGL-1014',
    sessionId: 'AGW-101',
    at: iso(-4),
    level: 'warn',
    tool: 'review',
    line: 'facade re-export list still pins renderer-svelte@5.0.0 — approval required',
  },
  {
    id: 'AGL-1021',
    sessionId: 'AGW-102',
    at: iso(-13),
    level: 'info',
    tool: 'read',
    line: 'reading packages/ui-svelte/src/Overlay.svelte',
  },
  {
    id: 'AGL-1022',
    sessionId: 'AGW-102',
    at: iso(-7),
    level: 'command',
    tool: 'shell',
    line: 'npx vitest run overlay',
  },
  {
    id: 'AGL-1023',
    sessionId: 'AGW-102',
    at: iso(-2),
    level: 'info',
    tool: 'test',
    line: 'overlay fixtures: 8/8 passed',
  },
  {
    id: 'AGL-1031',
    sessionId: 'AGW-103',
    at: iso(-32),
    level: 'info',
    tool: 'read',
    line: 'reading quellight-web/src/lib/world/schema.ts',
  },
  {
    id: 'AGL-1032',
    sessionId: 'AGW-103',
    at: iso(-27),
    level: 'info',
    tool: 'write',
    line: 'drafted provenance.ts (118 lines)',
  },
  {
    id: 'AGL-1041',
    sessionId: 'AGW-104',
    at: iso(-352),
    level: 'command',
    tool: 'shell',
    line: 'npm run test -w ops-console',
  },
  {
    id: 'AGL-1042',
    sessionId: 'AGW-104',
    at: iso(-346),
    level: 'info',
    tool: 'test',
    line: 'seeds suite: 24/24 passed',
  },
  {
    id: 'AGL-1043',
    sessionId: 'AGW-104',
    at: iso(-346),
    level: 'info',
    tool: 'done',
    line: 'session completed in 34 min',
  },
  {
    id: 'AGL-1051',
    sessionId: 'AGW-105',
    at: iso(-12),
    level: 'command',
    tool: 'shell',
    line: 'node scripts/verify-stage7a.mjs',
  },
  {
    id: 'AGL-1052',
    sessionId: 'AGW-105',
    at: iso(-10),
    level: 'info',
    tool: 'build',
    line: 'evidence aggregator split into 3 modules',
  },
  {
    id: 'AGL-1053',
    sessionId: 'AGW-105',
    at: iso(-9),
    level: 'error',
    tool: 'verify',
    line: 'frozen manifest check FAILED: candidate order drift',
  },
  {
    id: 'AGL-1054',
    sessionId: 'AGW-105',
    at: iso(-9),
    level: 'error',
    tool: 'stop',
    line: 'stopping before push; owner review required',
  },
];

/** Deterministic seeds per resource id (a restart restores exactly these). */
export const agentSeeds: Record<string, readonly Record<string, unknown>[]> = {
  agentProjects: agentProjectsSeed,
  agentSessions: agentSessionsSeed,
  agentFiles: agentFilesSeed,
  agentMessages: agentMessagesSeed,
  agentActivity: agentActivitySeed,
  agentLog: agentLogSeed,
  agentConsole: [],
};
