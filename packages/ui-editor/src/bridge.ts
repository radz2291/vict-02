/**
 * EditorBridge — the Svelte-facing session wrapper (U1).
 *
 * Owns ONE `UiEditSession` and exposes a plain observable snapshot for the
 * canvas/inspector/history modules. The bridge NEVER bypasses the exported
 * transactional commands and never mutates documents directly. Persistence
 * goes through the injected `saveDocument` port (expected-revision save);
 * reopen restores a fresh session over stored bytes.
 */

import {
  UiEditSession,
  canonicalUiDocument,
  uiDiagnostic,
  type UiDocument,
  type UiCatalogs,
  type UiEditSessionState,
  type UiApplyOutcome,
  type UiDiagnostic,
  type UiSaveOutcome,
} from '@victframework/ui';
import type { TransactionDraft } from './commands.js';

import type { DocumentStorePort, DocumentStoreLoadResult } from '@victframework/ui';
export type { DocumentStorePort, DocumentStoreLoadResult } from '@victframework/ui';

export interface EditorBridgeState {
  readonly revision: string;
  readonly storedRevision: string;
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly selectedOccurrence: string | undefined;
  readonly contentDigest: string;
}

export class EditorBridge {
  #session: UiEditSession;
  readonly #store: DocumentStorePort;
  #selectedOccurrence: string | undefined = undefined;
  #listeners = new Set<() => void>();
  /**
   * True for the whole save window (stage → store ack → commit). Edits are
   * REFUSED during that window: a storage callback that re-entered the bridge
   * could otherwise accept an edit between stage and commit, which the commit
   * would then have to reject — discarding it or stranding the acknowledged
   * store against a stale baseline. One synchronous save window, no edits.
   */
  #saveInFlight = false;

