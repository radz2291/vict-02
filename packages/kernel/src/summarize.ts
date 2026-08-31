import type { OutputSummary } from './types.js';

/**
 * Key names whose values must never be reflected anywhere in trace metadata.
 * Matches against lowercase key names.
 */
const SECRET_LIKE_KEY =
  /pass(word)?|secret|token|credential|api[-_]?key|private[-_]?key|authorization/i;

/**
 * Summarize an arbitrary output value into safe trace metadata.
 * Values are never included: strings contribute only length, objects only
 * key names (secret-like names are redacted).
 */
export function summarizeOutput(value: unknown): OutputSummary {
  if (value === undefined) {
    return { shape: 'undefined' };
  }
  if (value === null) {
    return { shape: 'null' };
  }
  switch (typeof value) {
    case 'string':
      return { shape: 'string', length: value.length };
    case 'number':
      return { shape: 'number' };
    case 'boolean':
      return { shape: 'boolean' };
    case 'bigint':
      return { shape: 'bigint' };
    case 'object':
      break;
    default:
      return { shape: 'unknown' };
  }
  if (Array.isArray(value)) {
    return { shape: 'array', length: value.length };
  }
  const keys = Object.keys(value).map((key) => (SECRET_LIKE_KEY.test(key) ? '[redacted]' : key));
  return { shape: 'object', keys };
}
