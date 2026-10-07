/**
 * Authoring store — the studio's LOCAL authoring-document persistence
 * (U1-04). A small localStorage-backed implementation of the editor
 * `DocumentStorePort` sufficient for the U1 proof: a successful save
 * survives a full browser reload, leaving and reopening the route, and
 * browser restarts (localStorage is persistent origin storage).
 *
 * Atomicity: the expected-revision check and the write complete in ONE
 * synchronous JS turn (check-then-set), which is the atomic boundary of
 * the storage mechanism; a stale editor therefore cannot overwrite a
 * newer saved document. Corrupt or incompatible stored content loads as
 * `status: 'invalid'` — the host must surface a visible diagnostic and
 * must never silently treat it as a successful reopen.
 */
import {
  defaultSemanticElementCatalog,
  isDeferredProductReference,
  validateUiDocument,
  type UiDocument,
} from '@victframework/ui';
import type { compileUiDocument } from '@victframework/ui';
import type { DocumentStoreLoadResult, DocumentStorePort } from '@victframework/ui-editor';

const STORAGE_KEY = 'vict.u1.authoring.doc';
const STORE_FORMAT = 'vict.authoring-store@1';
/** The stored revision a freshly seeded (empty-store) session starts from. */
export const SEED_STORED_REVISION = '2';

/**
 * Load failure detail. `overwritable` distinguishes the two corruption
 * classes: `false` — the payload itself is unreadable (invalid JSON, missing
 * envelope, no readable stored revision); the store REFUSES to overwrite it
 * (`UI_STORE_CORRUPT`) and the bytes are preserved until cleared. `true` —
 * the envelope is readable but the document inside is invalid; a successful
 * save against the recorded stored revision legitimately replaces it.
 */
export type AuthoringStoreInvalid = {
  readonly status: 'invalid';
  readonly message: string;
  readonly overwritable: boolean;
  /** Present when the envelope was readable (the overwritable class). */
  readonly storedRevision?: string;
};

export type AuthoringStoreLoad = DocumentStoreLoadResult | AuthoringStoreInvalid;

export interface AuthoringStore extends DocumentStorePort {
  /** Full load detail: loaded / empty / invalid (diagnostics flow from here). */
  readonly rawLoad: () => AuthoringStoreLoad;
  /** Remove the stored payload (return to an empty store). */
  readonly clear: () => void;
}

function childRefsOf(node: UiDocument['nodes'][string]): readonly string[] {
  switch (node.kind) {
    case 'element':
    case 'portal':
      return node.children ?? [];
    case 'repeat':
      return [node.templateRoot];
    case 'slot':
      return node.fallback ?? [];
    case 'conditional':
      return node.branches.flatMap((branch) => branch.children);
    case 'component':
      return Object.values(node.slots ?? {}).flatMap((fill) => fill.children);
    default:
      return [];
  }
}

/** Corrupted stores may hold orphaned nodes; every node must be reachable. */
function unreachableNodeIds(document: UiDocument): readonly string[] {
  const seen = new Set<string>();
  const stack: string[] = [String(document.root)];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = document.nodes[id];
    if (node === undefined) continue;
    stack.push(...childRefsOf(node));
  }
  for (const definition of Object.values(document.componentDefinitions ?? {})) {
    stack.push(String(definition.root));
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = document.nodes[id];
      if (node === undefined) continue;
      stack.push(...childRefsOf(node));
    }
  }
  return Object.keys(document.nodes).filter((id) => !seen.has(id));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Envelope-level classification of raw stored bytes — the SINGLE authority
 * both load and save use, so the preservation policy cannot drift between
 * them: `unreadable` payloads are load-invalid with `overwritable: false`
 * AND save-refused (bytes preserved); only an `envelope` with a readable
 * document and stored revision may be replaced by a later save.
 */
type StoredClassification =
  | { readonly kind: 'unreadable'; readonly message: string }
  | {
      readonly kind: 'envelope';
      readonly document: UiDocument;
      readonly recordedRevision: string;
    };

function classifyStored(raw: string): StoredClassification {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable', message: 'stored authoring data is not valid JSON' };
  }
  if (!isRecord(parsed) || parsed['format'] !== STORE_FORMAT) {
    return { kind: 'unreadable', message: `stored payload is not '${STORE_FORMAT}'` };
  }
  if (!isRecord(parsed['document']) || typeof parsed['storedRevision'] !== 'string') {
    return {
      kind: 'unreadable',
      message: 'stored payload lacks a readable document or stored revision',
    };
  }
  return {
    kind: 'envelope',
    document: parsed['document'] as unknown as UiDocument,
    recordedRevision: parsed['storedRevision'],
  };
}

