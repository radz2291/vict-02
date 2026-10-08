# UI foundation — current state

**2026-10-07 — U3 CLOSED: PASS WITH NON-BLOCKING FINDINGS.** The experience
repair is integrated (fast-forward; combined implementation `952d92d…`),
combined-gate verified ("U3 COMBINED GATE: PASS WITH NON-BLOCKING FINDINGS",
[U3-COMBINED-VERIFY-01](reviews/u3/U3-COMBINED-VERIFY-01.md)), and the owner
experienced the repaired product ("I have try it, it work simply." —
scope-bounded, [OWNER-FEEDBACK-01](reviews/u3/OWNER-FEEDBACK-01.md)).
U4 is NOT authorized and NOT started. The owner selected the stronger
catalog-authoring requirement (catalog components must be canonically
authorable: properties, values and action connections inspectable/editable
through the authoring experience); the registered-component (P3) proof no
longer satisfies the requirement, and the prepared handoff's proof section
and authorization prompt are superseded by
[U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md) — review complete
(cycle 1: FAIL -> PASS WNF -> PASS; frozen `68e166f…`), then the owner
directed a repair cycle: the first freeze's old-renderer compatibility
claim was FALSIFIED by the resolver-level probe against `952d92d…` bytes;
the gate was rebuilt from verified legacy behavior (events ABI marker +
compile-artifact marker + implementation abi). Cycle 2 review: R2 round 1
**PASS WNF** at `0ad3a2a…` -> repairs -> round 2 **PASS WNF**. Now FROZEN
— VERIFIED (SUPERSEDING): payload `460d963…`, pins in
[U4-AMENDMENT-FREEZE-02](U4-AMENDMENT-FREEZE-02.md), which supersedes
[U4-AMENDMENT-FREEZE](U4-AMENDMENT-FREEZE.md) (preserved byte-exact);
freeze-check `U4 AMENDMENT FREEZE CHECK 02: VERIFIED`
([reviews/u4/FREEZE-CHECK-02.md](reviews/u4/FREEZE-CHECK-02.md)).

Owner decision 8 (catalog recalibration) is IN PROGRESS on isolated branch
`codex/ui-foundation-u4-catalog-recalibration` (from `7a9477f…`):
[U4-CATALOG-RECALIBRATION](U4-CATALOG-RECALIBRATION.md) inventories all 41
families + the higher-level public components, challenges the contract, and
plans batches B1–B5; amendment §10 extends the value vocabulary
(`UiValueType`); the standing ledger lives in the reuse matrix §6. PROPOSED
— under independent review; implementation NOT authorized.
Recalibration review complete: R1 **PASS WNF** (9 findings) -> repairs ->
round 2 **PASS WNF** (8/9 verified; pointer residual) -> repairs. FROZEN
— VERIFIED (SUPERSEDING, scope): payload `52684696…`, pins in
[U4-CATALOG-RECALIBRATION-FREEZE](U4-CATALOG-RECALIBRATION-FREEZE.md);
freeze-check `U4 CATALOG RECALIBRATION FREEZE CHECK 03: VERIFIED`
([reviews/u4/FREEZE-CHECK-03.md](reviews/u4/FREEZE-CHECK-03.md)). Next
authorized action: owner decision on batch B1 (handoff §13.1 prompt).
**BOUNDED REPAIR (owner findings F1–F4) in progress** on
`codex/ui-foundation-u4-catalog-repair`: F1 complete value path
(amendment §10.1a: `UiValue` carrier + `isUiValueOfType` guard + all
eight boundaries widened), F2 legacy-validator compatibility corrected
(probe: all four widened types REJECTED with `UI_EXPR_TYPE_MISMATCH` at
the VALIDATION gate — matrix rows split accordingly), F3 Collapsible
assigned B5 + programmatic ledger reconciliation (RECONCILIATION OK; one
gap found and fixed), F4 higher-level authoring roadmap (display
components already document-mounted via ext.status/ext.feedback;
Studio config editing recorded PENDING owner decision). Superseding
freeze to follow review.
Amendment work is isolated on `codex/ui-foundation-u4-component-amendment`
(from the prepared handoff records `cfbd6d3…`); U0–U3 records untouched.
The prepared U4 handoff was independently reviewed on
`codex/ui-foundation-u4-handoff`:
[U4-HANDOFF](U4-HANDOFF.md) (PREPARED — IMPLEMENTATION NOT AUTHORIZED),
[U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md),
[U4-COMPONENT-INTEGRATION-DESIGN](U4-COMPONENT-INTEGRATION-DESIGN.md);
independent handoff review
[U4-HANDOFF-REVIEW-01](reviews/u4/U4-HANDOFF-REVIEW-01.md): round 1 FAIL →
repairs → round 2 FAIL (narrow) → repairs → round 3 FAIL (one defect class,
silent no-op edits) → repairs → **round 4 PASS WITH NON-BLOCKING FINDINGS**
(delivery-coupled completions resolved by the delivery commit/push). The owner-authorized U3 cycle (U3 only) delivered the complete
inspection journey with the rejection → correction → resubmission loop in
the frozen product host `examples/ui-authoring-proof`; the eight-scenario
matrix with deterministic resets, fencing and truthful implementation-mode
labels; runtime domain correctness (permissions, transitions, stale and
replayed decisions) at the adapter boundary; and the durable replacement of
scenario 1's `inspection.approve` through the declared adapter boundary —
same action identity, same contracts, unchanged UI source/binding digests —
persisted to a local SQLite file that survives a real process kill + restart
(negative control: simulated mode forgets, proving recovery comes from the
file). Shared conformance: both implementations pass
`runApplicationDataAdapterSuite` over the same fixture. Performance within
all frozen budgets ([U3-PERFORMANCE](U3-PERFORMANCE.json)); coverage matrix
[U3-COVERAGE](U3-COVERAGE.md); founder-facing [U3-WALKTHROUGH](U3-WALKTHROUGH.md).
Stage gate: independent verification at `cbb3fb6…` PASS WNF
([U3-VERIFY-01](reviews/u3/U3-VERIFY-01.md)), then the reviewed experience
repair integrated by fast-forward and re-verified as a combined candidate at
`952d92d…` PASS WNF ([U3-COMBINED-VERIFY-01](reviews/u3/U3-COMBINED-VERIFY-01.md),
sha256 `e101b4c7…`): full battery reproduced (68/131/2499/4/12, checks,
format, production build, performance), complete journey + rejection loop +
F-1 terminal state at four widths, domain probes vs both adapters, fencing,
the required actual restart demonstration on the combined app, shared
conformance, extension forgery matrix. Owner feedback recorded with exact
scope. F-1 (dead approve affordance) was repaired by the experience
integration; V-F1 (saved-source diagnostic wiped on detail first mount;
fails safe) and the packaging items (F3 + N-2 → U4 readiness) are retained
with owners in [U3-HANDOFF](U3-HANDOFF.md). U4, `apps/studio`, Stage 9,
merge to main, publication and deployment remain unauthorized.

