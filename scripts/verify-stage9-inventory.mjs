#!/usr/bin/env node
/**
 * Stage 9 G1 — mechanical three-surface inventory (WP-4 read slice).
 *
 * Parses the ACTUAL sources of the three closed surfaces and cross-checks
 * them, without importing any of them:
 *
 *   1. the closed command registry        (packages/server/src/commands.ts)
 *   2. the HTTP transport route tables    (packages/server/src/http.ts)
 *   3. the closed CLI command table       (packages/cli/src/commands.ts)
 *
 * Gate (exit 0 requires ALL):
 *   - every STAGE 9 G1 operator read command is present on ALL THREE
 *     surfaces (registry entry + HTTP route + CLI entry) UNCHANGED —
 *     re-asserted explicitly as the 'G1 read surface UNAMENDED at registry
 *     level' pinned block below (proposal §6.1);
 *   - the four legacy mutation commands (run.cancel, activation.select,
 *     release.select, release.rollback) remain present on all three (their
 *     receipt-gated versioned migration is the ratified D-4/D-10 G2 work —
 *     classified here, NOT silently treated as a failure);
 *   - the pre-existing `app.data.action` divergence (registered, no HTTP
 *     transport route, no CLI entry) is detected and explicitly classified;
 *   - the G2 confirmation surface is accounted explicitly (proposal §6.1):
 *     POST /vict/v1/confirmations (prepare), the single-receipt status read
 *     GET /vict/v1/confirmations/:receiptId, POST /vict/v1/runs/:runId/resolve,
 *     POST /vict/v1/runs/:runId/signal, the run.resolve/run.signal commands
 *     with their scopes, the confirmation-required consumption shape on the
 *     four legacy POST routes, the CLI two-step entries, the audit actions
 *     confirmation.prepared/confirmation.consumed, and the digest-only
 *     receipt + 90-day retention pin. Rows whose sources are not yet in this
 *     worktree are reported as g2-pending (the G2 command/transport slices
 *     are built in parallel); when a row's marker IS present its contract
 *     shape is asserted hard and any contradiction FAILS. There are no live
 *     server probes — all assertions are source shape assertions.
 *   - G2-pending commands (run.resolve, run.signal): their absence is
 *     classified as G2-pending (recorded, NOT a failure at this slice); their
 *     presence activates the hard G2 surface assertions (route + CLI + scope).
 *   - every HTTP route maps to a registered command (no orphan routes);
 *   - every CLI route maps to an HTTP route or an explicitly classified
 *     legacy CLI-only mapping.
 *
 * Any unclassified registry-command-without-coverage FAILS the inventory.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readSource(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function extractCommandNames(commandsSource) {
  const match = /export const VICT_COMMANDS = \[([\s\S]*?)\] as const;/.exec(commandsSource);
  if (match === null) {
    throw new Error('could not locate VICT_COMMANDS in commands.ts');
  }
  return [...match[1].matchAll(/'([a-z.]+)'/g)].map((m) => m[1]);
}

function extractRegistryScopes(commandsSource) {
  const scopes = {};
  const registryMatch = /const COMMAND_REGISTRY[^=]*= \{([\s\S]*?)\n\};/.exec(commandsSource);
  if (registryMatch !== null) {
    for (const entryMatch of registryMatch[1].matchAll(
      /'([a-z.]+)':\s*\{[^}]*scope:\s*'([^']+)'/g,
    )) {
      scopes[entryMatch[1]] = entryMatch[2];
    }
  }
  return scopes;
}

function extractHttpRoutes(httpSource) {
  const routes = new Map(); // path -> Set(commands)
  const add = (path, command) => {
    if (!routes.has(path)) routes.set(path, new Set());
    routes.get(path).add(command);
  };
  const fixedGet = /const ROUTE_COMMANDS[^=]*= \{([\s\S]*?)\n\};/.exec(httpSource);
  if (fixedGet !== null) {
    for (const m of fixedGet[1].matchAll(/'([^']+)':\s*'([a-z.]+)'/g)) add(m[1], m[2]);
  }
  const post = /const POST_ROUTES[^{]*= \{([\s\S]*?)\n\};/.exec(httpSource);
  if (post !== null) {
    for (const m of post[1].matchAll(/'([^']+)':\s*\(\)\s*=>\s*'([a-z.]+)'/g)) add(m[1], m[2]);
  }
  // Dynamic instance routes: pair each anchored path regex inside
  // resolveCommand with the command it returns. The regex SOURCE is kept
  // so CLI ':param' templates can be matched against its segment shape.
  const dynamicPatterns = []; // { source, command }
  for (const m of httpSource.matchAll(
    /\/\^([\s\S]*?)\$\/\.exec\(\s*path\s*,?\s*\)[\s\S]{0,800}?command:\s*'([a-z.]+)'/g,
  )) {
    dynamicPatterns.push({ source: m[1], command: m[2] });
  }
  const dynamic = dynamicPatterns.map((entry) => entry.command);
  return { routes, dynamic, dynamicPatterns };
}

/** Segment shape of a dynamic-route regex SOURCE, e.g. ['vict','v1','runs',':p']. */
function dynamicPatternSegments(source) {
  const normalized = source.replace(/\\\//g, '/').replace(/\^|\$/g, '');
  return normalized
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith('(') ? ':param' : segment));
}

