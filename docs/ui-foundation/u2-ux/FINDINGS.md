# Findings and failed observations — preserved

7 October 2026, builder observations before first committed candidate:

1. Initial server command failed: npm/Powershell argument forwarding and missing dependencies. Repaired locally by npm ci --ignore-scripts and direct Vite executable, own port 5197. No manifests or lockfile changed.
2. Initial full Svelte check returned 38 errors / 4 warnings. New errors (missing exported pseudo type, breadcrumb inference, missing store format, state name colliding with Svelte $state) repaired in scope. Generated SvelteKit sync run. Root tsc subsequently passed.
3. Existing EditorCanvas.svelte references UiRenderPlan without importing it. Existing workbench names a variable state and triggers $state shadow errors under broad svelte-check. Its check configuration excludes generated SvelteKit ambient types, causing $app/environment errors. These are outside writable scope; no global shim or suppression added. Manager request below. Root check:ui uses renderer-only configuration and reports 0 errors / 2 existing warnings; design-proof tsc passes. Broad Svelte check remains distinct and cannot be reported green.
4. Existing editor tooling tests first failed 3/3 due redesigned section placement/wording and text labels. UX-specific assertions updated to navigate Style, assert explicit browser values, use meaningful labels, and repopulate the selected condition input. All original semantic assertions retained. A bind-select synthetic-event mismatch then failed 1/3; explicit onchange used for condition/scope. Final 3/3 passed.
5. First browser probe targeted a display:contents text span: Puppeteer said it was not clickable. Changed to clicking rendered heading text; this is a harness correction, not a product pass.
6. Actual selection caused effect_update_depth_exceeded in Layers; selected ancestor reveal read and wrote expansion sets. Builder browser journey failed before text editing. Fixed with untracked expansion reconciliation; added exact-selection/loop regression. Re-run no page exceptions.
7. Clicking the center of a card selected its paragraph; the selected name correctly reflected that. Card-style journey uses the card border or the Service card row in Layers, rather than assuming any descendant selects its card.
8. Save/reload browser probe found padding reset to 0px despite saved canonical bytes: the review route initially SSR-rendered the seed's CSS while client-loaded saved source used a new revision. Repaired within the dedicated route by client-mounting the localStorage-backed renderer. Reload/reopen then preserved text, size, background and padding. No renderer or persistence implementation changed.
9. Builder inherited-origin test initially used innerText while Value origin was collapsed, so it could not observe that explanation. Verify by opening Value origin; do not count a hidden-text match as an experience pass.
10. Prettier cannot infer .svelte parser (project has no Svelte formatter plugin). Supported TS/JS/Markdown files formatted; no unrelated dependency installed.

## Precise manager requests

- Add UiRenderPlan to the existing type import from @victframework/ui in packages/ui-editor/src/EditorCanvas.svelte (onPlan prop).
- For broad Svelte checking, fix the existing workbench variable state naming conflict and include generated SvelteKit ambient declarations in the check configuration. These are manager-owned files; this branch deliberately supplies instructions instead of edits.
- Current underlying instance override API styles a component wrapper; per-inner-element occurrence overrides and instance text replacement remain unavailable. The UX exposes this existing limitation honestly; a future schema/API change is a separately governed manager decision.

These findings do not accept the pinned compiler repair or close U2. Owner acceptance remains pending.

11. Final broad check at initial candidate: 23 errors / 5 warnings. All 23 errors are in unchanged EditorCanvas and existing service/workbench paths. One new warning is the review-route canvas ref's non-reactive declaration; it is included in the bounded repair queue. Full output preserved in broad-svelte-check-initial.txt.
12. Root Prettier check after building failed on 44 generated design-proof build files and unchanged packages/ui/test/cascade-n1.test.ts (the pinned compiler repair). Scoped formatting of all edited TS/JS files passes. Generated output and compiler test are outside writable scope; no automatic global formatting run. The manager can extend .prettierignore for examples/ui-design-proof/build and format its compiler-repair test. Markdown is globally ignored by the existing formatter configuration, and .svelte has no bundled parser.

## Independent round-1 findings and bounded repair candidate

Fresh evaluator challenged exact pushed code 4d7b0670186a04411a51234d361bb8c9ef65fea1 in its own detached checkout/Chrome server. Its failed observations are preserved verbatim in independent-review/ROUND-1.md and its supporting evidence.

- M1: Collapsing a selected descendant's ancestor left zero visible Layers tab stops. Repair moves focusKey to the collapsed ancestor and supplies a visible fallback if a focused row disappears. Exact-selection/loop test extended with collapsed-tabstop assertion.
- M2: Reconnecting navigation discarded canonical parameter bindings. Repair keeps existing navigation params, matching action input preservation. New regression changes route.a to route.b and asserts unchanged params through the real UiEditSession.
- M3: Browser now values were stale after viewport/container resizing. Repair refreshes readEffective after preview size changes, window resize, and ResizeObserver callbacks, in addition to source/DOM ticks. Browser resize regression compares displayed font-size with actual getComputedStyle at 390 and 1440.
- Canvas ref non_reactive_update warning repaired with $state; broad Svelte check now 23 errors/4 existing warnings across unchanged files, zero diagnostics in new modules or review route.
- Adjacent in-scope improvements: Advanced attribute field populates from source, named-color swatches fall back to measured RGB, and the existing conditional style command builder is now publicly exported (additive only).