U2 remains CLOSED as described below.

---

**2026-10-07 (superseded by the U3 implementation record above) — U3
AUTHORIZED AND IN PROGRESS (product realism and durable replacement; U3
only).** The owner authorized U3 on 2026-10-07
([U3-HANDOFF](U3-HANDOFF.md), startup corrections recorded:
[U3-authorization entry](DECISIONS-AND-EVIDENCE.md)). Work proceeds on
`codex/ui-foundation-u3` from the U2 closure records `a8379110…`. Owner
experience acceptance for U3 is **PENDING** until the founder checkpoint.

---

**2026-10-07 (superseded by the U3 authorization above) — U2 CLOSED: PASS
WITH NON-BLOCKING FINDINGS; owner acceptance RECORDED for the integrated
Inspector. U3 handoff PREPARED — IMPLEMENTATION NOT AUTHORIZED.**

The owner approved the integrated Inspector/Layers workbench experience
(exact scope in [U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md):
the founder-facing [U2-WALKTHROUGH](U2-WALKTHROUGH.md) as amended — friendly
labels, scope-driven Layers with search/keyboard selection, visible selection
outline, Browser-now effective values, Reset, linked spacing, shared/instance
scope with the Adaptations override, first-screen Inspector at 390). That was
the only pending U2 owner item, so **U2 is formally closed as PASS WITH
NON-BLOCKING FINDINGS**: independent lineage `e0893fe… × f31477d… → 1a61389… →
2a1ab4c0… (round-1 FAIL, preserved) → 471952bb… (final verdict`
[U2-COMBINED-VERIFY-05](reviews/u2/U2-COMBINED-VERIFY-05.md)`, sha256
6ac54af9…)`; records at `1fe5383…` and this closure commit. Retained findings
have owners and next checks (F3 ui-editor dist build → **U4 packaging
readiness**; F4 Inspector scope persistence → U3+ UX iteration; NF-2 favicon
404 → U3 polish; R2-1 store desync → **U3-05**; R2-2/R2-3 → U3 polish;
carried NOT-DEMONSTRATED: literal restart → U3-05 requirement). Closure
authorizes nothing by itself.

**Next: the owner decides whether to authorize U3**
([U3-HANDOFF](U3-HANDOFF.md) — PREPARED — IMPLEMENTATION NOT AUTHORIZED:
inspection journey, eight-scenario matrix, runtime domain checks, durable
replacement surviving restart through the declared boundary, adapter
conformance, honest coverage labels, founder walkthrough). U3/U4
implementation, `apps/studio`, Stage 9, merge to main, publication and
deployment remain unauthorized.

---

**2026-10-07 (superseded by the closure record above) — U2 INSPECTOR/LAYERS UX
INTEGRATED; combined candidate independently verified PASS WITH NON-BLOCKING
FINDINGS at `471952bb5e9810ec30e370658f812cf9ae6a4eca` (after one bounded
repair round); awaiting the FOUNDER checkpoint — owner experience acceptance
PENDING.**

The owner-authorized Inspector/Layers UX track (Codex, branch
`codex/ui-foundation-u2-inspector-ux`, final records `f31477d8…`, independently
tested implementation `1bd745a0…`) is integrated into `codex/ui-foundation-u2`
with lineage preserved: merge `1a61389…` has parents exactly `e0893fe…` (U2
manager track) × `f31477d…` (UX tip). Integration + manager-owned repairs at
`2a1ab4c0…`; fresh independent verification there returned **FAIL** (one
blocking finding — the canvas selection outline was silently inert, a Svelte
expression inside a markup style element, never interpolated, byte-identical
since U1-era `7f49cd0` and never previously tested; report preserved as
[U2-COMBINED-VERIFY-04](reviews/u2/U2-COMBINED-VERIFY-04.md), sha256
`4f432023…`). Bounded repairs (outline via `data-ui-selected` + static CSS,
regression-pinned; workbench ≤860px layout bounds the canvas so the Inspector
is in the first screen at 390×844) at `471952b…`: fresh independent
re-verification returned **PASS WITH NON-BLOCKING FINDINGS**
([U2-COMBINED-VERIFY-05](reviews/u2/U2-COMBINED-VERIFY-05.md), sha256
`6ac54af9…`) — repairs confirmed (outline 14/14; first screen 10/10), all
eight demonstrations pass with zero page exceptions, every automated number
reproduced (renderer 125/125, unit 70/70, integration 4/4, design 12/12, root
typecheck 0, check:ui 0/2, broad design-proof Svelte check 0 errors / 2 known
warnings, design tsc 0, production build pass, format clean at the records
commit). Carried non-blocking findings: NF-1 format:check evidence scope
(fixed records-only), NF-2 favicon 404 noise (pre-existing), F3 ui-editor
workspace build TS2307 (pre-existing, nothing consumes the dist), F4 Inspector
scope persistence sharp edge. The reusable Inspector/Layers modules are now
the workbench's editing UI (friendly labels, document/scope-driven Layers,
bridge-synchronized selection, live effective-value measurements, visible
Reset, linked spacing, search + keyboard Layers); the dedicated /editor-review
route remains as supporting evidence. The broad Svelte check that previous
rounds reported as 23 errors in manager-owned files is now **0 errors / 2
known warnings** (manager requests executed; no suppressions). The historical
checksum reconciliation is recorded (ITERATION-2-REVIEW.md: recorded A9E855… =
the evaluator's original artifact, restored in-tree byte-exact with scoped
newline protection; the earlier committed copy differed by exactly one
import-time trailing-CR normalization — content and verdict unchanged).

