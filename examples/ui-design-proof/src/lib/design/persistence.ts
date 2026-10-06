/**
 * Shared design-document persistence for BOTH proof surfaces: the workbench
 * edits it and /service renders it — the same persisted source (the product
 * goal: the editor edits the source the application renders).
 *
 * The store uses the reusable createLocalStorageDocumentStore with the
 * design catalogs as the host VALIDATION GATE: a readable envelope whose
 * document fails validation classifies invalid+overwritable at the recorded
 * revision (seeded editors replace it on the next save) instead of silently
 * reopening broken bytes.
 */
import {
  createLocalStorageDocumentStore,
  type LocalStorageDocumentStore,
  type LocalStorageStoreLoad,
} from '@victframework/ui-editor';
import { validateUiDocument, type UiDocument } from '@victframework/ui';
import { designCatalogs } from './adapter.js';
import {
  DESIGN_STORE_FORMAT,
  SERVICE_SEED_REVISION,
  SERVICE_STORE_KEY,
} from './service-document.js';

/** Browser guard without importing SvelteKit's virtual `$app` modules into lib code. */
const isBrowser = typeof window !== 'undefined';

export interface DesignOpenResult {
  /** The document to present (persisted when usable, otherwise the seed). */
  readonly document: UiDocument;
  /** Revision the editor may save against ('1' seed on empty/preserved). */
  readonly storedRevision: string;
  /** Truthful banner for the user, when the stored state needed attention. */
  readonly banner: string | null;
}

export function openDesignStore(key: string): LocalStorageDocumentStore {
  return createLocalStorageDocumentStore(isBrowser ? window.localStorage : memoryStorage(), {
    key,
    format: DESIGN_STORE_FORMAT,
    seedStoredRevision: SERVICE_SEED_REVISION,
    validateDocument: (document) =>
      validateUiDocument(document, designCatalogs).map((issue) => ({
        code: issue.code,
        severity: issue.severity,
        message: issue.message,
      })),
  });
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const bag = new Map<string, string>();
  return {
    getItem: (k) => bag.get(k) ?? null,
    setItem: (k, v) => void bag.set(k, v),
  };
}

/**
 * Load the presentable document for a key: persisted bytes when usable,
 * otherwise the seed (with a truthful banner explaining exactly what
 * happened to the stored data).
 */
export function loadPresentable(
  store: LocalStorageDocumentStore,
  seed: UiDocument,
): DesignOpenResult {
  const load: LocalStorageStoreLoad = store.rawLoad();
  if (load.status === 'loaded') {
    return { document: load.document, storedRevision: load.storedRevision, banner: null };
  }
  if (load.status === 'empty') {
    return { document: seed, storedRevision: SERVICE_SEED_REVISION, banner: null };
  }
  if (load.overwritable) {
    // Readable envelope, invalid document: seed CONTENT at the RECORDED
    // revision so the replacement save is actually accepted.
    return {
      document: seed,
      storedRevision: load.storedRevision ?? SERVICE_SEED_REVISION,
      banner: `Stored design data was not usable (${load.message}). A fresh seed was loaded; the next successful save replaces the stored data.`,
    };
  }
  return {
    document: seed,
    storedRevision: SERVICE_SEED_REVISION,
    banner: `Stored design data is unreadable and has been PRESERVED (${load.message}). Save will fail until the site data for this key is cleared.`,
  };
}