No engine/compiler/renderer/store/workbench/frozen file changed. These are builder repair claims until the fresh evaluator rechecks the exact repair commit.

## Independent round 2 and handoff

The independent evaluator rechecked exact pushed repair d0ba90cfcd5efead2b7c7c82d37a2ed29483d715 in another fresh detached checkout. Verdict: PASS WITH NON-BLOCKING FINDINGS. ROUND-2.md and round2/ evidence are imported verbatim; round 1 remains FAIL in its original report. M1 keyboard reentry, M2 same/new-route bindings, M3 actual/display viewport/container measurements with no dirtying, and L1 warning removal all passed. Attribute population, named-color swatch and additive public export also passed.

Independent renderer 120/120, design 12/12, root TypeScript and production build pass. Broad Svelte check remains red at 23 errors / 4 existing warnings in unchanged files; manager requests above still apply. A failed Vite navigation-context harness run is preserved separately in round2/failed-journeys.json, followed by the completed fresh run with zero page exceptions. No failed observation is discarded or relabeled.

Final evidence-only handoff preserves implementation bytes from the tested repair candidate. Owner experience acceptance, compiler-repair acceptance and U2 closure remain PENDING. The next allowed action belongs to the overall U2 manager: integration and independent verification of the combined candidate.

Final artifact whitespace check reported trailing blank lines in the two imported round-2 evaluator harnesses. These evidence files are retained verbatim; implementation files have no new whitespace errors. This observation does not affect the independently tested implementation bytes.

## Second usability iteration — final handoff

Owner authorized all six implementer-review improvements. Implementation and builder failures are preserved in iteration-2/DESIGN.md. Expanded independent verdict: PASS WITH NON-BLOCKING FINDINGS at a82ca8ea24638d8563b2d03196faa794af046458. Full checks and 33+15+5 browser observations were independently performed at 349f09e; only one explanatory caption changed afterward, with affected exact-a82 wording verification. Full report and all intermediate/final evidence are imported unchanged under independent-review/iteration2-candidate/. Report SHA256 matches A9E8551093779D507D604F626AFD8EC803D3F896D94221F70ACFF1E09A9944DA.

All six demonstrated criteria passed. The unitless-versus-computed wording note was repaired to Resolved in preview; the original observation is retained. Broad Svelte checking still has 23 errors / four existing warnings in manager-owned unchanged files. The final evidence-only commit leaves implementation bytes identical to exact a82ca8e. No compiler acceptance or U2 closure is inferred. A prepared five-task founder exercise is available; no human participant result is claimed.

Final artifact whitespace check reported trailing blank lines at EOF in the imported evaluator Host.svelte, ITERATION-2-REVIEW.md, challenge.mjs and pseudo.mjs. These independent evidence files are retained verbatim, including the report checksum; implementation bytes have no changes in this handoff.

## Owner-authorized N1 UX follow-up

Read exact report e0893feebc3e9783b7a29026c2285929819f86bb. F1 uses existing setStyle value-omission removal path with visible Reset and retained conditional/spacing removal paths; no new operation. F2 historical46px annotation/61px actual mismatch independently reproduced with original83 Inspector before real Canvas. Reusable post-tick remeasurement repaired edit/selection/condition paths.

Independent e5931cf30fd2c2cdb0d03a017d77c46b0f35ba31 challenge was FAIL: M4 native hover/focus/active measurements stale; L2 Reset text overflowed29px icon button. Preserved independent report/evidence n1-candidate remains FAIL. Repair1bd745a04334af07934db33211ef7803a2e4cd0b adds coalesced native event invalidation and intrinsic Reset button width. Fresh exact1bd independent verdict PASS. Main28/live7/responsive5 observations, source/history equality, save/full reload/reopen, reset cascade and exact occurrence measurements pass; full123renderer/12design/types/build pass. No silent evaluator source repair. Final n1-recheck report and intermediate failures imported verbatim with verified SHA256.

Broad Svelte remains23 errors/four existing warnings in unchanged files; manager technical requests remain. Arbitrary external/container CSS changes still require host measurement invalidation. All six earlier UX improvements remain in scope and source; prior comprehensive verification lineage is preserved. The final handoff is evidence-only, not compiler acceptance, owner acceptance or U2 closure.

Final artifact whitespace observations are recorded in n1-followup/artifact-whitespace.txt. Imported evaluator fixtures/reports/logs have trailing blank lines retained verbatim; no implementation whitespace errors. Scoped .gitattributes disables newline normalization only for the two new independent evidence directories, preserving evaluator report SHA256 in both working files and stored Git blobs. The evidence check permits CR at EOL for these original CRLF files; it still reports their EOF blank lines.