**Next: the FOUNDER walks the updated U2 proofs ([U2-WALKTHROUGH](U2-WALKTHROUGH.md),
~10 min, plain language). Owner experience acceptance is PENDING — independent
verdicts are necessary, not sufficient.** U3/U4 remain unauthorized.

---

**2026-10-06 (superseded by the integration record above) — U2 IMPLEMENTATION
COMPLETE; independent technical gate PASS (after one repair round);
independent experience re-verification PASS WITH FINDINGS; records final;
awaiting the FOUNDER checkpoint — owner experience acceptance PENDING.****

U2 (designer and workbench breadth, STAGES §4 U2-01…U2-08) is implemented and
independently verified on branch `codex/ui-foundation-u2`:

- **Code candidate under verification:** `19bb4b98a18f86bb1193db5a45f8c33e1c5c9af5`
  (repaired round-2 candidate; the round-1 candidate `ebac7bf…` FAILED both independent
  reviews and its verdicts are preserved evidence).
- **Technical:** first independent review at `ebac7bf` returned "U2-TECHNICAL GATE: FAIL"
  (pseudo-state CSS silently inert [blocker], un-interpolated diagnostics, red integration
  gate) with U2-01/02/04/07/08 passing adversarial verification. All findings repaired;
  independent recheck at `19bb4b9`: **"U2-RECHECK: PASS WITH FINDINGS"** — R1 pseudo CSS,
  R2 integration gate, R3 persisted product rendering, R4 instance styling, R5 corrupt-store
  gate all PASS under fresh attack; targeted regressions green.
- **Experience:** first review at `ebac7bf` returned "U2-EXPERIENCE: FAIL" (persisted edits
  never reached the finished page [blocker]; instance styling no-op; schema-corrupt store
  hard-fail). Repaired; independent re-verification: **"U2-EXPERIENCE-RECHECK: PASS WITH
  FINDINGS"** — all five journeys (persisted edit, instance styling, empty-value guard,
  corrupt stores, keyboard resize/label clipping/console sweeps) PASS in a real browser at
  1440×900 / 1024×768 / 390×844 / 480-container.
- **Gates at `19bb4b9`:** unit 2497/2497, renderer 116/116, integration 4/4 (genuinely
  green), root typecheck 0, format clean, check:ui 0 errors (2 known warnings), authoring
  proof 33/33 + tsc 0, design proof 12/12 + typecheck 0 + clean build; console sweeps zero.
- **Performance (U2-08):** representative component-heavy workload (997 nodes, 20
  component instances, 100 repeated rows, 20 transactions, reopen) — p95 compile 20.9 ms
  (budget 250), edit feedback 13.9 ms (budget 100), reopen 4.9 ms (budget 1000). Bundle
  separation measured: product route chunks carry no authoring code.

**Remaining (registered):**
- **N1 — RECLASSIFIED by the owner as a U2-01 failure and REPAIRED + VERIFIED (2026-10-06):**
  definition-body localStyle competed with instance localStyle in the same 'local' layer
  (shared edits won by CSS order). Repair: definition-body localStyle compiles as
  componentBase (one reusable layer-assignment change; canonical source preserved); pinned
  by `cascade-n1.test.ts` (both authoring orders) and independently verified
  "U2-N1-VERIFY: PASS WITH FINDINGS" at candidate `83ba87f…` — all seven demonstrations
  (both pink/blue orders in workbench AND /service, attached-override survival, undo/redo/
  save/reload/reopen distinction, PRESERVED byte-identity through a refused save,
  replacement-clears-warning) PASS
  ([U2-N1-VERIFY-03](reviews/u2/U2-N1-VERIFY-03.md), sha256
  `3738d99352597a3ab96d7621c8e7baf9b18aa0033187f319e47357c4f9393bf1`).
- **N2 — CLOSED with evidence (2026-10-06):** the committed worktree keeps the PRESERVED
  banner visible through editing AND a refused save (`UI_STORE_CORRUPT`, bytes
  byte-identical, failure logged); the banner clears only on an acknowledged successful
  save. The prior reviewer's observation was an artifact of the mid-review drifting
  worktree (flagged by that reviewer); reproduction steps are recorded in the N1-verify
  report.
- **Routed to the Codex Inspector/Layers UX track** (branch
  `codex/ui-foundation-u2-inspector-ux`): D5/F1 — no UI affordance to REMOVE an instance
  override (model-level removal verified; the no-empty-apply guard stays); F2 — Inspector
  'effective value' annotations observed inconsistent with the rendered canvas (unverified
  observation, U2-04 follow-up).
- Notes: 'stored authoring data' wording on the design surface; sticky card travel (~150px)
  is honest but short; `Reload stored` on an empty store truthfully refuses.

