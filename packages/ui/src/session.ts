/**
 * Authoring session core (API-SPEC §6.1): transactions, idempotency,
 * monotonic revisions, undo/redo, dirty tracking, expected-revision save
 * and reopen. Framework-neutral; the Svelte boundary lives in
 * `packages/ui-editor`.
 *
 * Revision discipline (frozen semantics):
 * - the WORKING revision advances monotonically on every accepted
 *   transaction, undo and redo — restoring old content never rewinds it;
 * - the STORED revision advances only at save; stale saves fail with
 *   `UI_DOC_STALE_REVISION`; no silent last-write-wins;
 * - undo/redo revalidate continuity against the current working revision
 *   (`UI_EDIT_UNDO_CONFLICT` when history no longer applies);
 * - the saved document's own `revision` field advances at save (the
 *   catalog-visible revision).
 */

import type { UiCatalogs, UiDocument } from './document.js';
import { uiDiagnostic, type UiDiagnostic } from './diagnostics.js';
import { canonicalUiDocument } from './canonical.js';
import {
  applyUiEdit,
  cloneDocument,
  type UiDocumentSnapshot,
  type UiEditCommand,
  type UiEditTransaction,
} from './edit.js';
import { defaultSemanticElementCatalog } from './semantic.js';

export interface UiEditSessionState {
  readonly working: UiDocumentSnapshot;
  readonly storedRevision: string;
  readonly storedDocument: UiDocument;
  readonly dirty: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type UiApplyOutcome =
  | { readonly ok: true; readonly revision: string; readonly requestId: string }
  | { readonly ok: false; readonly issues: readonly UiDiagnostic[] };

export type UiSaveOutcome =
  | {
      readonly ok: true;
      readonly storedRevision: string;
      readonly document: UiDocument;
      readonly contentDigest: string;
    }
  | { readonly ok: false; readonly issues: readonly UiDiagnostic[] };

/**
 * A save computed but NOT yet committed (two-phase save). The host persists
 * the staged bytes first; only a successful persistence is committed to the
 * session — a failed write leaves revision, dirty state and undo/redo
 * continuity exactly as they were.
 */
export interface UiStagedSave {
  /** The stored revision the stage was computed from (commit guard). */
  readonly fromStoredRevision: string;
  /** The working sequence at stage time (commit guard: working moved?). */
  readonly fromWorkingSequence: number;
  readonly storedRevision: string;
  readonly document: UiDocument;
  readonly contentDigest: string;
}

interface HistoryEntry {
  readonly requestId: string;
  readonly before: UiDocument;
  readonly after: UiDocument;
}

interface IdempotencyRecord {
  readonly fingerprint: string;
  readonly document: UiDocument;
  readonly revision: string;
}

export class UiEditSession {
  #working: UiDocumentSnapshot;
  #storedRevision: string;
  #storedDocument: UiDocument;
  #undoStack: HistoryEntry[] = [];
  #redoStack: HistoryEntry[] = [];
  #idempotency = new Map<string, IdempotencyRecord>();
  #sequence = 0;
  /** The stage returned by the most recent stageSave (commit ownership guard). */
  #pendingStage: UiStagedSave | undefined = undefined;
  readonly #catalogs: UiCatalogs | undefined;

  private constructor(
    snapshot: UiDocumentSnapshot,
    storedDocument: UiDocument,
    storedRevision: string,
    catalogs?: UiCatalogs,
  ) {
    this.#working = snapshot;
    this.#storedRevision = storedRevision;
    this.#storedDocument = storedDocument;
    this.#catalogs = catalogs;
  }

  /** Open a session over a stored document + its stored revision. */
  static open(input: {
    readonly document: UiDocument;
    readonly storedRevision: string;
    readonly catalogs?: UiCatalogs;
  }): UiEditSession {
    const document = input.document;
    return new UiEditSession(
      { document, revision: `${input.storedRevision}#0` },
      cloneDocument(document),
      input.storedRevision,
      input.catalogs ?? {
        elements: defaultSemanticElementCatalog(),
        // Product references are the JOINT compiler's obligation (API-SPEC
        // §2.2 rule 4): an unconfigured session does not fail transactions
        // over them.
        actionIds: undefined,
        routeIds: undefined,
      },
    );
  }

