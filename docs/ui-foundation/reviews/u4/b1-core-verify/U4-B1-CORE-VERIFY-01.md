# U4-B1 core-refactor verification round 1 — VERDICT: FAIL (revision required)

- **Exact implementation candidate evaluated**: `098b84e3a342793c6bdb19b1e8b8e6a72f1c2220`
  (branch `codex/ui-foundation-u4-b1-core-refactor`, 4 commits on top of entry
  baseline `295064b4bfc770ba101bf73e7656c5005d2343c9` = `codex/ui-foundation-u4-b1`).
- **Verification branch**: `codex/ui-foundation-u4-b1-core-verification`
  (isolated worktree `vict-02-u4-b1-core-verification`, created at the exact
  candidate SHA; delivery repairs committed on top — see §5).
- **Date/environment**: 2026-10-08, Windows 10 (MyTingkap), Node v22.13.1,
  npm 11.19.1, Chrome DevTools Protocol (real-browser journeys), svelte
  5.57.0 / vite 6.4.3 / vitest 4.1.11 (root-lockfile versions).
- **Verifier**: fresh verification/delivery agent (not the implementer).
- **Governing payload**: `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`
  (U4-CATALOG-RECALIBRATION-FREEZE-02), amendment §10.1/§10.1a, handoff §13.1.

## 1. Verdict

**FAIL — substantial repair required; return to Codex.**

The candidate breaks 14 committed workspace tests (all passing at the entry
baseline), 7 of its own consumer tests, the consumer build itself, and the
governed Dialog journey. The failures cluster in protected areas (compile
authority, canonical styling/cascade, renderer lifecycle, extension bridge,
runtime/authored-state separation). Per the assignment, these return to Codex
with a concrete repair handoff (§7); this verifier made only routine delivery
repairs (§5) and did not implement any substantial repair.

B1 and U4 remain OPEN. Owner acceptance PENDING. This verdict does not
downgrade any missing required interaction: the Dialog close/keyboard journey
is FAIL, not a note (§4).

## 2. What the candidate demonstrably achieves (preserved positive evidence)

These capabilities were reproduced by this verifier from the packed artifacts
and are recorded with evidence; they must survive the repair:

| # | Capability | Evidence |
| --- | --- | --- |
| P1 | Value vocabulary landed as code per §10.1a: `packages/ui/src/values.ts` (`UiValue`, `isUiValueOfType`, finite-number rule, homogeneous lists, ISO format+calendar checks, `uiValueEmptyFor`, `copyUiValue`), widened declarations at state/prop/output boundaries, host-side guard + copy discipline | `packages/ui/test/contract-u4-b1.test.ts` (16/22 pass incl. the guard block), `packages/ui/src/validate.ts:383–430`, `DocumentHost.svelte:89–155`, `RenderNode.svelte:136–152` |
| P2 | Frozen negative fixtures R2/R3 (malformed isoDate/isoTime → `UI_DOC_INVALID_LITERAL`), R4 (null member), R7 (mixed members), R5/R6 (empty conventions, B3 range mapping) at validation level | consumer suite `9 passed` from packed artifacts |
| P3 | Compile-artifact marker (`outputDecls`) + effective-revision resolution + ABI marker gate (`vict.ui-component-abi@1`) + slot-required fail-closed (`UI_COMPONENT_SLOT_REQUIRED` reproduced in probe) | contract-u4-b1 tests (passing subset), `probe-dialog-loop.test.ts` log |
| P4 | 8 descriptor+implementation pairs registered; all 8 controls render styled in the workbench canvas and the finished app with occurrence provenance (`data-ui-occ`, `data-ui-primary`, `data-ui-part`) | browser `01-authoring-controls-1440.png`, `02-finished-app-1440.png`, DOM dumps in the report evidence |
| P5 | Descriptor-driven Inspector: literal editors with Apply, type-filtered binding pickers ("Bound to: state.ackFindings … Choose a compatible reference"), read-only canonical source; StateValuesPanel with list editor (`tags` string list Add) | browser DOM dumps (Inspector text), `03-*` screenshots |
| P6 | Same-control authoring loop VERIFIED END-TO-END for the checkbox family: select → edit label in Inspector → canvas reflects → undo reverts (status returns to clean) → redo re-applies → save → reload stored → **finished app replays the saved document** ("Acknowledge findings EDITED" in `/app.html`) | browser journey log (§4.1 of the session evidence), `08-finished-app-saved-replay.png` |
| P7 | Declared-action button: authored disabled expression gates correctly (both acks + region), genuine pending interval ("Working…", `aria-busy`, disabled-while-pending), truthful success/failure/denial messages in the workbench activity log; runtime activity leaves authored bindings intact | browser journey logs (success `task.submit: Review submitted.`; failure `The simulated service failed. Try again.`; denial `Task write permission is denied.`) |
| P8 | AppShell renders declared navigation with active destination; responsive collapse to header+drawer at 390×844 | `03-finished-shell-1440.png`, `04-shell-390.png` |
| P9 | Pack closure + isolated consumer pipeline (after §5 repairs): 10 tarballs, install outside the workspace graph, **zero** workspace-link/repo-path violations, both entries built and tested from packed artifacts, identical failure set as the workspace-linked run | `pack-run2.log`, `examples/u4-consumer/pack-manifest.json` (hashes §6) |
| P10 | Bundle separation: app entry chunk 2.4 kB + shared runtime chunk 377.6 kB contain **no** editor/preview module markers (minification-safe string-marker audit through the transitive graph: `Make a selection`, `Apply value`, `Preview state`, `vict.ui-scenario@1`, `@victframework/ui-editor`, `@victframework/ui-preview` all absent from the app graph) | bundle audit (session log), isolated `dist/assets/` |