**Parallel track (2026-10-06):** the owner assigned a fresh Codex agent to improve the
reusable Inspector/Layers UX on branch `codex/ui-foundation-u2-inspector-ux` (created from
the U2 tip `83ba87f…`, worktree `vict-02-u2-inspector-ux`, pushed). RESERVED for Codex:
`packages/ui-editor/src/Inspector.svelte`, `packages/ui-editor/src/Layers.svelte`, their
UI helpers/styles, UX-specific tests, and necessary additive exports — demonstrated via a
separate editor-review route. The U2 stage-manager track keeps compiler/renderer/session/
bridge/storage repairs and owns the workbench route and shared records. When both tracks
are ready, the reviewed UX commits are integrated into `codex/ui-foundation-u2` with
lineage preserved and the combined candidate independently verified (authorized within
U2). Until integration, the U2 stage-manager track makes NO edits to the reserved files.

**Next: the FOUNDER walks the U2 proofs ([U2-WALKTHROUGH](U2-WALKTHROUGH.md), ~10 min,
plain language). Owner experience acceptance is PENDING — independent verdicts are
necessary, not sufficient.** U3/U4 remain unauthorized.

---

**2026-10-06 — U1 ACCEPTED by the owner at the verified round-4 candidate `345b5c62…`
(non-blocking notes retained); U2 ONLY authorized — history below.**
Fresh independent verification of candidate `345b5c62f7eae1d02d7697cdd1abc71b0daeee41`
([U1-ROUND4-REVIEW-05.md](reviews/U1-ROUND4-REVIEW-05.md), sha256
`139c538422902a76f7b06c5b7a05c99c148f577b67cf684f9a756585c0f97dc4`; evidence in
`reviews/round4/`; verifier harness out-of-repo; worktree restored clean; verifier server
killed, owner demo server untouched; origin/main live-verified twice at `4d2df037…` —
unmoved). All four directed cases held:
- **Preservation policy in save (same as load):** the owner's exact cases —
  `future.format` envelope and `vict.authoring-store@1` envelope lacking a document —
  refused at seed AND non-seed revisions (`UI_STORE_CORRUPT`), bytes unchanged;
  preservation dominates staleness; 9 adversarial preserved shapes held; overwritable
  replacement retained.
- **Save-window ownership:** the owner's exact nested sequence held — nested save/stage/
  foreign-commit/edit refused BEFORE staging, outer commit succeeds, acknowledged store
  revision == editor baseline; thrown/refused writes release the window with state
  preserved; forged stages cannot commit; `session.save()` never reports a refused commit
  as success.
- **Banner semantics:** PRESERVED banner kept on refused saves (byte-identical storage);
  cleared only after acknowledged replacement; reload clean.
- **STATE wording:** consistent with live remote evidence.

Gates at the candidate: unit 2490/2490, renderer 108/108, integration 4/4, example 33/33,
typecheck 0, format clean, check:ui 0 errors (2 known warnings). All TWELVE previous
probes re-verified at suite level; browser journeys for the affected flows.

Non-blocking verifier notes: **NF-1** pre-existing unbound `compileUiDocument` type
reference at store.ts:144 (present at round-3 final `03810ce…`, invisible to gates since
the example is excluded from root typecheck; not a round-4 regression); NF-2/NF-3 minor
notes in the report. Disclosed limitations: no literal browser-process restart; unaffected
probes 1–12 suite-verified only; real-browser re-entrancy covered at unit level.

Next: push round-4 records, remote SHA verification, owner checkpoint. **Owner checkpoint
for U1: COMPLETE — owner accepted U1 at the verified candidate and authorized U2 (see top
of this file).**

| U1 rendering/editing loop | **ACCEPTED by owner 2026-10-06** (handoff [U1-HANDOFF](U1-HANDOFF.md)) | Accepted candidate `345b5c62…`; verdict "U1-ROUND4 GATE: PASS" ([U1-ROUND4-REVIEW-05](reviews/U1-ROUND4-REVIEW-05.md)); NF-1..3 non-blocking notes retained with U2 | Closed at U2 start; U3 unauthorized |
| U2 designer/workbench breadth + Inspector/Layers UX | **CLOSED — PASS WITH NON-BLOCKING FINDINGS + owner acceptance RECORDED (2026-10-07)** (handoff [U2-HANDOFF](U2-HANDOFF.md), integration record [U2-UX-INTEGRATION-01](reviews/u2/U2-UX-INTEGRATION-01.md), acceptance + closure [U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md)) | Combined candidate lineage `e0893fe… × f31477d… → 1a61389… → 2a1ab4c… → 471952b…`; round-1 FAIL at `2a1ab4c0…` preserved ([U2-COMBINED-VERIFY-04](reviews/u2/U2-COMBINED-VERIFY-04.md)); final "PASS WITH NON-BLOCKING FINDINGS" ([U2-COMBINED-VERIFY-05](reviews/u2/U2-COMBINED-VERIFY-05.md)); earlier U2 candidates `19bb4b9…`/`83ba87f…` and UX rounds (ROUND-1 FAIL, ROUND-2, iteration-2, n1-candidate FAIL, n1-recheck PASS) all preserved; broad Svelte check now 0 errors / 2 known warnings; N1/N2 notes retained | Owner walked the integrated Inspector ([U2-WALKTHROUGH](U2-WALKTHROUGH.md)) and approved it; retained findings carried to U3/U4 per the acceptance record; **U3 unauthorized until the owner accepts [U3-HANDOFF](U3-HANDOFF.md)** |
Fresh independent verification of candidate `c1e3d0fec930a2a11341181061d537f16ec065ab`
([U1-ROUND3-REVIEW-04.md](reviews/U1-ROUND3-REVIEW-04.md), sha256
`fd151713aa4345eb0653c648eace64eeb4a774cc8a796d0f74c760bd082cd12b`; 11 evidence screenshots;
verifier harness out-of-repo; worktree restored clean; dev server killed, port freed;
origin/main live-verified twice at `4d2df037…` — unmoved). All three repair claims held:
- **Claim A — history across saves:** 5/5 package attacks + real-browser journey (undo/redo
  continuity, dirty state, revision progression survive saves; genuine divergence still
  refuses; canonical application identity untouched).
