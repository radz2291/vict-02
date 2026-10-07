# U3 handoff — product realism and durable replacement

**Status: PREPARED — IMPLEMENTATION NOT AUTHORIZED.** No work may start until
the owner authorizes this handoff. Nothing here grants implementation, branch
creation, or dependency installation authority.

## Entry authority (verify live before starting)

The U3 manager must reconstruct and live-verify all of the following before
any task, and stop/reconcile if any has moved:

| Item | Value |
| --- | --- |
| Repository / remote | `radz2291/vict-02` |
| Work branch (to be created at authorization) | `codex/ui-foundation-u3`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u3` (must not exist before authorization; verify) |
| Entry tip | `codex/ui-foundation-u2` at `1fe5383c085ef5c2a2289c54116c8762467c7257` (verify live via `git ls-remote`) |
| U2 closure prerequisite (STAGES §5) | U2 CLOSED — PASS WITH NON-BLOCKING FINDINGS at implementation `471952bb5e9810ec30e370658f812cf9ae6a4eca`; acceptance/closure [reviews/u2/U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md) |
| Frozen amended U0 contract | `9ec87f3e7eb8eb7793f972111258940aac635346` (tip of `codex/ui-foundation-u0`; ancestor of the U1/U2 tracks) |
| Freeze record | `ea47edd68e302dc5b6cacb2e43635d11781619ad` |
| Main baseline (must remain untouched) | `4d2df037d8a82d36c60bf1bff16919650643ce22` |
| Governing documents | Root `AGENTS.md`; `docs/ui-foundation/AGENTS.addendum.md`; frozen `STAGES-AND-VERIFICATION.md` (§1 discipline, §5 = U3-01…U3-08, §7–§9), `PROOF-DESIGN.md` (§1 inspection domain operations; §2 scenario matrix; durable-replacement design), `API-SPEC.md` (§6.2 scenario orchestration; §10 coverage/fixtures), `CONTRACTS.md`, `PRODUCT-ARCHITECTURE.md` (§6 scenarios); `STATE.md`; `DECISIONS-AND-EVIDENCE.md`; [U2-HANDOFF](U2-HANDOFF.md) |

Per root `AGENTS.md`: if the baseline or authority has moved when work starts,
stop and reconcile before proceeding. A proposed document does not authorize
implementation; only an explicit owner authorization of THIS handoff does.

## Outcome (frozen STAGES §5)

The complete fictional inspection journey and negative scenarios work; one
simulated decision becomes durable without UI source or binding edits. The
durable local proof demonstrates a specific compatible replacement, not full
backend feasibility or production readiness.

## Criterion mapping — concrete work and required evidence

| ID | Frozen criterion (STAGES §5) | Concrete work | Required evidence |
| --- | --- | --- | --- |
| U3-01 | Journey: Queue → evidence/findings → decision → status/activity/queue refresh | Build the complete inspection journey on the frozen inspection domain (PROOF-DESIGN §1: `inspection.submit/approve/reject/revise`, `finding.add`, `evidence.add` with their permission and revision rules), hosted in `examples/ui-design-proof` against the existing adapter/dispatch boundary. **Must include the full rejection loop:** reject (mandatory reason) → revise (assigned technician; record decision fields cleared, reason preserved in the activity trail) → resubmit → fresh decision against a new `expectedDomainRevision` | Real-browser journey (1440×900 / 1024×768 / 390×844): every transition observable; queue, detail, status and activity views refresh coherently; rejection reason quoted in history; no UI-only state bypass |
| U3-02 | Scenarios: normal/empty/long/latency/failure/denied/conflict/missing operation reproducibly reset | Implement the frozen eight-scenario matrix (PROOF-DESIGN §2) as declarative scenario coverage (`vict.ui-scenario@1`) through the existing `packages/ui-preview` session orchestration (API-SPEC §6.2) | Reproducible scenario runs (scripted, repeatable, deterministically seeded) with per-scenario expected observables exactly as the frozen matrix table states; reset returns to the seeded state each time |
| U3-03 | Domain correctness: actor permissions, validation, domain revision and stale decision checked at runtime; no UI-only authorization | Enforce the frozen domain rules in the adapter/dispatch context, never in UI visibility: technician-vs-supervisor permissions; `submit` requires `draft`; `revise` requires `rejected` + assigned technician; `approve`/`reject` require `submitted` + `expectedDomainRevision`; stale/replayed decisions yield `DOMAIN_CONFLICT` / `DATA_IDEMPOTENT_REPLAY` with state unchanged | Runtime probes (not UI-driven) demonstrating each rule firing: denied actor, wrong-state transition, stale revision, replay; UI shows the resulting denial/conflict states honestly |
| U3-04 | Scenario identity: cache/local-state/domain-seed reset coherent; capability snapshots and in-flight operations fenced | Coherent reset across every cache layer the workbench uses (design-store session keys, scenario/local domain state, domain seed); capability snapshots recorded per scenario; in-flight operations fenced on reset (late results discarded) | Reset-coherence probes (state before/during/after reset at each layer); latency-scenario fencing evidence (late approve after reset changes nothing); snapshot contents recorded |
| U3-05 | Durable replacement: same action ID and compatible input/output contracts; UI source and binding digests unchanged; durable local operation runs through declared boundary and survives restart | Swap scenario 1's `inspection.approve` implementation to a deliberately selected durable local implementation **through the existing declared adapter boundary** (`packages/ui-preview` session / `packages/application` adapter surfaces), preserving action identity and contracts byte-for-byte; UI source and binding digests must be provably unchanged. **Includes the carried R2-1 fix:** the in-memory example store's failed-write save-window desync (DECISIONS R2-1 correction of record) is resolved by this slice | Action ID + input/output contract diff (empty); UI source digest and binding digest before/after (identical); **actual process/browser restart evidence** (not reload alone) showing the decided state persists; conformance suite pass for the durable implementation |
| U3-06 | Conformance: simulated/local adapter implementations pass relevant shared conformance; side effects and failure behavior observable | Run the shared adapter/data conformance suites (existing `packages/application` conformance tooling) over the simulated and durable-local implementations; make side effects and failure behavior observable (activity trail, failure outcomes) | Conformance run outputs per implementation; failure-behavior demonstrations (declared failure outcome leaves domain state unchanged; activity records the attempt) |
| U3-07 | Honest coverage: implementation mode is truthful per operation; no global "production" label hides missing behavior | Per-operation implementation-mode labels (simulated / durable-local / unavailable) surfaced in the UI coverage matrix; unavailable operations deny with `SCENARIO_COVERAGE_MISSING` and explicit UI state | Coverage matrix matching the frozen template (API-SPEC §10) with truthful per-operation modes; missing-implementation probe (scenario 6) showing the explicit denial state |
| U3-08 | Experience: owner can explain workflow from actual UI; negative-state UX remains coherent | A short founder walkthrough of the journey and its negative states (denial, failure, conflict, missing operation, rejection-correction-resubmission) written for plain-language re-run; negative states must be understandable and recoverable | Updated walkthrough document + real screenshots at required sizes; founder-facing walkthrough is the U3 owner checkpoint (independent verdicts remain necessary but not sufficient) |

## Allowed paths

`packages/application`, `packages/ui-preview`, `packages/sdk` (only where the
frozen contracts require), `examples/ui-design-proof`, relevant
manifests/build wiring/tests/verification scripts, and UI-foundation
documentation (including this handoff's evidence). Reuse of existing exported
modules over new proof-host-only handlers remains mandatory.

**Not allowed:** `apps/studio` or other workstreams; Stage 9; new external
services or network backends (the durable proof is deliberately local);
merge to main; force-push; publication; deployment; U4 packaging work.

## Carried obligations entering U3

- **R2-1 (MAJOR, record integrity):** in-memory example store failed-write
  save-window desync — actual fix owned by the U3-05 slice (see above).
- **R2-2/R2-3:** scenario-note live-region role; benign dev-mode warning —
  U3 host polish.
- **NF-2 (from U2):** favicon.png 404 console noise — U3 host polish; the U3
  walkthrough console review must show zero unexplained console errors.
- **F4 (from U2):** Inspector scope persistence sharp edge — non-blocking;
  may be addressed only if it touches U3 surfaces, else remains recorded.
- **NOT DEMONSTRATED carried from U2:** literal browser-process restart —
  U3-05 makes real restart evidence a requirement.
- **Explicitly deferred to U4 (not a U3 obligation):** the
  `@victframework/ui-editor` workspace dist build failure (TS2307 ×4,
  pre-existing). It must be resolved before any U4 built-artifact reuse claim
  (U4-01/U4-03); U3 must make no built-artifact reuse claim.

## Independent verification requirements

Per frozen STAGES §1 and §9: a fresh independent verifier (no implementation
role in the candidate) verifies the exact candidate SHA, preferably in a
separate checkout/session, covering at minimum:

- All eight criteria U3-01…U3-08 with individual PASS/FAIL/NOT DEMONSTRATED
  statuses — missing proof cannot be promoted to pass.
- The full journey including rejection → correction → resubmission in a real
  browser at 1440×900, 1024×768, 390×844 (+ 480 CSS-px container proof).
- The eight-scenario matrix reproduced, including determinism of resets.
- Domain-correctness probes (permissions, validation, stale revision, replay)
  exercised at runtime, not through UI visibility.
- The durable replacement: identity/contract digests unchanged, real restart
  evidence, conformance suite outputs.
- Truthfulness of per-operation implementation-mode labels.
- Zero unexplained console errors; prior repair regression suites for touched
  behavior (e.g., Inspector/Layers suites if U3 touches those modules).
- Automated battery affected by the change (typecheck, check:ui, renderer/unit/
  integration/design suites, design tsc + build, format check) — exact numbers
  reported; the stage manager inspects actual current scripts before choosing
  commands and never reports a script as run merely because it exists.

## Required outputs

1. Implementation increments on `codex/ui-foundation-u3` with preserved
   lineage from the entry tip.
2. Independent verification reports (round-wise, verbatim-imported, bytes
   preserved with scoped `.gitattributes` where checksums are recorded) under
   `docs/ui-foundation/reviews/u3/`, with harness/journey/scenario evidence.
3. Updated `STATE.md`, `DECISIONS-AND-EVIDENCE.md`, this handoff's status
   section, and a founder-facing `U3-WALKTHROUGH.md`.
4. Performance spot-checks per frozen §8 budgets for scenario reset and
   editing feedback (regression against U2 baselines).
5. Final owner checkpoint package: exact SHAs, verdicts, retained findings
   with owners/next checks, runnable instructions.

## Stop boundary

Work stops after: verified U3 candidate(s), independent verdict, in-scope
repairs with affected re-verification, records commit + normal push + remote
SHA verification, and the owner checkpoint report. The U3 owner checkpoint
(founder walkthrough) is the stage boundary: record acceptance when given, do
not infer it. U4 requires a U3 pass AND an authorized U4 handoff. No npm
publication, merge to main, Studio integration or production activation is
implied by any U3 outcome.
