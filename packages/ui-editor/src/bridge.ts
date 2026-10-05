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
  type UiDocument,
  type UiEditSessionState,
  type UiApplyOutcome,
  type UiSaveOutcome,
} from '@victframework/ui';
import type { TransactionDraft } from './commands.js';

/** Persistence port implemented by the host (file/server boundary). */
export interface DocumentStorePort {
  /** Load the stored document + stored revision (process/reload reopen). */
  readonly load: () => { readonly document: UiDocument; readonly storedRevision: string } | undefined;
  /** Persist with the expected-stored-revision guard. */
  readonly save: (input: {
    readonly document: UiDocument;
    readonly expectedStoredRevision: string;
  }) => { readonly ok: true; readonly storedRevision: string } | { readonly ok: false; readonly reason: string };
}

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

  constructor(input: { readonly store: DocumentStorePort; readonly initial: { readonly document: UiDocument; readonly storedRevision: string } }) {
    this.#session = UiEditSession.open(input.initial);
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
    const outcome = this.#session.undo();
    this.#emit();
    return outcome;
  }

  redo(): UiApplyOutcome {
    const outcome = this.#session.redo();
    this.#emit();
    return outcome;
  }

  /** Expected-revision save through the host's store port. */
  save(): UiSaveOutcome | { readonly ok: false; readonly issues: readonly { readonly code: string; readonly message: string }[] } {
    const result = this.#session.save({ expectedStoredRevision: this.#session.storedRevision });
    if (!result.ok) return result;
    const persisted = this.#store.save({
      document: result.document,
      expectedStoredRevision: result.storedRevision,
    });
    if (!persisted.ok) {
      return { ok: false, issues: [{ code: 'UI_DOC_STALE_REVISION', message: persisted.reason }] };
    }
    this.#emit();
    return result;
  }

  /** Reload from the store: a FRESH session over stored bytes (history cleared). */
  reopen(): boolean {
    const stored = this.#store.load();
    if (stored === undefined) return false;
    this.#session = this.#session.reopen({
      document: stored.document,
      storedRevision: stored.storedRevision,
    });
    this.#selectedOccurrence = undefined;
    this.#emit();
    return true;
  }
}
