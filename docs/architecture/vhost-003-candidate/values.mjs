import { createHash } from 'node:crypto';

export const hash = (data) => createHash('sha256').update(data).digest();

// PostgreSQL orders bytea lexicographically. Swapping UTF-16 units gives JS
// string order even for embedded NULs, lone surrogates, and non-BMP strings.
export const keyBytes = (key) => Buffer.from(key, 'utf16le').swap16();
export const fromKey = (bytes) => Buffer.from(bytes).swap16().toString('utf16le');
export const readKey = (key) => typeof key === 'string' ? keyBytes(key) : null;

export function createValueCodec({ runtime, snapshot }, db) {
  const { captureRuntimeStoreSnapshot, restoreRuntimeStoreSnapshot } = snapshot;
  const { HostedCoordinationError, VictStoreError } = runtime;
  const kind = 'VHOST003-indexed-record@1';

  function invalidArgument() {
    return new VictStoreError(
      'VICT_STORE_INVALID_COMMAND',
      'A store argument is outside the persisted-value domain.',
      { operation: 'postgres.captureArguments' }
    );
  }

  function capture(value, ancestors = new Set(), depth = 0) {
    if (depth > 128) throw invalidArgument();
    if (value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    if (typeof value !== 'object') throw invalidArgument();
    if (value instanceof Date) return new Date(value.getTime());
    const prototype = Object.getPrototypeOf(value);
    if (ancestors.has(value) ||
        (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null)) {
      throw invalidArgument();
    }
    ancestors.add(value);
    const copy = Array.isArray(value) ? new Array(value.length) : Object.create(prototype);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') throw invalidArgument();
      if (Array.isArray(value) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!('value' in descriptor)) throw invalidArgument();
      Object.defineProperty(copy, key, {
        value: capture(descriptor.value, ancestors, depth + 1),
        enumerable: descriptor.enumerable, configurable: true, writable: true
      });
    }
    ancestors.delete(value);
    return copy;
  }

  function captureArguments(args) {
    try {
      return args.map((value) => typeof value === 'function' ? value : capture(value));
    } catch {
      throw invalidArgument();
    }
  }

  function encode(value) {
    const envelope = captureRuntimeStoreSnapshot(kind, { record: [value] });
    const bytes = Buffer.from(JSON.stringify(envelope), 'utf8');
    if (bytes.length > db.maxSnapshotBytes) throw new HostedCoordinationError('HOSTED_STATE_LIMIT');
    const pending = [JSON.parse(envelope.payload)];
    let nodes = 0;
    while (pending.length) {
      const item = pending.pop();
      if (++nodes > db.maxStateNodes) throw new HostedCoordinationError('HOSTED_STATE_LIMIT');
      if (Array.isArray(item)) for (const entry of item) pending.push(entry);
    }
    return bytes;
  }

  function decode(bytes) {
    try {
      const record = [];
      restoreRuntimeStoreSnapshot(JSON.parse(bytes.toString('utf8')), kind, { record });
      if (record.length !== 1) throw new Error('Record count');
      return record[0];
    } catch {
      throw new HostedCoordinationError('HOSTED_SCHEMA_MISMATCH');
    }
  }
  return { captureArguments, encode, decode, captureRuntimeStoreSnapshot };
}
