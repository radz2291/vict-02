# U3 handoff — product realism and durable replacement

**Status: IMPLEMENTED — INDEPENDENT VERIFICATION IS THE NEXT GATE (owner
authorization 2026-10-07; U3 only).** The owner authorized U3 — product realism
and durable replacement (frozen STAGES §5, U3-01…U3-08) through implementation,
independent verification, bounded repairs, and the founder checkpoint. U4
remains unauthorized. Implementation record: [U3-COVERAGE](U3-COVERAGE.md)
(scenario matrix + truthful implementation modes), [U3-PERFORMANCE](U3-PERFORMANCE.json),
[U3-WALKTHROUGH](U3-WALKTHROUGH.md); founder checkpoint prepared at the
verified candidate.

Entry references (corrected at authorization — the originally prepared handoff
named `1fe5383…`; the completed U2 closure records are the actual entry):

## Entry authority (verify live before starting)

The U3 manager must reconstruct and live-verify all of the following before
any task, and stop/reconcile if any has moved:

| Item | Value |
| --- | --- |
| Repository / remote | `radz2291/vict-02` |
| Work branch | `codex/ui-foundation-u3`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u3` (created at authorization from the entry tip; verified not to exist before) |
| Entry tip | `codex/ui-foundation-u2` at `a8379110e378357c3732fd051a3f327d897a018c` (U2 final closure records; verified live via `git ls-remote`) |
| U2 closure prerequisite (STAGES §5) | U2 CLOSED — PASS WITH NON-BLOCKING FINDINGS at implementation `471952bb5e9810ec30e370658f812cf9ae6a4eca`; acceptance/closure [reviews/u2/U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md); records check [reviews/u2/U2-CLOSURE-CHECK-01](reviews/u2/U2-CLOSURE-CHECK-01.md) |
| Frozen amended U0 contract | `9ec87f3e7eb8eb7793f972111258940aac635346` (frozen contract commit on `codex/ui-foundation-u0`; the branch tip has since moved to confirmation-only records commits `9734690…` with the frozen governing docs byte-identical — see [reviews/u2/U2-CLOSURE-CHECK-01](reviews/u2/U2-CLOSURE-CHECK-01.md); ancestor of the U1/U2 tracks) |
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
| U3-01 | Journey: Queue → evidence/findings → decision → status/activity/queue refresh | Complete the inspection journey in the FROZEN INSPECTION PRODUCT HOST `examples/ui-authoring-proof` (queue, inspection detail, findings/evidence, submit, supervisor decision, refreshed status/activity/queue) on the frozen inspection domain (PROOF-DESIGN §1: `inspection.submit/approve/reject/revise`, `finding.add`, `evidence.add` with their permission and revision rules), using the canonical UI documents, the shared renderer, the exported tooling, and the existing adapter/dispatch boundaries. `examples/ui-design-proof` remains the contrasting page/workbench proof — necessary maintenance only, never a duplicate inspection product. **Must include the full rejection loop:** reject (mandatory reason) → revise (assigned technician; record decision fields cleared, reason preserved in the activity trail) → resubmit → fresh decision against a new `expectedDomainRevision` | Real-browser journey (1440×900 / 1024×768 / 390×844): every transition observable; queue, detail, status and activity views refresh coherently; rejection reason quoted in history; no UI-only state bypass |
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

- **R2-1 status correction (2026-10-07, at authorization).** The historical R2-1
  finding and the withdrawn round-2 commit-message claim are PRESERVED in
  [DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md). Current status: the
  failed-save session desync was **already repaired and independently verified
  in U1 round 4** (F2: `commitSave` refuses when the working session moved
  since the stage; edits preserved; save-window lock; "U1-ROUND4 GATE: PASS",
  17/17 attacks + 4/4 browser journeys). That finding concerned
  **authoring-document persistence** (the studio's `EditorBridge` store save),
  which is distinct from inspection-domain durability. **U3-05 owns only the
  inspection-domain durable replacement** (scenario 1's approve); no
  authoring-store repair is owed here.
- **R2-2/R2-3:** scenario-note live-region role; benign dev-mode warning —
  U3 host polish.
- **NF-2 (from U2):** favicon.png 404 console noise — U3 host polish; the U3
  walkthrough console review must show zero unexplained console errors.
- **F4 (from U2):** Inspector scope persistence sharp edge — non-blocking;
  may be addressed only if it touches U3 surfaces, else remains recorded.
- **NOT DEMONSTRATED carried from U2:** literal browser-process restart —
  U3-05 makes real restart evidence a mandatory requirement.
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

## Verification plan — EXECUTED (2026-10-07)

Fresh independent verification at the exact pinned candidate
`cbb3fb6584226c48633a2f3d21bccee674ce59c0` (separate detached checkout; the
verifier implemented nothing and repaired nothing): **"U3 GATE: PASS WITH
NON-BLOCKING FINDINGS"** — report imported verbatim as
[U3-VERIFY-01](reviews/u3/U3-VERIFY-01.md) (sha256
`9412d96c7335f85618fd53344f039393c56817825f625f38109d6dec58db5a2e`), with the
verifier's journey harness and 29 screenshots under
`reviews/u3/evidence/` (bytes preserved via scoped .gitattributes).

- **All eight criteria PASS** on the verifier's own evidence: 109/109
  independent node probes (domain rules against BOTH adapters, scenario
  declarations vs the frozen matrix, reset identity/determinism, latency
  fencing, zero-invocation missing coverage, conformance both adapters, swap
  identity/contracts); 48-check browser journey (46 pass + 2 resolved as
  harness artifacts, documented in the report) with 23 screenshots at the
  required sizes; 9/9 adversarial API attacks refused; clean console sweep.
- **Real restart reproduced independently**: production build, durable UI
  approve, force-kill (port dead), on-disk node:sqlite read, fresh process +
  fresh browser recovery; simulated mode honestly forgets; stale-after-
  restart and replay refused.
- Battery: typecheck/check:ui/format clean; renderer 125/125; integration
  4/4; authoring 66/66; design 12/12; svelte-check 0/2 known; performance
  reproduced (edit 0.14 ms, reset 0.11 ms, durable write 3.67 ms — within
  frozen budgets). Diff boundedness: 47 files, all allowed paths; packages/
  application and packages/sdk untouched by the delta.
- **F-1 (MINOR, retained)**: the document-level "Approve inspection" control
  is status-ungated and renders enabled on decided inspections; every click
  is refused honestly by the boundary (no bypass; state unchanged) — a dead
  affordance (U3-08 wart). Owner: U3+ UX iteration (Inspector/document
  surfaces); next check: the next stage touching the inspection document.
  NOT repaired post-verification: a behavior change after the gate would
  require affected re-verification for zero boundary risk.
- Environment notes N-1..N-3 in the report, including N-2: the root unit
  suite requires built package dists (4 failures in a dist-less fresh
  checkout; 10/10 reproduced green at identical bytes where dist exists) —
  recorded for U4 packaging readiness alongside F3.

**Founder checkpoint: prepared.** [U3-WALKTHROUGH](U3-WALKTHROUGH.md) is the
owner-facing sheet; the owner experience acceptance remains PENDING until
explicitly given. U4 requires a U3 pass AND an authorized U4 handoff.

## Integration, combined verification and closure (2026-10-07)

The Codex experience repair was integrated into this branch by **normal
fast-forward** (linear ancestry from the U3 records `aaeea16…`):
`8d99f36` (candidate 1 — experience review FAIL, preserved on the experience
branch) → `e0dd026` (repaired implementation — independent technical PASS +
experience PASS) → `9c34679` (records-only) → `952d92d…` (one records-only
`.prettierignore` commit on top; implementation bytes identical to
`e0dd026`). The experience branch `codex/ui-foundation-u3-experience` is
preserved untouched at `9c34679…`. The repair keeps the queue/detail authored
through canonical VICT UI, adds the reusable ui-svelte extension bridge
(explicit registration, props-only, visible-and-safe failures) and changes
no domain, durable-adapter, server-operation or preview-session code.

**Combined independent verification** at the exact integrated SHA
`952d92da5131d6ab595b45b3bf18bc7ce3b3466d` (fresh verifier, separate
checkout, falsification-only, no repairs): **"U3 COMBINED GATE: PASS WITH
NON-BLOCKING FINDINGS"** — report imported verbatim as
[U3-COMBINED-VERIFY-01](reviews/u3/U3-COMBINED-VERIFY-01.md) (sha256
`e101b4c705cc9c13ce6b5f44b2f31a33264acb54f3f14e19f60d74a23653efe4`) with 21
evidence files under `reviews/u3/u3-combined-verify-evidence/` (bytes
preserved via scoped .gitattributes). Reproduced now: full battery (68/131/
2499/4/12, typecheck, check:ui 0/2, svelte-check 0/2, format, production
build, performance p95 0.19/0.17 ms), the complete journey including the
rejection loop and terminal F-1 state at 1440/1024/390 + 480 container with
zero console errors, domain probes vs both adapters with zero-mutation
proofs, fencing, **the required actual restart demonstration on the combined
app** (durable approve → force-kill → hash-unchanged file → fresh process +
fresh browser recovers the decision; simulated forgets), shared conformance,
truthful console, corrupt-saved-source failsafe, and the extension forgery
matrix (missing/mismatched/wrong-revision → `UI_RENDER_EXTENSION_UNAVAILABLE`;
events/slots → `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`).

**Owner feedback** (verbatim, scope-bounded):
[OWNER-FEEDBACK-01](reviews/u3/OWNER-FEEDBACK-01.md) — "I have try it, it
work simply." — hands-on positive against the repaired queue/detail
experience; it does not attest the scenario internals, the durable restart
or Studio surfaces.

**U3 IS CLOSED: PASS WITH NON-BLOCKING FINDINGS.** Gate (independent
verification of U3-01..08) and owner requirement (founder checkpoint
experience) are satisfied. Retained findings and owners:

| Finding | Severity | Owner | Next check |
| --- | --- | --- | --- |
| V-F1 detail page wipes its invalid-saved-source diagnostic on first mount (route-key `$effect`); studio discloses loudly; fails safe | minor | U3+ product-host UX iteration | next stage touching the product host routes |
| F-1 document-level approve control status-ungated (dead affordance on decided records) | minor | repaired by the experience integration (terminal records have no enabled approve affordance — confirmed by the combined verifier) | closed this cycle |
| F3 ui-editor workspace dist build fails (four TS2307 Svelte declarations) + V-F2 honest packaging limitation | info | **U4 packaging readiness** — must resolve before any built-artifact reuse claim | U4 entry gate |
| V-F3 Inspector 42px round-trip + browser-level stateValues forgery standing on byte-identical files (EXPERIENCE-E0DD), not re-reproduced | info | combined evidence is sufficient; re-reproduce only if those files change | any stage editing ui-svelte document bridge |
| V-F4 fresh boot is simulated by design; durable recovery needs the Storage switch | info | by design; documented in the README + walkthrough | none |
| N-2 root unit suite needs built package dists | info | U4 packaging readiness (alongside F3) | U4 entry gate |

**Distinct owner-unattested item (named, not a generic pending banner):**
the durable restart demonstration has not been explicitly attested by the
owner. Short walkthrough: on the queue, Demo controls → Storage →
"Saved locally (SQLite)", approve an inspection as Supervisor, stop the
server (Ctrl+C), start it again (`node build` or the dev server), reload —
the inspection is still approved with its full trail. Switching back to
"Simulated" honestly shows the fresh seed. Independently verified three
times (manager `5bb145f`/`986a609` cycle, experience technical review,
combined verifier at `952d92d`); owner confirmation is welcome but optional.

**U4 remains unauthorized** and is not started. U4 handoff obligations are
recorded documentation-only in STATE/DECISIONS (packaging readiness: F3 +
N-2; see also the U2 carried F4 scope-persistence item owned by U3+ UX).
