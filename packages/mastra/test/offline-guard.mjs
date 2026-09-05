/**
 * Offline guard for the @vict/mastra suites (MSTR-010: verifiable offline).
 *
 * Stage 06A adapter tests must fail if an unexpected network request is
 * attempted. The guard replaces `globalThis.fetch` and the connect/
 * request entry points of `net`, `http`, `https`, and `dgram` with
 * deterministic throws. No Stage 06A fixture may rely on, disable, or
 * filter this guard — a failure here is a real violation of the offline
 * envelope, never a flake.
 */

const reason =
  'VICT_MASTRA_OFFLINE_GUARD: a network request was attempted in an offline Stage 06A suite.';

const block = () => {
  throw new Error(reason);
};

function lock(object, name, value) {
  try {
    Object.defineProperty(object, name, { value, writable: false, configurable: false });
  } catch {
    // Environmental: a non-configurable builtin keeps its original value.
  }
}

lock(globalThis, 'fetch', block);

const net = await import('node:net');
const http = await import('node:http');
const https = await import('node:https');

lock(net, 'connect', block);
lock(net, 'createConnection', block);
lock(http, 'request', block);
lock(http, 'get', block);
lock(https, 'request', block);
lock(https, 'get', block);