## 3. Blocking defects (return to Codex — implementation-ready handoff in §7)

### F1 — BLOCKER: new global compile gate turns author-time diagnostics fatal

`packages/ui/src/compile.ts:700`: `if (hasErrors(issues)) return { ok: false, issues };`
(added by the refactor; absent at the baseline). It converts six author-time
checks that the amendment §5.1 defines as **editor-visible plan diagnostics**
into hard compile failures:

- `UI_COMPONENT_REVISION_UNRESOLVED`, `UI_COMPONENT_ABI_UNSUPPORTED` (malformed
  marker pair), `UI_COMPONENT_OUTPUT_UNKNOWN`, `UI_COMPONENT_BINDING_INCOMPATIBLE`
  (incl. R1 list-payload→scalar-state and action-input typing),
  `UI_EXPR_TYPE_MISMATCH` (descriptor-instance prop typing), and the
  `UI_DOC_UNKNOWN_COMPONENT` undeclared-slot-fill rejection.

Consequences, all reproduced:
1. 6 committed tests of `packages/ui/test/contract-u4-b1.test.ts` fail
   (`expect(result.ok).toBe(true)` + `plan.diagnostics` contains the code) —
   **these tests are unchanged from the baseline and encode the amendment's
   behavior; the refactor broke them without touching them**.
2. 7 consumer tests fail the same way (R1 + 5 amendment negatives + the
   shell-document view-reference deferral, which the compiler's own rule —
   "no view-field catalog ⇒ view/record references are UNRESOLVED-not-invalid"
   — requires to be non-fatal; the new gate defeats that rule for
   descriptor-instance props re-checked at compile).
