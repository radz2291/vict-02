import type { Step, Citation, FileNode } from '../patterns/types.js';

export const publicPatternKinds = ['reasoning', 'chain-of-thought', 'tool', 'plan', 'task', 'queue', 'terminal', 'test-results', 'stack-trace', 'subagent', 'context', 'sources', 'inline-citation', 'file-tree', 'markdown'] as const;
export type PublicPatternKind = typeof publicPatternKinds[number];
export type PublicActivity = Step & { open?: boolean; code?: string; badges?: string[]; links?: {title: string; url: string}[] };
export interface PassiveData {
  version: 1;
  steps?: PublicActivity[];
  sources?: Citation[];
  source?: Citation;
  nodes?: FileNode[];
  breakdown?: {label: string; value: number}[];
  tools?: string[];
  testSuites?: {id: string; name: string; tests: {id: string; name: string; status: 'passed' | 'failed' | 'skipped'; error?: string}[]}[];
}
type Check = (value: unknown, path: string) => void;
const fail = (path: string, message: string): never => { throw new Error(`${path}: ${message}`); };
const string: Check = (value, path) => { if (typeof value !== 'string' || value.length > 16000) fail(path, 'expected string of at most 16000 characters'); };
const bool: Check = (value, path) => { if (typeof value !== 'boolean') fail(path, 'expected boolean'); };
const positive: Check = (value, path) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(path, 'expected finite nonnegative number'); };
const status = (allowed: readonly string[]): Check => (value, path) => { if (typeof value !== 'string' || !allowed.includes(value)) fail(path, `expected ${allowed.join('|')}`); };
const optional = (check: Check): Check => (value, path) => { if (value !== undefined) check(value, path); };
function record(fields: Record<string, Check>): Check {
  return (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) if (!Object.hasOwn(fields, key)) fail(`${path}.${key}`, 'unknown field');
    for (const [key, check] of Object.entries(fields)) check(object[key], `${path}.${key}`);
  };
}
function list(check: Check, uniqueKey?: string): Check {
  return (value, path) => {
    if (!Array.isArray(value) || value.length > 100) fail(path, 'expected array of at most 100 records');
    const seen = new Set<unknown>();
    for (const [index, item] of (value as unknown[]).entries()) {
      check(item, `${path}[${index}]`);
      if (uniqueKey) {
        const key = (item as Record<string, unknown>)[uniqueKey];
        if (key === '' || seen.has(key)) fail(path, `nonempty unique ${uniqueKey} required`);
        seen.add(key);
      }
    }
  };
}
const citation = record({id: string, title: string, url: string, excerpt: optional(string)});
const activity = record({id: string, title: string, detail: optional(string), status: optional(status(['running', 'pending', 'done', 'error'])), open: optional(bool), code: optional(string), badges: optional(list(string)), links: optional(list(record({title: string, url: string})))});
const test = record({id: string, name: string, status: status(['passed', 'failed', 'skipped']), error: optional(string)});
const suite = record({id: string, name: string, tests: list(test, 'id')});
function fileTree(value: unknown, path: string, depth = 0, paths = new Set<string>()): void {
  if (depth > 12) fail(path, 'maximum tree depth 12');
  list(record({path: string, name: string, children: optional((children, childPath) => fileTree(children, childPath, depth + 1, paths))}))(value, path);
  for (const item of value as FileNode[]) {
    if (!item.path || paths.has(item.path)) fail(path, 'nonempty globally unique paths required');
    paths.add(item.path);
    if (paths.size > 500) fail(path, 'maximum 500 file nodes');
  }
}
const version: Check = (value, path) => { if (value !== 1) fail(path, 'expected version 1'); };
export function parsePublicPatternData(kind: PublicPatternKind, input: unknown): {ok: true; value: PassiveData} | {ok: false; error: string} {
  try {
    if (typeof input !== 'string' || input.length > 131072) fail('data', 'expected JSON string of at most 131072 characters');
    const parsed: unknown = JSON.parse(input as string);
    const fields: Record<string, Check> = {version};
    if (['chain-of-thought', 'plan', 'task', 'queue'].includes(kind)) fields.steps = list(activity, 'id');
    if (kind === 'subagent') { fields.steps = list(activity, 'id'); fields.tools = optional(list(string)); }
    if (kind === 'sources') fields.sources = list(citation, 'id');
    if (kind === 'inline-citation') fields.source = citation;
    if (kind === 'file-tree') fields.nodes = fileTree;
    if (kind === 'context') fields.breakdown = list(record({label: string, value: positive}), 'label');
    if (kind === 'test-results') fields.testSuites = list(suite, 'id');
    record(fields)(parsed, 'data');
    return {ok: true, value: parsed as PassiveData};
  } catch (error) { return {ok: false, error: error instanceof Error ? error.message : 'Invalid public presentation data'}; }
}

/** Descriptor scalar carriers cannot express enums or numeric ranges. Reject
 * malformed status metadata rather than showing an unknown state as success. */
export function validatePublicPatternScalars(kind: PublicPatternKind, props: Readonly<Record<string, unknown>>): string | undefined {
  try {
    for (const [key, value] of Object.entries(props)) {
      if (key === 'data') continue;
      if (typeof value === 'string') string(value, key);
      if (typeof value === 'number' && !Number.isFinite(value)) fail(key, 'expected finite number');
    }
    if (props.status !== undefined) status(['', 'pending', 'running', 'error'])(props.status, 'status');
    if (props.state !== undefined && kind === 'tool') status(['pending', 'running', 'completed', 'error', 'denied'])(props.state, 'state');
    if (props.state !== undefined && kind === 'subagent') status(['pending', 'running', 'completed', 'error', 'failed'])(props.state, 'state');
    for (const key of ['duration', 'used', 'limit']) if (props[key] !== undefined) positive(props[key], key);
    if (props.exitCode !== undefined && !Number.isSafeInteger(props.exitCode)) fail('exitCode', 'expected safe integer');
    if (props.summaryIcon !== undefined) status(['terminal', 'error'])(props.summaryIcon, 'summaryIcon');
    return undefined;
  } catch (error) {return error instanceof Error ? error.message : 'Invalid scalar presentation data';}
}

export const publicPatternSeedData: Record<PublicPatternKind, PassiveData> = {
  reasoning: {version: 1}, 'chain-of-thought': {version: 1, steps: []}, tool: {version: 1},
  plan: {version: 1, steps: []}, task: {version: 1, steps: []}, queue: {version: 1, steps: []}, terminal: {version: 1},
  'test-results': {version: 1, testSuites: []}, 'stack-trace': {version: 1}, subagent: {version: 1, steps: [], tools: []},
  context: {version: 1, breakdown: []}, sources: {version: 1, sources: []},
  'inline-citation': {version: 1, source: {id: 'source', title: 'Supplied source', url: ''}}, 'file-tree': {version: 1, nodes: []},
  markdown: {version: 1},
};