- **Claim B — staged-commit preservation:** 9/9 attacks (cross-session stage, superseded
  stage, double-commit, working-move preservation, `UI_EDIT_SAVE_IN_PROGRESS` reentrancy,
  thrown/rejected writes, retry revisioning, stale-writer, nested-save truthful refusal) +
  live two-tab stale-editor fencing.
- **Claim C — load diagnostics:** every named malformed class (unsupported schema, missing
  node registry, empty document, null node, malformed child/branch structures) yields
  `invalid` with a message, zero console exceptions; unreadable bytes preserved behind a
  truthful PRESERVED banner (save refuses, `UI_STORE_CORRUPT`); replacement saves accepted
  at the recorded revision.

All TWELVE previous probes re-verified (suite-level; probes 6–12 were not re-driven as
individual browser journeys — disclosed). Gates at the candidate: unit 2483/2483, renderer
108, integration 4, example 28, typecheck 0, format clean, check:ui 0 errors (2 known
warnings).

Remaining (minor, non-blocking, from the round-3 review):
- **F1 (minor):** a wrong-format envelope with a readable `storedRevision` is classified
  `overwritable: false`, yet `save()` at the matching revision accepts — a multi-tab writer
  could overwrite "preserved" bytes; not reachable through the single-studio flow. Owner:
  U-track builder; next check: classify by envelope-readability + revision-consistency
  together, or refuse overwrite whenever the document is unreadable.
- **F2 (minor):** the startup corruption banner outlives the successful replacement save
  (stale diagnostic until reload). Owner: U-track builder; next check: clear
  `storeDiagnostic` on successful save.
- Carried: R2-2/R2-3 notes; in-memory simulated domain store (U3-05); diagnostic code-name
  reconciliation; host-side timing method; ui-editor `build` script (.svelte, pre-existing,
  exports→src); FINDING-1/2 from round 2 are RESOLVED by this round (history-across-saves,
  staged-commit guards).

Not covered (disclosed): literal browser-process restart (mechanism guarantee: localStorage
is persistent per-origin storage; reload + route reopen demonstrated); individual browser
journeys for probes 6–12 (suite-verified).

Next: normal push, remote SHA verification, **owner checkpoint at the U1 boundary**. U2
remains unauthorized.

**2026-10-06 — U1 REOPENED AGAIN (round 3) for three bounded repairs; prior verified
candidate preserved (history).** The owner directed resolution of: (1) working-session undo/redo must
survive successful saves (history comparison, not canonical-identity, must be repaired);
(2) staged-save commits must never discard accepted edits (guard working-session moves and
cross-session stages; challenge direct stage→edit→commit and synchronous reentrancy through
the store callback; rejecting a commit after persistence must not strand the store advanced);
(3) corrupt/incompatible document loading must return diagnostics reliably (unsupported
schema, missing node registry, empty document, null node, malformed structures), preserve
unreadable stored bytes, and the banner must not claim replacement when the store refuses
overwrite. The round-2 verified candidate `3bd03a5…` and its "U1-REOPEN GATE: PASS" verdict
remain preserved evidence of that snapshot; the overall readiness claim is superseded for
these three findings until this round's fresh verification passes. U2 remains unauthorized.

**2026-10-06 — U1 REOPEN ROUND COMPLETE (round 2): repairs independently verified; owner checkpoint pending; subsequently pushed (history — see round-3 entry for the live remote state).**
The bounded repair round closed with a fresh independent verdict on candidate
`3bd03a5d649c52ac529089f176f7e22b701ee09c`:
**"U1-REOPEN GATE: PASS"** ([U1-REOPEN-REVIEW-03.md](reviews/U1-REOPEN-REVIEW-03.md),
sha256 `44e1647d7321ce8b9c12cc6969bdb6aec8a8a7121897d2254f698940dea2862a`; verifier-built
out-of-repo attacks; worktree untouched; origin/main live-checked unmoved). All 12 owner
probes PASS with direct evidence, including the real-browser persistence journey (edit → save
→ genuine `location.reload()` → edited source + revision 2 restored; route leave/reopen
retained; corruption → visible `role=alert` diagnostic; studio fencing shows `SESSION_STALE`
mid-flight; zero console errors on all three routes; 3 verifier screenshots in reviews/).
Gates at the candidate: unit 2475/2475 (127 files), renderer 108, integration 4, example 20,
typecheck 0, format clean, check:ui 0 errors (2 known warnings).

Repairs now verified (finding → fix):
- U1-04 persistence → localStorage-backed authoring store (`src/lib/authoring/store.ts`):
  startup loads SAVED source, seeds only when empty; corrupt/incompatible → visible
  diagnostic, never a fake reopen; studio save/reopen feedback truthful.
- U1-04 save acknowledgment/revision integrity → two-phase session save
  (`stageSave`/`commitSave`, `packages/ui`); bridge stages → store (revision AUTHORITY)
  checks `expectedStoredRevision` atomically with the write → commit only on store ack;
  failed/thrown writes preserve working doc, dirty state, stored revision, undo/redo
  continuity; stale second editor rejected without overwriting.
- U1-06 fencing → post-await token recheck on success AND rejection paths (both timing
  windows demonstrated; pre-invocation latency fencing retained).
