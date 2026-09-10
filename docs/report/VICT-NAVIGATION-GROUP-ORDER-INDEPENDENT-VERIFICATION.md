# VICT Navigation Group Order — Independent Verification

> **Status:** Independent verification of the v0.4.4 navigation-group-order
> renderer correction. This audit was performed under the independence
> protocol: governing contracts and architecture were read first, the
> baseline defect was reproduced with an independently authored probe, the
> adversarial probe matrix was authored and executed, and the permanent-test
> pre-fix result was reproduced — all BEFORE the implementation report was
> read. The implementation report's claims were then reconciled one by one
> against independently obtained evidence. No implementer conclusion was
> reused as audit evidence.
>
> **Verdict:** `VERIFIED WITH NON-BLOCKING ISSUES — RELEASE PREPARATION
> PERMITTED` (§15). GAP-CANDIDATE-2 is
> `VERIFIED — PUBLIC RELEASE PENDING`; **Trading OS T1 remains blocked until
> a new immutable VICT release containing this correction is published and
> independently proven installable** (§16).

---

## 1. Auditor independence and scope

- This audit is an independent verification, not an implementation,
  remediation, release-preparation, or publication task.
- The implementer's report
  (`docs/report/VICT-NAVIGATION-GROUP-ORDER-IMPLEMENTATION-REPORT.md`) was
  read only AFTER the independence protocol's evidence-gathering steps were
  complete (contracts → baseline inspection → verification matrix → diff
  inspection → probe authoring → report reading → claim reconciliation).
- No production code, permanent test, normative document, manifest, version,
  lockfile, npm dist-tag/access/ownership/metadata, Git tag, or GitHub
  release was created or modified. No publication occurred. Trading OS T1
  was not started. The Trading OS repository was used strictly read-only;
  Quellight was not accessed.
- All temporary audit material (two git worktrees, probe files, packed
  tarballs, the external consumer, isolated npm caches) was created under
  temporary directories and was removed after evidence collection (§14
  notes the residue that predated the audit).
- The only repository change produced by this audit is this report.

## 2. Exact SHAs and environment

| Item | Value |
| --- | --- |
| Audited repository | `C:\Users\RZ1\Desktop\RZ\260831-VCT-02` |
| Baseline commit | `e70b1a876bf7f4bad83a611f5333d86541a0b664` |
| Implementation commit | `4fdabe21449740bfce61242b3480331215c64f97` |
| Documentation commit (audit start) | `13b4ef2a97d53560016b8d9771bb4847a84d5cf9` |
| Ancestry | `e70b1a8 → 4fdabe2 → 13b4ef2` verified via `git merge-base --is-ancestor` (both OK) |
| Remote state at audit start | after `git fetch`: `HEAD == origin/main == 13b4ef2…` (no divergence; `origin/main` had not advanced) |
| Tracked working tree at audit start | clean (`git status --porcelain`: zero tracked modifications) |
| Untracked material | pre-existing `.pi/` (`audit-work`, `skills`) only — preserved untouched |
| Trading OS repository (read-only) | `22a6b34773033bc5d807b4bdd130f30240b7079d` (expected commit confirmed) |
| OS / runtime | Windows 11, Git Bash (win32-x64), Node v22.13.1 |
| Toolchain (installed via committed lockfile) | vitest 4.1.11, Svelte **5.57.0**, vite 6.4.3, TypeScript 6.x line |
| Audit worktrees | `e70b1a8…` and `13b4ef2…` checked out into isolated temp directories, each with its own `npm ci` (both exit 0); deleted after evidence collection |

## 3. Requirements matrix (independently derived)

The audit matrix below was derived from the governing documents read before
any implementation material: `docs/VICT-SYSTEM-REFERENCE.md` (read
completely, all 3,287 lines), `docs/RELEASE-COMPATIBILITY.md`,
`docs/architecture/STAGE-04-CAPABILITY-APPLICATION-AUTHORING.md`,
`docs/architecture/STAGE-05-APPLICATION-DELIVERY.md`, the SDK/application
source contracts, the renderer source, the renderer tests, and the read-only
Trading OS audit documents.

