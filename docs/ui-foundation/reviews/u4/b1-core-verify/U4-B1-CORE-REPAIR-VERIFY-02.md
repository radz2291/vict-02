# U4-B1 core repair verification round 2 — VERDICT: FAIL (one focused residual)

- **Exact implementation candidate evaluated**: `2f82fc059c4364aadc5f4b21aaf144bc95788a26`
  (branch `codex/ui-foundation-u4-b1-core-repair-01`, single commit "Repair U4 B1
  diagnostics, controlled portal lifetimes and preview state ownership" on top of
  the round-1 verification branch tip `53f12a25b99864b88f3c8db6dd2bc3175e4df4a2`).
- **Verification branch**: `codex/ui-foundation-u4-b1-core-repair-verify-02`
  (isolated worktree `vict-02-u4-b1-repair-verify-02`, created at the exact
  candidate SHA; delivery repairs committed on top — §5).
- **Date/environment**: 2026-10-08/09, Windows 10, Node v22.13.1, npm 11.19.1,
  Chrome DevTools Protocol (real-browser journeys), svelte 5.57.0 / vite 6.4.3 /
  vitest 4.1.11 (root-lockfile versions).
- **Governing payload**: unchanged `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`
  (FREEZE-02), confirmed live by this verifier.
- **Lineage confirmed live** (2026-10-09): repair candidate and its parent as
  above; `codex/ui-foundation-u4-b1-core-refactor` still `098b84e3…`; round-1
  verification branch still at `53f12a2` + two later record-keeping commits
  (`1b3ac82`, `56554c9`) by another track — preserved untouched; `main`
  `4d2df03…`. No other track modified.

## 1. Verdict

**FAIL — one focused residual. Return to Codex for a single, bounded repair.**

