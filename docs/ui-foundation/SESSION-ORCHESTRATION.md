# Safe orchestration over the session API (host guide)

For hosts composing editing surfaces from `@victframework/ui`'s lower-level session API
(`UiEditSession`) rather than `EditorBridge`. This documents the U1-established guarantees
the U2 proofs rely on, and the orchestration contract a custom host MUST follow.

## The two-phase save

1. `stageSave({ expectedStoredRevision })` — computes the saved bytes and the next stored
   revision WITHOUT mutating the session. Opening a stage OPENS THE SAVE WINDOW: while the
   window is open, further `stageSave` calls are refused
   (`UI_EDIT_SAVE_IN_PROGRESS`) — a nested save can never supersede the outer stage.
2. Persist via the injected `DocumentStorePort.save` (the store is the revision AUTHORITY:
   it checks `expectedStoredRevision` atomically and refuses stale writers).
3. `commitSave(stage)` — applies the stage only after persistence succeeded. Guards, all
   pre-mutation: stage OWNERSHIP (only the session's current stage object commits), stored
   revision unmoved, working session unmoved (an edit accepted between stage and commit is
   PRESERVED and the commit refused).
4. `releaseSaveWindow()` — the OWNING operation must call this in a `finally` block.
   Nested stage/commit attempts never touch the lock; only the owner releases it.
   `session.save()` (the convenience wrapper) owns its window automatically and returns a
   refused commit TRUTHFULLY.

## Failure semantics (preserve, never lie)

- **Failed or thrown write:** session untouched (working document, dirty state, stored
  revision, undo/redo continuity all preserved); the window closes in your `finally`.
- **Refused commit after persistence** (should not happen behind `EditorBridge`, which
  blocks edits for the whole window): the session keeps its pre-commit state truthfully —
  the host MUST reconcile by reopening from the authoritative store. The refusal is
  returned, never converted into a fake success.
- **Retry after a failed save:** works at the correct next revision once the window is
  released.

## The store contract

- `DocumentStorePort.save` checks `expectedStoredRevision` against the authoritative
  stored revision in the same synchronous turn as the write (check-then-set).
- An EMPTY store accepts exactly one seed revision (`SEED_STORED_REVISION`).
- Preservation policy (identical in load and save): payloads classified unreadable by
  `classifyStored` are load-invalid with `overwritable:false` AND save-refused
  (`UI_STORE_CORRUPT`, bytes unchanged). Readable envelopes whose document fails the
  host's validation gate are invalid+overwritable and carry the RECORDED revision, so a
  replacement save from a seeded editor is actually accepted.
- Per-origin, per-key partitioning: localStorage is partitioned by origin; changing the
  storage key means a different store.

## `EditorBridge` (recommended)

`EditorBridge` implements this contract for you: it refuses apply/undo/redo during the
whole save window (`UI_EDIT_SAVE_IN_PROGRESS`, window released via try/finally), wraps
`store.save` + `commitSave`, reports post-persistence refusals truthfully, and exposes
`reopen()` with `UI_STORE_EMPTY` / `UI_STORE_INVALID` (+ `overwritable`,
`storedRevision`) classification. Use it unless you have a concrete reason to orchestrate
the session directly.