| # | Requirement (source) | Audit result |
| --- | --- | --- |
| R1 | Baseline renderer sorts nav groups alphabetically, discarding declared route order (implied by ordered-route contract) | **Confirmed** by independent probe at `e70b1a8` (§4) |
| R2 | `ApplicationDefinition.routes` is ordered navigation semantics (`packages/sdk/src/application.ts`: "The routes array is ORDERED navigation semantics"; `routes: "Ordered navigation routes"`) | **Confirmed** in source |
| R3 | Compiled plan preserves declared route order (`compile.ts`: plan `routes` built by mapping `application.routes` in order; "Resolved routes in NAVIGATION order") | **Confirmed** in source + probe (plan route ids in declared order) |
| R4 | Route order is application-identity relevant (`canonicalApplicationManifest` preserves route arrays; STAGE-04 §6: "navigation route order … change the identity when reordered — UI intent is never sorted away") | **Confirmed** in source + probe (reordered declaration ⇒ different `applicationVersion`; recompile deterministic) |
| R5 | `nav.order` is an order hint WITHIN its group; `nav.group`/`order` are the only nav fields (`NAV_FIELDS = ['label','group','order']`; closed schema rejects `groupOrder`) | **Confirmed** in source + probe (compile rejects a `groupOrder` field with structured diagnostics) |
| R6 | Corrected rule — "Navigation groups render in the order of their first navigable occurrence in the ordered compiled route list" — generic, deterministic, no trading-specific names, no schema field, no CSS workaround, no duplicated navigation | **Confirmed** at `13b4ef2` (§6 probe matrix items 1–8; diff contains no consumer-specific terms — §5) |
| R7 | Within-group `nav.order` preserved verbatim; declaration position never overrides an explicit hint; deterministic path tie-break for equal/absent hints | **Confirmed** (probe matrix items 3–4) |
| R8 | Repeated/interleaved groups anchor at first occurrence and collect all members; ungrouped routes form an unlabeled collection anchored at its own first occurrence | **Confirmed** (probe matrix items 1, 5–6); see §6 note on ungrouped-collection semantics |
| R9 | Desktop and mobile present the same semantic order (single `nav[aria-label="Application"]` landmark; responsive CSS switches presentation) | **Confirmed** (probe item 9; markup inspection) |
| R10 | Active-route highlighting, close-on-navigation, Escape-closes-and-restores-focus survive the change | **Confirmed** (probe items 10–11) |
| R11 | Reactive plan replacement recalculates order without remounting | **Confirmed for same-shape permutation/rename; REFUTED as a blanket claim for shape-changing updates** (§7 findings IV-1/IV-2) |
| R12 | No export/schema/plan-shape/identity/declaration change; no new dependency; no Node-only dependency in browser-safe packages; no Trading-OS-specific behavior | **Confirmed** (§5, §9) |
| R13 | Published `0.1.0` set immutable; correction NOT publicly installable | **Confirmed** (§12) |
| R14 | Trading OS T0 complete; GAP-CANDIDATE-2 the only current external T1 blocker; T1 blocked until a released, independently proven installable version supplies it | **Confirmed** read-only (§13 of the report; Trading OS roadmap T1 entry gate) |
| R15 | Permanent tests assert public behavior and fail at baseline for the intended reasons; claimed `5 failed / 4 passed` pre-fix | **Confirmed** (§8) |
| R16 | Implementation report truthful | **Confirmed with one overbroad reactive-reactivity claim** (finding IV-1) |

## 4. Baseline negative control (at `e70b1a8`)

An independently authored probe
(`iv-baseline-negative-control.test.ts`, executed in the baseline worktree,
`npx vitest run --project renderer test/iv-baseline-negative-control.test.ts`)
proved, against the unmodified baseline renderer:

1. **The defect:** with routes declared `Reports → Alpha → Metrics`
   (one navigable route each), the baseline renders
   `#Alpha → Alpha → #Metrics → Metrics → #Reports → Reports` —
   **alphabetical, not declared order**. The probe asserted the rendered
   sequence EQUALS the alphabetical sequence (4/4 probe tests passed,
   demonstrating the baseline behavior exactly).
2. **Divergence proof:** rendered group order (`Alpha, Metrics, Reports`)
   differs from route first-occurrence order (`Reports, Alpha, Metrics`).
3. **Control — within-group contract pre-existed:** `nav.order` ordered
   routes inside a group at baseline (declared-reversed fixture rendered
   hint-sorted).
4. **Control — no separate group-order field:** a definition whose `nav`
   declares `groupOrder` is REJECTED by the closed schema at compile time
   (structured diagnostic), proving consumers had no way to declare group
   order other than route position.

**Public-registry cross-check:** the published
`@victframework/renderer-svelte@0.1.0` tarball was downloaded read-only
(integrity recomputed — §12) and its `src/VitApp.svelte` was diffed against
the baseline commit's file: **byte-identical** (`diff` clean), and it
contains both the alphabetical group sort
(`.sort((a, b) => (a[0] < b[0] ? -1 : …))`) and the keyed outer each
(`{#each navGroups as [group, entries] (group)}`). The published artifact
therefore exhibits exactly the baseline behavior.

## 5. Source and diff inspection

Complete diffs inspected: `e70b1a8..4fdabe2` (implementation),
`4fdabe2..13b4ef2` (documentation), `e70b1a8..13b4ef2` (aggregate).

**Changed-file scope — confirmed exact:**

