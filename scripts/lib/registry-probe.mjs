/**
 * Read-only registry probes for the release path (public npm registry
 * only). Shared by the OIDC release engine and the trust preflight.
 *
 * A registry failure fails closed at the CALLER: absence of proof is
 * treated as a blocker, never as "unpublished" / "absent".
 */

import { spawnSync } from 'node:child_process';

export const PUBLIC_REGISTRY = 'https://registry.npmjs.org/';

/**
 * Small, dependency-free synchronous GET with a bounded timeout.
 * Windows Node 22 supports synchronous fetch only via this child trick —
 * spawn the resident `node` with an inline fetch script (no shell).
 */
export function fetchSync(url) {
  const script = `
    const url = process.argv[1];
    fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) })
      .then(async (response) => {
        if (response.status === 404) { console.log(JSON.stringify({ kind: 'not-found' })); return; }
        if (!response.ok) { console.log(JSON.stringify({ kind: 'error', message: 'HTTP ' + response.status })); return; }
        const body = await response.text();
        console.log(JSON.stringify({ kind: 'ok', body }));
      })
      .catch((error) => { console.log(JSON.stringify({ kind: 'error', message: String(error && error.message) })); });
  `;
  const result = spawnSync(process.execPath, ['-e', script, url], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (result.status !== 0) {
    return { kind: 'error', message: `probe exited ${result.status}` };
  }
  const line = (result.stdout ?? '').trim().split(/\r?\n/).at(-1) ?? '';
  try {
    return JSON.parse(line);
  } catch {
    return { kind: 'error', message: 'unparseable probe output' };
  }
}

/**
 * Registry packument probe for one exact package name (never caches).
 * Throws a plain Error when the registry is unreachable or the metadata
 * is unparseable; returns an EMPTY packument shape for a 404 (absent
 * package — the caller decides what absence means).
 *
 * @param {string} name exact package name
 * @returns {{name: string, versions: Record<string, unknown>, 'dist-tags': Record<string, string>}}
 */
export function fetchPackument(name) {
  const url = `${PUBLIC_REGISTRY}${encodeURIComponent(name)}`;
  const response = fetchSync(url);
  if (response.kind === 'error') {
    throw new Error(`the public npm registry is unreachable for ${name}: ${response.message}`);
  }
  if (response.kind === 'not-found') {
    return { name, versions: {}, 'dist-tags': {} };
  }
  let packument;
  try {
    packument = JSON.parse(response.body);
  } catch {
    throw new Error(`the registry returned unparseable metadata for ${name}.`);
  }
  return packument;
}