- U1-06 snapshot immutability → double registry captured ONCE at session creation; used for
  coverage and execution; reset/new sessions capture fresh.

Remaining (minor, non-blocking, from the reopen review):
- **FINDING-1 (minor, PRE-EXISTING at base)**: after a *successful* save, `undo()` is refused
  (`UI_EDIT_UNDO_CONFLICT` — the saved revision stamp breaks the continuity digest); undo
  before any save works; claims about continuity across FAILED writes hold. Owner: U-track;
  next check: any round touching session history semantics (natural fit: the U3 durability
  slice or a future editor round).
- **FINDING-2 (minor, introduced this round)**: `commitSave`'s guard misses working-session
  moves between stage and commit (silent intervening-edit loss) — unreachable through
  `EditorBridge.save()`/the studio (single synchronous turn); contradicts the method
  docstring only. Owner: U-track builder; next check: tighten the guard if any host ever
  hand-drives the two-phase API across turns.
- Carried from earlier rounds: R2-2 (studio scenario-note live-region role), R2-3 (benign
  Svelte dev-mode studio warning), in-memory simulated domain store (U3-05), diagnostic
  code-name reconciliation vs PROOF-DESIGN sketches, host-side timing method,
  ui-editor `build` script fails on .svelte imports (pre-existing; exports point to src;
  root typecheck is the gate).

Next: normal push, remote SHA verification, **owner checkpoint at the U1 boundary**. U2
remains unauthorized.

**2026-10-06 — U1 REOPENED by the owner (history).**
The owner's follow-up review reproduced failures against U1-04 and U1-06: studio authoring
persistence was component-local only (no full-reload/restart survival); `EditorBridge.save`
advanced the session before store acknowledgement (failed write → revision/dirty desync;
expected-revision compared session-with-itself, not the authoritative store); preview reset
fencing only covered the pre-invocation window (an async double resolving after a reset
returned stale `ok:true`); the double registry was re-snapshotted at execution time, so
registry changes leaked into existing sessions. The prior U1 GATE PASS and readiness claim are
SUPERSEDED (explicitly historical; the two earlier verifier reports remain preserved evidence
of their own rounds). Repairs + fresh independent verification follow in this round. Scope:
U1 only; U2 remains unauthorized.

**2026-10-06 — U1 GATE: PASS (independent verdict) — HISTORICAL, SUPERSEDED by the reopening
above.** Verification cycle on candidate `351d3e5…`: fresh falsification review
([U1-FALSIFICATION-REVIEW-01.md](reviews/U1-FALSIFICATION-REVIEW-01.md), U1 **GATE FAIL** —
BLOCKER-1: document dispatch was a silent stub in both hosts, so the authored Approve button
did nothing while the page claimed otherwise; MAJOR-1: empty-permission actors bypassed the
preview gate; five minors/notes) → builder repairs at candidate
`5a81672283dbefbbffdbd809704fe563d114f1f7` (real dispatch through the adapter boundary in both
hosts, unconditional permission gate, awaited doubles, role=alert denials, duplicate-submit
guards, true code-point ordering; report preserved and committed) → scoped independent
re-verification ([U1-REPAIR-REVIEW-02.md](reviews/U1-REPAIR-REVIEW-02.md), **U1-REPAIR GATE:
PASS WITH NON-BLOCKING FINDINGS**).

Final U1 criterion verdicts (pass 2): U1-01 PASS (code-point ordering + astral regression),
U1-02 PASS, U1-03 PASS (stand from pass 1, untouched), U1-04 PASS (MINOR-3 latent — see open
findings), U1-05 PASS (16/16 probes + live journeys), U1-06 PASS (gate + awaited doubles),
U1-07 PASS, U1-08 PASS (budgets: compile p95 14.2 ms, edit 8.7 ms, reset 0.13 ms on the
1,966-node workload). Regressions: none (unit 2463, renderer 108, integration 4, example 15,
typecheck/format/check:ui clean; three pass-1 root-suite failures were environmental,
non-reproducing on focused re-runs at both candidate HEAD and base).

OPEN findings carried into the record (none gate-blocking per the verifier):
- **R2-1 (MAJOR, record integrity)**: the repair commit `5a81672…` MESSAGE claims an
  `EditorBridge.save()` rollback (pass-1 MINOR-3) that was **NOT applied** — the builder's
  patch silently no-op'd and the claim was not verified before commit. The desync (failed
  store write → session advances while the store does not) persists, probe-confirmed by the
  verifier. Latent-only under the in-memory example store; withdrawn as a claim; actual fix
  is owned by the U3-05 durability slice. Recorded here as the correction of record.
- R2-2/R2-3 (notes): studio scenario-note paragraph lacks a live-region role; one benign
  Svelte dev-mode warning in the studio (absent from production builds).
- Retained from pass 1: in-memory simulation store is scope-honest for U1 (durable
  replacement = U3-05); preview/adapter diagnostic code names differ from PROOF-DESIGN
  sketches (semantics correct; reconciliation queued); timings measured host-side
  (CDP/client-side method queued); extension placeholders (def./ext.) are U2+ scope.

The branch carries the candidate, the preserved review reports, and this record. Next:
normal push, remote SHA verification, **owner checkpoint at the U1 boundary**. U2 remains
unauthorized.

