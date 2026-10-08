import type { UiDocument } from './document.js';

/** Result of loading the authoritative stored bytes. */
export type DocumentStoreLoadResult =
  | { readonly status: 'loaded'; readonly document: UiDocument; readonly storedRevision: string }
  | { readonly status: 'empty' }
  | {
      readonly status: 'invalid';
      readonly message: string;
      /** false: payload unreadable — the store refuses to overwrite it. */
      readonly overwritable?: boolean;
      /** Present when the envelope was readable (the overwritable class). */
      readonly storedRevision?: string;
    };

/** Persistence port implemented by the host (file/server boundary). */
export interface DocumentStorePort {
  /** Load the authoritative stored document + revision (reload/reopen). */
  readonly load: () => DocumentStoreLoadResult;
  /**
   * Persist ATOMICALLY: the store is the revision AUTHORITY. It must check
   * `expectedStoredRevision` against its own authoritative stored revision
   * and write through under the NEW revision in the same synchronous turn;
   * a mismatch fails with code `UI_DOC_STALE_REVISION` and MUST NOT write.
   * A stale editor can therefore never overwrite a newer saved document.
   */
  readonly save: (input: {
    readonly document: UiDocument;
    readonly newStoredRevision: string;
    readonly expectedStoredRevision: string;
  }) =>
    | { readonly ok: true; readonly storedRevision: string }
    | {
        readonly ok: false;
        readonly code?: 'UI_DOC_STALE_REVISION' | (string & {});
        readonly reason: string;
      };
}