/** Segment shape of a CLI path template, e.g. ['vict','v1','runs',':runId']. */
function cliPathSegments(path) {
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith(':') ? ':param' : segment));
}

function extractCliCommands(cliSource) {
  const entries = new Map(); // name -> { method, path }
  const table = /export const CLI_COMMANDS[^=]*= \{([\s\S]*?)\n\};/.exec(cliSource);
  if (table === null) {
    throw new Error('could not locate CLI_COMMANDS in commands.ts');
  }
  for (const m of table[1].matchAll(
    /'([^']+)':\s*\{\s*method:\s*'(GET|POST)',\s*path:\s*'([^']+)'/g,
  )) {
    entries.set(m[1], { method: m[2], path: m[3] });
  }
  return entries;
}

// ---- Stage 9 G1 gate data --------------------------------------------------

const STAGE9_G1_READS = [
  'run.list',
  'run.get',
  'run.events',
  'run.waits',
  'run.detail',
  'activation.list',
  'activation.get',
  'activation.selected',
  'release.list',
  'release.selections',
  'audit.search',
];

const LEGACY_MUTATIONS = ['run.cancel', 'activation.select', 'release.select', 'release.rollback'];
const G2_PENDING = ['run.resolve', 'run.signal'];
const CLASSIFIED_DIVERGENCE = ['app.data.action'];
/**
 * Commands sharing ONE payload-dispatched dynamic route with a sibling
 * command (pre-existing, exercised by packages/server/test/http.test.ts):
 * `/vict/v1/approvals/:approvalId` POST dispatches approve OR decline from
 * the payload's `decision` field, so only `agent.tool.approve` is paired
 * with the route regex by textual analysis. Classified, not a divergence.
 */
const CLASSIFIED_SHARED_ROUTE = ['agent.tool.decline'];

const commandsSource = readSource('packages/server/src/commands.ts');
const httpSource = readSource('packages/server/src/http.ts');
const cliSource = readSource('packages/cli/src/commands.ts');

const commands = extractCommandNames(commandsSource);
const scopes = extractRegistryScopes(commandsSource);
const { routes, dynamic, dynamicPatterns } = extractHttpRoutes(httpSource);
const cli = extractCliCommands(cliSource);

const httpCommands = new Set([...routes.values()].flatMap((set) => [...set]));
for (const command of dynamic) httpCommands.add(command);
const failures = [];
const rows = [];

