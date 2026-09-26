import { RESOURCE_DEFINITION_SCHEMA, defineContract, defineResource } from '@victframework/sdk';

/**
 * The ENTIRE VICT UI Showcase application, described neutrally (P6D).
 *
 * This module contains no Svelte, no renderer code, and no host styling: it
 * is the framework-neutral Application Definition plus its resource/contract
 * bindings, compiled into an immutable Application Plan. The generic
 * `@victframework/ui-svelte` host renders whatever this definition declares.
 *
 * The definition is assembled from per-scenario modules
 * (`./scenarios/*.ts`): every visible scenario is an ordinary VICT
 * Application Definition surface — nothing is handcrafted per scenario.
 *
 * All seed data is DETERMINISTIC (fixed constants + index formulas, fixed
 * timestamps) so the owner always inspects the same showcase.
 */

/* ------------------------------------------------------------------ */
/* Contracts                                                           */
/* ------------------------------------------------------------------ */

const TICKET_STATES = ['baru', 'dalam_proses', 'selesai', 'batal'] as const;
const TICKET_PRIORITIES = ['rendah', 'sederhana', 'tinggi', 'kritikal'] as const;

function failContract(
  message: string,
  path = '(root)',
): {
  ok: false;
  issues: { code: string; path: string; message: string }[];
} {
  return { ok: false as const, issues: [{ code: 'invalid_value', path, message }] };
}

export const ticketInputContract = defineContract<{
  id?: string;
  title: string;
  customer: string;
  state: string;
  priority: string;
  channel?: string;
  amount: number;
  slaDate: string;
  escalated: boolean;
  notes?: string;
  owner: string;
  location?: string;
}>({
  id: 'showcase.ticket.input',
  revision: '1',
  expected:
    '{ id?, title, customer, state, priority, channel?, amount, slaDate, escalated, notes?, owner, location? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a ticket record is required');
    }
    const title = candidate.title;
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 140) {
      return failContract('title is required (1-140 characters)');
    }
    const customer = candidate.customer;
    if (typeof customer !== 'string' || customer.trim().length === 0 || customer.length > 120) {
      return failContract('customer is required (1-120 characters)');
    }
    const state = candidate.state;
    if (typeof state !== 'string' || !TICKET_STATES.includes(state as never)) {
      return failContract('state must be one of: baru, dalam_proses, selesai, batal');
    }
    const priority = candidate.priority;
    if (typeof priority !== 'string' || !TICKET_PRIORITIES.includes(priority as never)) {
      return failContract('priority must be one of: rendah, sederhana, tinggi, kritikal');
    }
    const amount = candidate.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return failContract('amount must be a non-negative finite number');
    }
    const slaDate = candidate.slaDate;
    if (typeof slaDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(slaDate)) {
      return failContract('slaDate must be an ISO date string (YYYY-MM-DD)');
    }
    const owner = candidate.owner;
    if (typeof owner !== 'string' || owner.trim().length === 0 || owner.length > 80) {
      return failContract('owner is required (1-80 characters)');
    }
    if (
      candidate.channel !== undefined &&
      (typeof candidate.channel !== 'string' || candidate.channel.length > 40)
    ) {
      return failContract('channel must be a string of at most 40 characters');
    }
    if (
      candidate.notes !== undefined &&
      (typeof candidate.notes !== 'string' || candidate.notes.length > 2000)
    ) {
      return failContract('notes must be a string of at most 2000 characters');
    }
    if (
      candidate.location !== undefined &&
      (typeof candidate.location !== 'string' || candidate.location.length > 80)
    ) {
      return failContract('location must be a string of at most 80 characters');
    }
    if (typeof candidate.escalated !== 'boolean') {
      return failContract('escalated must be a boolean');
    }
    const id = candidate.id;
    if (id !== undefined && (typeof id !== 'string' || id.trim().length === 0)) {
      return failContract('id must be a non-empty string when present');
    }
    return {
      ok: true as const,
      value: {
        ...(typeof id === 'string' ? { id } : {}),
        title,
        customer,
        state,
        priority,
        amount,
        slaDate,
        owner,
        ...(typeof candidate.channel === 'string' ? { channel: candidate.channel } : {}),
        ...(typeof candidate.notes === 'string' ? { notes: candidate.notes } : {}),
        ...(typeof candidate.location === 'string' ? { location: candidate.location } : {}),
        escalated: candidate.escalated,
      },
    };
  },
});

/* ------------------------------------------------------------------ */

export const messageInputContract = defineContract<{
  id: string;
  text: string;
  author: string;
  participant: string;
}>({
  id: 'showcase.message.input',
  revision: '1',
  expected: '{ id, text, author, participant }',
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
        text,
        author,
        participant,
        ...(typeof candidate.createdAt === 'string' ? { createdAt: candidate.createdAt } : {}),
      },
    };
  },
});

export const galleryInputContract = defineContract<{
  id?: string;
  name: string;
  rank: number;
  zeroCheck: boolean;
  startDate?: string;
  payload?: string;
  comment?: string;
}>({
  id: 'showcase.gallery.input',
  revision: '1',
  expected: '{ id?, name, rank, zeroCheck, startDate?, payload?, comment? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object') {
      return failContract('a submission record is required');
    }
    const name = candidate.name;
    if (typeof name !== 'string' || name.trim().length === 0 || name.length > 80) {
      return failContract('Use a name between 1 and 80 characters.', 'name');
    }
    const rank = candidate.rank;
    if (typeof rank !== 'number' || !Number.isFinite(rank) || rank < 0 || rank > 100) {
      return failContract('Choose a priority score between 0 and 100.', 'rank');
    }
    if (typeof candidate.zeroCheck !== 'boolean') {
      return failContract('Choose whether this needs follow-up.', 'zeroCheck');
    }
    if (
      candidate.startDate !== undefined &&
      (typeof candidate.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.startDate))
    ) {
      return failContract('startDate must be an ISO date string (YYYY-MM-DD) when present');
    }
    if (
      candidate.payload !== undefined &&
      (typeof candidate.payload !== 'string' || candidate.payload.length > 2000)
    ) {
      return failContract('payload must be a string of at most 2000 characters');
    }
    if (
      candidate.comment !== undefined &&
      (typeof candidate.comment !== 'string' || candidate.comment.length > 500)
    ) {
      return failContract('comment must be a string of at most 500 characters');
    }
    const id = candidate.id;
    if (id !== undefined && (typeof id !== 'string' || id.trim().length === 0)) {
      return failContract('id must be a non-empty string when present');
    }
    return {
      ok: true as const,
      value: {
        ...(typeof id === 'string' ? { id } : {}),
        name,
        rank,
        zeroCheck: candidate.zeroCheck,
        ...(typeof candidate.startDate === 'string' ? { startDate: candidate.startDate } : {}),
        ...(typeof candidate.payload === 'string' ? { payload: candidate.payload } : {}),
        ...(typeof candidate.comment === 'string' ? { comment: candidate.comment } : {}),
      },
    };
  },
});

/** Permissive demo-input contract for the showcase demo/demo-state mutations. */
export const demoInputContract = defineContract<{ note?: string }>({
  id: 'showcase.demo.input',
  revision: '1',
  expected: '{ note? }',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate !== null && typeof candidate === 'object') {
      const note = candidate.note;
      if (note !== undefined && typeof note !== 'string') {
        return failContract('note must be a string when present');
      }
      return { ok: true as const, value: typeof note === 'string' ? { note } : {} };
    }
    return { ok: true as const, value: {} };
  },
});

/**
 * The stress-input contract DELIBERATELY produces a very long, structured
 * rejection message when the trigger word appears in field `c03` — this is
 * the documented long-validation-message stress case (see /stress).
 */
const STRESS_TRIGGER = 'tolak';
const STRESS_LONG_MESSAGE_PREFIX =
  'Pengesahan telah gagal atas medan berikut dan keadaan yang dinyatakan oleh penghantar: medan c03 mengandungi perkataan pencetus; sistem pengesahan integrasi menuntut mesej pengesahan yang panjang bagi menguji pembalikan teks, pembalik baris, pembacaan skrin, dan ketumpatan susun atur borang dalam keadaan sebenar; sila semak nilai medan tersebut, buang perkataan pencetus daripada kandungan, kemudian hantar semula borang ini untuk menyelesaikan penyerahan;';

