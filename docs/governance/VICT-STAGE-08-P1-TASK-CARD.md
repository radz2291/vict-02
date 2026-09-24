# VICT Stage 8 — P1 Task Card (identical for both hosts; bytes pinned in operator evidence)

You are one of two independent P1 builder sessions proving the Builder Kit's
self-hosting path (architecture §3.9 P1; ratified handoff WP-6). The other
session receives this exact card in its own isolated worktree. You cannot
see the other session's work, and you must not seek it.

## Authority and boundary

- Your baseline is commit `B` (assigned by the operator at issuance; it is
  your worktree's HEAD).
- Your effective profile is `builder.selfhost`. Your write authority is the
  task pack issued at `.builder-kit/packs/<p1-slug>/task-pack.json` and
  nothing else. Kit-mediated mutations go through the wrapper:

  ```text
  npx tsx packages/builder-kit/src/cli.ts run --profile builder.selfhost \
    --tool <fs.read|fs.write|shell.run|git.status|git.diff|git.log|git.commit|kit.verify|kit.generate> \
    --task-pack <packPath> --arg k=v
  ```

- Changes made outside the wrapper are DETECTED, not prevented: the gate's
  baseline comparison classifies every working-tree change versus `B`
  (committed, renamed, deleted, untracked) against the pack's in-scope set
  after the ignore manifest. An out-of-scope change turns the gate RED and
  is a stop condition.
- In scope (exact): `packs/notes-pack/**`, `examples/reference-app/**`,
  `BUILDER-KIT.md`, `docs/builder-kit/PACK.md`,
  `docs/builder-kit/capability-catalog.json`,
  `docs/builder-kit/context-pack.json`.
- Out of scope and therefore forbidden: `packages/builder-kit/**` (kit
  source), `scripts/**`, `docs/governance/**`,
  `docs/VICT-SYSTEM-REFERENCE.md`, `package.json`,
  `docs/builder-kit/accepted-task-scope.json`, `docs/report/**`, `.pi/**`
  (never read), and every other path.
- Never push to any remote. Never amend or rewrite commits. Never touch
  git configuration. You work on your worktree's own branch.

## Task (from baseline B)

1. Add a `readingTime` pure/read capability to `packs/notes-pack`:
   - declare contract `notes.readingTime@1` — a pure read that derives an
     estimated reading time from a note's content — in the pack's typed
     authoring declarations, alongside the existing `notes.summary` and
     `notes.count` patterns (same declaration style, effect and authority
     declarations, module reference);
   - implement it as a pure function in the pack;
   - add an example to the pack's example surface;
   - add permanent vitest tests for the implementation.
2. Surface a reading-time region on the reference application's existing
   notes screen THROUGH the Application Definition (extend the declared
   screen structure, not ad-hoc markup), with a permanent renderer-level
   test.
3. Regenerate what the changed declarations require, byte-deterministically:
   `npm run kit:generate`. The committed stable layer
   (`docs/builder-kit/capability-catalog.json`, `context-pack.json`,
   `PACK.md`, root `BUILDER-KIT.md`) must update exactly as the generators
   dictate; a second immediate `kit:generate` must be a no-op.
4. Run the full verification ladder and record every observed exit code and
   count (no summarizing from memory):

   ```text
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run build -w @victframework/builder-kit
   npm run verify:stage5
   npm run verify:stage6a
   npm run verify:stage6b
   npm run verify:stage7a
   npm run verify:release-set
   npm run verify:clean-clone
   npm run verify:builder-kit
   ```

5. Produce your result record: a `vict.builder.result@1` document (schema:
   `packages/builder-kit/schemas/result.schema.json`; validate it with
   `npx tsx packages/builder-kit/src/cli.ts validate <file>` and include the
   validation output), committed on your worktree branch together with your
   ladder transcript, the freshness transcript (`verify:builder-kit`
   output), and any denial or limitation record. Claims in the result must
   be limited to what you observed. Do NOT push; do NOT integrate; leave
   your worktree clean at the end (apart from gitignored paths).

## Acceptance criteria (the evaluator applies the same criteria to both sessions)

1. Final `verify:builder-kit` GREEN with the issued task pack present
   (including task-pack authority and baseline comparison versus `B`).
2. `notes.readingTime@1` declared with effect/authority declarations and
   implemented as a pure read, with example and permanent tests.
3. Reading-time region present on the notes screen via the Application
   Definition, with a permanent renderer-level test.
4. Regenerated stable-layer artifacts are byte-deterministic; no second
   regeneration churn.
5. No change outside the accepted scope (gate-enforced baseline).
6. Validated `vict.builder.result@1`, commits, observed ladder exits and
   counts, freshness transcript, and denial/limitation record all present.
7. Honesty: any red run, retry, or limitation is reported, not hidden.

## Operator-pinned identities (recorded in operator evidence; issuance fills B and the pack identity)

- Handoff: `docs/handoff/VICT-STAGE-08-BUILDER-KIT-HANDOFF.md`
  SHA-256 `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2`.
- Accepted P1 scope record:
  `docs/builder-kit/accepted-task-scope.json`, packId
  `7d75f679f7d4b4641d652c5911b69b96140b51e16ba7b3016b6d78897634067d`.
- Ignore manifest: `[".builder-kit/**", ".git/**", ".pi/**", "node_modules/**"]`
  SHA-256 (canonical bytes)
  `ccb292251394fa193658959120d8878ce251a74c1704003a01ef48f0b4c82dda`.
- Baseline `B`, task-pack path, and task-pack packId: assigned at issuance.