| Commit | Files |
| --- | --- |
| `e70b1a8..4fdabe2` | `packages/renderer-svelte/src/VitApp.svelte` (+production, 34 lines), `packages/renderer-svelte/test/navigation-group-order.test.ts` (new, 353 lines) |
| `4fdabe2..13b4ef2` | `docs/VICT-SYSTEM-REFERENCE.md` (9 lines), `docs/report/VICT-NAVIGATION-GROUP-ORDER-IMPLEMENTATION-REPORT.md` (new) |
| Aggregate | exactly the four files above — **no historical report, handoff, architecture document, manifest, lockfile, or script touched** |

**Production change semantics (read in full):**

1. `navGroups` derivation: the alphabetical group-name sort was removed; a
   `Map` populated in plan-route order now yields first-occurrence group
   anchoring and collect-all membership; the within-group
   `nav.order`-then-path sort is byte-identical to baseline.
2. The nav's outer each changed from keyed `(group)` to unkeyed; the inner
   route each remains keyed `(entry.route.id)`.
3. No exported symbol, type, prop, CSS class, ARIA attribute, or theme
   token changed; no dependency changed; no consumer- or trading-specific
   name appears in the production diff (grep of all added production lines
   for `trading|quellight|research|operate|practice`: **0 matches**; all
   such terms in the aggregate diff are in documentation describing the
   originating finding).

**Contract non-interaction (from source):** `compile.ts` untouched — the
closed schemas, canonicalization (`set-like sorted, arrays preserved`),
plan freezing, serialization, and `applicationVersion` are byte-for-byte
unchanged; the SDK contract file is untouched; the renderer's exported
surface (`RENDERER_ID`, `RENDERER_REVISION`, `createVictRenderer`,
`renderVictApplication`, `VitApp`, roles) is untouched, so its emitted
`dist/index.d.ts` is unchanged in shape (the renderer build passed in the
ladder).

## 6. Independently authored adversarial probes (corrected tip `13b4ef2`)

`iv-corrected-matrix.test.ts` (16 test cases) plus supporting debug probes
were executed in the corrected worktree against the REAL compiler and
mounted renderer (`happy-dom`, Svelte 5.57.0). Final state after probe-bug
fixes on the auditor side (documented honestly): **15/16 passed; the single
failure is the genuine reactive shape-change defect of finding IV-2.**

| Area | Result | Evidence |
| --- | --- | --- |
| 1. Non-alphabetical group order | **PASS** | declared `Solo0, Reports(,Reports2), Alpha, Metrics` renders first-occurrence |
| 2. Alphabetical input stability | **PASS** | `Alpha, Beta, Gamma` renders alphabetically (identical to first occurrence) |
| 3. `nav.order` inside a group; declaration position never overrides an explicit hint | **PASS** | declared `order 7, 1, 3` renders `1, 3, 7` |
| 4. Deterministic path tie-break (equal/absent hint) | **PASS** | hint-0 members and hint-4 members each sort by path |
| 5. Repeated/interleaved groups | **PASS** | `AA,BB,AA,BB,AA` anchors `AA` at first occurrence, collects all members hint-sorted, `BB` complete |
| 6. Ungrouped before/between/after named groups | **PASS** | ungrouped routes form ONE unlabeled collection anchored at the first ungrouped route (Map semantics: the `''` key first-inserts at the first ungrouped route and collects ALL ungrouped members; the collection can therefore not be split between named groups). This matches the permanent test and the system-reference sentence "routes without a `group` … anchor at their own first occurrence" read as anchoring the ungrouped collection. Recorded here because an auditor's first reading (positional per-member interleaving) is NOT the implemented semantic. |
| 7. Routes without navigation metadata | **PASS** | absent from nav; their screens still resolve |
| 8. Navigable redirect routes | **PASS** | a nav-declared redirect renders as a navigable link at its group position; a redirect without `nav` stays out of nav |
| 9. Desktop/mobile equivalence | **PASS** | exactly one `nav[aria-label="Application"]`; identical sequence before/during the opened mobile panel; `aria-expanded` toggles |
| 10. Active-route highlighting | **PASS** | `aria-current="page"` follows the path (exactly one at any time) |
| 11. Close-on-navigation + Escape | **PASS** | a path change closes the open menu; Escape inside the nav closes it and restores focus to the toggle |
| 12. Reactive replacement (permutation) | **PASS** | `A→B→A→B` consecutive permutations on ONE mounted instance; order recalculates every time |
| 12b. Reactive add/remove of a group | **FAIL — genuine defect (IV-2)** | inserting a labeled group between two existing groups LOSES the following group's label (`AA,A,MM,M,B` — `BB` label gone); removing a middle group leaves a STALE DUPLICATE label (`AA,A,BB,B,BB`); a swap whose first group GROWS (1→3 links) renders the ENTIRE NAV EMPTY until the next update. Deterministic across 3 consecutive runs. Identical failures for adding/removing UNLABELED (ungrouped) nav routes. |
| 13. Multiple consecutive permutations `A→B→A` | **PASS** | covered in 12 |
| 14. Label/link association integrity | **PASS (permutation/rename)** | after permutation/rename, every link's `href`/label sits under its own group; no stale `aria-current`. **Fails under 12b's shape changes** (missing/duplicated labels) |
| 15. No duplicated/missing/stale DOM nodes | **PASS for same-shape updates** (5 rounds of permute/restore keep exact node counts); **FAIL under 12b shape changes** |
| 16. Identity deterministic + route-order sensitive; rendering never mutates the plan | **PASS** | reordered declaration ⇒ different `applicationVersion`; recompile identical; `toJSON()` byte-equal before/after render |
| SSR | **PASS** | `svelte/server` render (via vite SSR pipeline) emits `#Reports, Reports, #Alpha, Alpha, #Metrics, Metrics` — first-occurrence order in initial server markup (exit 0). Reactive-reconciliation defects cannot manifest in SSR (no client reconciliation server-side). |
| Route position vs explicit hint | **PASS** | see item 3 — route-array position never overrides `nav.order` inside a group |