export const stressInputContract = defineContract<Record<string, unknown>>({
  id: 'showcase.stress.input',
  revision: '1',
  expected: '{ c01..c22 } (c03 containing "tolak" triggers the long rejection message)',
  parse: (input) => {
    const candidate = input as Record<string, unknown> | null;
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return failContract('a stress submission object is required');
    }
    const c03 = candidate.c03;
    if (typeof c03 === 'string' && c03.toLowerCase().includes(STRESS_TRIGGER)) {
      return failContract(
        `${STRESS_LONG_MESSAGE_PREFIX} nilai medan c03 diterima sebagai pencetus ujian mesej pengesahan yang panjang (masa proses: hantar semula).`,
      );
    }
    return { ok: true as const, value: { ...candidate } };
  },
});

export const replyOutputContract = defineContract<{
  metrics: { id: string; label: string; value: string }[];
}>({
  id: 'showcase.reply.output',
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

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export const ticketResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'tickets',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'customer', type: 'string', required: true, label: 'Customer' },
    { name: 'state', type: 'string', required: true, label: 'State' },
    { name: 'priority', type: 'string', required: true, label: 'Priority' },
    { name: 'channel', type: 'string', label: 'Channel' },
    { name: 'amount', type: 'number', required: true, label: 'Amount (MYR)' },
    { name: 'slaDate', type: 'date', required: true, label: 'SLA date' },
    { name: 'escalated', type: 'boolean', required: true, label: 'Escalated' },
    { name: 'notes', type: 'json', label: 'Notes' },
    { name: 'owner', type: 'string', required: true, label: 'Owner' },
    { name: 'location', type: 'string', label: 'Location' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: {
    list: {
      filters: ['state', 'priority'],
      sort: ['createdAt', 'title', 'amount'],
      pagination: true,
      projection: [
        'id',
        'title',
        'customer',
        'state',
        'priority',
        'channel',
        'amount',
        'slaDate',
        'escalated',
        'notes',
        'owner',
        'location',
        'createdAt',
      ],
    },
    detail: {},
  },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.ticket.input',
      idempotency: 'keyed',
      permissions: ['tickets.write'],
    },
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'showcase.ticket.input',
      permissions: ['tickets.write'],
    },
    { op: 'delete', effect: 'write', permissions: ['tickets.admin.delete'] },
  ],
  authorization: { effect: 'read', permissions: ['tickets.read'] },
});

export const instrumentResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'instruments',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Symbol' },
    { name: 'name', type: 'string', required: true, label: 'Name' },
    { name: 'bid', type: 'number', required: true, label: 'Bid' },
    { name: 'ask', type: 'number', required: true, label: 'Ask' },
    { name: 'spread', type: 'number', required: true, label: 'Spread' },
    { name: 'dayHigh', type: 'number', required: true, label: 'Day high' },
    { name: 'dayLow', type: 'number', required: true, label: 'Day low' },
    { name: 'changePips', type: 'number', required: true, label: 'Change (pips)' },
    { name: 'changePct', type: 'number', required: true, label: 'Change (%)' },
    { name: 'marketState', type: 'string', required: true, label: 'Market state' },
    { name: 'volume', type: 'number', required: true, label: 'Volume' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  authorization: { effect: 'read', permissions: ['instruments.read'] },
});

export const signalResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'signals',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'instrument', type: 'string', required: true, label: 'Instrument' },
    { name: 'pattern', type: 'string', required: true, label: 'Pattern' },
    { name: 'score', type: 'number', required: true, label: 'Score' },
    { name: 'confidence', type: 'number', required: true, label: 'Confidence' },
    { name: 'rr', type: 'number', required: true, label: 'R:R' },
    { name: 'state', type: 'string', required: true, label: 'State' },
    { name: 'analyst', type: 'string', required: true, label: 'Analyst' },
    { name: 'session', type: 'string', required: true, label: 'Session' },
    { name: 'instrumentId', type: 'string', required: true, label: 'Instrument id' },
  ],
  queries: {
    list: {
      filters: ['pattern', 'state', 'instrument'],
      sort: ['id', 'score', 'confidence', 'instrument'],
      pagination: true,
      projection: [
        'id',
        'instrument',
        'pattern',
        'score',
        'confidence',
        'rr',
        'state',
        'analyst',
        'session',
        'instrumentId',
      ],
    },
    detail: {},
  },
  authorization: { effect: 'read', permissions: ['signals.read'] },
});

export const instrumentSeriesResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'instrumentSeries',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'instrumentId', type: 'string', required: true, label: 'Instrument' },
    { name: 'session', type: 'string', required: true, label: 'Session' },
    { name: 'price', type: 'number', required: true, label: 'Price' },
  ],
  queries: { list: { sort: ['session'] } },
  authorization: { effect: 'read', permissions: ['instruments.read'] },
});

export const agentSessionResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentSessions',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Session' },
    { name: 'project', type: 'string', required: true, label: 'Project' },
    { name: 'task', type: 'string', required: true, label: 'Task' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'model', type: 'string', required: true, label: 'Model' },
    { name: 'startedAt', type: 'date', required: true, label: 'Started' },
    { name: 'durationMin', type: 'number', label: 'Duration (min)' },
    { name: 'filesChanged', type: 'number', label: 'Files changed' },
    { name: 'tokens', type: 'number', required: true, label: 'Tokens' },
    { name: 'branch', type: 'string', required: true, label: 'Branch' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  mutations: [
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
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
    { name: 'path', type: 'string', required: true, label: 'Path' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'lines', type: 'number', required: true, label: 'Lines' },
  ],
  queries: { list: { sort: ['path'] } },
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const agentMessageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'agentMessages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.message.input',
      idempotency: 'keyed',
      permissions: ['agent.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['agent.read'] },
});

export const worldEntryResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'worldEntries',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'topic', type: 'string', required: true, label: 'Topic' },
    { name: 'kind', type: 'string', required: true, label: 'Kind' },
    { name: 'confidence', type: 'number', required: true, label: 'Confidence' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'source', type: 'string', required: true, label: 'Source' },
    { name: 'updatedAt', type: 'date', required: true, label: 'Updated' },
    { name: 'summary', type: 'string', required: true, label: 'Summary' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  authorization: { effect: 'read', permissions: ['world.read'] },
});

export const worldChangeResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'worldChanges',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'entryId', type: 'string', required: true, label: 'Entry' },
    { name: 'proposal', type: 'string', required: true, label: 'Proposal' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'proposedBy', type: 'string', required: true, label: 'Proposed by' },
    { name: 'reviewedBy', type: 'string', label: 'Reviewed by' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  mutations: [
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['world.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['world.read'] },
});

export const quellightMessageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'quellightMessages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.message.input',
      idempotency: 'keyed',
      permissions: ['world.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['world.read'] },
});

export const workflowInstanceResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'workflowInstances',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Instance' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'stage', type: 'string', required: true, label: 'Stage' },
    { name: 'owner', type: 'string', required: true, label: 'Owner' },
    { name: 'department', type: 'string', required: true, label: 'Department' },
    { name: 'dueDate', type: 'date', required: true, label: 'Due' },
    { name: 'progress', type: 'number', required: true, label: 'Progress (%)' },
    { name: 'blocked', type: 'boolean', required: true, label: 'Blocked' },
  ],
  queries: { list: { sort: ['id'] }, detail: {} },
  mutations: [
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['workflow.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['workflow.read'] },
});

export const workflowEventResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'workflowEvents',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'instanceId', type: 'string', required: true, label: 'Instance' },
    { name: 'stage', type: 'string', required: true, label: 'Stage' },
    { name: 'actor', type: 'string', required: true, label: 'Actor' },
    { name: 'note', type: 'string', required: true, label: 'Note' },
    { name: 'at', type: 'date', required: true, label: 'At' },
  ],
  queries: { list: { sort: ['at'] } },
  authorization: { effect: 'read', permissions: ['workflow.read'] },
});

export const kpiResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'kpi',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'label', type: 'string', required: true, label: 'Indicator' },
    { name: 'value', type: 'number', required: true, label: 'Value' },
    { name: 'unit', type: 'string', required: true, label: 'Unit' },
    { name: 'deltaPct', type: 'number', required: true, label: 'Delta (%)' },
    { name: 'segment', type: 'string', required: true, label: 'Segment' },
    { name: 'quarter', type: 'string', required: true, label: 'Quarter' },
  ],
  queries: { list: { sort: ['id'] } },
  authorization: { effect: 'read', permissions: ['analytics.read'] },
});

export const dealResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'deals',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'account', type: 'string', required: true, label: 'Account' },
    { name: 'region', type: 'string', required: true, label: 'Region' },
    { name: 'value', type: 'number', required: true, label: 'Value (RM)' },
    { name: 'stage', type: 'string', required: true, label: 'Stage' },
    { name: 'closeDate', type: 'date', required: true, label: 'Close date' },
    { name: 'owner', type: 'string', required: true, label: 'Owner' },
  ],
  queries: { list: { sort: ['id'] } },
  authorization: { effect: 'read', permissions: ['analytics.read'] },
});