Every round-1 defect is repaired and re-verified EXCEPT one sub-requirement of
F2: **the catalog Dialog never transfers focus into the open modal.** The
governing amendment makes focus/portal/Escape semantics an explicit
implementation obligation ("focus/portal/Escape semantics provided by the
implementation (bits-ui focus scope…)", U4-COMPONENT-AMENDMENT line ~449; the
catalog journey table requires "keyboard/focus/portal behavior"; handoff U4-05
requires "Dialog focus/portal"). Per the round-2 mandate ("If required behavior
fails, deliver FAIL with a focused Codex repair handoff"), B1 returns to Codex
with the §7 handoff. Everything else — compile diagnostics model, portal
lifetimes, select runtime loop, action-completion truthfulness, legacy
extension compatibility, cascade, state ownership, selection, packaging,
isolation, bundle separation — passes its round-1 oracle AND real-browser
verification. B1 and U4 remain OPEN; owner acceptance PENDING; no ledger row
moves (all §6 rows remain C).

## 2. Repair-to-oracle mapping (all round-1 oracles unchanged — verified)

`git diff 53f12a2..2f82fc0` touches **no test file**; all round-1 oracles ran
byte-identically.

| Round-1 finding | Repair mechanism (candidate) | Round-2 oracle result |
| --- | --- | --- |
| F1 fatal compile gate | Fatal gate at `compile.ts:700` replaced: only `UI_DOC_CYCLE` expansion errors refuse compilation; new `isUiComponentPlanDiagnostic` classifier routes the three descriptor connection codes (`UI_COMPONENT_OUTPUT_UNKNOWN`, `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID`, `UI_COMPONENT_BINDING_INCOMPATIBLE`) into editor-visible plan diagnostics; `applyUiEdit` no longer rejects documents carrying them; `resolveUiAttachments` excludes them from the fatal set; `rejectedProps` on the instruction refuses only the affected occurrence at render; invalid output bindings are dropped from the plan (cannot dispatch) while the diagnostic stays visible; deferred view/record references keep their deferral (`isDeferredFieldReference`) | `contract-u4-b1.test.ts` **22/22** (was 6 failing); consumer suite **16/16** (was 7+collection error); structural refusals retained (malformed ABI pair, unresolvable revision pin, unknown component without descriptor — all still fatal, all covered by passing tests) |
| F2 dialog leak | `CatalogPortal` (new) gates the bits-ui `Portal` behind `{#if open}` — closed state destroys the portaled subtree; `CatalogPart` (new) forwards bits-ui attributes/handlers/attachment symbols onto the rendered element and mirrors its public ref | Both committed probes pass: `probe-dialog-loop.test.ts` and `probe-dialog-bare.test.ts` (`afterClose === 0`, was 1). Browser: open mounts, **✕ close unmounts (0 dialogs), trusted-path Escape unmounts, overlay pointer dismisses, authored confirmation (Confirm → declared action → successValues) unmounts and flips the trigger to `closed`** — the full governed journey from the amendment table now closes. **RESIDUAL: focus never moves into the dialog** (`document.activeElement` stays BODY across 600 ms of samples, click-free state-driven open and click paths, both entries, packed artifacts) → §7 |
| F4 workbench action-state drop | Root cause fixed where diagnosed: `EditorCanvas` memoizes compilation on source identity — selection notifications and host-state mirrors no longer recompile/replace the plan, so `DocumentHost`'s generation stays stable and post-dispatch writes land; `setState` same-value guard stops echo churn; `acceptedSupplied` snapshot stops spurious re-supplies | Browser (workbench, fresh page): success → **"Review submitted." renders adjacent to the button** + activity log; failure (fail-next armed) → **"The simulated service failed. Try again." adjacent to the button**; genuine pending sampled live (`"Working…" + aria-busy=true`); app entry: `task.approve` successValues opens the dialog (post-dispatch writes work). Runtime activity does not alter authored source (STATUS stayed "Saved", undo history intact) |
| F5 select severed | `CatalogSelect`/`CatalogSelectOption`: `bind:value`/`bind:open`, trigger/content/items rendered through `CatalogPart` so bits-ui's handlers and attachment symbols survive the custom rendering | Browser: workbench canvas AND app entry — trigger click opens listbox, pointer sequence selects "EU West", **trigger label updates, state receives the value, submit gating enables**; dialog-internal select selects "Ada" → Confirm → authored close. Select value journey: **DEMONSTRATED** |
| F6 unauthorized style gate | `UI_COMPONENT_STYLE_UNAVAILABLE` removed entirely (legacy path refuses nothing new); the ABI-path style-target refusal reuses the authorized `UI_COMPONENT_UNAVAILABLE` | `document-extensions.test.ts` **4/4** (U3 carry-forward evidence restored); no occurrence of the invented code anywhere in `packages/` |
| F7 cascade change | Compound-class selector emission removed — `styleRulesToCss` emits the recorded descendant form again | `pseudo-css-u2.test.ts` **4/4**; browser: catalog controls styled through the shared cascade in both entries (portaled parts receive `scopeClass` via the new presentation field — dialog/select portals render styled) |
| F8 merge revert | `priorSupplied` set replaced by an `acceptedSupplied` value snapshot: withdrawn/invalid supply never reverts accepted local values; only changed supply overwrites | `document-state-values.test.ts` passes (incl. "preserves local corrections"); browser state panel + live controls agree |
| F9 selection rewrite | Canvas-scoped marking + owned-portal matching via `[data-ui-owner]`, `MutationObserver` for late-mounted portal content, no layout-geometry dependency, cleanup removes its own marker; `data-extension-id` provenance added | `editor-tooling-u2.svelte.test.ts` passes; browser: selection outline lands on the clicked occurrence in the workbench |

## 3. Round-1 remaining obligations rechecked (handoff scope preserved)

- **Slots/fills/SSR/typed props+outputs/revision pins/missing payloads/rejected
  emits/stale callbacks**: covered by the unchanged suites — `renderer.test`,
  `document-renderer.test`, `component-abi-u4-b1.test`, `catalog.test`,
  `bridge-save.test`, `selection.test`, `composition-feedback.test` (72/72 in
  batch 2) and the full battery below.
- **Invalid connections cannot dispatch**: compile drops invalid output
  bindings from the plan (`acceptedBindings`); action-input typing enforced
  (oracle tests).
- **Invalid properties refuse the affected occurrence**: `rejectedProps` →
  `evaluateComponentPropValues` seeds `invalidNames` → RenderNode renders the
  refusal for that occurrence only. (Observed live once as a stale-HMR artifact
  during this round — see §6 finding N3; on clean loads the seeded documents
  render every control.)
- **Inspector/canvas distinction demonstrated**: the Inspector's binding
  pickers are type-filtered — for the checkbox `checked` prop only the five
  boolean state keys are offered (`state.ackFindings/ackPricing/approving/
  notifications/escalated`); string keys are not selectable, so an incompatible
  binding cannot be authored through the UI. Compile-level diagnostics and
  their editor visibility are proven by the unchanged oracle tests; the canvas
  renders a diagnostics list (`.uv-canvas-diagnostics`, new in EditorCanvas)
  whenever `plan.diagnostics` is non-empty. No live trigger exists through the
  authoring UI because the UI prevents the malformed states — recorded as a
  design strength; the seeded documents are diagnostic-clean (view references
  resolve through the consumer's declared view fields).
- **SSR**: renderer suites run server-side renders in happy-dom (unchanged
  suites green); the packed consumer builds both entries without SSR hooks.

## 4. Gates (actual results)

| Gate | Result |
| --- | --- |
| `npm run build` (root) + `ui-editor` + `ui-preview` | rc=0 |
| `npm test` (root battery; reference was 2988) | **2990 passed / 0 failed / 3 skipped** (+2 = the two round-1 dialog probes, committed evidence) |
| consumer suite (own toolchain) | **16/16** |
| consumer suite (packed artifacts, isolated install) | **16/16** |
| `npm run typecheck` | 0 errors |
| `npm run check:ui` | **0 errors** / 5 warnings (candidate had introduced 2 errors in `CatalogPart.svelte` — repaired in §5 D1) |
| `prettier --check .` | 23 files unformatted — **pre-existing** (13 files untouched by B1, e.g. `packages/contracts/src/*`); recorded, not silently reformatted (would churn unrelated stage files) |
| pack closure | 10 tarballs incl. `ui-preview`, manifest regenerated `2026-10-08T17:08:59Z`, **no tarball written into `packages/`** (F13 fix) |
| isolated install `C:/Users/RZ1/Desktop/RZ/u4-consumer-isolated` | deps all `file:vendor/*.tgz`, zero workspace links, zero repo-path strings in bundles, both entries boot from packed artifacts, dialog ✕-close + F10 verified on packed artifacts |
| bundle separation | app chunk 2.36 kB + shared execution chunk 381.3 kB (gzip 112.9 kB); minification-safe marker audit (editor-only strings ×6, preview scenario strings, package ids): **app graph clean**; authoring chunk carries all editor markers |
| performance budgets | **None defined** by the governing handoff/amendment (handoff §7 explicitly declines to invent one — "No performance target is invented"). Recorded actuals: bundle sizes above; authoring chunk gzip 33.9 kB; full-suite duration ~4.2 min on this machine. Method: rollup output listing + gzip sizes. |

## 5. Delivery repairs performed on the verification branch (allowed scope)

| ID | Repair | Classification | Files |
| --- | --- | --- | --- |
| D1 | `CatalogPart.svelte`: inline the props type (fixes "private name 'Props'" svelte-check error) + string/symbol index typing and a typed DOM spread (fixes the symbol-index spread error). Type-level only; runtime identical; svelte-check back to 0 errors | type hygiene on Codex's new file (no semantic change) | `packages/ui-svelte/src/catalog/components/CatalogPart.svelte` |
| D2 | Probe files: replace readonly-record mutation with immutable node-map construction (2 typecheck errors in MY round-1 evidence files) | evidence-file hygiene | `packages/ui-svelte/test/probe-dialog-{bare,loop}.test.ts` |
| D3 | **F10**: scoped `.vict-nav-toggle[data-dialog-trigger] { display: none }` at (0,2,0) in `catalog.css` — above the (0,1,0) trigger baseline it wrongly tied with, below the (0,2,1) medium/small reveals, so the responsive contract stays solely in `styles.css`. Browser-verified: desktop 1440 → toggle hidden with sidebar visible; 390 → toggle visible and the drawer opens (`data-state=open`, nav visible); 480 captured | assigned delivery repair (bounded, cascade-preserving) | `packages/ui-svelte/src/catalog.css` |
| D4 | **F13**: `git rm --cached` the 38 stale tracked tarballs; pack script now uses `npm pack --pack-destination <vendor>` so regeneration never writes into the repository tree; scoped `.gitignore` entry added. Packing scripts, manifest and historical evidence preserved | assigned delivery repair | 38 untracked files, `scripts/pack-u4-consumer.mjs`, `.gitignore` |
| D5 | Root `vitest.config.ts`: exclude `examples/u4-consumer/**` from the root integration project — same class and precedent as the existing `ui-design-proof` exclusion (its suite mounts Svelte renderer sources and must run under its own svelte toolchain; it does, 16/16, and is verified packed). At the parent commit the file already failed collection there ("no tests"); the exclusion makes the root battery truthful without touching assertions | delivery/config repair with in-repo precedent | `vitest.config.ts` |

Not repaired (returned to Codex): the F2 focus residual (§7).

## 6. New findings this round (none blocking except the residual)

- **N1 (the residual — see §7)**: dialog focus transfer.
- **N2 (minor, pre-existing)**: 23 files fail `prettier --check` (13 untouched by
  B1). A repo-wide format pass is an owner decision; not a B1 gate.
- **N3 (minor, dev-only)**: mid-session Vite HMR after package edits can leave
  the workbench canvas refusing all state-bound occurrences
  ("incompatible bound properties") until a full reload (reproduced once;
  clean loads always render). Root cause: mixed old/new module identities
  across HMR boundaries; dev-mode authoring-experience robustness note for a
  later batch — not a packed-artifact or production defect.
- **N4 (tooling note, not a product defect)**: trusted CDP input
  (`Input.dispatchMouseEvent/KeyEvent`) does not reach pages in this
  environment's Chrome session; all browser journeys used synthetic DOM
  events (full pointer sequences where bits-ui requires them). The round-1
  report's "trusted Escape/overlay" wording overstated the input class — this
  report corrects the record. Real-input confirmation belongs to the founder
  walkthrough and the browser-experience review.

## 7. Focused Codex repair handoff (single item)

**Defect**: the catalog Dialog (bits-ui Dialog.Content rendered through the
child snippet + `CatalogPart`) never moves focus into the open modal.
`document.activeElement` stays BODY from mount onward (600 ms sampled; state
panel-driven open and trigger-click paths; both entries; packed artifacts).
The same pattern presumably breaks focus restoration to the trigger on close
(not verifiable without trusted input in this environment — verify with real
input).

**Required behavior** (governing): amendment "focus/portal/Escape semantics
provided by the implementation (bits-ui focus scope…)" + the catalog journey
"keyboard/focus/portal behavior" + handoff U4-05 "Dialog focus/portal".

**Suggested direction** (investigate, do not blindly apply): bits-ui's focus
scope attaches to the element its Content ref resolves to. With the
child-snippet rendering, its ref may resolve to a wrapper/placeholder rather
than the `CatalogPart` DOM node — mirror the ref BOTH ways (as `triggerRef`/
`contentRef` already attempt) or mark the content element focusable and invoke
bits-ui's open-auto-focus contract; ensure `onOpenAutoFocus` is not prevented
and that close restores focus to the trigger element. Select's listbox has the
same delegated rendering — check its keyboard focus path too.

**Oracles (all must pass on the repaired candidate)**:
1. Both committed probes still pass (leak stays fixed).
2. NEW (add to `probe-dialog-loop.test.ts` or a sibling): after opening,
   `document.activeElement` is inside the dialog content; after Escape close,
   focus returns to the trigger element.
3. Browser (verifier will re-run): open → `document.activeElement` inside
   `[role=dialog]` within 300 ms, stable; Escape → dialog unmounts AND focus
   lands on the trigger; the full journey (open → select "Ada" → Confirm →
   close → focus on trigger) with a real keyboard/pointer pass recorded on
   video or screenshots.
4. No regression: full root battery 0 failed; consumer 16/16 (own + packed);
   typecheck 0; svelte-check 0 errors.

**Process**: run the complete pipeline green before reporting (build, battery,
consumer×2, typecheck, svelte-check, pack + isolated verification). A new
candidate SHA will be re-verified with affected rechecks; the three
independent reviews run only after this verifier's screening passes.

## 8. Positive evidence preserved/re-verified this round (fresh, repair candidate)

- Authoring loop end-to-end (checkbox family): select → Inspector "Apply
  value" → canvas reflects → undo → redo → Save (rev r1.r2) → finished app
  replays "Acknowledge findings EDIT2" (browser-verified fresh; stored doc
  reset to seed afterwards).
- Button: pending ("Working…", aria-busy), success and failure feedback
  adjacent to the button, truthful activity log, disabled-expression gating.
- Select: workbench + app entry value journeys; type-filtered binding pickers.
- Dialog: open/state loop, ✕/Escape/overlay close, in-dialog select, authored
  confirmation close (all except focus).
- Switch/Toggle/RadioGroup: interactions flip (`aria-checked`/`aria-pressed`).
- AppShell: nav + active destination; F10 toggle hidden at desktop, drawer at
  390 (screenshots `browser-r2/01–05`).
- Packaging/isolation/bundle separation as in §4.
- Environment quirk honored: pack script run from a normal shell (recorded in
  round-1 follow-up commits); "stdout is not a tty" is non-fatal there.

## 9. Evidence index

- `browser-r2/01-shell-1440.png` … `05-shell-480.png` — responsive + drawer
  evidence (this directory).
- `packages/ui-svelte/test/probe-dialog-{loop,bare}.test.ts` — committed
  passing probes (leak oracle).
- `examples/u4-consumer/pack-manifest.json` — this round's tarball hashes.
- Round-1 report `U4-B1-CORE-VERIFY-01.md` — all failed-round evidence,
  preserved verbatim on the round-1 branch and in history.
