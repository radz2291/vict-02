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
import type { DocumentStoreLoadResult, DocumentStorePort } from '@victframework/ui-editor';

const STORAGE_KEY = 'vict.u1.authoring.doc';
const STORE_FORMAT = 'vict.authoring-store@1';
/** The stored revision a freshly seeded (empty-store) session starts from. */
export const SEED_STORED_REVISION = '1';

export type AuthoringStoreLoad = DocumentStoreLoadResult;

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
      if (!read.ok) return { status: 'invalid', message: read.message };
      if (read.raw === null) return { status: 'empty' };
      let parsed: unknown;
      try {
        parsed = JSON.parse(read.raw);
      } catch {
        return { status: 'invalid', message: 'stored authoring data is not valid JSON' };
      }
      if (!isRecord(parsed) || parsed['format'] !== STORE_FORMAT) {
        return {
          status: 'invalid',
          message: `stored payload is not '${STORE_FORMAT}'`,
        };
      }
      if (!isRecord(parsed['document']) || typeof parsed['storedRevision'] !== 'string') {
        return { status: 'invalid', message: 'stored payload lacks a document or stored revision' };
      }
      const document = parsed['document'] as unknown as UiDocument;
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
        return {
          status: 'invalid',
          message: `stored document has unreachable node(s): ${orphaned.join(', ')}`,
        };
      }
      if (diagnostics.some((issue) => issue.severity === 'error')) {
        const first = diagnostics[0];
        return {
          status: 'invalid',
          message: `stored document invalid: ${first?.code ?? 'UNKNOWN'} — ${first?.message ?? 'no detail'}`,
        };
      }
      return {
        status: 'loaded',
        document,
        storedRevision: parsed['storedRevision'],
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
      let authoritative: string | undefined;
      if (read.raw !== null) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(read.raw);
        } catch {
          return {
            ok: false,
            code: 'UI_STORE_CORRUPT',
            reason: 'stored payload is not valid JSON; refusing to overwrite unreadable data',
          };
        }
        if (!isRecord(parsed) || typeof parsed['storedRevision'] !== 'string') {
          return {
            ok: false,
            code: 'UI_STORE_CORRUPT',
            reason: 'stored payload lacks a readable stored revision; refusing to overwrite',
          };
        }
        authoritative = parsed['storedRevision'];
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