export const galleryMessageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'galleryMessages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.message.input',
      idempotency: 'keyed',
      permissions: ['gallery.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['gallery.read'] },
});

export const emptyInboxResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'emptyInbox',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.message.input',
      idempotency: 'keyed',
      permissions: ['gallery.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['gallery.read'] },
});

export const gallerySubmissionResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'gallerySubmissions',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'name', type: 'string', required: true, label: 'Name' },
    { name: 'rank', type: 'number', required: true, label: 'Rank' },
    { name: 'zeroCheck', type: 'boolean', required: true, label: 'Zero check' },
    { name: 'startDate', type: 'date', label: 'Start date' },
    { name: 'payload', type: 'json', label: 'Payload' },
    { name: 'comment', type: 'string', label: 'Comment' },
  ],
  queries: { list: { sort: ['id'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.gallery.input',
      idempotency: 'keyed',
      permissions: ['gallery.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['gallery.read'] },
});

export const stressRowResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'stressRows',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    ...Array.from({ length: 29 }, (_, index) => {
      const c = index + 1;
      const name = `c${String(c).padStart(2, '0')}`;
      if (c % 9 === 4 || c % 6 === 0) {
        return {
          name,
          type: 'number',
          required: true,
          label: `Column ${String(c).padStart(2, '0')}`,
        } as const;
      }
      if (c % 11 === 9) {
        return {
          name,
          type: 'boolean',
          required: true,
          label: `Column ${String(c).padStart(2, '0')}`,
        } as const;
      }
      return { name, type: 'string', label: `Column ${String(c).padStart(2, '0')}` } as const;
    }),
  ],
  queries: {
    list: {
      filters: ['c01', 'c07'],
      sort: ['id', 'c01'],
      pagination: true,
      projection: [
        'id',
        ...Array.from({ length: 29 }, (_, index) => `c${String(index + 1).padStart(2, '0')}`),
      ],
    },
  },
  mutations: [
    {
      op: 'update',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['stress.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['stress.read'] },
});

export const stressMessageResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'stressMessages',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'text', type: 'string', required: true, label: 'Text' },
    { name: 'author', type: 'string', required: true, label: 'Author' },
    { name: 'participant', type: 'string', required: true, label: 'Participant' },
    { name: 'createdAt', type: 'date', required: true, label: 'Created' },
  ],
  queries: { list: { sort: ['createdAt'] } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'showcase.message.input',
      idempotency: 'keyed',
      permissions: ['stress.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['stress.read'] },
});

/** Gallery chart demo datasets: zero/one/many/mixed (label, value). */
function defineChartResource(id: string) {
  return defineResource({
    schema: RESOURCE_DEFINITION_SCHEMA,
    id,
    revision: '1',
    identity: { key: 'id' },
    fields: [
      { name: 'id', type: 'string', required: true, label: 'Id' },
      { name: 'label', type: 'string', required: true, label: 'Label' },
      { name: 'value', type: 'number', required: true, label: 'Value' },
    ],
    queries: { list: {} },
    authorization: { effect: 'read', permissions: ['gallery.read'] },
  });
}

export const galleryChartZeroResource = defineChartResource('galleryChartZero');
export const galleryChartOneResource = defineChartResource('galleryChartOne');
export const galleryChartWideResource = defineChartResource('galleryChartWide');
export const galleryChartMixedResource = defineChartResource('galleryChartMixed');

export const demoResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'demo',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'note', type: 'string', label: 'Note' },
  ],
  queries: { list: {} },
  mutations: [
    {
      op: 'succeed',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'validate',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'deny',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'fail',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'note',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'stress',
      effect: 'write',
      inputContractId: 'showcase.stress.input',
      permissions: ['demo.write'],
    },
    {
      op: 'decideChange',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'approveSession',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
    {
      op: 'advanceStage',
      effect: 'write',
      inputContractId: 'showcase.demo.input',
      permissions: ['demo.write'],
    },
  ],
  authorization: { effect: 'read', permissions: ['demo.read'] },
});

/* ------------------------------------------------------------------ */
/* Deterministic seeds                                                 */
/* ------------------------------------------------------------------ */

/** Fixed epoch base: 2026-09-01T00:00:00+08:00 plus minute offsets. */
const BASE_MINUTES = 30 * 24 * 60; // September offset keeps values stable
function iso(minutesFromBase: number): string {
  const total = BASE_MINUTES + minutesFromBase;
  const day = 1 + Math.floor(total / (24 * 60));
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  const month = day <= 30 ? '09' : '10';
  const dayOfMonth = day <= 30 ? day : day - 30;
  return `2026-${month}-${String(dayOfMonth).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`;
}