**Keyed-vs-unkeyed reconciliation evidence (§5 audit focus) — see §7.**

## 7. Keyed/unkeyed Svelte 5 reconciliation — independent reproduction

Three independent probes were executed (Svelte **5.57.0**, the version the
correction names):

1. **Minimal fixture, keyed vs unkeyed outer each, multi-node bodies
   (label + N links), NO `{#if}`:** rotations, swaps, body-size changes,
   insert/remove, and a 20× permutation loop all produced CORRECT document
   order for BOTH variants (12/12). A bare keyed multi-node body therefore
   does NOT misassociate by itself.
2. **Real production component with ONLY the keying restored
   (`VitAppKeyed.svelte` — a byte-copy of the shipped `VitApp.svelte` with
   `{#each navGroups as [group, entries] (group)}`):** one equal-size
   permutation `AB→BA` produced
   `['#Alpha', '#Beta', 'B1', 'B2', 'B3', 'A1', 'A2']` — **the `#Alpha`
   label stayed orphaned at the top while the blocks moved; the A links
   rendered under the Beta heading**. The claimed keyed-fragment
   misassociation is therefore **REPRODUCED** against the actual component
   (the `{#if group !== ''}` label node inside the keyed body is the
   difference from the minimal fixture — consistent with the
   implementation report's mechanism description).
3. **Same reactive scenarios, shipped unkeyed component vs keyed variant,
   side by side (3× deterministic):**

| Scenario | Shipped (unkeyed) | Keyed variant (baseline code) |
| --- | --- | --- |
| Equal-size swap | `BB,B,AA,A` — **CORRECT** | `AA,BB,B,A` — Alpha label orphaned (BROKEN) |
| Insert middle group | `AA,A,MM,M,B` — `BB` label LOST | `AA,A,BB,M,B` — `MM` label lost, M under BB (BROKEN) |
| Remove middle group | `AA,A,BB,B,BB` — stale duplicate `BB` label | `AA,A,MM,BB,B` — stale `MM` label (BROKEN) |
| Swap with first group growing 1→3 links | `[]` — ENTIRE NAV EMPTY until next update | `[]` — identical (BROKEN) |

**Conclusions:**

- The keyed→unkeyed change genuinely FIXES the permutation
  misassociation that the correction was motivated by (reproduced,
  deterministic).
- Reactive updates that CHANGE THE NAV SHAPE (insert/remove nav routes,
  add/remove unlabeled routes, member-count-changing swaps) corrupt the
  nav DOM in the shipped implementation — AND in the baseline keyed
  implementation (in equivalent or worse forms). This defect class is
  **pre-existing**, not introduced by the correction; the correction is
  strictly an improvement for the permutation case.
- The correction's own permutation/reactivity claims hold; the blanket
  sentences "a reactively updated application plan recalculates the
  presentation order from the new plan" (System Reference v0.4.4 header
  and §17.3) and the report's §5 wording are **overbroad** — they hold for
  same-shape permutation/rename updates, not for shape-changing updates
  (finding IV-1).
- Focus/keyboard behavior was re-checked after corrupting updates: the
  toggle, close-on-navigation, and Escape policy continue to function
  (probe item 11 executed after updates); the corruption is node
  association/loss, not event-handler loss.

## 8. Permanent-test audit (nine committed tests)

Each test was reviewed individually and the file was executed against the
BASELINE worktree:

**Pre-fix result — REPRODUCED EXACTLY: `5 failed / 4 passed`.** The five
failures are the first-occurrence assertions (non-alphabetical order,
ungrouped anchoring, desktop/mobile order with keyboard policy, reactive
permutation, plan/identity file); the four passes are the tests expressing
baseline-compatible behavior (alphabetical stability positive control,
`nav.order`, path tie-break, interleaved collection). The implementation
report's §3 negative-control claim is accurate, including its honest
disclosure that the interleaved-groups test passes at baseline
coincidentally (alphabetically ordered fixture names `Aurora`/`Borealis`).

