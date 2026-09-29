# VICT Stage 09 — G1 Process Amendment (multi-agent G1 execution)

> **Date:** 2026-09-29 · **Authority:** owner directive of 2026-09-29 (quoted below) · **Scope:** process only — G1 product scope, the frozen G0 contract bytes, and all G1 exclusion boundaries are UNCHANGED. This amendment is the later guidance identified by the owner; it supersedes the named single-builder reporting procedure for G1 only.

## 1. Owner directive (authority for this amendment)

The owner directed on 2026-09-29, verbatim in relevant part:

> "Resume VICT Stage 9 G1 as the **stage manager responsible for the complete G1 outcome**, not as a one-pass builder. My earlier stop instruction is lifted for work inside the already accepted G1 scope. … Own the full G1 loop: 1. Map the remaining G1 criteria. Coordinate genuinely separate builder agents where your environment supports them. Split the Studio server/session work and VICT Application Definition/Plan UI work into non-overlapping worktrees and paths; agree on their interface first. You are the integrator and own the final candidate. … 4. Commit and push an integrated candidate. Give a **fresh-context verifier who did not build it** the exact SHA and a separate checkout/session. … 5. Triage each finding yourself. For an in-scope defect, direct a builder to repair it, integrate a new SHA, and obtain independent re-verification of affected claims and regressions. Repeat this cycle without asking me to relay each builder or verifier report. Preserve failed evidence and candidate lineage. … Before continuing G1, make its multi-agent workflow durable in the repo. On your existing G1 branch, record the `801ecee0…` checkpoint in the live STATE and add a dated process amendment that names you as G1 stage manager. Update the agent entry/handoff guidance to say you may coordinate non-overlapping builders, commission a genuinely fresh-context verifier, repair and reverify in-scope findings across multiple candidate SHAs, and report to me only at the final G1 boundary or a real stop condition. Preserve the G0 freeze commit and its historical digests. Identify exactly which later guidance supersedes the old 'builder stops and reports' procedure; do not silently rewrite the frozen contract or change G1 product scope."

## 2. Exactly which guidance is superseded, by what, and why this is not a frozen-byte edit

**Superseded (for G1 only):** the *stop-and-report-per-candidate* cadence of the single-builder procedure, namely:

1. `AGENTS.md` (adopted at G0; bytes frozen): the paragraph "For each completed gate, commit and push the candidate and evidence, verify the remote SHA, and give the owner the branch, full SHA, checks, findings, and next allowed action" — the *per-gate immediate owner report* requirement. The underlying discipline (candidate + evidence + remote-verify + independent verdict) is RETAINED in full.
2. `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` §"Gate protocol and pushed report" (bytes frozen): step (6) "stop and send the owner the branch link, full base/candidate SHAs, …" per candidate. Steps (1)–(5) are RETAINED unchanged.

**Superseding guidance:** this dated amendment, which records the owner's 2026-09-29 directive above. During G1, the stage manager reports to the owner **only at the final G1 boundary (defensible verdict) or a real stop condition**, while builders and verifiers report to the stage manager intra-gate.

**Why this is not a frozen-byte edit:** the G0 freeze pinned SHA-256 digests of `AGENTS.md`, the architecture, the STATE file, and the handoff **at the freeze commit** (`5c680d51a0622013cac5349853659a74c1584a98`). None of those pinned files is edited to effect this supersession; the historical digests remain valid statements about the freeze commit. The ratified contract itself provides the mechanism: "the frozen bytes are pinned by SHA-256 in the ratification record; changes require a dated amendment" — this IS that dated amendment, and it amends procedure, not contract. The STATE file is the designated live-status document whose gate rows and dated sections the frozen protocol itself requires updating at each gate; its updates here record status and this amendment, not contract changes.

**Scope of supersession:** G1 only. At G2 the frozen single-builder stop-and-report procedure is in force again unless the owner issues a successor amendment.

## 3. G1 stage manager — named role and authorities

The pi agent session operating as "co-founder" on branch `codex/stage9-g1-foundation` is the **G1 stage manager and single integrator**. Within G1 and within the already-ratified G1 scope, it is authorized to:

- **Coordinate genuinely separate builder agents** in non-overlapping worktrees and path sets; agree their shared interface first; integrate their branches into the G1 candidate. (The handoff's existing "single integrator owns the pushed candidate" sentence is satisfied, not changed: the stage manager IS that single integrator.)
- **Commission genuinely fresh-context independent verification**: verifiers who did not build the audited candidate, in separate checkouts/sessions, pushing reports to their own `review/...` branches. A role label inside the builder's own context is NOT independent verification.
- **Triage findings and direct repairs**: for in-scope defects, direct a builder fix, integrate a new candidate SHA, and obtain independent re-verification of affected claims and regressions. Repeat without owner relay.
- **Report at the boundary**: send the owner one report at the final G1 boundary or a real stop condition, containing branch, full base/candidate/verifier SHAs, evidence, commands, findings with dispositions, verdict, and the next proposed gate.

## 4. Unchanged obligations (retained verbatim in effect)

- G1 product scope and exclusions exactly as ratified (reads; HTTP/CLI mappings + inventory; operator connection/session boundary; real Application Definition/Plan read path to a working browser read; **no** G2 receipts/mutations, **no** FT-1 implementation or S9-02 claim, **no** Quellight edits, **no** publication, **no** production activation, **no** G2 start).
- Every candidate: isolated branch/worktree, no overlapping writes, commit evidence, push, remote-verify the exact SHA. A push alone is not a pass.
- Independent verification at the exact pushed candidate SHA before any gate claim; verifier files on its own `review/...` branch and does not repair what it audits.
- Verdict vocabulary: PASS / PASS WITH NON-BLOCKING FINDINGS / HELD / FAIL / BLOCKED.
- Preserve failed observations and the full candidate lineage (the `801ecee0…` checkpoint and its evidence are preserved; later candidates append, they do not rewrite).
- The known FT-4 release-authority parallel-timeout must remain visible and classified in G1 evidence (it is a documented Stage 8 follow-up-register item); the whole suite is never silently called green while it fails.
- Stop early only for: a material product choice, a missing authority or external right, a non-remediable required failure, a security leakage, a contract/source conflict, or the ratified G1 stop conditions.

## 5. Live status recorded with this amendment

- G1 checkpoint `801ecee0be895172ec033f779eb5d382c19e562c` on `codex/stage9-g1-foundation` (base `fd675d9083a32f282820d9e0135c191d691c943c` = merged `main` after G0): WP-1 read commands, HTTP/CLI mappings, D-5 protected-detail mechanics, loopback-only configurable binding, auth-matrix rows, three-surface inventory. It is a **builder checkpoint, not a gate verdict**; its reported test results are self-reported, to be independently re-verified at the final G1 candidate SHA.
- Remaining G1 criteria: Studio server/session boundary (D-2/D-7), Studio Application Definition/Plan read path through genuine `ui`/`ui-svelte`, integration to a working browser read, direct-API negative cases, keyboard/responsive behavior, FT-4 classification, evidence record, independent verification.