const ticketsSeed: Record<string, unknown>[] = [
  {
    id: 'OPS-1041',
    title: 'Permohonan pembetulan alamat bil elektrik',
    customer: 'Ahmad Faizal bin Roslan',
    state: 'selesai',
    priority: 'rendah',
    channel: 'portal',
    amount: 0,
    slaDate: '2026-09-05',
    escalated: false,
    notes:
      'Pelanggan memohon pembetulan alamat melalui portal. Pembetulan disemak oleh bahagian pendaftaran dan disahkan lengkap.',
    owner: 'Hafiz Rahman',
    location: 'Shah Alam',
    createdAt: iso(0),
  },
  {
    id: 'OPS-1042',
    title: 'Gangguan nama paparan dalam portal e-Filing',
    customer: 'Nurul Izzah binti Hamid',
    state: 'dalam_proses',
    priority: 'tinggi',
    channel: 'telefon',
    amount: 1250.5,
    slaDate: '2026-10-02',
    escalated: true,
    notes:
      'Nama paparan berulang kali terpotong selepas penamatan sesi. Laporan teknikal diserahkan kepada pengurus sistem.',
    owner: 'Tan Mei Ling',
    location: 'Kuala Lumpur',
    createdAt: iso(75),
  },
  {
    id: 'OPS-1043',
    title: 'Permintaan pelepasan caj terlebih bayar',
    customer: 'Syarikat Pengangkutan Seremban Sdn Bhd',
    state: 'dalam_proses',
    priority: 'sederhana',
    channel: 'e-mel',
    amount: 4820.75,
    slaDate: '2026-09-28',
    escalated: false,
    notes:
      'Caj terlebih dikesan semasa penutupan akaun bulan Ogos. Juruaudit dalaman meminta salinan resit asal.',
    owner: 'Aina Sofea',
    location: 'Seremban',
    createdAt: iso(220),
  },
  {
    id: 'OPS-1044',
    title: 'Kemas kini alamat e-mel korporat',
    customer: 'Perbadanan Perpustakaan Awam Negeri Kedah',
    state: 'selesai',
    priority: 'rendah',
    channel: 'portal',
    amount: 120,
    slaDate: '2026-09-08',
    escalated: false,
    notes: 'Alamat e-mel korporat dikemas kini dan disahkan oleh pegawai keselamatan.',
    owner: 'Hafiz Rahman',
    location: 'Alor Setar',
    createdAt: iso(400),
  },
  {
    id: 'OPS-1045',
    title: 'Kegagalan muat naik dokumen berukuran besar',
    customer: 'Wan Hafizah binti Wan Omar',
    state: 'baru',
    priority: 'kritikal',
    channel: 'telefon',
    amount: 990,
    slaDate: '2026-09-27',
    escalated: true,
    notes:
      'Muat naik dokumen berukuran 214 MB gagal pada tiga percubaan berturut-turut. Rangkaian pelanggan dicatat sebagai stabil.',
    owner: 'Suria Anak Empiang',
    location: 'Kuching',
    createdAt: iso(610),
  },
  {
    id: 'OPS-1046',
    title: 'Penjadualan semula lawatan tapak',
    customer: 'Koperasi Nelayan Kampung Cenderawasih',
    state: 'dalam_proses',
    priority: 'sederhana',
    channel: 'telefon',
    amount: 320,
    slaDate: '2026-10-11',
    escalated: false,
    notes: 'Lawatan tapak ditunda atas permintaan pihak pengurusan kampung kerana musim monsun.',
    owner: 'Adrian Chong',
    location: 'Kuantan',
    createdAt: iso(980),
  },
  {
    id: 'OPS-1047',
    title: 'Rayuan senarai hitam akaun perantara',
    customer: 'Global Mitra Logistics Sdn Bhd',
    state: 'dalam_proses',
    priority: 'tinggi',
    channel: 'kaunter',
    amount: 15750,
    slaDate: '2026-10-06',
    escalated: false,
    notes: 'Rayuan diserahkan ke jawatankuasa pematuhan. Dokumen sokongan diterima 12 September.',
    owner: 'Raj Kumar',
    location: 'Johor Bahru',
    createdAt: iso(1310),
  },
  {
    id: 'OPS-1048',
    title: 'Pembetulan bil separuh tahunan',
    customer: 'Koperasi Guru-Guru Melayu Perak Berhad',
    state: 'selesai',
    priority: 'rendah',
    channel: 'e-mel',
    amount: 640.2,
    slaDate: '2026-09-12',
    escalated: false,
    notes: 'Bil telah dibetulkan dan pengesahan balas diterima daripada bendahari koperasi.',
    owner: 'Tan Mei Ling',
    location: 'Ipoh',
    createdAt: iso(1560),
  },
  {
    id: 'OPS-1049',
    title: 'Permintaan laporan audit akses',
    customer: 'Firma Perakaunan Halim & Chong',
    state: 'baru',
    priority: 'sederhana',
    channel: 'portal',
    amount: 2100,
    slaDate: '2026-10-15',
    escalated: false,
    notes: 'Permintaan laporan akses tiga tahun terakhir bagi tujuan pematuhan dalaman.',
    owner: 'Aina Sofea',
    location: 'Putrajaya',
    createdAt: iso(1900),
  },
  {
    id: 'OPS-1050',
    title: 'Pendaftaran peranti pengesahan dua faktor',
    customer: 'Lim Wei Sheng',
    state: 'selesai',
    priority: 'rendah',
    channel: 'telefon',
    amount: 45,
    slaDate: '2026-09-03',
    escalated: false,
    notes: 'Pendaftaran peranti baharu disiapkan semasa panggilan dengan pengesahan identiti.',
    owner: 'Hafiz Rahman',
    location: 'George Town',
    createdAt: iso(2100),
  },
  {
    id: 'OPS-1051',
    title: 'Pembatalan langgan berjadual',
    customer: 'Kolej Vokasional Perpaduan Johor',
    state: 'batal',
    priority: 'rendah',
    channel: 'e-mel',
    amount: 780.9,
    slaDate: '2026-09-20',
    escalated: false,
    notes: 'Langganan dibatalkan mengikut syarat perjanjian perkhidmatan; baki dikembalikan.',
    owner: 'Suria Anak Empiang',
    location: 'Johor Bahru',
    createdAt: iso(2500),
  },
  {
    id: 'OPS-1052',
    title: 'Kesilapan penukaran mata wang pada invois',
    customer: 'Borneo Trading House Sdn Bhd',
    state: 'dalam_proses',
    priority: 'tinggi',
    channel: 'kaunter',
    amount: 3322.15,
    slaDate: '2026-10-04',
    escalated: true,
    notes: 'Kadar penukaran EUR/MYR dipaparkan salah pada invois; pembetulan kredit dalam semakan.',
    owner: 'Raj Kumar',
    location: 'Kota Kinabalu',
    createdAt: iso(2870),
  },
  {
    id: 'OPS-1057',
    title: 'Penyesuaian kadar caj sifar akaun kerajaan',
    customer: 'Jabatan Perkhidmatan Veterinar Negeri',
    state: 'selesai',
    priority: 'sederhana',
    channel: 'portal',
    amount: 0,
    slaDate: '2026-09-18',
    escalated: false,
    notes:
      'Akaun kerajaan dikecualikan daripada caj perkhidmatan; kadar sifar kekal dan disemak tahunan.',
    owner: 'Aina Sofea',
    location: 'Melaka',
    createdAt: iso(3200),
  },
];

const INSTRUMENT_ROWS: [
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  number,
][] = [
  // id, name, bid, ask, spread, dayHigh, dayLow, changePips, changePct, marketState, volume
  [
    'XAUUSD',
    'Gold / US Dollar',
    2438.55,
    2439.05,
    0.5,
    2444.1,
    2421.8,
    12.4,
    0.51,
    'open',
    1_845_230,
  ],
  [
    'EURUSD',
    'Euro / US Dollar',
    1.08421,
    1.08439,
    0.18,
    1.0871,
    1.0812,
    -8.2,
    -0.34,
    'open',
    921_442_115,
  ],
  [
    'GBPUSD',
    'British Pound / US Dollar',
    1.27155,
    1.27189,
    0.34,
    1.2744,
    1.2688,
    4.6,
    0.36,
    'pre',
    412_009_771,
  ],
  [
    'USDJPY',
    'US Dollar / Japanese Yen',
    149.842,
    149.871,
    0.29,
    150.12,
    149.32,
    -18.7,
    -1.25,
    'halted',
    688_010_334,
  ],
  [
    'BTCUSD',
    'Bitcoin / US Dollar',
    97412.5,
    97425.0,
    12.5,
    99280.0,
    95877.4,
    -2314.0,
    -2.32,
    'open',
    88_102,
  ],
  [
    'ETHUSD',
    'Ethereum / US Dollar',
    3412.8,
    3414.6,
    1.8,
    3488.0,
    3361.5,
    42.6,
    1.26,
    'closed',
    61_240_887,
  ],
  [
    'XAGUSD',
    'Silver / US Dollar',
    30.845,
    30.875,
    0.03,
    31.19,
    30.41,
    0.21,
    0.68,
    'open',
    12_884_402,
  ],
  [
    'AUDUSD',
    'Australian Dollar / US Dollar',
    0.65912,
    0.65931,
    0.19,
    0.6612,
    0.6571,
    0.0,
    0.0,
    'open',
    233_114_905,
  ],
];

const instrumentsSeed: Record<string, unknown>[] = INSTRUMENT_ROWS.map(
  ([id, name, bid, ask, spread, dayHigh, dayLow, changePips, changePct, marketState, volume]) => ({
    id,
    name,
    bid,
    ask,
    spread,
    dayHigh,
    dayLow,
    changePips,
    changePct,
    marketState,
    volume,
  }),
);

const SIGNAL_PATTERNS = [
  'acceptance',
  'negotiation',
  'release',
  'rotation',
  'breakout_candidate',
  'invalidated',
] as const;
const SIGNAL_INSTRUMENTS = [
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'BTCUSD',
  'ETHUSD',
  'XAGUSD',
  'AUDUSD',
];
const SIGNAL_ANALYSTS = ['Adil Hakim', 'Wen Ling Chua', 'Farah Nadhirah', 'Raj Kumar'];
const SIGNAL_SESSIONS = ['Asia', 'London', 'New York'];
const SIGNAL_STATES = ['active', 'pending', 'closed'];

/** Deterministic zig-zag price series: base + drift + sine. */
function seriesPrice(base: number, index: number): number {
  const drift = (index - 16) * base * 0.0012;
  const wave = Math.sin(index * 0.7) * base * 0.004;
  return Math.round((base + drift + wave) * 100) / 100;
}

const instrumentSeriesSeed: Record<string, unknown>[] = [];
for (const [index, symbol] of ['XAUUSD', 'EURUSD', 'BTCUSD'].entries()) {
  const base = INSTRUMENT_ROWS[index]![2] as number;
  for (let point = 0; point < 32; point += 1) {
    instrumentSeriesSeed.push({
      id: `${symbol}-S${String(point + 1).padStart(2, '0')}`,
      instrumentId: symbol,
      session: `S${String(point + 1).padStart(2, '0')}`,
      price: seriesPrice(base, point),
    });
  }
}

const signalsSeed: Record<string, unknown>[] = Array.from({ length: 48 }, (_, index) => {
  const n = index + 1;
  const instrument = SIGNAL_INSTRUMENTS[index % SIGNAL_INSTRUMENTS.length]!;
  const pattern = SIGNAL_PATTERNS[index % SIGNAL_PATTERNS.length]!;
  const score = Math.round((Math.sin(n * 1.3) * 5.2 - (n % 7 === 0 ? 2.4 : 0)) * 100) / 100;
  const confidence = Math.round((0.42 + ((n * 17) % 55) / 100) * 100) / 100;
  const rr = Math.round((0.8 + ((n * 7) % 34) / 10) * 100) / 100;
  return {
    id: `SIG-${String(n).padStart(4, '0')}`,
    instrument,
    pattern,
    score,
    confidence,
    rr,
    state: SIGNAL_STATES[index % SIGNAL_STATES.length]!,
    analyst: SIGNAL_ANALYSTS[index % SIGNAL_ANALYSTS.length]!,
    session: SIGNAL_SESSIONS[index % SIGNAL_SESSIONS.length]!,
    instrumentId: instrument,
  };
});