  /** Convenience alias matching the proposed session API name. */
  static loadSnapshot(input: {
    readonly document: UiDocument;
    readonly storedRevision: string;
    readonly catalogs?: UiCatalogs;
  }): UiEditSession {
    return UiEditSession.open(input);
  }

  get workingRevision(): string {
    return this.#working.revision;
  }

  get document(): UiDocument {
    return this.#working.document;
  }

  get storedRevision(): string {
    return this.#storedRevision;
  }

  isDirty(): boolean {
    // Dirt is CONTENT not yet persisted: compared by history identity (the
    // document-level revision stamp differs by design between the working
    // lineage and the saved bytes — see historyIdentity).
    return historyIdentity(this.#working.document) !== historyIdentity(this.#storedDocument);
  }

  canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  /** Apply one transaction (idempotent per requestId within this session). */
  applyTransaction(transaction: UiEditTransaction): UiApplyOutcome {
    const recorded = this.#idempotency.get(transaction.requestId);
    if (recorded !== undefined) {
      const fingerprint = fingerprintOf(transaction);
      if (recorded.fingerprint === fingerprint) {
        // Reconcile to the recorded result — but only if history still ends there.
        if (this.#working.revision === recorded.revision) {
          this.#working = { document: recorded.document, revision: recorded.revision };
          return { ok: true, revision: recorded.revision, requestId: transaction.requestId };
        }
        return {
          ok: false,
          issues: [
            uiDiagnostic(
              'UI_EDIT_REQUEST_CONFLICT',
              'Replayed request no longer applies to the current revision.',
              {
                requestId: transaction.requestId,
              },
            ),
          ],
        };
      }
      return {
        ok: false,
        issues: [
          uiDiagnostic('UI_EDIT_REQUEST_CONFLICT', 'requestId reuse with a different payload.', {
            requestId: transaction.requestId,
          }),
        ],
      };
    }
    const result = applyUiEdit(this.#working, transaction, this.#catalogs);
    if (!result.ok) {
      return { ok: false, issues: result.issues };
    }
    const before = this.#working.document;
    this.#sequence += 1;
    const nextRevision = `${this.#storedRevision}#${this.#sequence}`;
    this.#working = { document: result.document, revision: nextRevision };
    this.#undoStack = [
      ...this.#undoStack,
      { requestId: transaction.requestId, before, after: result.document },
    ];
    this.#redoStack = [];
    this.#idempotency.set(transaction.requestId, {
      fingerprint: fingerprintOf(transaction),
      document: result.document,
      revision: nextRevision,
    });
    return { ok: true, revision: nextRevision, requestId: transaction.requestId };
  }