3. `compileApplication` treats any failed document as fatal for the whole
   application (`resolveUiAttachments` → `issues`), so **one in-progress
   authoring error kills the entire preview in both entries** ("The working
   application cannot compile"), instead of showing the diagnostic with the
   rest of the canvas alive. That degrades the required §6 authoring loop.

Baseline evidence: the same 22-test file passes 22/22 at `295064b`
(run in the preserved baseline worktree).

### F2 — BLOCKER: Dialog controlled loop leaks the portaled layer (journey FAIL)

The catalog Dialog opens from the trigger but can never be visually dismissed:

- State writes land (`assignOpen` flips false in the workbench state panel),
  bits-ui reports `data-state="closed"` on the dialog content, **but the
  `[role=dialog]` content remains mounted** — ✕, overlay and a trusted CDP
  Escape all leave it visible.
- Focus never moves into the open dialog (`document.activeElement` stays on
  BODY / the trigger) with `aria-modal="true"` — a modal dialog whose
  keyboard/focus contract is broken; Escape therefore has no live target.
- Confirmed with the real browser (finished app + workbench) AND two minimal
  committed probes that fail identically in happy-dom:
  - `packages/ui-svelte/test/probe-dialog-loop.test.ts` (inside appshell
    content slot): `PROBE open: 1 afterClose: 1 states: [ 'closed' ]`
  - `packages/ui-svelte/test/probe-dialog-bare.test.ts` (bare page — rules out
    slot-composition interaction): `PROBE2 open: 1 afterClose: 1 states: [ 'closed' ]`
- Consequence: the governed P-overlay journey (open → select value → declared
  confirmation → Escape close → focus restoration) is **FAIL**. The declared
  confirmation close (`task.assign` successValues) cannot be demonstrated
  through the visible layer.

Classification: renderer lifecycle / occurrence authority (protected area) —
not repaired by the verifier.

### F3 — BLOCKER (delivery class; repaired on the verification branch, see §5)

Four independent packaging defects meant **the candidate could not build or
launch its own consumer**:
1. `deriveActionInputCatalog` not exported from `@victframework/application`
   (imported by `examples/u4-consumer/src/product/registrations.ts:1`) —
   Vite build fails: `"deriveActionInputCatalog" is not exported by
   "packages/application/dist/index.js"`.
2. Pack closure omits `@victframework/ui-preview` (declared by the consumer,
   absent from the public registry) — isolated install cannot resolve it.
3. Consumer route `path: '/app.html'` → `ROUTE_PATH_INVALID` ("path segment
   'app.html' is not a valid static segment or ':name' parameter") — **the
   seeded application never compiled on the candidate; both entries rendered
   their failure fallback**. This is the root cause of the "blank /
   wrong-subtree rendering" class the owner flagged for browser
   investigation.
4. The packed `ui-svelte` package breaks Vite's dev dependency optimizer on
   `.svelte.ts` modules (`mount.svelte.ts` parse error) — dev mode of any
   non-workspace consumer crashes without an `optimizeDeps.exclude`.

All four are repaired on the verification branch (§5) with before/after
evidence; the underlying lesson for the repair (run the pack pipeline before
declaring the consumer green) is part of §7.

### F4 — MAJOR: workbench preview drops post-dispatch action-state writes

In the authoring workbench, after a dispatch completes, the mapped writes
(`connection.error` → `submissionError`, `connection.result` →
`submissionResult`, `successValues`, and the `ActionFeedback` near the button)
never land — `submissionError`/`submissionResult` remain `''` and no feedback
renders near the button, while the pending-phase write (`approving=true` →
"Working…") and the activity-log message DO land. In the finished app the same
channel works (`task.approve` → `successValues` opened the Dialog: trigger
`data-state="open"`). The discriminating difference is the workbench's
`onStateChange`/`stateValues` mirror loop; the founder-visible effect is that
**the editor preview is not truthful about failure/denial** (the founder must
read the developer-facing activity log). DocumentHost `runAction`
(`DocumentHost.svelte:170–194`) is the affected authority; the stale-guard
(`token !== generation || runs.get(actionId) !== run`) or the mirror race are
the suspects to diagnose.

### F5 — MAJOR: Select option selection is severed (value journey NOT DEMONSTRATED)

Trusted CDP clicks and direct `opt.click()` on rendered `[role=option]` items
never select: the listbox stays open, the trigger keeps "Choose an option",
`valueChange` → `state.region` never fires (state row stays empty; submit
stays disabled because `region === ''`). Same severed-layer pattern as F2.
Consequence: the Select founder journey (value flows into declared state)
is **NOT DEMONSTRATED** in the browser; the compile-level wiring is
contract-clean but the runtime loop does not close.

### F6 — MAJOR: unauthorized new diagnostic code + legacy-path behavior change

`UI_COMPONENT_STYLE_UNAVAILABLE` (`extensions.ts:175,218`) appears nowhere in
the frozen amendment/recalibration/handoff/fixture bytes; amendment §10.3
authorizes exactly ONE new code (`UI_DOC_INVALID_LITERAL`). The new
style-forwarding gate also fail-closes the **legacy props-only extension
path**, whose behavior §5.2 freezes as "code and behavior unchanged" —
breaking 2 recorded U3 extension tests
(`document-extensions.test.ts`: registration forwarding through
visual components/conditional branches/slot fills; bound props and repeated
source occurrences) that the handoff carry-forward explicitly requires to be
reproduced against the changed bridge.

### F7 — MAJOR: pseudo-state CSS emission change breaks the cascade evidence

`logic.ts styleRulesToCss` now emits a second compound-class selector
(`.sel, .sel.rootClass:pseudo`) for every non-`:root` rule (plus a new
expression-binding CSS-variable mechanism). A compound `class.class` selector
has higher specificity than the descendant form and changes which rule wins —
canonical styling/cascade is a protected area. 4 recorded U2 regression tests
fail (`pseudo-css-u2.test.ts`, the F1-regression guard for U2-03). If the
compound form is needed for portaled parts, it must be re-justified against
the cascade contract and the U2 evidence re-recorded — an owner-visible
styling decision, not a silent refactor.

### F8 — MAJOR: host-state merge reverts local edits

New `priorSupplied` logic in the `DocumentHost` merge effect resets a key to
its declared initial when the host stopped supplying it — including after the
host briefly supplied an INVALID value (rejected as supplied, but the key was
recorded as supplied). Recorded test: `document-state-values.test.ts`
("merges only correctly typed declared host state, **preserves local edits**")
fails: expected 'local correction', received 'initial'. This moves
runtime/authored-state separation (protected).

### F9 — MINOR: editor selection outline rewrite breaks recorded selection

`EditorCanvas` selection marking now queries `[data-ui-owner]` elements
globally and requires `getBoundingClientRect().width > 0`; in non-layout
environments nothing is marked (editor-tooling-u2 test: expected 1 marked
occurrence, received 0). U2 selection affordance evidence regressed.

### F10 — MINOR (pre-existing, exposed by B1): AppShell desktop nav-toggle visible

`catalog.css`'s `.vict-controls :where([data-dialog-trigger], …) { display:
inline-flex }` ties with `.vict-nav-toggle { display: none }` on specificity
and comes later, so the shell's "Menu" button renders at 1440px next to the
already-visible sidebar. Present at the baseline bytes; first EXPOSED by the
B1 shell journey. Fix alongside the F7 styling repair.

### F11 — MINOR (delivery class; repaired in §5): red typecheck + stale manifests

Root `npm run typecheck` failed with 15 errors on the candidate (2 source-level
in `examples/u4-consumer/src/product/*` — the missing export and a @2/@3
screen-type mismatch — plus 13 test-hygiene errors across 3 files), the root
lockfile was missing the consumer's two new dependencies, and the committed
`pack-manifest.json` was stale (9-tarball, pre-refactor hashes). The baseline
already had 5+ typecheck errors (e.g. missing `assets` fields) — the root
typecheck was never green on the B1 branch.

### F12 — RECORD: workspace suite red on the candidate

`npm test`: **14 failed | 2974 passed** (6 files) on the candidate; all 14
pass at the entry baseline (verified for the 8 non-B1 files by running the
baseline worktree: 13/13 across the 4 affected renderer/editor files, and
contract-u4-b1 22/22). The STATE claim "workspace suite 2662/2662 green"
describes a pre-refactor state and is superseded by this record. Consumer
suite: 7 failed | 9 passed (identical from packed artifacts).

### F13 — MINOR (hygiene): 38 stale tarballs tracked in git

Commit `b7b82a3` (baseline) committed the packed `.tgz` binaries into the
package directories (`packages/*/victframework-*.tgz`) — handoff §11 records
"tarballs themselves not committed — manifest + reproducible script only".
They went stale immediately and churn on every pack run (npm pack overwrote
five during this verification; restored). Remove them from tracking in the
repair (keep `pack-manifest.json` + the script). Related hygiene: the dist
packages ship `.map` files whose `../src` targets are not in the tarball, so
`npm run dev` prints a wall of benign "Sourcemap … points to missing source
files" warnings (observed on the isolated consumer; pages serve and journeys
run normally). Either drop the maps from `files` or ship sources, so the
founder launch is quiet.

## 4. Criterion verdicts (handoff §13.1 scope)

| B1 obligation | Verdict | Basis |
| --- | --- | --- |
| (1) Value vocabulary as code (§10.1/§10.1a, 8 boundaries) | **PASS (contract/unit level)** | P1/P2; guard + wiring verified in source and suites; render-side host guard + copy discipline in place; F8 regression is the one boundary defect (merge semantics, not the guard) |
| (2a) Button / checkbox / switch / toggle / radio-group wrappers (P-scalar) | **PARTIAL** | Button + checkbox demonstrated end-to-end (P6/P7); switch/toggle/radio-group RENDER with provenance but their interaction loops were not separately clicked in the browser — recorded NOT DEMONSTRATED (interaction), NOT FAIL |
| (2b) Catalog select single (P-scalar) | **FAIL at runtime** | F5: option selection severed; value journey not demonstrable in browser |
| (2c) Catalog dialog (P-overlay) | **FAIL** | F2: close/Escape/focus broken; journey impossible |
| (2d) AppShell composition | **PARTIAL** | P8 (nav, active destination, responsive) + F10 cosmetic desktop defect |
| (3) F3 packaging repair + action-input catalog derivation | **PASS** (package level) / repaired at consumer level | ui-editor emits (`dist/` present, no TS2307), `deriveActionInputCatalog` wired at `ui-attach.ts:365` + Inspector typing (P5); consumer-side repairs in §5 |
| (4) Inspector scalar+list editors, output connections | **PASS** for demonstrated controls | P5/P6 (label literal, binding reconnection, output bindings authored in seeds and editable through the Behavior tab) |
| (5) Pack closure + isolated consumer | **PASS after §5 repairs** | P9 |
| (6) §6 same-control catalog proof per family + negative fixtures | **FAIL as a set** | Checkbox family complete (P6); button pending/gating yes, feedback drop F4; select F5; dialog F2; R2–R7 validation negatives pass (P2) but R1/compile negatives fire at the wrong gate (F1) |
| (7) Parity + bundle separation + walkthrough + unfamiliar-agent exercise | **Bundle separation PASS (P10); parity and walkthrough PARTIAL; agent exercise NOT STARTED** | Same renderer/plan both entries (P6/P8); the full walkthrough is blocked by F2/F5; the unfamiliar-agent exercise awaits a repaired candidate |

Ledger consequence: NO reuse-matrix §6 row moves to B-n on this round; all B1
rows remain **C** with this FAIL recorded. The reconciliation script was not
run for a ledger change because no ledger change is claimed.

## 5. Delivery repairs performed on the verification branch (allowed scope, all recorded)

| Repair | Classification | Files | Effect |
| --- | --- | --- | --- |
| Export `deriveActionInputCatalog` from the application public index | routine delivery (missing re-export; mirrors `resolveUiAttachments` pattern; additive) | `packages/application/src/index.ts` | consumer build works |
| Add `ui-preview` to the pack closure (closure inspected: its deps application/runtime/sdk/ui are all already packed) | packaging script repair | `scripts/pack-u4-consumer.mjs` | isolated install resolves |
| Consumer route `/app.html` → `/` | routine consumer metadata fix | `examples/u4-consumer/src/product/definition.ts` | seeds compile; both entries render |
| Consumer vite config `optimizeDeps.exclude` for `@victframework/*` + pinned devDependencies to root-lockfile versions | packaging/lock repair | `examples/u4-consumer/vite.config.ts`, `examples/u4-consumer/package.json` | packed dev mode works; reproducible versions |
| Lock normalization | dependency-lock consistency | `package-lock.json` | `npm ci` reproduces; consumer uses hoisted root tools |
| Typecheck repairs: `ApplicationDefinitionV3` union on compile input + identity fns (type-only), `ScreenDefinitionV3`-aware internal typing, test-file narrowing/`assets` fields, `consumerActionInputs` import in the consumer test | delivery/type hygiene (no runtime semantic change; assertions preserved) | `packages/application/src/*`, 3 test files, consumer test | root typecheck GREEN (baseline was red; candidate was red) |
| Regenerated `pack-manifest.json` from the actual vendor tarballs of this round | evidence accuracy | `examples/u4-consumer/pack-manifest.json` | manifest matches this candidate |

Not repaired (substantial, returned to Codex): F1, F2, F4–F9.

## 6. Artifact hashes (this round)

Packed from the verification branch at the recorded commit (see delivery
report); SHA-256 of the vendor tarballs installed in the isolated consumer:

```
@victframework/application 7b843e7643ddb2ecc82403cc1f0023748a8ada63d7a0abf17a4341592207e067
@victframework/contracts   017c0587843869653f6bd723566dcaf39f2e89b2fb55bc923f35667be9d618de
@victframework/control     3cf09cb1bf97f90f50e6f4bbf76a690f309b9a3d39833e54bac0d361ab61386f
@victframework/kernel      c40b7377be433f4b5e731fcfc26607d45200c0e44fd7a38c1701ac26b4565ddd
@victframework/runtime     92e12395499c029be449f0bfda309cffbbe54d4af880d1c8887db31596a1d8a3
@victframework/sdk         26ba8993f73f70071e57cec97471bf9c4bc4abde3137084be4fd4ee064f338f4
@victframework/ui          a3fb0bf0f6790ee88aca158b26ef1a0bc5784ea1352e7fb58441ee385ad6d835
@victframework/ui-editor   967717fc92ae40c23c767eb1297595389fdb0aae04f7d20e50faf5699f391a86
@victframework/ui-preview  38fc0dffc878751b29a0b9f1963d87fa113afa6e9a7d0588b2982cc94d690f45
@victframework/ui-svelte   bf6359e9c4d0f1bf1201065e1206128f3101266db2c80447aa374ab73c284d7d
```

Isolated root: `C:/Users/RZ1/Desktop/RZ/u4-consumer-isolated` (outside the
workspace graph; every `@victframework/*` resolves inside it; zero violations).

Launch (founder, after the next repaired candidate passes its gate):

```bash
node scripts/pack-u4-consumer.mjs          # repo root
cd ../u4-consumer-isolated/u4-consumer
npm run dev                                # / = authoring, /app.html = finished app
```

Environment note (this round): running `scripts/pack-u4-consumer.mjs` from a
tmux/Git-Shell pane aborts with `stdout is not a tty` (execSync + npm.cmd
piping quirk). Run it directly from a normal shell — it then executes the
full pipeline (this round's log: `pack-run2.log`; its nonzero exit was ONLY
the 7 known F1 test failures, everything else green).

## 7. Codex repair handoff (implementation-ready)

**Candidate**: `098b84e3a342793c6bdb19b1e8b8e6a72f1c2220`.
**Required outcomes** (each verifiable by the named oracle; no requirement may
be weakened and no expected assertion rewritten):

1. **F1 compile gate** — restore author-time diagnostics as editor-visible
   plan diagnostics. Remove or narrowly rescope the
   `if (hasErrors(issues)) return { ok: false, issues }` gate at
   `packages/ui/src/compile.ts:700` so that the six §5.1 author-time checks
   compile-with-diagnostics again (structural/unresolvable errors may still
   abort; descriptor resolution and deferred view/record references must keep
   the baseline deferral semantics).
   *Oracle*: `packages/ui/test/contract-u4-b1.test.ts` 22/22 (unchanged file)
   and consumer tests "R1", "unknown output", "incompatible binding",
   "revision pin", "action input typing", "undeclared slot fill", "shell
   document" — 16/16 consumer suite. Additionally: in the workbench, an
   in-progress bad binding must surface as an Inspector diagnostic while the
   rest of the canvas keeps rendering.
2. **F2 dialog loop** — make the catalog Dialog's controlled loop close the
   visible layer: ✕, overlay click and Escape must unmount the portaled
   content (or at minimum hide it and restore focus to the trigger), focus
   must move INTO the open modal, and the whole loop must survive the
   wrapper's re-render. *Oracle*: turn the two committed probes into passing
   behavior (`probe-dialog-loop.test.ts`, `probe-dialog-bare.test.ts`:
   afterClose === 0) + a real-browser journey: open → select value → Confirm
   → dialog closes via the declared action's successValues AND via Escape
   with focus restored; record screenshots.
3. **F4 workbench action-state truthfulness** — post-dispatch writes
   (`connection.error/result`, `successValues`, ActionFeedback) must land in
   the workbench preview exactly as in the finished app. *Oracle*: workbench
   journey with "Fail the next operation": `submissionError` receives the
   message, feedback renders near the button, and `submissionResult` receives
   the success value on the success path.
4. **F5 select runtime loop** — selecting an option in the portaled listbox
   must fire `valueChange` → `setState` in both entries. *Oracle*: browser
   journey: click trigger → click "EU West" → trigger shows the value, state
   row `region = 'eu'`, submit enables.
5. **F6 style-forwarding gate** — remove the unauthorized
   `UI_COMPONENT_STYLE_UNAVAILABLE` code or obtain owner authorization for it
   in the frozen contract; the legacy props-only extension path must keep
   §5.2's unchanged behavior. *Oracle*: `document-extensions.test.ts` 4/4 and
   the forgery-matrix carry-forward re-run.
6. **F7 pseudo-state CSS** — restore the recorded U2 selector emission or
   take the cascade change to the owner with a justified re-record of the U2
   evidence. *Oracle*: `pseudo-css-u2.test.ts` 4/4 (unchanged) or a
   superseding owner decision + updated evidence.
7. **F8 state merge** — a host that stops supplying a key (or supplied an
   invalid value once) must never revert a user's local edit; only an explicit
   reset signal or document replacement re-initializes.
   *Oracle*: `document-state-values.test.ts` (unchanged).
8. **F9 selection outline** — restore recorded selection marking semantics
   (canvas-scoped, not visibility-gated to layout).
   *Oracle*: `editor-tooling-u2.svelte.test.ts` 4/4 (unchanged).
9. **F10 nav toggle** — while repairing the styling, scope the catalog
   trigger baseline so the shell's desktop nav-toggle hide wins (Menu button
   hidden at ≥960/720 with a visible sidebar). *Oracle*: browser screenshot
   at 1440 (no Menu button with sidebar visible) + drawer still works at 390.
10. **Process**: before reporting, run the full pipeline green end-to-end on
    the repaired candidate: `npm ci --ignore-scripts && npm run build &&
    npm run build -w @victframework/ui-editor && npm run build -w
    @victframework/ui-preview && npm test` (expect 2988 passed / 0 failed) +
    `node scripts/pack-u4-consumer.mjs` (expect "ISOLATED PACKED-ARTIFACT
    VERIFICATION: OK", 16/16 packed consumer tests) + root typecheck +
    `check:ui`. A candidate whose consumer cannot build or whose suite is red
    is not a verification candidate.

Non-goals for the repair (unchanged scope): B2–B5 rows, Studio integration,
U4 closure, npm publication, merge to main. The three independent reviews
(technical falsification, real-browser experience, unfamiliar-agent exercise)
are deferred to the repaired candidate and will be arranged fresh by the
verifier at that gate.

## 8. Evidence index (this directory + repo)

- `failures-initial.txt`, `renderer-failures.txt`, `workspace-suite-full.txt`
  — red-suite evidence on the exact candidate.
- `browser/01…08*.png` — authoring workbench, finished app, shell, responsive,
  saved-replay evidence.
- `packages/ui-svelte/test/probe-dialog-loop.test.ts`,
  `packages/ui-svelte/test/probe-dialog-bare.test.ts` — F2 minimal
  reproductions (committed, failing, marked VERIFICATION PROBE).
- `examples/u4-consumer/pack-manifest.json` — tarball hashes + isolation
  result for this round.
- Baseline comparisons run in the preserved `vict-02-u4-b1` worktree at
  `295064b` (22/22 and 13/13 pass; consumer 16/16 pass).