  constructor(input: {
    readonly catalogs?: UiCatalogs;
    readonly store: DocumentStorePort;
    readonly initial: { readonly document: UiDocument; readonly storedRevision: string };
  }) {
    this.#session = UiEditSession.open({ ...input.initial, catalogs: input.catalogs });
    this.#store = input.store;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): EditorBridgeState => ({
    revision: this.#session.workingRevision,
    storedRevision: this.#session.storedRevision,
    dirty: this.#session.isDirty(),
    canUndo: this.#session.canUndo(),
    canRedo: this.#session.canRedo(),
    selectedOccurrence: this.#selectedOccurrence,
    contentDigest: canonicalUiDocument(this.#session.document).contentDigest,
  });

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }

  get document(): UiDocument {
    return this.#session.document;
  }

  get session(): UiEditSession {
    return this.#session;
  }

  /** The working snapshot for canvas rendering (plan recompiled by the host). */
  state(): UiEditSessionState {
    return this.#session.state();
  }

  select(occurrence: string | undefined): void {
    this.#selectedOccurrence = occurrence;
    this.#emit();
  }

  /** Apply one assembled transaction draft (expected revision = current working). */
  apply(draft: TransactionDraft): UiApplyOutcome {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_EDIT_SAVE_IN_PROGRESS',
            'Edit refused: a save is being acknowledged; retry the edit after the save settles.',
            {},
          ),
        ],
      };
    }
    const outcome = this.#session.applyTransaction({
      requestId: draft.requestId,
      expectedDocumentRevision: this.#session.workingRevision,
      ...(draft.reason !== undefined ? { reason: draft.reason } : {}),
      commands: draft.commands,
    });
    this.#emit();
    return outcome;
  }

  undo(): UiApplyOutcome {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_EDIT_SAVE_IN_PROGRESS',
            'Undo refused: a save is being acknowledged; retry after the save settles.',
            {},
          ),
        ],
      };
    }
    const outcome = this.#session.undo();
    this.#emit();
    return outcome;
  }

  redo(): UiApplyOutcome {
    if (this.#saveInFlight) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_EDIT_SAVE_IN_PROGRESS',
            'Redo refused: a save is being acknowledged; retry after the save settles.',
            {},
          ),
        ],
      };
    }
    const outcome = this.#session.redo();
    this.#emit();
    return outcome;
  }

  /**
   * Two-phase expected-revision save: the session STAGES the saved bytes,
   * the store (the revision AUTHORITY) checks `expectedStoredRevision`
   * atomically with the write, and the session COMMITS only after the store
   * acknowledged. A failed, rejecting or thrown storage write leaves the
   * working document, dirty state, stored revision and undo/redo continuity
   * untouched; other storage failures are reported truthfully.
   */
  save():
    | UiSaveOutcome
    | {
        readonly ok: false;
        readonly issues: readonly { readonly code: string; readonly message: string }[];
      } {
    const staged = this.#session.stageSave({
      expectedStoredRevision: this.#session.storedRevision,
    });
    if (!staged.ok) return staged;
    let persisted: ReturnType<DocumentStorePort['save']>;
    let commitFailure: { readonly ok: false; readonly issues: readonly UiDiagnostic[] } | undefined;
    this.#saveInFlight = true;
    try {
      persisted = this.#store.save({
        document: staged.staged.document,
        newStoredRevision: staged.staged.storedRevision,
        expectedStoredRevision: staged.staged.fromStoredRevision,
      });
      // Still inside the save window: a re-entrant store callback could not
      // have edited (refused above); the session-level guard is the second
      // line of defense and keeps any intervening state truthfully.
      if (persisted.ok) {
        const committed = this.#session.commitSave(staged.staged);
        if (!committed.ok) commitFailure = committed;
      }
    } catch (error) {
      // Thrown storage failure: truthful, and the session stays untouched.
      return {
        ok: false,
        issues: [
          {
            code: 'UI_STORE_WRITE_FAILED',
            message: `Storage write failed: ${String(error instanceof Error ? error.message : error)}`,
          },
        ],
      };
    } finally {
      this.#saveInFlight = false;
      // Release the session's save window when THIS operation ends —
      // success, refused commit, failed or thrown write. Nested calls are
      // refused during the window and can neither supersede its stage nor
      // release its lock.
      this.#session.releaseSaveWindow();
    }
    if (!persisted.ok) {
      return {
        ok: false,
        issues: [
          {
            code: persisted.code ?? 'UI_STORE_WRITE_FAILED',
            message: persisted.reason,
          },
        ],
      };
    }
    if (commitFailure !== undefined) {
      // The store acknowledged but the commit was refused: the session
      // truthfully keeps its pre-commit state (edits intact, older saved
      // baseline, still dirty). Surfaced so the host can reconcile by
      // reopening from the authoritative store.
      return commitFailure;
    }
    this.#emit();
    return {
      ok: true,
      storedRevision: staged.staged.storedRevision,
      document: staged.staged.document,
      contentDigest: staged.staged.contentDigest,
    };
  }

  /**
   * Reload from the store: a FRESH session over the authoritative stored
   * bytes (history cleared). An empty or invalid store is reported — never
   * silently treated as a successful reopen.
   */
  reopen():
    | { readonly ok: true; readonly storedRevision: string }
    | {
        readonly ok: false;
        readonly code: 'UI_STORE_EMPTY' | 'UI_STORE_INVALID';
        readonly message?: string;
        readonly overwritable?: boolean;
        readonly storedRevision?: string;
      } {
    const stored = this.#store.load();
    if (stored.status === 'empty') {
      return { ok: false, code: 'UI_STORE_EMPTY', message: 'No stored document exists.' };
    }
    if (stored.status === 'invalid') {
      return {
        ok: false,
        code: 'UI_STORE_INVALID',
        message: stored.message,
        ...(stored.overwritable !== undefined ? { overwritable: stored.overwritable } : {}),
        ...(stored.storedRevision !== undefined ? { storedRevision: stored.storedRevision } : {}),
      };
    }
    this.#session = this.#session.reopen({
      document: stored.document,
      storedRevision: stored.storedRevision,
    });
    this.#selectedOccurrence = undefined;
    this.#emit();
    return { ok: true, storedRevision: stored.storedRevision };
  }
}
