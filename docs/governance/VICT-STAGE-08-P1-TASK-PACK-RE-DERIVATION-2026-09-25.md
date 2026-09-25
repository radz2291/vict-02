# Task-Pack Re-Derivation Rule for a Legitimate Generated Base-Pack Change

> **Document type:** governance note (new file; no existing filed record was
> edited). Claim record, NOT independently authoritative. **Stage 8 remains
> NOT Verified; this note assigns no status.**

## 1. Finding this rule resolves

The G2/P1 host sessions surfaced a real tension in the current gate design
(recorded in `docs/governance/VICT-STAGE-08-G2-P1-PROOF-2026-09-25.md` §3
and §7.5): when a task's accepted scope legitimately includes the GENERATED
stable layer (`docs/builder-kit/**`), executing the task runs the mandated
regeneration, which changes the committed base pack's `packId`. The ISSUED
task pack binds the base pack by `basePackId` (architecture §3.3), so the
gate's `task-pack:base-pack-binding` and `task-pack:regenerate-compare`
checks — which compare against the CURRENT committed base pack — fail for
the issued pack after any successful in-scope execution. Both P1 hosts
resolved this identically and transparently (re-derivation from identical
inputs; issued bytes preserved); neither bypassed the gate. This note
specifies the rule they followed so it is procedure, not improvisation.

## 2. The rule

A task-pack **re-derivation** is permitted ONLY under all of the following:

1. **Trigger** — the committed base pack changed because the task's
   accepted scope legitimately includes the generated stable layer and the
   task's mandated regeneration produced a new base-pack `packId`. (A base
   pack that moved for any other reason is NOT a re-derivation trigger.)
2. **Evidence preservation** — the issued pack's bytes are copied verbatim
   to a preserved evidence path BEFORE re-derivation (the per-handoff
   output directory is shared, so the copy must precede the write). The
   issued pack is never silently overwritten.
3. **Identical derivation inputs** — the successor is generated from
   EXACTLY the same §3.3 inputs as the issuance: same handoff document
   (path + bytes), same baseline commit `baseTree`, same `inScopePaths`,
   same ignore manifest (hence same `ignoreManifestDigest`), same
   `permissionProfile`. No task-authority field may change.
4. **Bounded identity delta** — the successor differs from the issued pack
   in EXACTLY the derived identity pair: `basePackId` (the new committed
   base pack) and the recomputed `packId`. Every other field is
   byte-identical.
5. **Re-verification** — the successor must pass full task-pack authority
   verification (all eight checks, including the accepted-scope binding
   and the baseline comparison) before any wrapper or gate accepts it.

## 3. What re-derivation is NOT

- **Not an authority grant.** The recomputed `packId` certifies BYTES,
  never authority (architecture §3.9). A pack whose scope, ignore
  manifest, permission profile, or handoff binding differs from the
  accepted record is refused even with a self-consistent recomputed
  `packId`.
- **Not a baseline escape.** The successor keeps the ORIGINAL `baseTree`;
  the gate's baseline comparison still runs against the pinned baseline.
- **Not silent.** The re-derivation (old and new identity pair, and the
  evidence path of the issued pack) is recorded in the task's session
  evidence and is auditable.

## 4. Permanent test evidence

`packages/builder-kit/test/task-pack-re-derivation.test.ts` proves the rule
on the kit fixture:

- GREEN — after a legitimate scoped change + regeneration + commit, the
  successor generated from identical inputs differs from the issued pack
  in exactly `basePackId` + `packId`; the successor passes
  `verifyTaskPackAuthority`; the preserved evidence copy still holds the
  issued bytes.
- RED — a "successor" that additionally expands scope
  (`examples/**` smuggled in) with a recomputed, self-consistent `packId`
  FAILS authority verification at the accepted-scope check. Changing a
  task-authority field cannot pass as routine re-derivation.
- RED — the un-re-derived ISSUED pack fails authority verification after
  the base-pack change (the motivating negative: `base-pack-binding` /
  `regenerate-compare`), proving the rule is necessary, not cosmetic.

## 5. Frozen-contract impact

No frozen architecture bytes are amended by this note. The rule is a
PROCEDURAL specification plus a kit-level test; the gate and wrapper are
unchanged. If the owner later wants the rule ENFORCED by the tooling (e.g.,
a `task-pack --rederive` command that refuses authority-field deltas and
auto-preserves the issued bytes, or an accepted-record field that
pre-authorizes the successor identity pair), that is a builder-kit change
for a future ratified pass — recorded here as a recommendation, not
executed.