**2026-10-06 — U1 CANDIDATE history (superseded header, kept for the record).**
The owner authorized U1 (see [U1-HANDOFF](U1-HANDOFF.md)): the first runnable rendering,
editing and simulated product loop. Implemented per the frozen API-SPEC §9 scope:
`packages/ui` (vict.ui-document@1 neutral core: model, validation, compilation to
vict.ui-render-plan@1, transactional edits, sessions, occurrence identity, A-03 identity
ordering), `packages/sdk` (@3 authoring shape), `packages/application` (@3 joint compilation,
rules 1–5, A-01 expansion-cycle detection, A-03 identity payload), `packages/ui-svelte` (the
ONE document renderer), `packages/ui-editor` (session bridge, exported transactional command
builders, canvas/inspector/history), `packages/ui-preview` (scenario orchestration, coverage
denial, reset fencing), `examples/ui-authoring-proof` (inspection product + studio; consumes
built outputs; product entry graph imports no editor/preview modules — verified by test).
Candidate history: `182caa9…` → `b9e6573…` → `4e69175…` → `9284888…` → `7f49cd0…` → `505e0b1…`
→ walkthrough repairs `4f8c1ab…` → **candidate `351d3e5…`** (branch codex/ui-foundation-u1,
worktree vict-02-u1; starting commit `9734690…`).

Automated evidence: U1-01 identity suite (Examples A–D, dangling, catalog/pin collisions, old
release rejection, permutation+duplicate invariance, code-point order, navigation-loop-valid,
expansion-cycle-rejected, @3-never-aliases-@1/@2); transaction atomicity/idempotency/undo-redo/
expected-revision save/reopen; renderer occurrence provenance tests; preview isolation tests
(SCENARIO_COVERAGE_MISSING denial, reset-during-latency fencing, DOMAIN_CONFLICT, permission
denial); product-path tests through the real adapter (approve/deny/stale); adapter discipline;
entry-graph isolation. Root suites green except SIX failures verified PRE-EXISTING at the base
commit `9734690…` in the untouched u0 worktree (bootstrap-artifact, kernel child-process
identity, scaffolder real build, store-sqlite/server SIGKILL cross-process — Windows
environment specifics).

Browser walkthrough (real Chrome via CDP, commands + screenshots under
`examples/ui-authoring-proof/walkthrough/`): queue → detail (document-mode screen) → approve
updates status/activity through the adapter boundary; technician denial leaves state unchanged;
stale decision fails visibly; studio selection maps click → exact source occurrence; exported
transactional commands edit text/styles/interactions; invalid transactions rejected with
diagnostics and no partial effect; undo/redo/expected-revision save/reload round trip preserves
IDs/layout/bindings; preview normal approve via registered double, missingCoverage denies
without invoking any handler, reset-during-latency fences the in-flight result (SESSION_STALE).
Console sweep across all routes: zero errors/warnings/exceptions.

Measurements (PROOF-DESIGN §5 workload: 1,966 authored nodes, 100 repeated occurrences,
20 consecutive transactions): compile p95 **24.3 ms** (budget ≤ 250 ms), edit feedback p95
**16.8 ms** (budget ≤ 100 ms), scenario reset p95 **0.2 ms** (budget ≤ 1 s). Product bundle:
278 KB client JS (~94 KB gzip) for the whole example build; editor/preview modules absent from
the product entry graph.

Next: fresh independent falsification review of candidate `351d3e5…` (U1-01…U1-08) → repairs
if needed → reverify → evidence, normal push, remote SHA verification, owner checkpoint at the
U1 boundary. U2 remains unauthorized.

**U0 — CLOSED (2026-10-06).** Final state: contract candidate
`9ec87f3e7eb8eb7793f972111258940aac635346` (base `4d2df037d8a82d36c60bf1bff16919650643ce22`),
freeze record `ea47edd68e302dc5b6cacb2e43635d11781619ad` (FREEZE.json v2: 22 pins,
supersedes original record `ffbafc0a509d7179eddfa81c157595fe336c9dba` over candidate
`54490a861fcd9992bfc8bfac14178fdb7921ecf0` — both historically intact; the original 19 pins
reproduce), closure/remote commit `97346903e0c1a242b4bab0477c92bc3f34c43c38` (normal push,
remote SHA verified). Independent lineage: original rounds (reports preserved under
[reviews](reviews/)) → owner-authorized amendment (A-01 cycle scope, A-02 rejection→
correction→resubmission journey, A-03 catalog total ordering) → amendment review
([U0-AMENDMENT-REVIEW-01.md](reviews/U0-AMENDMENT-REVIEW-01.md), AMENDMENT HELD;
F-A-01…F-A-07) → five repairs → scoped recheck ([U0-AMENDMENT-RECHECK-01.md](reviews/U0-AMENDMENT-RECHECK-01.md),
REPAIRS VERIFIED — READY TO FREEZE) → fourth fresh checker
([U0-AMENDMENT-FREEZE-CHECK-01.md](reviews/U0-AMENDMENT-FREEZE-CHECK-01.md), FREEZE VERIFIED:
22/22 pins by two methods, lineage/fidelity/scope/truthfulness PASS, `npm ci` + typecheck +
format:check + check:ui clean). U0-01…U0-08 PASS (U0-08 demonstrated at the freeze-record SHA).
Retained non-blocking notes: F-A-06 pack fidelity 6/11 identical / 5/11 diverged (enumerated
in FREEZE.json; divergences are the authorized amendment targets plus the two mutable-discipline
files), F-A-07 `decidedAt` fixture omission (consistent with the approve fixture), checker
F-2 CRLF process note. A documented process incident (mistaken `rm -rf` of uncommitted
working-tree edits, fully restored from git before any commit) is recorded in
[decisions](DECISIONS-AND-EVIDENCE.md).

Round history: the pack was installed verbatim into `docs/ui-foundation/` at base
`4d2df037d8a82d36c60bf1bff16919650643ce22` (all installed digests matched the pack
`HASHES.json` inventory; see [decisions](DECISIONS-AND-EVIDENCE.md) §U0 installation record).
Local reconciliation is recorded in [RECONCILIATION](RECONCILIATION.md); exact schema/API/
diagnostic drafts and the module/export plan in [API-SPEC](API-SPEC.md); fictional domain,
proof walkthroughs, visual criteria and the named performance environment in
[PROOF-DESIGN](PROOF-DESIGN.md); representative fixtures under `fixtures/`. The root
`AGENTS.md` routing block is appended per `AGENTS.addendum.md`.