export function createAuthoringStore(
  storage: StorageLike,
  /** Host-declared compile context for the compatibility gate (same context the host compiles with). */
  compatibility?: Parameters<typeof compileUiDocument>[3],
): AuthoringStore {
  const readRaw = (): { ok: true; raw: string | null } | { ok: false; message: string } => {
    try {
      return { ok: true, raw: storage.getItem(STORAGE_KEY) };
    } catch (error) {
      return {
        ok: false,
        message: `storage unavailable: ${String(error instanceof Error ? error.message : error)}`,
      };
    }
  };

  return {
    rawLoad(): AuthoringStoreLoad {
      const read = readRaw();
      if (!read.ok) return { status: 'invalid', message: read.message, overwritable: false };
      if (read.raw === null) return { status: 'empty' };
      const classified = classifyStored(read.raw);
      if (classified.kind === 'unreadable') {
        // Unreadable payload: the bytes are preserved and save() refuses to
        // overwrite them (UI_STORE_CORRUPT) — never silently replaced.
        return { status: 'invalid', message: classified.message, overwritable: false };
      }
      const { document, recordedRevision } = classified;
      // Envelope readable: a later save against the recorded stored revision
      // legitimately replaces this class of corruption.
      const invalid = (message: string): AuthoringStoreInvalid => ({
        status: 'invalid',
        message,
        overwritable: true,
        storedRevision: recordedRevision,
      });
      // Envelope-shape hardening BEFORE any deep access: malformed structures
      // must produce a diagnostic, never an exception or a fake reopen.
      if (typeof document['schema'] !== 'string' || document['schema'] !== 'vict.ui-document@1') {
        return invalid(
          `unsupported document schema: ${String(document['schema'] ?? '(missing)')} — expected 'vict.ui-document@1'`,
        );
      }
      if (!isRecord(document['nodes'])) {
        return invalid('stored document has no node registry');
      }
      if (Object.keys(document['nodes']).length === 0) {
        return invalid('stored document is empty (no nodes)');
      }
      for (const [nodeId, node] of Object.entries(document['nodes'])) {
        if (!isRecord(node) || typeof node['kind'] !== 'string') {
          return invalid(`stored node '${nodeId}' is malformed (missing kind)`);
        }
      }
      if (typeof document['root'] !== 'string') {
        return invalid('stored document has no readable root');
      }
      try {
        // Corruption gate: full structural validation with the host's
        // declared context; product-reference diagnostics (view./record./
        // repeat. typing, action/route ids) are DEFERRED to the joint
        // compiler by the layered validation authority — structural errors
        // are fatal and must surface as a visible diagnostic, never a fake
        // successful reopen.
        const diagnostics = validateUiDocument(document, {
          elements: defaultSemanticElementCatalog(),
          ...(compatibility ?? {}),
        }).filter((issue) => !isDeferredProductReference(issue));
        const orphaned = unreachableNodeIds(document);
        if (orphaned.length > 0) {
          return invalid(`stored document has unreachable node(s): ${orphaned.join(', ')}`);
        }
        if (diagnostics.some((issue) => issue.severity === 'error')) {
          const first = diagnostics[0];
          return invalid(
            `stored document invalid: ${first?.code ?? 'UNKNOWN'} — ${first?.message ?? 'no detail'}`,
          );
        }
      } catch (error) {
        // Validation itself must never throw past the gate.
        return invalid(
          `stored document could not be analyzed: ${String(error instanceof Error ? error.message : error)}`,
        );
      }
      return {
        status: 'loaded',
        document,
        storedRevision: recordedRevision,
      };
    },

    load(): DocumentStoreLoadResult {
      return this.rawLoad();
    },

    save(input): ReturnType<DocumentStorePort['save']> {
      const read = readRaw();
      if (!read.ok) return { ok: false, code: 'UI_STORE_WRITE_FAILED', reason: read.message };
      // The AUTHORITATIVE stored revision, read in the same synchronous turn
      // as the write (check-then-set = the storage mechanism's atomic window).
      // The SAME preservation policy as load applies here: a payload the
      // loader would classify unreadable (wrong format envelope, missing
      // document or stored revision, invalid JSON) is REFUSED without
      // changing its bytes — never silently replaced behind a PRESERVED
      // banner. Only an empty store or a readable envelope can be saved over.
      let authoritative: string | undefined;
      if (read.raw !== null) {
        const classified = classifyStored(read.raw);
        if (classified.kind === 'unreadable') {
          return {
            ok: false,
            code: 'UI_STORE_CORRUPT',
            reason: `refusing to overwrite preserved data: ${classified.message}`,
          };
        }
        authoritative = classified.recordedRevision;
      }
      // Stale rules: an editor may save only against the revision the store
      // actually holds. An EMPTY store accepts the one seed revision the
      // host initializes from (SEED_STORED_REVISION) — any other expectation
      // claims a revision the store never had, and a mismatched non-empty
      // store means a NEWER save exists: reject without writing.
      const stale =
        authoritative === undefined
          ? input.expectedStoredRevision !== SEED_STORED_REVISION
          : authoritative !== input.expectedStoredRevision;
      if (stale) {
        return {
          ok: false,
          code: 'UI_DOC_STALE_REVISION',
          reason: `stored revision is ${authoritative ?? 'absent (empty store)'}, editor expected ${input.expectedStoredRevision}`,
        };
      }
      const payload = {
        format: STORE_FORMAT,
        document: input.document,
        storedRevision: input.newStoredRevision,
      };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        return {
          ok: false,
          code: 'UI_STORE_WRITE_FAILED',
          reason: `storage write failed: ${String(error instanceof Error ? error.message : error)}`,
        };
      }
      return { ok: true, storedRevision: input.newStoredRevision };
    },

    clear(): void {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        // clearing is best-effort; loads report storage failures
      }
    },
  };
}