Quality review:

- **Public behavior, not implementation detail:** all nine compile through
  the REAL `compileApplication`, mount the real renderer, and assert DOM
  sequences, ARIA attributes, and identity values. No snapshot of
  internals, no private imports.
- **Baseline sensitivity:** 5/9 fail at baseline for exactly the intended
  reason (alphabetical group presentation); no test passes at baseline
  *and* post-fix in a way that would mask a regression (the two disclosed
  baseline-passing tests are positive controls).
- **Fixed-fixture-order accidental passes:** none found post-fix beyond
  the two disclosed positive controls; the anti-alphabetical fixtures
  (`Zebra` before `Yak`, `Reports` before `Alpha`/`Metrics`) genuinely
  exercise the rule.
- **No global-order dependence:** every test compiles its own app and
  unmounts in `try/finally`; assertions query the mounted output element,
  not shared document state.
- **Cleanup:** idempotent `unmount()` per test; no leaked timers or
  listeners observed across the 5× repeated-update probes.
- **Mobile and accessibility behavior:** test 7 verifies the single
  landmark, identical semantic order across form factors, `aria-expanded`
  toggle, the in-flow open panel, Escape-closes-and-restores-focus, and
  `aria-current` with grouped navigation; the pre-existing
  `renderer.test.ts` "accessible defaults" suite and the Stage 05
  real-browser axe suites (via `verify:stage5`, exit 0) cover the broader
  a11y regression envelope.
- **Reactive replacement:** test 8 covers plan replacement without
  remount (permutation + rename). Coverage gap: NO permanent test covers
  shape-changing reactive updates (add/remove nav routes, member-count
  changes) — precisely the region of finding IV-2 (IV-3).
- **No weakened assertions, excessive timeouts, or suppressed
  diagnostics:** the 10 ms `setTimeout` flushes match the established
  suite style; nothing was loosened relative to the repository's existing
  renderer tests; no diagnostic output is swallowed.
- **Coverage of the report's claimed areas:** the report's §7 list
  (nine areas plus the accessibility paragraph) accurately describes what
  the file covers; the report does NOT claim add/remove-group coverage
  (accurate).

## 9. Contract, identity, and package assessment

Verified from source, the aggregate diff, the build, and the packed
tarball:

- **No exported TypeScript contract change** — no `.d.ts`-affecting change;
  renderer exports byte-identical in shape (build passed; diff touches
  only component internals).
- **No Application Definition schema change** — `NAV_FIELDS` unchanged
  (`['label','group','order']`); unknown-field rejection intact (probe:
  `groupOrder` rejected).
- **No serialized plan-shape change** — `compile.ts` untouched; plan
  `toJSON()` byte-stable across rendering (probe item 16).
- **No canonical application-identity algorithm change** — route order was
  ordered identity semantics BEFORE the correction (STAGE-04 §6 identity
  formula: "arrays preserved"); probe proves order-sensitivity and
  determinism at the corrected tip. The correction makes the PRESENTATION
  honor the identity-bearing order; it does not alter identity.
- **No generated declaration change; no new consumer dependency; no
  Node-only dependency added to browser-safe packages** — the renderer's
  dependency graph is unchanged (`@victframework/application`,
  `@victframework/sdk`, svelte peer); `npm pack --dry-run --json` shows the
  same 14-file layout (src + dist + theme).
- **No Trading-OS-specific behavior** — the rule is generic first-
  occurrence ordering; zero consumer-specific strings in production code.
- **Release-set consistency:** `npm run verify:release-set` exit 0 —
  13 packages, exact `0.1.0` pins, content ID `v1_dbb7438dfe16b7d…`
  unchanged.

### Renderer identity disposition (explicit, as required)

`RENDERER_ID = 'renderer.svelte-kit'`, `RENDERER_REVISION = '5.0.0'` is
unchanged by the correction. Governing conventions state the renderer
identity "participates ONLY in release identity, never application
identity" (STAGE-05 §3) and that `applicationVersion` is "unchanged by
renderer revision alone"; **no normative rule found requires bumping the
renderer revision on renderer behavior changes**, and the repository's own
practice kept `5.0.0` through earlier behavior-changing renderer
corrections (mobile-nav layout remediation, form-values remediation,
close-on-navigate policy — all pre-publication).

Disposition: retaining `renderer.svelte-kit@5.0.0` is **consistent with
documented rules and established practice**, and application identity is
unaffected. HOWEVER, this is the first behavior-changing renderer
correction since an immutable public release exists: the published `0.1.0`
tarball and any future corrected package would BOTH declare
`renderer.svelte-kit@5.0.0`, so an Application Release manifest's
`releaseVersion` (which hashes the renderer id@revision) cannot by itself
distinguish the two behaviors. The npm package version does distinguish.
This is acceptable for release PREPARATION (consumers pin exact npm
versions; release manifests are per-deployment records), but the release
task SHOULD make an explicit owner decision on whether to bump
`RENDERER_REVISION` (e.g. `5.0.1`) in the corrected package so
release-manifest identity can distinguish the corrected renderer
(recorded as finding IV-4; non-blocking).