const agentSessionsSeed: Record<string, unknown>[] = [
  {
    id: 'AGT-2201',
    project: 'vict-02',
    task: 'Migrate the remaining shell navigation to ui-svelte surfaces and keep the facade re-exports byte-identical',
    status: 'awaiting_approval',
    model: 'vict-agent-local',
    startedAt: iso(-40),
    durationMin: 18,
    filesChanged: 6,
    tokens: 1_284_002,
    branch: 'pi/ui-shell-nav',
  },
  {
    id: 'AGT-2202',
    project: 'vict-02',
    task: 'Add regression fixtures for the drawer focus-restore path after the overlay close event',
    status: 'running',
    model: 'vict-agent-local',
    startedAt: iso(-12),
    durationMin: 4,
    filesChanged: 2,
    tokens: 214_881,
    branch: 'qa/overlay-focus',
  },
  {
    id: 'AGT-2203',
    project: 'landing-my',
    task: 'Rebuild the campaign landing hero with the conversation surface and Bahasa Malaysia copy',
    status: 'completed',
    model: 'vict-agent-local',
    startedAt: iso(-380),
    durationMin: 96,
    filesChanged: 14,
    tokens: 4_910_223,
    branch: 'landing/my-hero',
  },
  {
    id: 'AGT-2204',
    project: 'vict-02',
    task: 'Split the release evidence aggregator so candidate artifacts stop sharing the frozen order',
    status: 'failed',
    model: 'vict-agent-local',
    startedAt: iso(-520),
    durationMin: 41,
    filesChanged: 9,
    tokens: 2_406_110,
    branch: 'release/evidence-split',
  },
  {
    id: 'AGT-2205',
    project: 'quellight-web',
    task: 'Draft the shared-world provenance drawer content model from the knowledge schema',
    status: 'running',
    model: 'vict-agent-local',
    startedAt: iso(-31),
    durationMin: 11,
    filesChanged: 3,
    tokens: 512_460,
    branch: 'ql/provenance-drawer',
  },
  {
    id: 'AGT-2206',
    project: 'ops-console',
    task: 'Backfill the service-desk seeds with Malaysian district naming and SLA date rules',
    status: 'queued',
    model: 'vict-agent-local',
    startedAt: iso(5),
    durationMin: 0,
    filesChanged: 0,
    tokens: 0,
    branch: 'ops/bm-seeds',
  },
  {
    id: 'AGT-2207',
    project: 'vict-02',
    task: 'Re-run the packaging ladder after the 15-package manifest amendment and record the digests',
    status: 'completed',
    model: 'vict-agent-local',
    startedAt: iso(-780),
    durationMin: 133,
    filesChanged: 21,
    tokens: 8_114_902,
    branch: 'release/pack-15',
  },
];

const agentFilesSeed: Record<string, unknown>[] = [
  {
    id: 'AGF-001',
    sessionId: 'AGT-2201',
    path: 'examples/reference-app/src/routes/[...vict]/+page.svelte',
    status: 'modified',
    lines: 64,
  },
  {
    id: 'AGF-002',
    sessionId: 'AGT-2201',
    path: 'packages/ui-svelte/src/AppShell.svelte',
    status: 'modified',
    lines: 96,
  },
  {
    id: 'AGF-003',
    sessionId: 'AGT-2201',
    path: 'packages/ui-svelte/src/styles.css',
    status: 'modified',
    lines: 318,
  },
  {
    id: 'AGF-004',
    sessionId: 'AGT-2201',
    path: 'packages/renderer-svelte/src/index.ts',
    status: 'clean',
    lines: 26,
  },
  {
    id: 'AGF-012',
    sessionId: 'AGT-2202',
    path: 'packages/ui-svelte/test/overlay.test.ts',
    status: 'new',
    lines: 142,
  },
  {
    id: 'AGF-013',
    sessionId: 'AGT-2202',
    path: 'packages/ui-svelte/src/Overlay.svelte',
    status: 'modified',
    lines: 88,
  },
  {
    id: 'AGF-006',
    sessionId: 'AGT-2203',
    path: 'landing-my/src/routes/+page.svelte',
    status: 'modified',
    lines: 204,
  },
  {
    id: 'AGF-007',
    sessionId: 'AGT-2203',
    path: 'landing-my/src/lib/copy/bm.ts',
    status: 'new',
    lines: 77,
  },
  {
    id: 'AGF-007',
    sessionId: 'AGT-2204',
    path: 'scripts/lib/release-set.mjs',
    status: 'modified',
    lines: 412,
  },
  {
    id: 'AGF-008',
    sessionId: 'AGT-2204',
    path: 'scripts/release-evidence.mjs',
    status: 'deleted',
    lines: 0,
  },
  {
    id: 'AGF-009',
    sessionId: 'AGT-2205',
    path: 'quellight-web/src/lib/world/schema.ts',
    status: 'new',
    lines: 233,
  },
  {
    id: 'AGF-014',
    sessionId: 'AGT-2205',
    path: 'quellight-web/src/lib/world/provenance.ts',
    status: 'modified',
    lines: 118,
  },
  {
    id: 'AGF-010',
    sessionId: 'AGT-2207',
    path: 'scripts/publish-release.mjs',
    status: 'modified',
    lines: 507,
  },
  {
    id: 'AGF-011',
    sessionId: 'AGT-2207',
    path: 'docs/RELEASE-COMPATIBILITY.md',
    status: 'modified',
    lines: 214,
  },
];

const agentMessagesSeed: Record<string, unknown>[] = [
  {
    id: 'AGM-01',
    text: 'Selesaikan tugas berikut: alihkan navigasi petala ke ui-svelte tanpa mengubah identiti fasad renderer-svelte. Laporkan setiap fail yang disentuh.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-40),
  },
  {
    id: 'AGM-02',
    text: 'Plan accepted: 3 files in packages/ui-svelte, 1 re-export check in renderer-svelte, 1 route file in the reference app. I will run the renderer suite after the move.',
    author: 'Agent',
    participant: 'assistant',
    createdAt: iso(-39),
  },
  {
    id: 'AGM-03',
    text: 'Edited packages/ui-svelte/src/AppShell.svelte (96 lines) and packages/ui-svelte/src/styles.css (318 lines). The mobile menu toggle keeps aria-expanded and focus restoration.',
    author: 'Agent',
    participant: 'assistant',
    createdAt: iso(-36),
  },
  {
    id: 'AGM-04',
    text: 'Approval needed before I touch the facade re-export list. The diff keeps renderer-svelte as a pure compatibility facade: index.ts re-exports ui-svelte only, no duplicated logic.',
    author: 'Agent',
    participant: 'assistant',
    createdAt: iso(-34),
  },
  {
    id: 'AGM-05',
    text: 'Luluskan perubahan fasad itu — pastikan tiada logik pendua kekal di renderer-svelte.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-33),
  },
  {
    id: 'AGM-06',
    text: 'Renderer suites pass (70/70) and the consumer verifier still proves the facade identity (RENDERER_ID renderer.svelte-kit @ 5.0.0). Waiting for your review on the shell diff.',
    author: 'Agent',
    participant: 'assistant',
    createdAt: iso(-31),
  },
];

