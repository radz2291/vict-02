/**
 * Reusable localStorage-backed `DocumentStorePort` (U2-07: host-side
 * persistence is composed from public modules, not per-proof handlers).
 *
 * PRESERVATION POLICY (identical in load and save — U1 round-4 contract):
 * `classifyStored` is the single envelope authority. Payloads the loader
 * classifies unreadable (invalid JSON, wrong format envelope, missing
 * document or stored revision) load as `invalid` with `overwritable:false`
 * AND are REFUSED by save() with `UI_STORE_CORRUPT`, bytes unchanged.
 * Readable envelopes load `invalid` with `overwritable:true` and carry the
 * RECORDED stored revision so a replacement save is actually accepted.
 * The store is the revision AUTHORITY (atomic check-then-set per JS turn).
 */
import type { DocumentStorePort, DocumentStoreLoadResult } from './bridge.js';
import type { UiDocument } from '@victframework/ui';

export type { DocumentStoreLoadResult };

/** Shape `classifyStored` returns for bytes that can never be replaced. */
export interface UnreadableClassification {
  readonly kind: 'unreadable';
  readonly message: string;
}
/** Shape for readable envelopes (replaceable by a later save). */
export interface EnvelopeClassification {
  readonly kind: 'envelope';
  readonly document: UiDocument;
  readonly recordedRevision: string;
}
export type StoredClassification = UnreadableClassification | EnvelopeClassification;

/** Classify raw stored bytes — the SINGLE authority for load and save. */
export function classifyStored(raw: string, format: string): StoredClassification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', message: 'stored authoring data is not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as Record<string, unknown>)['format'] !== format) {
    return { kind: 'unreadable', message: `stored payload is not '${format}'` };
  }
  const record = parsed as Record<string, unknown>;
  if (
    typeof record['document'] !== 'object' ||
    record['document'] === null ||
    typeof record['storedRevision'] !== 'string'
  ) {
    return {
      kind: 'unreadable',
      message: 'stored payload lacks a readable document or stored revision',
    };
  }
  return {
    kind: 'envelope',
    document: record['document'] as UiDocument,
    recordedRevision: record['storedRevision'],
  };
}

export interface LocalStorageStoreOptions {
  /** Per-document storage key (origin-partitioned; port changes = new store). */
  readonly key: string;
  /** Envelope format marker (e.g. 'vict.authoring-store@1'). */
  readonly format: string;
  /** The one revision an EMPTY store accepts for the initial seed save. */
  readonly seedStoredRevision: string;
  /**
   * Seed content used when the host initializes from empty. The store never
   * invents content: seeding is a HOST decision (open/invalid classification).
   */
}

export interface LoadFailureDetail {
  readonly status: 'invalid';
  readonly message: string;
  readonly overwritable: boolean;
  /** Present when the envelope was readable (the overwritable class). */
  readonly storedRevision?: string;
}

export type LocalStorageStoreLoad =
  | Extract<DocumentStoreLoadResult, { status: 'loaded' | 'empty' }>
  | LoadFailureDetail;

export interface LocalStorageDocumentStore extends DocumentStorePort {
  /** Envelope-level load with preservation classification for host UX. */
  rawLoad(): LocalStorageStoreLoad;
}

export function createLocalStorageDocumentStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  options: LocalStorageStoreOptions,
): LocalStorageDocumentStore {
  const { key, format, seedStoredRevision } = options;
  const readRaw = (): { ok: true; raw: string | null } | { ok: false; message: string } => {
    try {
      return { ok: true, raw: storage.getItem(key) };
    } catch (error) {
      return {
        ok: false,
        message: `storage unavailable: ${String(error instanceof Error ? error.message : error)}`,
      };
    }
  };

  return {
    rawLoad(): LocalStorageStoreLoad {
      const read = readRaw();
      if (!read.ok) return { status: 'invalid', message: read.message, overwritable: false };
      if (read.raw === null) return { status: 'empty' };
      const classified = classifyStored(read.raw, format);
      if (classified.kind === 'unreadable') {
        return {
          status: 'invalid',
          message: `${classified.message} (stored bytes preserved)`,
          overwritable: false,
        };
      }
      return {
        status: 'loaded',
        document: classified.document,
        storedRevision: classified.recordedRevision,
      };
    },

    load(): DocumentStoreLoadResult {
      const read = readRaw();
      if (!read.ok) {
        return { status: 'invalid', message: read.message, overwritable: false };
      }
      if (read.raw === null) return { status: 'empty' };
      const classified = classifyStored(read.raw, format);
      if (classified.kind === 'unreadable') {
        return {
          status: 'invalid',
          message: classified.message,
          overwritable: false,
        };
      }
      return {
        status: 'loaded',
        document: classified.document,
        storedRevision: classified.recordedRevision,
      };
    },

    save(input): ReturnType<DocumentStorePort['save']> {
      const read = readRaw();
      if (!read.ok) return { ok: false, code: 'UI_STORE_WRITE_FAILED', reason: read.message };
      let authoritative: string | undefined;
      if (read.raw !== null) {
        const classified = classifyStored(read.raw, format);
        if (classified.kind === 'unreadable') {
          return {
            ok: false,
            code: 'UI_STORE_CORRUPT',
            reason: `refusing to overwrite preserved data: ${classified.message}`,
          };
        }
        authoritative = classified.recordedRevision;
      }
      const stale =
        authoritative === undefined
          ? input.expectedStoredRevision !== seedStoredRevision
          : authoritative !== input.expectedStoredRevision;
      if (stale) {
        return {
          ok: false,
          code: 'UI_DOC_STALE_REVISION',
          reason: `stored revision is ${authoritative ?? 'absent (empty store)'}, editor expected ${input.expectedStoredRevision}`,
        };
      }
      try {
        storage.setItem(
          key,
          JSON.stringify({
            format,
            document: input.document,
            storedRevision: input.newStoredRevision,
          }),
        );
      } catch (error) {
        return {
          ok: false,
          code: 'UI_STORE_WRITE_FAILED',
          reason: `storage write failed: ${String(error instanceof Error ? error.message : error)}`,
        };
      }
      return { ok: true, storedRevision: input.newStoredRevision };
    },
  };
}
