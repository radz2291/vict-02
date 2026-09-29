# VICT Stage 09 — Entry and Gate Handoff

> **RATIFIED 2026-09-29 — G0 contract FROZEN.** The owner resolved D-1–D-10 and adopted the root `AGENTS.md` (see `docs/governance/VICT-STAGE-09-G0-RATIFICATION-2026-09-29.md` and `docs/governance/VICT-STAGE-09-STATE.md`). **Decisions are not implementation evidence**; the work packages below are issued ONLY at the bounds of §"Current authorization". Baseline for the ratified contract: VICT `main` `516948ac8bc55bbae8624bb91b3b35de34b3146c`; Quellight read-only observation `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`. Frozen bytes are pinned by SHA-256 in the ratification record; the freeze commit is independently verified and remote-checked before PR #2 merges. Check remote and clean local state again before work. Read `docs/governance/VICT-STAGE-09-STATE.md` for live status and `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md` for the ratified contract.

## Current authorization — G0 RATIFIED; G1 issued and bounded

The owner ratified G0 on 2026-09-29 (decision record:
`docs/governance/VICT-STAGE-09-G0-RATIFICATION-2026-09-29.md`). The
pre-G0 review task is COMPLETE and retained below as history. **G1 —
operator foundation — is now issued with exactly this scope:** (a) safe
operator reads, including graph/activation identity and the D-5
protected-detail positive path; (b) explicit HTTP/CLI mappings and the
three-surface registry ↔ HTTP ↔ CLI inventory for the G1 read surface;
(c) the operator connection and session boundary (D-2/D-7: target registry,
stable loopback endpoint, server-held credential, distinct admin-provisioned
operator actor, HttpOnly/SameSite cookie + session-bound CSRF + Origin/Host
checks, no token in the browser); (d) a real Studio Application
Definition/Plan rendered in `apps/studio` through the genuine `ui`/`ui-svelte`
delivery path, integrated to a working browser read before any such claim.
**Explicitly outside G1:** receipts, confirmations, run.resolve/run.signal,
and any mutation surface (G2, after its own freeze — caller/release migration
plan must be frozen first); the product view and Quellight work (S9-05/G3
behind Quellight's separately governed increment); the FT-1 platform work
itself and any S9-02 drill-down claim; publication; production activation;
Quellight edits. A fresh independent verifier must check the exact pushed G1
candidate SHA before any gate claim.

### Historical — pre-ratification G0 review task (complete)

The owner's 2026-09-29 request authorized preparing a Stage 9 development cycle and pushing the reviewable planning pack. Stage 8's closure is a predecessor fact, not automatic permission to start G1. A fresh agent may review and correct this candidate in a documentation-only branch, verify paths and source facts, and push a report. It must not declare the architecture ratified, edit code or Quellight, publish packages, or activate a product. The owner's explicit G0 decision must be recorded before implementation authority is issued.

**G0 review task (COMPLETE — dispositioned by the ratification):** verify VICT and Quellight repository identities and current heads; read reference §23 Stage 9/§27, Stage 8 closure and follow-up register, current command/HTTP/CLI/UI/application contracts and the independent review above. Test each proposed D-1–D-10 choice against the observed code. The owner must choose the S9-02 navigation path, all-four-command confirmation compatibility, exact operator connection/session mechanics, the already owner-selected Quellight claim IN (2026-09-29), and conscious adoption of the root `AGENTS.md`; the remaining rows must also be accepted or amended. Return a decision-ready correction, not an invented ratification. Only after the owner chooses and records G0 may the handoff below be made executable with a committed-byte digest. *(All of the above was done: reviews filed, owner decisions recorded, contract frozen with digests.)*

## Post-G0 bounded work (issued per gate)

| Package | Candidate scope | Evidence and stop |
| --- | --- | --- |
| WP-1 operator reads — **ISSUED AT G1** | Bounded run/event/wait, **graph identity/content and activation selection/history**, Release, ChangeSet and audit reads through versioned commands; sanitized by default | Scope matrix, canary, pagination/ordering; one separately scoped protected-detail retrieval with per-access audit; stop on leak or unversioned command |
| WP-2 operator authorization — **ISSUED AT G1** | Configured loopback target, distinct actor, server-side credential, authenticated Studio session and mutation protection | Real browser and direct-API allow/deny; no token in browser; stop on actor confusion or arbitrary target proxy |
| WP-3 confirmations/recovery — **NOT ISSUED (G2; caller/release migration plan frozen first)** | Proposed server-issued receipts for new run interventions and the four existing commands under the ratified D-4 compatibility policy; fenced, audited bounded recovery | Direct-API B-3 outcome table, same-key retry versus fresh-key spent receipt, restart and race evidence; stop on unconfirmed legacy bypass |
| WP-4 CLI/transport parity — **G1 SLICE ISSUED** (read-command routes/entries + inventory); prepare→confirm CLI waits for G2 | Explicit HTTP routes and CLI entries for every supported operator command; correct flag/GET encoding; CLI prepare→human review→confirm | Mechanical registry ↔ HTTP ↔ CLI inventory including classified pre-existing `app.data.action` gap; equivalent isolated targets, same semantic result, no second effect |
| WP-5 Studio consumer — **ISSUED AT G1** (scaffold + real read path; no S9-02 claim) | Private SvelteKit app using VICT Application Definition/Plan, `ui`, `ui-svelte` and justified custom operator components; the owner chose the FT-1-gated disposition, so list→detail drill-down waits for FT-1 | Real browser S9-01–S9-04, empty/denied/stale/disconnected states, accessibility; S9-02 list→detail proof cannot pass without its chosen navigation path; no retired facade dependency |
| WP-6 product view — **NOT ISSUED (S9-05/G3; behind Quellight's separately governed increment)** | Two-actor permission-gated example and owner-selected Quellight S9-05 pilot under a separately governed product increment | Allow/safe projection/deny; same-turn Quellight claim only after real actor/grant/endpoint proof |
| WP-7 integrated audit — **NOT ISSUED (G3)** | Documentation, `verify:stage9`, independent usability/security review, owner report | Fresh independent verifier at exact pushed candidate; any later fix reruns affected checks |

WP-1 and WP-5 scaffolding can start in parallel in isolated non-overlapping worktrees after G0, with a single integrator and integrity-recorded local artifacts. WP-5's real read-through-ApplicationDataAdapter proof waits for the WP-1 HTTP commands; the adapter may not import VictStores. S9-02 waits for its owner-chosen navigation dependency (FT-1, separately gated; G1 must not implement the FT-1 platform change or claim the drill-down). WP-3's safety and compatibility decisions are now frozen (D-4/D-10 ratified); its implementation remains G2. Publication is **not** a prerequisite for Studio development; a coordinated package publication and registry-only consumer proof require a separate owner decision after integrated local evidence.

## Gate protocol and pushed report

For every gate, the builder must: (1) state the exact authorized handoff and starting `origin/main` SHA; (2) use an isolated branch/worktree with no overlapping writes; (3) build and run the relevant checks; (4) commit the candidate and full evidence; (5) push the branch and independently fetch/compare the remote SHA; (6) stop and send the owner the branch link, full base/candidate SHAs, changed paths, commands/results, each criterion PASS/FAIL/NOT DEMONSTRATED, remaining risks and next proposed gate. A push alone is not a pass.

A fresh verifier in a separate context/checkout must check the exact candidate SHA, exercise negative paths and the real operator walkthrough, and push its audit record. Report the verifier SHA and any difference from the candidate. If code changes after verification, rerun impacted checks. Preserve failed observations. Use PASS, PASS WITH NON-BLOCKING FINDINGS, HELD, FAIL, or BLOCKED with direct evidence; only the owner records acceptance, amendment, and formal Stage 9 closure.

**Stop and return:** current remote moved; contract/source conflict; scope/authorization gap; security leakage; unable to reproduce baseline; failed check not attributable to the handoff; Studio-only application model emerging; unapproved ABI break; proposed Quellight edit; or publication/production activation. Don't rewrite a red test as a pass or upgrade an agent's recommendation into an owner decision.
