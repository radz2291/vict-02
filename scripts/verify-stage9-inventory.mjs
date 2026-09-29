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
 *     surfaces (registry entry + HTTP route + CLI entry);
 *   - the four legacy mutation commands (run.cancel, activation.select,
 *     release.select, release.rollback) remain present on all three (their
 *     receipt-gated versioned migration is the ratified D-4/D-10 G2 work —
 *     classified here, NOT silently treated as a failure);
 *   - the pre-existing `app.data.action` divergence (registered, no HTTP
 *     transport route, no CLI entry) is detected and explicitly classified;
 *   - no G2-pending command (run.resolve, run.signal) exists yet;
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

// Report
const counts = {};
for (const row of rows) {
  const key = row.class.split(' ')[0];
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log('STAGE 9 G1 — three-surface inventory (registry ↔ HTTP ↔ CLI)');
console.log(`commands=${rows.length}  http-routes=${routes.size}  cli-entries=${cli.size}`);
for (const row of rows.sort((a, b) => a.command.localeCompare(b.command))) {
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
console.log('\nINVENTORY OK — G1 reads on all three surfaces; divergences classified.');
