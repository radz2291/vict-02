/**
 * Stage 06B — CLI entry point (testable core).
 *
 * Exit codes:
 * - 0: command succeeded (envelope ok);
 * - 1: usage error (unknown command, missing flags, unreadable file);
 * - 2: the VICT endpoint rejected the command (stable server code);
 * - 3: transport failure (endpoint unreachable/malformed).
 *
 * The binary never reads databases and never prints hostile values: flag
 * values are user input, and all server-derived output comes from the
 * bounded command envelopes.
 */

import { readFileSync, statSync } from 'node:fs';
import { VictCliError, VictHttpClient } from './client.js';
import {
  CLI_COMMANDS,
  fillPath,
  payloadToQuery,
  buildPayload,
  type CliCommandSpec,
} from './commands.js';

export interface VictCliIo {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

export interface VictCliOptions {
  /** Resolved endpoint URL (from --endpoint or VICT_ENDPOINT). */
  readonly endpoint?: string;
  /** Resolved bearer token (from --token or VICT_TOKEN). */
  readonly token?: string;
}

const USAGE = `vict — VICT operator/developer CLI (vict.cli@1)

Usage: vict <command> [positionals] [--flag value ...]

Connection:
  --endpoint URL     VICT server base URL (or $VICT_ENDPOINT)
  --token TOKEN      bearer token (or $VICT_TOKEN)
  --file PATH        JSON payload file for propose/publish/mutate commands
  --json             print the raw command envelope as JSON

Commands:
${Object.entries(CLI_COMMANDS)
  .map(([name, spec]) => `  ${name.padEnd(22)} ${spec.description}`)
  .join('\n')}

The CLI consumes the versioned VICT command surface over HTTP only; it
never reads stores directly and never bypasses governance.`;

/** Parse argv into (command, flags, positionals, file, jsonOut). */
function parse(argv: readonly string[]): {
  command: string | undefined;
  flags: Record<string, string>;
  positionals: string[];
  file?: string;
  jsonOut: boolean;
} {
  const flags: Record<string, string> = {};
  const positionals: string[] = [];
  let file: string | undefined;
  let jsonOut = false;
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index] as string;
    if (arg === '--json') {
      jsonOut = true;
      index += 1;
      continue;
    }
    if (arg === '--file') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--file requires a path.');
      }
      file = value;
      index += 2;
      continue;
    }
    if (arg === '--endpoint' || arg === '--token') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`${arg} requires a value.`);
      }
      flags[arg.slice(2)] = value;
      index += 2;
      continue;
    }
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--${name} requires a value.`);
      }
      flags[name] = value;
      index += 2;
      continue;
    }
    positionals.push(arg);
    index += 1;
  }
  return { command: positionals.shift(), flags, positionals, file, jsonOut };
}

/** Resolve the CLI command name: `"changeset get"` style two-word verbs. */
function resolveCommand(
  name: string | undefined,
  firstPositional: string | undefined,
):
  | {
      spec: CliCommandSpec;
      key: string;
      rest: string[];
    }
  | undefined {
  if (name === undefined) {
    return undefined;
  }
  const direct = CLI_COMMANDS[name];
  if (direct !== undefined) {
    return { spec: direct, key: name, rest: [] };
  }
  if (firstPositional !== undefined) {
    const compound = `${name} ${firstPositional}`;
    const spec = CLI_COMMANDS[compound];
    if (spec !== undefined) {
      return { spec, key: compound, rest: [] };
    }
  }
  return undefined;
}

/** Read a JSON payload file (bounded: 256 KiB, matching the HTTP limit). */
function readJsonFile(path: string): unknown {
  if (statSync(path).size > 256 * 1024) {
    throw new Error('Payload file exceeds the 256 KiB request limit.');
  }
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/**
 * Run the CLI with the given argv. Returns the process exit code.
 */
export async function runVictCli(
  argv: readonly string[],
  io: VictCliIo,
  options: VictCliOptions = {},
): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`vict: ${(error as Error).message}`);
    io.stderr(USAGE);
    return 1;
  }
  if (parsed.command === undefined || parsed.command === 'help') {
    io.stdout(USAGE);
    return parsed.command === 'help' ? 0 : 1;
  }
  const endpoint = parsed.flags.endpoint ?? options.endpoint ?? process.env['VICT_ENDPOINT'];
  const token = parsed.flags.token ?? options.token ?? process.env['VICT_TOKEN'];
  if (endpoint === undefined || token === undefined) {
    io.stderr('vict: --endpoint and --token (or $VICT_ENDPOINT / $VICT_TOKEN) are required.');
    return 1;
  }
  const resolved = resolveCommand(parsed.command, parsed.positionals[0]);
  if (resolved === undefined) {
    io.stderr(`vict: unknown command '${parsed.command}'.`);
    io.stderr(USAGE);
    return 1;
  }
  const { spec, key } = resolved;
  const flags = { ...parsed.flags };
  // Approval verbs map onto the two distinct approval commands.
  if (key === 'approval approve') {
    flags['decision'] = 'approved';
  } else if (key === 'approval decline') {
    flags['decision'] = 'declined';
  }
  // Positional arguments fill the declared positionals in order; for
  // compound commands the second word was consumed as the subcommand.
  const positionalArgs =
    parsed.positionals[0] !== undefined &&
    CLI_COMMANDS[`${parsed.command} ${parsed.positionals[0]}`] !== undefined
      ? parsed.positionals.slice(1)
      : parsed.positionals;
  spec.positionals.forEach((name, position) => {
    const value = positionalArgs[position];
    if (value !== undefined) {
      flags[name] = value;
    }
  });
  let fileJson: unknown;
  if (parsed.file !== undefined) {
    try {
      fileJson = readJsonFile(parsed.file);
    } catch (error) {
      io.stderr(`vict: ${(error as Error).message}`);
      return 1;
    }
  }
  let path: string;
  let payload: Record<string, unknown>;
  try {
    path = fillPath(spec, flags);
    payload = buildPayload(spec, flags, fileJson);
  } catch (error) {
    io.stderr(`vict: ${(error as Error).message}`);
    return 1;
  }
  const client = new VictHttpClient({ endpoint, token });
  try {
    const data =
      spec.method === 'GET'
        ? await client.request('GET', path, { query: payload })
        : await client.request('POST', path, { payload });
    if (parsed.jsonOut) {
      io.stdout(JSON.stringify({ ok: true, command: key, data }, null, 2));
    } else {
      io.stdout(JSON.stringify(data, null, 2));
    }
    return 0;
  } catch (error) {
    if (error instanceof VictCliError) {
      io.stderr(`vict: ${error.message}`);
      if (error.code === 'VICT_CLI_TRANSPORT' || error.code === 'VICT_CLI_MALFORMED_RESPONSE') {
        return 3;
      }
      return 2;
    }
    io.stderr(`vict: the command failed.`);
    return 1;
  }
}
