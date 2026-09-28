/**
 * Pure trust-relationship rules for the one-time npm trusted-publishing
 * bootstrap (contract §11 of
 * docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md).
 *
 * Extracted from scripts/trust-bootstrap.mjs so the interpretation of
 * `npm trust list` output and the exact argv construction carry permanent
 * regression coverage. All functions are pure; nothing here performs I/O.
 */

import { FROZEN_TRUST_TARGET, trustGithubArgv } from './release-set.mjs';

export { FROZEN_TRUST_TARGET, trustGithubArgv };

/** Redact anything token-shaped from tool output before echoing it. */
export function sanitize(text) {
  return String(text ?? '')
    .replace(/\bnpm_[A-Za-z0-9]{36}\b/g, '[redacted]')
    .replace(/\bgh(?:p|o|u|s)_[A-Za-z0-9]{36,}\b/g, '[redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, '[redacted]');
}

/**
 * Classify the JSON output of the official `npm trust list <name> --json`
 * command against the frozen trust target (r5: shared here so the
 * evidence validator reclassifies from the CAPTURED OUTPUT itself, not
 * from a claimed status; fail-closed on unparseable output).
 *
 * Tolerated real-output shapes (verified against the npm 11.19.1
 * source): a single pretty JSON object per trust configuration, or
 * SEVERAL such documents concatenated in one output (npm prints one
 * JSON blob per configured relationship with no separating comma), or
 * an empty string (a package with no trust configuration — classified
 * as MISSING, never as an error). Anything else is an error and the
 * caller decides (the preflight treats it as UNVERIFIABLE — a blocker).
 */
export function classifyTrustListOutput(rawOutput) {
  const text = String(rawOutput ?? '').trim();
  const documents = [];
  if (text.length === 0) {
    documents.push({});
  } else {
    try {
      documents.push(JSON.parse(text));
    } catch {
      // Concatenated JSON documents: scan balanced top-level {...} blocks.
      let depth = 0;
      let start = -1;
      let inString = false;
      let escaped = false;
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') {
          inString = true;
        } else if (char === '{') {
          if (depth === 0) start = index;
          depth += 1;
        } else if (char === '}') {
          depth -= 1;
          if (depth === 0 && start !== -1) {
            try {
              documents.push(JSON.parse(text.slice(start, index + 1)));
            } catch {
              return { error: 'unparseable npm trust list output; inspect manually.' };
            }
            start = -1;
          }
        }
      }
      if (depth !== 0 || documents.length === 0) {
        return { error: 'unparseable npm trust list output; inspect manually.' };
      }
    }
  }
  const entries = [];
  for (const parsed of documents) {
    entries.push(...collectRelationships(parsed));
  }
  return classifyRelationships(entries);
}

/** Collect candidate relationship objects from arbitrary JSON shapes. */
export function collectRelationships(value, found = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectRelationships(entry, found);
    return found;
  }
  if (value === null || typeof value !== 'object') return found;
  const hasTarget =
    'repository' in value || 'repo' in value || 'workflow' in value || 'file' in value;
  const hasKind = 'provider' in value || 'type' in value || 'tool' in value;
  if (hasTarget && hasKind) {
    found.push(value);
  }
  for (const child of Object.values(value)) collectRelationships(child, found);
  return found;
}

function relationshipField(entry, names) {
  for (const name of names) {
    if (typeof entry[name] === 'string' && entry[name].length > 0) return entry[name];
  }
  return undefined;
}

function relationshipAllowsPublish(entry) {
  if (entry.allowPublish === true || entry['allow-publish'] === true) return true;
  const permissions = entry.permissions ?? entry.scopes;
  // The publish permission, in every observed spelling. The raw API key
  // `createPackage` is what npm 11.x `npm trust list <pkg> --json`
  // actually emits for a relationship configured with --allow-publish
  // (npm/lib/trust-cmd.js: PERMISSIONS.CREATE_PACKAGE = 'createPackage';
  // the human-facing label 'publish' is only the non-JSON display form).
  // Stage-publish (createStagedPackage) is deliberately NOT accepted:
  // the frozen relationship is --allow-publish only.
  const publishTokens = ['publish', 'npm publish', 'createPackage'];
  const hasPublish = (value) => publishTokens.includes(value);
  if (Array.isArray(permissions)) {
    if (permissions.some(hasPublish)) return true;
  }
  if (typeof permissions === 'string') {
    if (
      permissions
        .split(/[,;|]/)
        .map((part) => part.trim())
        .some(hasPublish)
    )
      return true;
  }
  return false;
}

/**
 * Classify candidate relationship objects against the FROZEN trust
 * target. `exact` = the intended relationship; `conflicting` = anything
 * else (other provider, other repository/workflow, an environment, or a
 * missing publish permission) — conflicts are refused, never replaced.
 */
export function classifyRelationships(entries) {
  const exact = [];
  const conflicting = [];
  for (const entry of entries) {
    const provider = (relationshipField(entry, ['provider', 'type', 'tool']) ?? '').toLowerCase();
    const isGithub =
      provider === 'github' || provider === 'githubactions' || provider === 'github_actions';
    if (!isGithub) {
      conflicting.push(entry);
      continue;
    }
    const repository = relationshipField(entry, ['repository', 'repo']);
    const workflow = relationshipField(entry, [
      'workflow',
      'file',
      'workflowFile',
      'workflow_file',
    ]);
    const environment = relationshipField(entry, ['environment', 'env']);
    const matches =
      repository === FROZEN_TRUST_TARGET.repository &&
      workflow === FROZEN_TRUST_TARGET.workflowFile &&
      (environment === undefined || environment.length === 0);
    if (!matches || !relationshipAllowsPublish(entry)) {
      conflicting.push(entry);
      continue;
    }
    exact.push(entry);
  }
  return { exact, conflicting };
}

/** Compact NON-SENSITIVE description of a relationship for failure reports. */
export function describeRelationship(entry) {
  return JSON.stringify({
    provider: relationshipField(entry, ['provider', 'type', 'tool']),
    repository: relationshipField(entry, ['repository', 'repo']),
    workflow: relationshipField(entry, ['workflow', 'file', 'workflowFile', 'workflow_file']),
    environment: relationshipField(entry, ['environment', 'env']),
  });
}

/**
 * The canonical origin URL check: only the frozen GitHub repository may
 * be bootstrapped.
 */
export function originMatchesFrozenRepository(originUrl) {
  const normalized = String(originUrl ?? '')
    .replace(/^https:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/, '');
  return normalized === FROZEN_TRUST_TARGET.repository;
}