## 10. Packed external-consumer evidence (UNRELEASED CANDIDATE)

Clearly labeled: **unreleased-candidate test** — the candidate tarball was
never published; it is NOT registry `0.1.0`, and it is not presented as
such anywhere.

1. **Build:** `npm run build` exit 0 (all 13 packages, from the
   authoritative checkout at `13b4ef2`).
2. **Pack inspection:** `npm pack --dry-run --json` (renderer-svelte):
   `@victframework/renderer-svelte@0.1.0`, 14 files, containing
   `src/VitApp.svelte`, `src/index.ts`, `src/theme.css`, `dist` +
   `package.json`.
3. **Candidate tarball packed** to a temporary directory. Candidate
   integrity `sha512-pEfKzweaeSAM…` ≠ published `sha512-TCtsqR+O5+mkT/…`
   — provably a DIFFERENT artifact from the registry release.
4. **External consumer** created OUTSIDE both repositories in a temp
   directory: `@victframework/contracts@0.1.0`, `@victframework/sdk@0.1.0`,
   `@victframework/application@0.1.0` resolved **from the public npm
   registry**, and the corrected renderer installed **from the temporary
   local tarball** (as an extracted tarball folder, because npm 10.9.2
   crashed on tarball-dependency resolution with its known
   `edgesOut` bug — documented workaround; the installed content is the
   candidate tarball's content, verified: installed
   `node_modules/@victframework/renderer-svelte/src/VitApp.svelte` carries
   the corrected unkeyed each at line 310). Svelte 5.57.0 and zod 3.25.76
   resolved normally; the lockfile records registry URLs for the three
   registry packages (no monorepo path in any resolution).
5. **Emitted-package behavior:** the consumer compiles a deliberately
   non-alphabetical definition (`Reports → Alpha → Metrics` groups with
   two members in the first group) through the INSTALLED
   `@victframework/application@0.1.0` and renders it through the INSTALLED
   candidate renderer: rendered sequence
   `#Reports, Reports, Drafts, #Alpha, AlphaOps, #Metrics, MetricsView` —
   **first-occurrence group order from the emitted package, not
   source-path resolution** (1/1 test passed).