const worldEntriesSeed: Record<string, unknown>[] = [
  {
    id: 'QL-0042',
    topic: 'Dasar cuti Rehat Bersyarat',
    kind: 'fact',
    confidence: 0.94,
    status: 'current',
    source: 'Pekeliling Perkhidmatan Bilangan 6 Tahun 2023, lampiran 2',
    updatedAt: iso(-90),
    summary:
      'Pekerja layak mengambil cuti rehat bersyarat sehingga 14 hari setahun dengan kelulusan ketua jabatan dan rekod perubatan yang sah.',
  },
  {
    id: 'QL-0043',
    topic: 'Kadar subsidi petrol BUDI MADANI',
    kind: 'fact',
    confidence: 0.88,
    status: 'current',
    source: 'Siaran media KPDN, seksyen kadar',
    updatedAt: iso(-240),
    summary:
      'Subsidy RM350 sebulan untuk pemilik kenderaan kategori S2 dengan nilai jualan buku di bawah paras yang ditetapkan.',
  },
  {
    id: 'QL-0044',
    topic: 'Waktu perkhidmatan kaunter WP',
    kind: 'preference',
    confidence: 0.76,
    status: 'current',
    source: 'Nota perbualan 12 Sept',
    updatedAt: iso(-430),
    summary:
      'Pengguna lebih suka perundingan pada waktu pagi Isnin sehingga Rabu; petang Jumaat dielakkan.',
  },
  {
    id: 'QL-0045',
    topic: 'Hubungan vendor Logistik Selatan',
    kind: 'relationship',
    confidence: 0.81,
    status: 'conflicted',
    source: 'Borang penilaian vendor 2026',
    updatedAt: iso(-560),
    summary:
      'Dua rekod bertentangan: satu menandakan perkhidmatan aktif, satu lagi merekodkan penamatan berkuat kuasa Julai.',
  },
  {
    id: 'QL-0046',
    topic: 'Garis masa penyerahan modul e-Invois',
    kind: 'event',
    confidence: 0.92,
    status: 'current',
    source: 'Minit mesyuarat pelaksanaan 3',
    updatedAt: iso(-700),
    summary:
      'Fasa kedua bermula 1 Oktober dengan latihan pengguna selama dua minggu di tiga wilayah.',
  },
  {
    id: 'QL-0047',
    topic: 'Dasar claim perjalanan luar bandar',
    kind: 'fact',
    confidence: 0.63,
    status: 'stale',
    source: 'Pekeliling tatatertib lama',
    updatedAt: iso(-980),
    summary:
      'Kadar lama RM0.45/km mungkin telah digantikan oleh pekeliling baharu; perakuan masih menunggu pengesahan.',
  },
  {
    id: 'QL-0048',
    topic: 'Keutamaan paparan dwibahasa',
    kind: 'preference',
    confidence: 0.97,
    status: 'current',
    source: 'Profil pengguna',
    updatedAt: iso(-1200),
    summary:
      'Antara muka memaparkan Bahasa Malaysia dahulu dengan terjemahan Inggeris di bawah untuk istilah teknikal.',
  },
  {
    id: 'QL-0049',
    topic: 'Senarai semak persendirian data',
    kind: 'fact',
    confidence: 0.85,
    status: 'current',
    source: 'Dasar perlindungan data 2026',
    updatedAt: iso(-1500),
    summary:
      'Medan peribadi mesti disamarkan dalam eksport demo; nombor kad pengenalan tidak boleh dipaparkan sepenuhnya.',
  },
];

const worldChangesSeed: Record<string, unknown>[] = [
  {
    id: 'QLC-01',
    entryId: 'QL-0047',
    proposal: 'Ganti kadar claim lama dengan kadar pekeliling baharu RM0.58/km mulai 1 Okt.',
    status: 'pending',
    proposedBy: 'Quellight (draf)',
    reviewedBy: '',
  },
  {
    id: 'QLC-02',
    entryId: 'QL-0042',
    proposal: 'Tambah rujukan borang perubatan digital sebagai bukti sah.',
    status: 'accepted',
    proposedBy: 'Quellight (draf)',
    reviewedBy: 'Pn. Rosnah',
  },
  {
    id: 'QLC-03',
    entryId: 'QL-0045',
    proposal: 'Tanda hubungan vendor sebagai tamat pada 31 Julai berdasarkan borang penilaian.',
    status: 'pending',
    proposedBy: 'Quellight (draf)',
  },
  {
    id: 'QLC-04',
    entryId: 'QL-0043',
    proposal: 'Naikkan keyakinan kepada 0.9 selepas siaran semula rasmi.',
    status: 'accepted',
    proposedBy: 'Quellight (draf)',
    reviewedBy: 'Encik Farid',
  },
  {
    id: 'QLC-05',
    entryId: 'QL-0046',
    proposal: 'Terjemah garis masa ke BM standard dengan label tarikh penuh.',
    status: 'rejected',
    proposedBy: 'Quellight (draf)',
    reviewedBy: 'Pn. Rosnah',
  },
  {
    id: 'QLC-06',
    entryId: 'QL-0048',
    proposal: 'Kemas kini keutamaan paparan untuk skrin mudah alih sahaja.',
    status: 'stale',
    proposedBy: 'Quellight (draf)',
    reviewedBy: 'Encik Farid',
  },
];

const quellightMessagesSeed: Record<string, unknown>[] = [
  {
    id: 'QLM-01',
    text: 'Apa itu dasar cuti Rehat Bersyarat dan siapa yang layak?',
    author: 'You',
    participant: 'user',
    createdAt: iso(-30),
  },
  {
    id: 'QLM-02',
    text: 'Berdasarkan dunia pengetahuan anda: cuti Rehat Bersyarat membolehkan pekerja mengambil cuti sehingga 14 hari setahun dengan kelulusan ketua jabatan, disertai rekod perubatan yang sah (keyakinan 0.94, sumber Pekeliling Perkhidmatan, lampiran 2).',
    author: 'Quellight',
    participant: 'assistant',
    createdAt: iso(-29),
  },
  {
    id: 'QLM-03',
    text: 'Adakah kadar claim perjalanan luar bandar masih RM0.45 sekilometer?',
    author: 'You',
    participant: 'user',
    createdAt: iso(-28),
  },
  {
    id: 'QLM-04',
    text: 'Rekod itu berstatus berkonflik: kadar RM0.45/km datang daripada pekeliling lama dan cadangan baharu (RM0.58/km) masih menunggu pengesahan. Saya mencadangkan pengesahan manual sebelum anda merujuk kadar tersebut.',
    author: 'Quellight',
    participant: 'assistant',
    createdAt: iso(-27),
  },
  {
    id: 'QLM-05',
    text: 'Boleh simpan jawapan itu sebagai pengetahuan tahan lasak?',
    author: 'You',
    participant: 'user',
    createdAt: iso(-26),
  },
  {
    id: 'QLM-06',
    text: 'Cadangan telah direkodkan dalam dunia bersama: Kemas Kini Kadar Perjalanan (status menunggu). Anda boleh menyemaknya di tab Perubahan Dunia.',
    author: 'Quellight',
    participant: 'assistant',
    createdAt: iso(-25),
  },
];

const workflowInstancesSeed: Record<string, unknown>[] = [
  {
    id: 'WF-1041',
    title: 'Kelulusan bajet perbaharui lesen tahunan',
    stage: 'draft',
    owner: 'Hafiz Rahman',
    department: 'Pentadbiran',
    dueDate: '2026-10-08',
    progress: 10,
    blocked: false,
  },
  {
    id: 'WF-1042',
    title: 'Perolehan papan pemuka analitik wilayah',
    stage: 'review',
    owner: 'Tan Mei Ling',
    department: 'Perancangan',
    dueDate: '2026-10-01',
    progress: 35,
    blocked: false,
  },
  {
    id: 'WF-1043',
    title: 'Pelantikan penyemak luar audit keselamatan',
    stage: 'approval',
    owner: 'Aina Sofea',
    department: 'Perlindungan Data',
    dueDate: '2026-09-30',
    progress: 55,
    blocked: false,
  },
  {
    id: 'WF-1044',
    title: 'Pembaharuan lesen perisian pangkalan data',
    stage: 'approval',
    owner: 'Raj Kumar',
    department: 'IT',
    dueDate: '2026-10-05',
    progress: 60,
    blocked: false,
  },
  {
    id: 'WF-1045',
    title: 'Pelaksanaan kemas kini polisi akses',
    stage: 'execution',
    owner: 'Suria Anak Empiang',
    department: 'IT',
    dueDate: '2026-10-09',
    progress: 75,
    blocked: false,
  },
  {
    id: 'WF-1046',
    title: 'Verifikasi kembangan invois suku ketiga',
    stage: 'verification',
    owner: 'Hafiz Rahman',
    department: 'Kewangan',
    dueDate: '2026-10-12',
    progress: 90,
    blocked: false,
  },
  {
    id: 'WF-1047',
    title: 'Semakan pematuhan eksport data demo',
    stage: 'review',
    owner: 'Aina Sofea',
    department: 'Perlindungan Data',
    dueDate: '2026-10-14',
    progress: 30,
    blocked: true,
  },
  {
    id: 'WF-1048',
    title: 'Pengesahan senarai semak keselamatan tapak',
    stage: 'draft',
    owner: 'Adrian Lee',
    department: 'Operasi',
    dueDate: '2026-10-20',
    progress: 5,
    blocked: false,
  },
];