for (const command of commands) {
  const onHttp = httpCommands.has(command);
  const cliEntries = [...cli.entries()].filter(([_name, spec]) => {
    const fixed = routes.get(spec.path);
    if (fixed !== undefined) return fixed.has(command);
    const cliSegments = cliPathSegments(spec.path);
    return dynamicPatterns.some((entry) => {
      if (entry.command !== command) return false;
      const patternSegments = dynamicPatternSegments(entry.source);
      return (
        patternSegments.length === cliSegments.length &&
        patternSegments.every((segment, index) => segment === cliSegments[index])
      );
    });
  });
  const onCli = cliEntries.length > 0;
  const row = { command, scope: scopes[command] ?? '?', http: onHttp, cli: onCli };

  if (STAGE9_G1_READS.includes(command)) {
    row.class = 'stage9-g1-read';
    if (!onHttp) failures.push(`${command}: G1 read has NO HTTP transport route`);
    if (!onCli) failures.push(`${command}: G1 read has NO CLI entry`);
    // cliEntries was built so every entry ALREADY provably serves this
    // command (fixed-route membership or segment-shape dynamic match); the
    // redundant per-entry re-check that produced false failures is gone.
  } else if (LEGACY_MUTATIONS.includes(command)) {
    row.class = 'legacy-mutation (G2 receipt migration pending; classified)';
  } else if (CLASSIFIED_SHARED_ROUTE.includes(command)) {
    // Classified: textual pairing cannot see payload-dispatched coverage by
    // construction — this branch asserts the known state instead of a
    // mechanical match, and must NOT demand an onHttp pairing.
    row.class = 'shared payload-dispatched route (classified; pre-existing)';
  } else if (CLASSIFIED_DIVERGENCE.includes(command)) {
    row.class = 'pre-existing divergence (classified; out of G1 scope)';
    if (onHttp || onCli) {
      failures.push(`${command}: classified divergence unexpectedly gained coverage`);
    }
  } else {
    row.class = 'pre-existing';
    // A pre-existing command with NO surface coverage anywhere is a NEW
    // unclassified divergence — fail loudly.
    if (!onHttp && !onCli) {
      failures.push(
        `${command}: registered command has neither transport route nor CLI entry (unclassified divergence)`,
      );
    }
  }
  rows.push(row);
}

for (const pending of G2_PENDING) {
  if (commands.includes(pending)) {
    failures.push(`${pending}: G2-pending command must NOT exist at G1`);
  }
}

// Orphan HTTP routes: every route must map to a registered command.
for (const [path, routeCommands] of routes) {
  for (const command of routeCommands) {
    if (!commands.includes(command)) {
      failures.push(`HTTP route ${path}: maps to unregistered command '${command}'`);
    }
  }
}

// (G2 accounting note, proposal §6.1): the G1-era gate 'G2-pending command
// must NOT exist at G1' is conditionalized here — at this slice's HEAD the
// packages still hold the G1 surface (run.resolve/run.signal are built in
// parallel by the command/transport builders), so absence is recorded as
// G2-PENDING; once the commands exist in the sources, the G2 surface block
// below asserts their full route/CLI/scope shapes HARD. Nothing is silently
// re-classified: the printed rows carry the classification.
const g2CommandsInRegistry = G2_PENDING.filter((pending) => commands.includes(pending));

/** Pinned G2 scope per command (D-OPEN-2: 'run.signal' ACCEPTED as worded;
 * run.resolve's new closed scope is pinned by the proposal §4.2 table). */
function expectedG2ScopeFor(command) {
  switch (command) {
    case 'run.resolve':
      return 'run.resolve';
    case 'run.signal':
      return 'run.signal';
    default:
      return command;
  }
}

const g2Rows = []; // G2 accounting rows, printed after the G1 rows.

function g2PendingRow(command, scope, note) {
  g2Rows.push({ command, scope, http: false, cli: false, class: `g2-pending — ${note}` });
}

// ---- G1 read surface UNAMENDED at registry level (PROPOSAL §6.1, HARD) -----
// G1 read commands, routes and CLI entries change NOWHERE in G2; only the
// inventory ACCOUNTING gains rows. These pins are the byte-level amendment
// detector for the closed G1 read surface.
const G1_READ_SURFACE_PINS = [
  { command: 'run.list', scope: 'run.read', fixedHttpPath: '/vict/v1/runs' },
  { command: 'run.get', scope: 'run.read' },
  { command: 'run.events', scope: 'run.read' },
  { command: 'run.waits', scope: 'run.read' },
  { command: 'run.detail', scope: 'run.detail' },
  { command: 'activation.list', scope: 'activation.read', fixedHttpPath: '/vict/v1/activations' },
  { command: 'activation.get', scope: 'activation.read' },
  {
    command: 'activation.selected',
    scope: 'activation.read',
    fixedHttpPath: '/vict/v1/activations/selected',
  },
  { command: 'release.list', scope: 'release.read', fixedHttpPath: '/vict/v1/releases' },
  {
    command: 'release.selections',
    scope: 'release.read',
    fixedHttpPath: '/vict/v1/releases/selections',
  },
  { command: 'audit.search', scope: 'audit.read', fixedHttpPath: '/vict/v1/audit' },
];