Pre-installation state (5 October 2026): the documentation execution pack and U0 design
contract were authored against observed VICT main
`4d2df037d8a82d36c60bf1bff16919650643ce22`. Independent documentation review of candidate 02
returned PASS after one minor candidate 01 ambiguity was repaired and rechecked. The owner
authorized starting pack preparation. No foundation code, new schema/API, reference
application, repository integration or Stage 9 change was implemented at that time.

## Identity and authority

- Source repository: https://github.com/radz2291/vict-02.
- Baseline: origin/main `4d2df037d8a82d36c60bf1bff16919650643ce22` — verified live at U0
  start, at the U0 amendment, and again at U1 branch creation (unmoved).
- Current branch: codex/ui-foundation-u1 (isolated worktree `vict-02-u1`), created at
  `97346903e0c1a242b4bab0477c92bc3f34c43c38`; normal push destination. The completed
  `codex/ui-foundation-u0` branch and its worktree are preserved as delivered.
- Delivery location: `docs/ui-foundation/` (frozen contract bytes) plus the U1 implementation
  scope frozen at [API-SPEC](API-SPEC.md) §9.
- Authority: U0 completed and accepted; U1 authorized by the owner on 2026-10-06 with
  end-to-end ownership (see [U1-HANDOFF](U1-HANDOFF.md) §1 for the verbatim grant scope).
  U2–U4 remain the delivery plan, not an unattended implementation grant.
- Concurrent work: Stage 9 branches and other ui-foundation/qa/pi tracks on the remote belong
  to other agents and are left untouched; U1 never modifies `apps/studio` or Stage 9 bytes.

## Current gate ledger

| Item | Status | Candidate/verifier | Next action |
| --- | --- | --- | --- |
| Pack drafting | COMPLETE | Candidate 02; final reporting metadata folded afterward | Installed 2026-10-06; see decisions §U0 installation record |
| Pack independent review | PASS — documentation only | Candidate 01: 8d2683a2a1aae7740755326af597eeed16b4a7a44cfdaf4a9d60cd8b76318e6d; candidate 02: db369614c97119762995480d3ad277b92d21e2eb812739d770bc16bf2df6b15a | Reports preserved under reviews/ |
| U0 repository establishment/freeze | **CLOSED — amended contract frozen (22 pins) and freeze-byte verified; owner accepted; pushed (`a664c70…` → `9734690…` fast-forward)** | Candidates `54490a8…`/`9ec87f3…`; freeze records `ffbafc0…`/`ea47edd…`; four independent verdicts incl. FREEZE VERIFIED (`9b80f3d4…`) | None — closed. Preserve freeze records and historical evidence |
| U1 rendering/editing loop | **ROUND-4 VERIFIED then ACCEPTED by owner (superseded by the ledger at the top of this file)** (handoff [U1-HANDOFF](U1-HANDOFF.md)) | Candidate `345b5c62…`; verdict "U1-ROUND4 GATE: PASS" ([U1-ROUND4-REVIEW-05](reviews/U1-ROUND4-REVIEW-05.md)); preservation policy unified in load+save, save-window ownership, banner clearing all held; NF-1..3 non-blocking + carried notes | Closed — owner accepted; U2 authorized |
| U2 breadth | PLANNED | None | Requires U1 pass and its own accepted scope |
| U3 realism | PLANNED | None | Requires U2 and its own accepted scope |
| U4 reuse/handoff | PLANNED | None | Requires U3 and its own accepted scope |

## Baseline observations

- Root AGENTS.md routes existing work through the system reference and Stage 9 pack; preserve it.
- SDK accepts application schema @1/@2; application compile uses closed field sets and versioned canonical identity.
- Application Release binds the compiled applicationVersion and renderer/data-adapter/component identities.
- UI composition is currently closed stack/split plus semantic presets.
- Existing UI and Svelte package manifests declare 0.4.0-rc.1. This is source evidence, not a newly checked npm registry claim.
- Existing ApplicationDataAdapter query/mutate context carries permissions/effect/actor.
- System reference describes capability simulation doubles; the exact callable composition APIs (`registerDouble`/`replaceDouble`/`snapshotDoubles` and the adapter context) were reconciled in [RECONCILIATION](RECONCILIATION.md) §4.

## Missing proof and limits

U1 status (2026-10-06, at authorization): no implementation evidence exists yet — no contract
element executed as code, no browser/visual work, no performance measurements, no adapter or
double runtime execution for the document model, no U1 candidate commit. The frozen U0
fixtures remain contract examples for review, not executed evidence. Everything below the U0
line is unchanged: no package publication, no npm-registry verification, no Studio
integration. U1 verification must add runtime evidence per [U1-HANDOFF](U1-HANDOFF.md) §4;
design-fixture inspection alone does not establish runtime behavior.

Pack-review limits remain historical facts: the pack documentation review established the
pack's adequacy only, and its candidate-02 snapshot excludes the folded reporting metadata
(final delivery hashes in the pack inventory). U0 repository freeze evidence is recorded in
this repository: FREEZE.json, [decisions](DECISIONS-AND-EVIDENCE.md), and the preserved
reports under [reviews](reviews/).

## Update discipline

After each candidate/review/repair, update this opening state and ledger rather than append
contradictory "current" statuses. Historical decisions/evidence remain in
DECISIONS-AND-EVIDENCE. Include full tested candidate/verifier SHAs and the next authorized
action. Do not copy mutable status into AGENTS.