## U2 manager integration — combined candidate (2026-10-07)

The overall U2 manager integrated the reviewed Inspector/Layers UX branch
(merged at the UX tip f31477d8 with the U2 manager lineage e0893feeb; merge
commit records both parents) and executed the manager-owned repairs in this
file's "Precise manager requests", inside the authorized U2 scope.

1. `UiRenderPlan` is now imported in packages/ui-editor/src/EditorCanvas.svelte
   (onPlan prop typing) — manager request 1 executed.
2. The existing workbench route no longer names a component state `state`
   (renamed `snapshotState`; the identifier collided with the $state rune under
   broad svelte-check), derived values are typed through `$derived.by` with the
   version signal, and examples/ui-design-proof/tsconfig.check.json now includes
   the generated SvelteKit ambient/non-ambient/$types declarations and no longer
   excludes `.svelte-kit` from the check — manager request 2 executed.
3. Broad Svelte check (`npx svelte-check --tsconfig
   examples/ui-design-proof/tsconfig.check.json`) at the combined candidate:
   **0 errors / 2 warnings** — the two known renderer accessibility warnings
   (packages/ui-svelte RenderNode.svelte, unchanged). The previously reported
   23 errors are resolved; no suppression shims were added.
4. Workbench mounting completed per the UX handoffs: canonical working document
   and renderer scope into Layers, friendly EditorLabels into Inspector and
   Layers, selection synchronized through bridge.select (canvas, Layers and
   Inspector derive from the same occurrence), `readEffective` re-measured via a
   host `domVersion` signal (Svelte ticks after source/preview-size changes,
   canvas-frame ResizeObserver, window resize), `lastIssues` passed from apply
   outcomes, bridge-owned editing/history/revision/persistence unchanged. The
   dedicated /editor-review route remains as supporting evidence.
5. Integration-level browser testing found one real combined-candidate defect in
   the reusable Inspector numeric editor (packages/ui-editor/src/
   InspectorControl.svelte): when the displayed value is a non-unitized
   expression (e.g. the service heading's `clamp(34px, 5vw, 56px)` attached
   source), committing a bare number produced a unitless `61` (invalid CSS, so
   the honest Browser now annotation kept showing 56px and the edit appeared
   ineffective), and typing a bare number flipped the field from the textual to
   the numeric editor mid-typing, dropping keystrokes. Repaired per the
   documented design ("numbers without units use px; expressions such as
   auto/calc remain textual"): both editor paths commit unitless numbers with
   px, and the editor branch is chosen from the committed value so a field never
   switches identity mid-typing. Regression-pinned in
   packages/ui-editor/test/inspector-iteration-ux.svelte.test.ts. The review
   fixture never exposed this because its heading value was authored `46px`
   (numeric path from the start).
6. Root `format:check` is clean at the combined candidate: `.prettierignore` now
   excludes `examples/ui-design-proof/build/` (generated output made the check
   misleading after builds) and the three verbatim-evidence directories under
   docs/ui-foundation/u2-ux/ (independent-review/, iteration-2/, n1-followup/),
   whose imported evaluator/builder bytes carry recorded identities. During
   worktree reconciliation, 67 evidence files that a prior uncommitted session
   had reformat-modified were restored byte-identical to HEAD before any
   commit; no evidence content changed.
7. Historical evidence checksum reconciled: iteration-2/HANDOFF records SHA-256
   A9E8551093779D507D604F626AFD8EC803D3F896D94221F70ACFF1E09A9944DA for
   ITERATION-2-REVIEW.md, while the committed copy hashed to
   a927c3d38855f79751f9de9217dfc10b8bad7ab89fbd5f99740f9b4d2b8c689f. The
   original evaluator artifact — preserved untracked in the evaluator's own
   detached worktree (vict-02-u2-iteration2-review, exact candidate a82ca8e) —
   hashes to exactly A9E855… and ends with a CRLF-terminated final blank line;
   the import into codex/ui-foundation-u2 normalized that one trailing CRLF to
   LF (root `.gitattributes` `* text=auto eol=lf`). Content is byte-identical
   modulo that single trailing CR; verdict and every reported observation are
   unchanged. The in-tree file is restored to the evaluator's original bytes
   and docs/ui-foundation/u2-ux/.gitattributes now covers
   independent-review/iteration2-candidate/** (the same protection the n1
   evidence directories already had), so the recorded checksum verifies in-tree
   from this candidate onward. Historical commits keep the normalized copy and
   are not rewritten. All other recorded report checksums verify byte-exact
   in-tree: ROUND-1 B99907F9…, ROUND-2 6ABBD9F0…, n1-candidate CEF99725…,
   n1-recheck 1717C185….

These records do not close U2: owner experience acceptance, the fresh
independent verdict on the exact combined candidate, and U2 closure remain
pending.