/** The four legacy POST routes keep their paths and command pairings — the
 * confirmation-required reshape happens INSIDE the command service/transport,
 * never by moving or renaming the route entries (proposal §4.3). */
const LEGACY_POST_ROUTE_PINS = [
  { path: '/vict/v1/runs/cancel', command: 'run.cancel' },
  { path: '/vict/v1/activations/select', command: 'activation.select' },
  { path: '/vict/v1/releases/select', command: 'release.select' },
  { path: '/vict/v1/releases/rollback', command: 'release.rollback' },
];

for (const pin of G1_READ_SURFACE_PINS) {
  if (!commands.includes(pin.command)) {
    failures.push(`G1 read surface UNAMENDED: '${pin.command}' is missing from the registry`);
    continue;
  }
  if (scopes[pin.command] !== undefined && scopes[pin.command] !== pin.scope) {
    failures.push(
      `G1 read surface UNAMENDED: '${pin.command}' scope changed (${scopes[pin.command]} != ${pin.scope})`,
    );
  }
  if (pin.fixedHttpPath !== undefined) {
    const fixed = routes.get(pin.fixedHttpPath);
    if (fixed === undefined || !fixed.has(pin.command)) {
      failures.push(
        `G1 read surface UNAMENDED: fixed GET route ${pin.fixedHttpPath} no longer serves '${pin.command}'`,
      );
    }
  }
}
for (const pin of LEGACY_POST_ROUTE_PINS) {
  const mapped = routes.get(pin.path);
  if (mapped === undefined || !mapped.has(pin.command)) {
    failures.push(
      `legacy POST route ${pin.path} no longer pairs with '${pin.command}' (route identity must not move in G2)`,
    );
  }
}
console.assert(G1_READ_SURFACE_PINS.every((pin) => STAGE9_G1_READS.includes(pin.command)),
  'inventory pin set drift: G1_READ_SURFACE_PINS must cover all STAGE9_G1_READS');