const workflowEventsSeed: Record<string, unknown>[] = [
  {
    id: 'WFE-01',
    instanceId: 'WF-1043',
    stage: 'draft',
    actor: 'Aina Sofea',
    note: 'Draf disediakan dengan lampiran penilaian risiko.',
    at: iso(-600),
  },
  {
    id: 'WFE-02',
    instanceId: 'WF-1043',
    stage: 'review',
    actor: 'Tan Mei Ling',
    note: 'Semakan teknikal selesai; dua pembetulan kecil diminta.',
    at: iso(-300),
  },
  {
    id: 'WFE-03',
    instanceId: 'WF-1043',
    stage: 'review',
    actor: 'Aina Sofea',
    note: 'Pembetulan dimasukkan semula.',
    at: iso(-150),
  },
  {
    id: 'WFE-04',
    instanceId: 'WF-1044',
    stage: 'draft',
    actor: 'Raj Kumar',
    note: 'Sebut harga lesennya dilampirkan.',
    at: iso(-800),
  },
  {
    id: 'WFE-05',
    instanceId: 'WF-1044',
    stage: 'approval',
    actor: 'Pn. Rosnah',
    note: 'Diteruskan ke jawatankuasa kelulusan.',
    at: iso(-200),
  },
  {
    id: 'WFE-06',
    instanceId: 'WF-1045',
    stage: 'execution',
    actor: 'Adrian Chong',
    note: 'Rollout peringkat bermula untuk 40 pengguna pertama.',
    at: iso(-90),
  },
  {
    id: 'WFE-07',
    instanceId: 'WF-1046',
    stage: 'verification',
    actor: 'Hafiz Rahman',
    note: 'Sampel 50 invois disemak tanpa pengecualian.',
    at: iso(-40),
  },
  {
    id: 'WFE-08',
    instanceId: 'WF-1047',
    stage: 'review',
    actor: 'Tan Mei Ling',
    note: 'Ditangguhkan: eksport demo perlu penyelarasan medan peribadi.',
    at: iso(-20),
  },
];

const kpiSeed: Record<string, unknown>[] = [
  {
    id: 'KPI-01',
    label: 'Hasil kutipan yuran perkhidmatan',
    value: 18_442_310,
    unit: 'RM',
    deltaPct: 4.2,
    segment: 'Semua',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-02',
    label: 'Indeks keyakinan pengguna',
    value: 72.4,
    unit: 'poin',
    deltaPct: -1.8,
    segment: 'Semua',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-03',
    label: 'Masa tindak balas pentadbiran',
    value: 3.6,
    unit: 'jam',
    deltaPct: -12.5,
    segment: 'Semua',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-04',
    label: 'Kadar resolusi pertama',
    value: 86.1,
    unit: '%',
    deltaPct: 2.4,
    segment: 'Portal',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-05',
    label: 'Pendaftaran akaun baharu',
    value: 12_884,
    unit: 'akaun',
    deltaPct: 9.6,
    segment: 'Portal',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-06',
    label: 'Penerimaan subsidi disalurkan',
    value: 241_500_000,
    unit: 'RM',
    deltaPct: 0.8,
    segment: 'Sokongan',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-07',
    label: 'Keputusan rayaban tertunggak',
    value: 148,
    unit: 'kes',
    deltaPct: -6.2,
    segment: 'Kaunter',
    quarter: 'Q2 2026',
  },
  {
    id: 'KPI-08',
    label: 'Kepuasan warga korporat',
    value: 4.3,
    unit: '/5',
    deltaPct: 1.1,
    segment: 'Korporat',
    quarter: 'Q2 2026',
  },
];

const dealsSeed: Record<string, unknown>[] = [
  {
    id: 'DLR-201',
    account: 'Air Selangor Sdn Bhd',
    region: 'Central',
    value: 845_000,
    stage: 'negotiation',
    closeDate: '2026-10-15',
    owner: 'Adrian Chong',
  },
  {
    id: 'DLR-202',
    account: 'Perbadanan Kemajuan Negeri Selangor',
    region: 'Central',
    value: 1_250_000,
    stage: 'proposal',
    closeDate: '2026-11-02',
    owner: 'Farah Nadhirah',
  },
  {
    id: 'DLR-203',
    account: 'TNB Distribution Sdn Bhd',
    region: 'Central',
    value: 964_300,
    stage: 'close_won',
    closeDate: '2026-09-12',
    owner: 'Wen Ling Chua',
  },
  {
    id: 'DLR-204',
    account: 'Pihak Berkuasa Pelabuhan Pulau Pinang',
    region: 'Northern',
    value: 512_800,
    stage: 'proposal',
    closeDate: '2026-10-28',
    owner: 'Adil Hakim',
  },
  {
    id: 'DLR-205',
    account: 'Lembaga Kemajuan Wilayah Kedah',
    region: 'Northern',
    value: 187_450,
    stage: 'prospecting',
    closeDate: '2026-12-01',
    owner: 'Farah Nadhirah',
  },
  {
    id: 'DLR-206',
    account: 'Johor Corporation',
    region: 'Southern',
    value: 733_110,
    stage: 'negotiation',
    closeDate: '2026-10-20',
    owner: 'Wen Ling Chua',
  },
  {
    id: 'DLR-207',
    account: 'Lembaga Getah Johor',
    region: 'Southern',
    value: 98_700,
    stage: 'close_lost',
    closeDate: '2026-09-02',
    owner: 'Raj Kumar',
  },
  {
    id: 'DLR-208',
    account: 'Kumpulan Wang Amanah Pencen Sabah',
    region: 'Eastern',
    value: 1_020_000,
    stage: 'negotiation',
    closeDate: '2026-11-11',
    owner: 'Adil Hakim',
  },
  {
    id: 'DLR-214',
    account: 'Yayasan Hasanah Kuching',
    region: 'Eastern',
    value: 245_600,
    stage: 'proposal',
    closeDate: '2026-11-25',
    owner: 'Suria Anak Empiang',
  },
  {
    id: 'DLR-209',
    account: 'Sarawak Energy Berhad',
    region: 'Eastern',
    value: 1_480_200,
    stage: 'close_won',
    closeDate: '2026-08-29',
    owner: 'Adrian Chong',
  },
  {
    id: 'DLR-210',
    account: 'Perbadanan Putrajaya',
    region: 'Central',
    value: 402_150,
    stage: 'prospecting',
    closeDate: '2026-12-15',
    owner: 'Farah Nadhirah',
  },
  {
    id: 'DLR-211',
    account: 'Cyberjaya Hosting Hub',
    region: 'Central',
    value: 168_900,
    stage: 'negotiation',
    closeDate: '2026-10-30',
    owner: 'Raj Kumar',
  },
  {
    id: 'DLR-212',
    account: 'Melaka Water Authority',
    region: 'Southern',
    value: 275_400,
    stage: 'proposal',
    closeDate: '2026-11-18',
    owner: 'Wen Ling Chua',
  },
  {
    id: 'DLR-213',
    account: 'Kuala Terengganu Port Cluster',
    region: 'Eastern',
    value: 356_750,
    stage: 'prospecting',
    closeDate: '2026-12-08',
    owner: 'Suria Anak Empiang',
  },
];

const galleryMessagesSeed: Record<string, unknown>[] = [
  {
    id: 'GALM-01',
    text: 'Hai! Boleh terangkan apa yang paparan ini tunjukkan?',
    author: 'You',
    participant: 'user',
    createdAt: iso(-10),
  },
  {
    id: 'GALM-02',
    text: 'Paparan ini ialah galeri komponen VICT: setiap tab mempamerkan satu keupayaan pembentangan sebenar daripada penerima Svelte kekal — teks, jadual, borang, tindakan, status, tab, lapisan atas (dialog/drawer), carta, perbualan, slot komponen tersuai dan keadaan aplikasi. Tiada gaya khusus demo ditambah; semua yang anda lihat datang daripada pakej VICT itu sendiri.',
    author: 'Assistant',
    participant: 'assistant',
    createdAt: iso(-9),
  },
  {
    id: 'GALM-03',
    text: 'Nota panjang untuk ujian pembalikan: panel perbualan perlu kekal boleh digunakan apabila mesej sangat panjang, termasuk perenggan berturut-turut tanpa jarak, senarai istilah teknikal seperti renderer.svelte-kit@5.0.0, ApplicationVersion v1_hash-of-canonical-manifest, serta baris yang mengandungi nombor besar 1_250_000 dan nilai perpuluhan 0.6842. Perhatikan bagaimana pembungkusan teks, ketinggian feed dan tingkah laku tatal berkelakuan apabila kandungan ini dipaparkan.',
    author: 'Assistant',
    participant: 'assistant',
    createdAt: iso(-8),
  },
  {
    id: 'GALM-04',
    text: 'Terima kasih — maklum balas direkodkan.',
    author: 'You',
    participant: 'user',
    createdAt: iso(-7),
  },
];

const galleryChartZeroSeed: Record<string, unknown>[] = [];