  /** Undo the last accepted transaction. */
  undo(): UiApplyOutcome {
    const entry = this.#undoStack[this.#undoStack.length - 1];
    if (entry === undefined) {
      return {
        ok: false,
        issues: [
          uiDiagnostic('UI_EDIT_UNDO_CONFLICT', 'Nothing to undo.', {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision,
          }),
        ],
      };
    }
    // Revalidation: the undo applies only when history still ends at the
    // current working revision. Compared by HISTORY identity (canonical bytes
    // with the document-level revision stamp normalized): a save stamps the
    // working document's `revision` without changing its content, so history
    // captured before a save still matches afterwards. Canonical application
    // identity (contentDigest) is untouched.
    if (this.#working.document !== entry.after) {
      const currentDigest = historyIdentity(this.#working.document);
      const afterDigest = historyIdentity(entry.after);
      if (currentDigest !== afterDigest) {
        return {
          ok: false,
          issues: [
            uiDiagnostic('UI_EDIT_UNDO_CONFLICT', 'Current source diverged from the undo point.', {
              expectedRevision: entry.after ? this.#working.revision : this.#working.revision,
              currentRevision: this.#working.revision,
            }),
          ],
        };
      }
    }
    this.#undoStack = this.#undoStack.slice(0, -1);
    this.#redoStack = [...this.#redoStack, entry];
    this.#sequence += 1;
    this.#working = {
      document: entry.before,
      revision: `${this.#storedRevision}#${this.#sequence}`,
    };
    return { ok: true, revision: this.#working.revision, requestId: `undo:${entry.requestId}` };
  }

  /** Redo the most recently undone transaction. */
  redo(): UiApplyOutcome {
    const entry = this.#redoStack[this.#redoStack.length - 1];
    if (entry === undefined) {
      return {
        ok: false,
        issues: [
          uiDiagnostic('UI_EDIT_UNDO_CONFLICT', 'Nothing to redo.', {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision,
          }),
        ],
      };
    }
    const currentDigest = historyIdentity(this.#working.document);
    const beforeDigest = historyIdentity(entry.before);
    if (this.#working.document !== entry.before && currentDigest !== beforeDigest) {
      return {
        ok: false,
        issues: [
          uiDiagnostic('UI_EDIT_UNDO_CONFLICT', 'Current source diverged from the redo point.', {
            expectedRevision: this.#working.revision,
            currentRevision: this.#working.revision,
          }),
        ],
      };
    }
    this.#redoStack = this.#redoStack.slice(0, -1);
    this.#undoStack = [...this.#undoStack, entry];
    this.#sequence += 1;
    this.#working = {
      document: entry.after,
      revision: `${this.#storedRevision}#${this.#sequence}`,
    };
    return { ok: true, revision: this.#working.revision, requestId: `redo:${entry.requestId}` };
  }

  /**
   * Save with the expected-stored-revision guard. Advances the stored
   * revision deterministically (numeric revisions increment; otherwise a
   * `.r1`, `.r2`, … suffix is appended) and stamps the saved document's own
   * `revision` field so catalog pins can address exactly these bytes.
   */
  save(input: { readonly expectedStoredRevision: string }): UiSaveOutcome {
    const staged = this.stageSave(input);
    if (!staged.ok) return staged;
    this.commitSave(staged.staged);
    return {
      ok: true,
      storedRevision: staged.staged.storedRevision,
      document: staged.staged.document,
      contentDigest: staged.staged.contentDigest,
    };
  }

  /**
   * Two-phase save, stage: compute the saved bytes and next stored revision
   * WITHOUT mutating the session. The host persists the staged bytes first
   * (the store is the revision AUTHORITY); commitSave applies the stage only
   * after persistence succeeded, so a failed write preserves the working
   * document, dirty state, stored revision and undo/redo continuity.
   */
  stageSave(input: {
    readonly expectedStoredRevision: string;
  }):
    | { readonly ok: true; readonly staged: UiStagedSave }
    | { readonly ok: false; readonly issues: readonly UiDiagnostic[] } {
    if (input.expectedStoredRevision !== this.#storedRevision) {
      return {
        ok: false,
        issues: [
          uiDiagnostic('UI_DOC_STALE_REVISION', 'Save rejected: the stored revision moved.', {
            expectedRevision: input.expectedStoredRevision,
            storedRevision: this.#storedRevision,
          }),
        ],
      };
    }
    const nextStored = advanceStoredRevision(this.#storedRevision);
    const saved: UiDocument = { ...this.#working.document, revision: nextStored };
    const staged: UiStagedSave = {
      fromStoredRevision: this.#storedRevision,
      fromWorkingSequence: this.#sequence,
      storedRevision: nextStored,
      document: saved,
      contentDigest: canonicalUiDocument(saved).contentDigest,
    };
    // Recorded on THIS session: only the exact object returned by the most
    // recent stageSave can commit (a stage from another session, or a stale
    // stage superseded by a later one, is rejected).
    this.#pendingStage = staged;
    return { ok: true, staged };
  }

  /**
   * Two-phase save, commit: apply a staged save after the host's persistence
   * succeeded. Guards, all checked BEFORE any mutation: (a) the staged object
   * must be this session's most recent stage (a stage from another session,
   * or a stale stage superseded by a later one, is rejected); (b) the stored
   * revision must not have moved since the stage; (c) the working session
   * must not have moved since the stage — an edit/undo/redo accepted between
   * stage and commit is PRESERVED and the commit is refused, so staged bytes
   * can never silently replace newer working state.
   *
   * If a host's persistence already wrote when the commit is refused, the
   * session truthfully keeps its pre-commit state (edits intact, older saved
   * baseline, still dirty): the host MUST reconcile by reopening from the
   * authoritative store — the session never claims the uncommitted baseline
   * was saved. `EditorBridge` prevents that situation by refusing edits for
   * the whole save window.
   */
  commitSave(
    staged: UiStagedSave,
  ): { readonly ok: true } | { readonly ok: false; readonly issues: readonly UiDiagnostic[] } {
    if (staged !== this.#pendingStage) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_DOC_STALE_REVISION',
            'Commit rejected: this staged save does not belong to the current session state.',
            {
              expectedRevision: staged.fromStoredRevision,
              storedRevision: this.#storedRevision,
            },
          ),
        ],
      };
    }
    if (staged.fromStoredRevision !== this.#storedRevision) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_DOC_STALE_REVISION',
            'Commit rejected: the stored revision moved since the save was staged.',
            {
              expectedRevision: staged.fromStoredRevision,
              storedRevision: this.#storedRevision,
            },
          ),
        ],
      };
    }
    if (staged.fromWorkingSequence !== this.#sequence) {
      return {
        ok: false,
        issues: [
          uiDiagnostic(
            'UI_DOC_STALE_REVISION',
            'Commit rejected: the working session moved since the save was staged; the intervening edits are preserved.',
            {
              expectedRevision: staged.fromStoredRevision,
              storedRevision: this.#storedRevision,
            },
          ),
        ],
      };
    }
    this.#storedRevision = staged.storedRevision;
    this.#storedDocument = cloneDocument(staged.document);
    // The working snapshot continues from the new stored revision.
    this.#working = {
      document: staged.document,
      revision: `${staged.storedRevision}#${this.#sequence + 1}`,
    };
    this.#sequence += 1;
    this.#pendingStage = undefined;
    return { ok: true };
  }

  /** Reopen a fresh session over stored bytes (history cleared). */
  reopen(input: { readonly document: UiDocument; readonly storedRevision: string }): UiEditSession {
    return UiEditSession.open(input);
  }

  /** Structural snapshot for inspector surfaces. */
  state(): UiEditSessionState {
    return {
      working: this.#working,
      storedRevision: this.#storedRevision,
      storedDocument: this.#storedDocument,
      dirty: this.isDirty(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

/**
 * History-continuity identity: the canonical bytes with the document-level
 * revision stamp normalized away. A successful save stamps the working
 * document's revision field without changing content, so history entries
 * captured before a save must still match the working document afterwards.
 * Canonical application identity (contentDigest) is NOT affected — this
 * normalization exists only for undo/redo continuity comparisons.
 */
function historyIdentity(document: UiDocument): string {
  return canonicalUiDocument({ ...document, revision: '' }).contentDigest;
}
function fingerprintOf(transaction: UiEditTransaction): string {
  return canonicalUiDocument({
    expectedDocumentRevision: transaction.expectedDocumentRevision,
    reason: transaction.reason,
    commands: transaction.commands as readonly unknown[],
  }).contentDigest;
}

/** Deterministic stored-revision advance (save-boundary discipline). */
export function advanceStoredRevision(storedRevision: string): string {
  if (/^\d+$/.test(storedRevision)) return String(Number(storedRevision) + 1);
  const match = /\.r(\d+)$/.exec(storedRevision);
  if (match !== null) {
    return `${storedRevision.slice(0, -match[0].length)}.r${Number(match[1]) + 1}`;
  }
  return `${storedRevision}.r1`;
}

export type { UiEditCommand, UiDocumentSnapshot };