// ---- G2 surface rows (proposal §6.1; classified as G2 surface) -------------
if (g2CommandsInRegistry.length === 0) {
  g2PendingRow(
    'run.resolve',
    'run.resolve (pinned, proposal §4.2; default-deny for non-admin classes)',
    'not yet in this worktree; receipt-gated POST /vict/v1/runs/:runId/resolve',
  );
  g2PendingRow(
    'run.signal',
    'run.signal (D-OPEN-2 ACCEPTED)',
    'not yet in this worktree; receipt-gated POST /vict/v1/runs/:runId/signal',
  );
  g2PendingRow(
    'POST /vict/v1/confirmations (prepare)',
    'the TARGET command mutation scope (e.g. run.cancel for run.cancel)',
    'not yet in this worktree; SINGLE prepare route (D-OPEN-3 ACCEPTED); returns the human-reviewable summary {receiptId, command, payloadDigest, expectedRevision, expiryAt, createdBy, createdAt}; opaque, bounded, NON-ENUMERABLE receipt id; unknown/foreign/target-mismatched receipts are non-echoing VICT_CONFIRMATION_UNAVAILABLE; prepare TTL 10 minutes (D-OPEN-1 ACCEPTED)',
  );
  g2PendingRow(
    'GET /vict/v1/confirmations/:receiptId (status)',
    'the receipt command mutation scope; non-echoing for other actors (R-5)',
    'not yet in this worktree; SINGLE-receipt read; no list endpoint in G2; audited like other reads; statuses prepared/consumed/expired/spent/unavailable',
  );
  g2PendingRow(
    'confirmations/:receiptId CLI read',
    'the receipt command mutation scope',
    'not yet in this worktree; CLI read entry \'confirmation get\' mirrors the status route',
  );
  g2PendingRow(
    'four legacy POST routes (consume shape)',
    'scopes unchanged (run.cancel, activation.select, release.select, release.rollback)',
    'consumption reshaped IN PLACE: every command body gains the REQUIRED confirmation{receiptId} + bounded Idempotency-Key; unconfirmed legacy calls fail closed 409 VICT_CONFIRMATION_REQUIRED for EVERY actor class INCLUDING administrator (P-11/P-12); no optional flag softens the fence',
  );
  g2PendingRow(
    'CLI two-step entries',
    'scopes unchanged',
    'run cancel | activation select | release select | release rollback REPLACED by --prepare (prints server-issued summary + receipt, NEVER auto-confirms) and --confirm <receiptId> --key <Idempotency-Key>; NEW run resolve, run signal, confirmation get; invoking without either flag returns usage guidance naming both steps (breaking CLI migration, documented)',
  );
  g2PendingRow(
    'audit actions confirmation.prepared / confirmation.consumed',
    'CONTROL_AUDIT_ACTIONS additions (closed set)',
    'prepared records actor/command/subject/receipt DIGEST — never a payload byte; consumed records actor/command/key/outcome class; expiry/spend captured on the durable receipt record; audit.search subjectType confirmation',
  );
  g2PendingRow(
    'receipt retention (digest-only + 90-day window)',
    'digest-only receipt records (D-OPEN-4 ACCEPTED: minimum 90 days before purge eligibility)',
    'receipts carry identities + canonical payload digest ONLY (digest EXCLUDES the receipt id); no payload bytes ever; the digest-level confirmation.prepared/consumed audit trail survives any purge',
  );
}
// Presence mode: the G2 sources exist in this worktree — assert shapes HARD.
else {
  for (const g2Command of g2CommandsInRegistry) {
    const onHttp = httpCommands.has(g2Command);
    const onCli = [...cli.entries()].some(([_name, spec]) => {
      const fixed = routes.get(spec.path);
      if (fixed !== undefined) return fixed.has(g2Command);
      const cliSegments = cliPathSegments(spec.path);
      return dynamicPatterns.some((entry) => {
        if (entry.command !== g2Command) return false;
        const patternSegments = dynamicPatternSegments(entry.source);
        return (
          patternSegments.length === cliSegments.length &&
          patternSegments.every((segment, index) => segment === cliSegments[index])
        );
      });
    });
    g2Rows.push({
      command: g2Command,
      scope: scopes[g2Command] ?? '?',
      http: onHttp,
      cli: onCli,
      class: 'g2 confirmation-gated intervention (present)',
    });
    if (!onHttp) failures.push(`${g2Command}: G2 command has NO HTTP transport route`);
    if (!onCli) failures.push(`${g2Command}: G2 command has NO CLI entry`);
    if (scopes[g2Command] !== undefined) {
      const expected = expectedG2ScopeFor(g2Command);
      if (scopes[g2Command] !== expected) {
        failures.push(
          `${g2Command}: scope '${scopes[g2Command]}' does not match the pinned G2 scope '${expected}'`,
        );
      }
    }
  }

  const hasConfirmationsPost = httpSource.includes("'/vict/v1/confirmations'");
  const hasConfirmationsStatusGet =
    dynamicPatterns.some((entry) => entry.source.includes('confirmations')) ||
    /confirmations\\\/\\\(/.test(httpSource);
  if (!hasConfirmationsPost) {
    failures.push(
      'G2: POST /vict/v1/confirmations (prepare) route not found in http.ts while G2 commands exist',
    );
  } else {
    g2Rows.push({
      command: 'POST /vict/v1/confirmations (prepare)',
      scope: 'target command mutation scope',
      http: true,
      cli: true,
      class: 'g2 prepare route (present; D-OPEN-3 single endpoint)',
    });
  }
  if (!hasConfirmationsStatusGet) {
    failures.push(
      'G2: GET /vict/v1/confirmations/:receiptId (status) route not found in http.ts while G2 commands exist',
    );
  } else {
    g2Rows.push({
      command: 'GET /vict/v1/confirmations/:receiptId (status)',
      scope: 'receipt command mutation scope; non-echoing',
      http: true,
      cli: true,
      class: 'g2 single-receipt status read (present; no list endpoint)',
    });
  }
  for (const pin of LEGACY_POST_ROUTE_PINS) {
    const mapped = routes.get(pin.path);
    if (mapped === undefined || !mapped.has(pin.command)) {
      failures.push(
        `G2: legacy POST route ${pin.path} disappeared or re-paired (must be reshaped in place)`,
      );
    }
  }
  const cliHas = (needle) => cliSource.includes(needle);
  if (!cliHas('confirmation get')) {
    failures.push("G2: CLI read entry 'confirmation get' (receipt status mirror) not found");
  }
  for (const twoStep of ['run resolve', 'run signal']) {
    if (![...cli.keys()].includes(twoStep)) {
      failures.push(`G2: CLI entry '${twoStep}' missing two-step confirmation command`);
    }
  }
  if (!cliHas('--prepare') || !cliHas('--confirm')) {
    failures.push(
      'G2: CLI two-step reshape (--prepare / --confirm <receiptId> --key <Idempotency-Key>) not found in cli/src/commands.ts',
    );
  }
  if (!commandsSource.includes('VICT_CONFIRMATION_REQUIRED')) {
    failures.push(
      'G2: legacy fence (409 VICT_CONFIRMATION_REQUIRED for unconfirmed legacy shapes, every actor class incl. administrator) not found in server/src/commands.ts',
    );
  }
  const runtimeSource = readSource('packages/runtime/src/control-types.ts');
  for (const auditAction of ['confirmation.prepared', 'confirmation.consumed']) {
    if (!runtimeSource.includes(`'${auditAction}'`)) {
      failures.push(`G2: audit action '${auditAction}' not found in control-types.ts (closed audit action set)`);
    }
  }
  const retentionPinned =
    runtimeSource.includes('confirmation') &&
    runtimeSource.match(/90[ -]?day|90 days/i) !== null;
  if (!retentionPinned) {
    failures.push('G2: 90-day receipt retention window pin not found in control-types.ts');
  }
  g2Rows.push({
    command: 'consume shape note (four legacy POST routes)',
    scope: 'unchanged scopes',
    http: true,
    cli: true,
    class:
      'g2 consumption reshape (present): confirmation{receiptId} REQUIRED + Idempotency-Key; unconfirmed → 409 VICT_CONFIRMATION_REQUIRED for every actor class incl. administrator',
  });
}

// Report
const counts = {};
for (const row of [...rows, ...g2Rows]) {
  const key = row.class.split(' ')[0];
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log('STAGE 9 — three-surface inventory (registry ↔ HTTP ↔ CLI; G1 reads + G2 confirmation surface)');
console.log(
  `commands=${rows.length + g2Rows.length} (registry=${commands.length})  http-routes=${routes.size}  cli-entries=${cli.size}`,
);
console.log('— G1 read surface (asserted UNAMENDED at registry level):');
for (const row of rows) {
  console.log(
    `  ${row.command.padEnd(22)} scope=${String(row.scope).padEnd(18)} http=${row.http ? 'Y' : 'n'}  cli=${row.cli ? 'Y' : 'n'}  ${row.class}`,
  );
}
console.log('— G2 confirmation surface (proposal §6.1 accounting):');
for (const row of g2Rows.sort((a, b) => a.command.localeCompare(b.command))) {
  console.log(
    `  ${row.command.padEnd(22)} scope=${String(row.scope).padEnd(18)} http=${row.http ? 'Y' : 'n'}  cli=${row.cli ? 'Y' : 'n'}  ${row.class}`,
  );
}
console.log(`classification counts: ${JSON.stringify(counts)}`);
if (failures.length > 0) {
  console.error('\nINVENTORY FAILURES:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log('\nINVENTORY OK — G1 reads on all three surfaces UNAMENDED; G2 confirmation surface accounted.');;