6. **Strict host compilation:** `tsc --strict` (with
   `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
   `verbatimModuleSyntax`) over the consumer's `src`/`test`/config —
   **exit 0** against the candidate's emitted declarations.

All consumer material was deleted after evidence collection.

## 11. Public-registry immutability evidence

Read-only `npm view` / `npm pack` checks performed during the audit:

- All 13 `@victframework/*` packages: `versions` = `["0.1.0"]` ONLY;
  `dist-tags.latest = 0.1.0` for every member. No new version, no new tag.
- `@victframework/renderer-svelte@0.1.0` `dist.integrity`
  `sha512-TCtsqR+O5+mkT/rJFRG7SMkkHvQqQjC7iKTr3TxduyVJJBZkXplPj4cMRt5FUxQ6TR1die84kDP61aj7VxpeFQ==`
  — the downloaded tarball's recomputed SHA-512 **matches exactly**
  (byte-identical to the published artifact).
- The published tarball's `src/VitApp.svelte` is byte-identical to the
  baseline commit's file (diff clean) and contains the alphabetical sort +
  keyed each: **published `0.1.0` still has baseline behavior**.
- Registry `time` metadata for renderer-svelte shows only the original
  2026-09-09 publication events (created/published/modified at 11:05:18–19Z)
  — no mutation during implementation or this audit.
- `npm run verify:release-set` exit 0 at the corrected tip: the recorded
  `vict-release-set@1/0.1.0` identity
  (`v1_dbb7438dfe16b7de245fe3863f6980b7e9a44a83c1809e01071941782597a11d`)
  still matches the manifests. Nothing was published, unpublished,
  dist-tagged, or otherwise mutated by implementation or audit.

## 12. Verification ladder (authoritative clean checkout at `13b4ef2`)

Executed once, sequentially, in the prescribed order; no failure was
rerun silently, no timeout increased, no diagnostic suppressed. Exit codes
are the commands' actual results.

| # | Command | Exit | Observed result |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | clean install from the committed lockfile (pre-existing `EBADENGINE` warning for `posthog-node@5.51.6` — a transitive Mastra dependency warning only) |
| 2 | `npm run format:check` | 0 | all files pass Prettier |
| 3 | `npm run lint` | 0 | ESLint clean |
| 4 | `npm run typecheck` | 0 | strict `tsc --noEmit` clean |
| 5 | `npm run build` | 0 | all 13 packages build |
| 6 | `npm test` | 0 | **first-run green: 116 files passed + 1 skipped (117); 2184 tests passed / 3 skipped (2187)** — exactly the implementation report's claimed counts; the 3 skips are the documented POSIX-only `packages/mastra/test/storage.permissions.posix.test.ts` suite (`describe.skipIf(process.platform === 'win32')`) |
| 7 | `npm run example:application` | 0 | application-proof build + 17/17 tests |
| 8 | `npm run verify:stage5` | 0 | ALL CHECKS PASSED (full-package build, complete suite, warning-free reference build, definition/DOM suites, real-process HTTP restart, REAL-browser desktop + mobile with axe accessibility, packed-consumer scaffolder verification) |
| 9 | `npm run verify:release-set` | 0 | ALL CHECKS PASSED — 13 packages, `0.1.0`, `v1_dbb7438dfe16b7d…` |
| 10 | `npm run verify:clean-clone` | 0 | fresh-clone `npm ci` + typecheck + build + `verify:stage6b` ALL GATES PASSED from the committed correction |
| 11 | `git diff --check` | 0 | no whitespace/conflict markers |

All commands exist in the repository; no substitute was needed.

**Additional focused runs (main checkout):** the focused navigation file
`npx vitest run --project renderer test/navigation-group-order.test.ts` —
**9/9 passed**; the full renderer project — **4 files / 54 tests, all
passed** (includes the shared renderer-conformance suite
`runRendererConformanceSuite`, "accessible defaults", and heading-levels
accessibility suites); independent probes — see §6–§7. Worktree
cross-checks: permanent renderer files 4 files / 54 tests green at the
corrected worktree; the three pre-existing renderer files (45 tests) green
at the baseline worktree.

## 13. Trading OS gate (read-only evidence at `22a6b34…`)

- **T0 remains complete:** the reconciliation's verdict block reads
  `T0 RECONCILED WITH EXTERNAL VICT DEPENDENCY — T1 BLOCKED` (with F-1
  resolved via a clean product-owned `TradingShell` composition).
- **GAP-CANDIDATE-2 is the only current external T1 blocker:** the
  reconciliation's unresolved-dependency table marks GAP-CANDIDATE-2
  "Blocking T1"; GAP-CANDIDATE-1 (subscription data binding) is deferred
  to T6 with evidence and is not blocking. No other external blocker is
  recorded.
- **T1 entry gate:** `docs/TRADING-OS-ROADMAP.md` T1 — "T1 does not begin
  until a released VICT version supplies declared navigation-group
  ordering (GAP-CANDIDATE-2) … unless a recorded decision explicitly
  accepts VICT's alphabetical group order".
- **This correction, even verified, is NOT publicly installable:** the
  registry carries only the baseline-behavior `0.1.0` artifacts (§11).
  The correction exists only in source at `13b4ef2`. T1 therefore REMAINS
  BLOCKED until a new immutable VICT release containing the correction is
  published and independently proven installable per
  `docs/RELEASE-COMPATIBILITY.md` §6 (publish →
  `verify:release-consumer -- --registry`).
- One nuance recorded for the release task: the Trading OS audit's
  "minimum required behavior" sketched a NEW declaration with alphabetical
  fallback; VICT's chosen rule instead honors the already-ordered routes
  array (no new field). This is a stricter, contract-restoring reading —
  it satisfies the consumer's stated need (Research → Practice → Operate →
  Review → System renders declared-order) and is compatible with the T1
  gate's intent. Trading OS documentation was not modified by this audit.

## 14. Findings by severity

Blocking findings: **none.**

- **IV-1 (Medium, non-blocking — documentation truthfulness):** the
  blanket reactive-recalculation sentences in the System Reference v0.4.4
  header/§17.3 and the implementation report's §5 hold only for
  same-shape permutation/rename plan updates; under shape-changing
  reactive updates the nav DOM corrupts (IV-2). The wording must be
  qualified (or the defect remediated) in a follow-up documentation pass.
  The implementation report's SPECIFIC claims (permutation recalculation,
  keyed-defect mechanism, negative control, ladder counts) were all
  independently confirmed; no claim was found false.
- **IV-2 (Medium, non-blocking — pre-existing defect, newly documented):**
  reactive plan updates that add/remove nav routes or change group member
  counts corrupt the shipped renderer's nav DOM (missing adjacent group
  labels on insert; stale duplicate labels on remove; an entirely empty
  nav after a member-count-growing swap — deterministic, reproduced 3×;
  equally present in the baseline keyed implementation). The correction
  neither introduced nor worsened this class; it fixed the permutation
  case. Remediation (outer keyed reconciliation redesign, stable wrapper
  elements, or `{#if}` elimination) is recommended before or alongside
  the coordinated release, as a separate narrowly-scoped correction.
- **IV-3 (Low — test coverage):** the permanent suite has no coverage for
  shape-changing reactive nav updates; the committed reactive test covers
  only same-shape permutation/rename, so IV-2 cannot regress-and-fail any
  gate today.
- **IV-4 (Low — renderer identity):** retaining
  `renderer.svelte-kit@5.0.0` is rule-consistent (§9 disposition) but
  leaves release-manifest identity unable to distinguish corrected vs
  published renderer behavior; the release task should take an explicit
  owner decision (bump to e.g. `5.0.1`, or record acceptance).
- **IV-5 (Informational — documentation hygiene):** the System Reference
  footer still reads "End of authoritative baseline v0.4.3" while the
  header records v0.4.4; a stale footer string.
- **IV-6 (Informational — environment):** pre-existing implementer residue
  was observed in the shared temp directory (`vict-audit*` paths from the
  implementation session, including the implementation report's own
  disclosed pre-correction full-suite failure log). Not repository
  material; removed-relevant residue predating this audit was left
  untouched and all AUDIT-created material was removed. Separately: npm
  10.9.2's `edgesOut` crash on tarball dependencies required the extracted-
  folder workaround in §10 — an environment note for the release task's
  consumer verifications.

## 15. Final verdict

The correction restores an EXISTING contract (ordered navigation route
semantics, ordered identity semantics, and `nav.order`-within-group were
all normative before the correction); the baseline renderer's alphabetical
group sort contradicted that contract (a §0.1 authority-order mismatch,
fixed at the right layer). The implemented rule — first navigable
occurrence in the ordered compiled route list — is generic, deterministic,
identity-consistent, and free of workarounds.

- Source behavior: **verified** (baseline negative control; 15/16 probe
  matrix; SSR check).
- Contract consistency: **verified** (§5, §9).
- Keyed/unkeyed reactivity: **verified for the corrected case**; the
  claimed keyed defect was independently reproduced; a pre-existing
  shape-change corruption class is documented as IV-2.
- Accessibility: **verified** (landmark uniqueness, `aria-current`,
  close-on-navigation, Escape + focus restore, real-browser axe suites
  via `verify:stage5`).
- Package output: **verified** (pack inspection, emitted-declaration
  typecheck, consumer behavior from the installed artifact).
- Independent consumer behavior: **verified** (§10, unreleased candidate,
  clearly labeled).
- Compatibility: **a source/behavior correction within the existing
  contract** — source/API compatible (no contract, schema, plan, identity,
  or declaration change); serialized-plan compatible (no shape change);
  application-identity compatible (identity already treated route order as
  meaningful; unchanged algorithm); **NOT visually/behaviorally compatible
  for definitions whose first-occurrence group order differs from
  alphabetical** — such definitions intentionally render differently from
  the published `0.1.0`. That is the CONTRACT CORRECTION working as
  intended (the published behavior contradicted the contract), and a patch
  release is the appropriate vehicle under repository policy: no API or
  schema migration, no plan or identity migration, and `0.x` semver
  communicates the pre-1.0 compatibility posture (exact pins protect
  consumers; nothing published is republished or mutated).
- Identity implications: renderer revision retention acceptable with an
  explicit release-time decision (IV-4).
- Registry immutability: **verified** (§11).
- Documentation truthfulness: **one overbroad sentence** (IV-1); all
  specific claims verified.

```text
VERIFIED WITH NON-BLOCKING ISSUES — RELEASE PREPARATION PERMITTED
```

## 16. Exact remaining release work

1. (Recommended, pre-release) Qualify the v0.4.4 reactive-recalculation
   wording (IV-1) and optionally remediate the shape-change reconciliation
   (IV-2) with permanent coverage (IV-3) as a narrowly-scoped follow-up;
   if shipped uncorrected, document the limitation truthfully in the
   release notes.
2. Take the explicit renderer-identity decision (IV-4): retain
   `renderer.svelte-kit@5.0.0` or bump, and record it.
3. Decide the coordinated release version for the 13-package set (a NEW
   exact set identity — the immutable `vict-release-set@1/0.1.0` is never
   mutated), update `docs/RELEASE-COMPATIBILITY.md`, and pass
   `verify:release-set`.
4. Execute the scripted publication path from a clean checkout of the
   release commit per `docs/RELEASE-COMPATIBILITY.md` §6 (build → pack →
   `verify:release-consumer` pre-publication → `publish:release` →
   post-publication `verify:release-consumer -- --registry`).
5. Independent post-publication verification that the released set is
   installable from the public registry and carries the corrected
   first-occurrence behavior.
6. Only then may Trading OS T1 begin (its entry gate is satisfied by a
   released, independently proven installable VICT version supplying
   navigation-group ordering).

---

*Audit evidence material (worktrees, probes, tarballs, consumer, caches)
was removed after collection. This report is the audit's only repository
change.*