const galleryChartOneSeed: Record<string, unknown>[] = [
  { id: 'PT-1', label: 'Titik tunggal', value: 42 },
];

const galleryChartWideSeed: Record<string, unknown>[] = Array.from({ length: 24 }, (_, index) => ({
  id: `GCW-${String(index + 1).padStart(2, '0')}`,
  label: `Hari ${String(index + 1).padStart(2, '0')}`,
  value: Math.round((Math.sin(index * 0.55) * 40 + 60) * 10) / 10,
}));

const galleryChartMixedSeed: Record<string, unknown>[] = [
  {
    id: 'GCM-1',
    label: 'Kategori panjang: Perkhidmatan Penjagaan Kesihatan Bersatu Sabah',
    value: -3.2,
  },
  { id: 'GCM-2', label: 'Sifar pertama', value: 0 },
  { id: 'GCM-3', label: 'Nilai besar', value: 1_250_000 },
  { id: 'GCM-4', label: 'Sifar kedua', value: 0 },
  { id: 'GCM-5', label: 'Negatif', value: -18.75 },
  { id: 'GCM-6', label: 'Perpuluhan', value: 0.125 },
  { id: 'GCM-7', label: 'Biasa', value: 320 },
  { id: 'GCM-8', label: 'Sifar ketiga', value: 0 },
];

/** Deterministic stress rows: 110 rows × 29 columns, index-derived (no RNG).
 * Column TYPE catalogue (mirrored by the writer below):
 * - number: c % 9 === 4 (c04,c13,c22) and c % 6 === 0 (c06,c12,c18,c24)
 * - boolean: c % 11 === 9 (c09,c20)
 * - empty strings by design: c10, c25
 * - long Bahasa Malaysia paragraphs: c07, c17, c27 (odd rows only)
 */
const stressRowsSeed: Record<string, unknown>[] = Array.from({ length: 110 }, (_, index) => {
  const n = index + 1;
  const row: Record<string, unknown> = {
    id: `STRESS-9F2A7C61E4B0D3A8-LONG-UNBROKEN-ID-${String(n).padStart(6, '0')}`,
  };
  for (let c = 1; c <= 29; c += 1) {
    const name = `c${String(c).padStart(2, '0')}`;
    if (c === 10 || c === 25) {
      row[name] = ''; // empty strings by design
      continue;
    }
    if (c === 7 || c === 17 || c === 27) {
      row[name] =
        n % 2 === 1
          ? 'Ayat panjang Bahasa Malaysia yang sengaja tidak dipendekkan bagi menguji pembungkusan teks, keterbacaan lajur yang sempit dan gelagat pemotongan apabila ruang lajur terhad di dalam jadual padat yang berisi banyak rekod.'
          : `Kandungan rekod nombor ${n} untuk turutan keadaan stres.`;
      continue;
    }
    if (c % 9 === 4) {
      row[name] = Math.round((((n * c) % 1000) / (c % 3 === 0 ? 100 : 1)) * 100) / 100 - (c % 5);
      continue;
    }
    if (c % 6 === 0) {
      row[name] = (n % 10) * 1_000_000_000 + c;
      continue;
    }
    if (c % 11 === 9) {
      row[name] = (n * c) % 2 === 0;
      continue;
    }
    row[name] = `${n}-${c}-sel`;
  }
  return row;
});

const stressMessagesSeed: Record<string, unknown>[] = Array.from({ length: 55 }, (_, index) => {
  const n = index + 1;
  const mine = n % 3 !== 0;
  return {
    id: `STRM-${String(n).padStart(3, '0')}`,
    text:
      n % 7 === 0
        ? `Mesej nombor ${n} dengan ayat panjang: urusan pemprosesan giliran kerja berlaku di sebalik tabir apabila pelaksana memeriksa rujukan silang antara rekod invois, senarai semak pematuhan dan kedudukan giliran semasa, dan setiap langkah direkodkan dalam log peristiwa yang boleh diaudit semula oleh pengguna pentadbiran apabila diperlukan.`
        : mine
          ? `Arahan ujian ${n}: semak giliran kerja dan laporkan.`
          : `Laporan ${n}: giliran kerja selesai dalam ${((n * 13) % 40) + 2} saat; ${((n * 7) % 9) + 1} fail disentuh.`,
    author: mine ? 'You' : 'Agent',
    participant: mine ? 'user' : 'assistant',
    createdAt: iso(index - 55),
  };
});

/* ------------------------------------------------------------------ */
/* Scenario modules (declared below in ./scenarios modules)            */
/* ------------------------------------------------------------------ */

export interface ScenarioDefinition {
  readonly routes: readonly ApplicationDefinition['routes'][number][];
  readonly screens: readonly ApplicationDefinition['screens'][number][];
  readonly views: readonly NonNullable<ApplicationDefinition['views']>[number][];
  readonly forms: readonly NonNullable<ApplicationDefinition['forms']>[number][];
  readonly actions: readonly ApplicationDefinition['actions'][number][];
}

import type { ApplicationDefinition } from '@victframework/sdk';

/* ------------------------------------------------------------------ */
/* Application definition assembly                                     */
/* ------------------------------------------------------------------ */

export const allResources = [
  ticketResource,
  instrumentResource,
  signalResource,
  instrumentSeriesResource,
  agentSessionResource,
  agentFileResource,
  agentMessageResource,
  worldEntryResource,
  worldChangeResource,
  quellightMessageResource,
  workflowInstanceResource,
  workflowEventResource,
  kpiResource,
  dealResource,
  galleryMessageResource,
  emptyInboxResource,
  gallerySubmissionResource,
  stressMessageResource,
  galleryChartZeroResource,
  galleryChartOneResource,
  galleryChartWideResource,
  galleryChartMixedResource,
  demoResource,
];

export const registryContracts = [
  { id: 'showcase.ticket.input', revision: '1' },
  { id: 'showcase.message.input', revision: '1' },
  { id: 'showcase.gallery.input', revision: '1' },
  { id: 'showcase.demo.input', revision: '1' },
  { id: 'showcase.stress.input', revision: '1' },
  { id: 'showcase.reply.output', revision: '1' },
] as const;

/** The contracts bound to the data adapter (mutation validation). */
export const dataContracts = [
  ticketInputContract,
  messageInputContract,
  galleryInputContract,
  demoInputContract,
  stressInputContract,
];

export const workloadResources = {
  tickets: ticketResource,
  instruments: instrumentResource,
  signals: signalResource,
  instrumentSeries: instrumentSeriesResource,
  agentSessions: agentSessionResource,
  agentFiles: agentFileResource,
  agentMessages: agentMessageResource,
  worldEntries: worldEntryResource,
  worldChanges: worldChangeResource,
  quellightMessages: quellightMessageResource,
  workflowInstances: workflowInstanceResource,
  workflowEvents: workflowEventResource,
  kpi: kpiResource,
  deals: dealResource,
  galleryMessages: galleryMessageResource,
  emptyInbox: emptyInboxResource,
  gallerySubmissions: gallerySubmissionResource,
  stressRows: stressRowResource,
  stressMessages: stressMessageResource,
  galleryChartZero: galleryChartZeroResource,
  galleryChartOne: galleryChartOneResource,
  galleryChartWide: galleryChartWideResource,
  galleryChartMixed: galleryChartMixedResource,
  demo: demoResource,
};

/** Deterministic seeds per resource id. */
export const seeds: Record<string, readonly Record<string, unknown>[]> = {
  tickets: ticketsSeed,
  instruments: instrumentsSeed,
  signals: signalsSeed,
  instrumentSeries: instrumentSeriesSeed,
  agentSessions: agentSessionsSeed,
  agentFiles: agentFilesSeed,
  agentMessages: agentMessagesSeed,
  worldEntries: worldEntriesSeed,
  worldChanges: worldChangesSeed,
  quellightMessages: quellightMessagesSeed,
  workflowInstances: workflowInstancesSeed,
  workflowEvents: workflowEventsSeed,
  kpi: kpiSeed,
  deals: dealsSeed,
  galleryMessages: galleryMessagesSeed,
  emptyInbox: [],
  gallerySubmissions: [],
  stressRows: stressRowsSeed,
  stressMessages: stressMessagesSeed,
  galleryChartZero: galleryChartZeroSeed,
  galleryChartOne: galleryChartOneSeed,
  galleryChartWide: galleryChartWideSeed,
  galleryChartMixed: galleryChartMixedSeed,
  demo: [],
};

export const resourceList = Object.values(workloadResources);

/* Scenario modules are imported and assembled in definition.ts (kept
 * separate so this data module stays storage/domain-only). */
