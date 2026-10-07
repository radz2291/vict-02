# U4 HANDOFF REVIEW — independent verification report 01

- **Reviewer role:** fresh independent documentation verifier (did not author the candidate; read-only; no repairs made)
- **Tested SHA (pinned candidate):** `ebc3461e697ffd6f0bec5129316cc012137d5de1` on `codex/ui-foundation-u4-handoff` (local worktree `vict-02-u4-handoff`, clean tree, verified via `git status` / `git rev-parse HEAD`)
- **Candidate under review:** `docs/ui-foundation/U4-HANDOFF.md`, `docs/ui-foundation/U4-COMPONENT-REUSE-MATRIX.md`, `docs/ui-foundation/U4-COMPONENT-INTEGRATION-DESIGN.md`, and the `U3-HANDOFF.md` opening-status correction (diff vs `16df3bf` = opening status block only; no historical report bytes altered)
- **Frozen authority:** `9ec87f3e7eb8eb7793f972111258940aac635346` — `STAGES-AND-VERIFICATION.md` §6 (U4-01…U4-07) and `API-SPEC.md` §6.2/§7/§10. Verified byte-identical to the working-tree copies at the tip (`diff` clean both files).
- **Method:** falsification-first source inspection at the pinned tip (grep/read only; no builds, no servers, no edits). Every source-backed claim re-derived from the source bytes; entry-authority SHAs checked against `git ls-remote` / history; the U3-HANDOFF delta diffed against `16df3bf`. No runtime proof attempted or claimed (none is expected at this gate).

---

## A. Fidelity to the frozen U4 criteria — verdict: sound, no weakening found

- All seven frozen criteria (U4-01 Packaging … U4-07 Final gate, `git show 9ec87f3e:docs/ui-foundation/STAGES-AND-VERIFICATION.md` §6) are mapped one-to-one to concrete work + named evidence locations in U4-HANDOFF §2. Wording preserved: "built artifact contents and public exports recorded", "editor/simulator infrastructure absent", "no original app-source imports or repo source aliases", "fresh independent verifier … per-criterion", the frozen closing line "No npm publication, merge to main, existing Studio integration or production activation is implied" mirrored in §9.
- The representative component proof (design §1.1–1.4) is positioned as an **explicit additional owner requirement that cannot be relabelled**: U4-HANDOFF §2 bold block ("explicit, not relabellable", "must not be downgraded to a minor finding to obtain a reuse PASS") and design §6 decision 1 (owner authority for accepting P3 as catalog reuse). Nothing is added beyond scope without an owner-decision hook.
- Out-of-scope list (§1) covers `apps/studio`, Stage 9, merge to main, publication, deployment, frozen-contract changes, and the design-doc §5 amendment. Copy-paste authorization prompt (§12) is consistent with §1/§2/§9.

## B. Source-backed claims — verified against the bytes at `ebc3461`

| # | Claim | Result | Evidence (all at the tested SHA) |
| --- | --- | --- | --- |
| 1 | `catalog/*` re-export bits-ui parts | **TRUE** | `catalog/button.ts`, `catalog/checkbox.ts`, `catalog/select.ts`, `catalog/dialog.ts` are each one-line `export { X } from 'bits-ui'` |
| 2 | coverage = 41 families: 30 styled-and-usable / 8 supported-direct-composition / 3 deferred; Select, Dialog, AlertDialog, Checkbox, Button present | **TRUE (exact)** | `packages/ui-svelte/catalog-coverage.json`: 41 entries, statuses 30/8/3; the five named families all "styled and usable" |
| 3 | `RenderNode.handleChange` handles checkbox `checked` + number coercion | **TRUE** | `packages/ui-svelte/src/document/RenderNode.svelte:104-119` — `target.checked` for checkboxes, `Number(...)` parse with declared-value fallback, string values otherwise (change→setState path only) |
| 4 | `UiInteraction` = click→invokeAction / navigate, change→setState, submit→invokeAction | **TRUE** | `packages/ui/src/document.ts:61-86` (exactly those four variants) |
| 5 | Action bridge: declared dispatch + undeclared refusal BEFORE dispatcher; `createComponentRegistry` exact componentId+revision; ComponentSlot/useVictActions | **TRUE** | `packages/ui-svelte/test/catalog.test.ts:56-150` — "rejects undeclared actions without reaching the dispatcher" asserts `expect(f.dispatch).not.toHaveBeenCalled()`; "dispatches declared actions … invalidates on success" asserts dispatch call + `onInvalidate` once. `packages/application/src/renderer.ts:119` `createComponentRegistry` with structural (id, revision) map identity. `ComponentSlot` exported (root index :32); `useVictActions` public via `./component-actions` subpath (throws outside a VICT surface) |
| 6 | Extension bridge props-only; events/slots → `UI_RENDER_EXTENSION_INTERFACE_UNSUPPORTED`; missing/mismatch → `UI_RENDER_EXTENSION_UNAVAILABLE` / `EXTENSION_UNAVAILABLE` | **TRUE** | `packages/ui-svelte/src/document/extensions.ts` — `UiSvelteExtensionProps` = props + occurrenceKey + nodeId ("Actions stay on authored elements. Components receive neither dispatch nor hidden application data"); exact id+revision+rendererImplementationId match required; both render diagnostics present. `packages/ui/src/compile.ts:426` `EXTENSION_UNAVAILABLE` |
| 7 | ActionButton pending/feedback/focus-restore + feedback validation | **TRUE** | `packages/ui-svelte/src/ActionButton.svelte` — "Working…", `aria-busy`, `disabled={disabled || pending}`, focus restored to trigger after `tick()`; `packages/ui/src/feedback.ts` — `validateActionFeedback` + `actionFeedback` outcome mapping; covered by `test/action-transition.test.ts:53` (asserts "Working…") through the public `renderVictApplication` surface path |
| 8 | AppShell responsive nav matchMedia 720/960 + groups/breadcrumbs | **TRUE** | `packages/ui-svelte/src/AppShell.svelte:28` (`'(min-width: 960px)'` / `'(min-width: 720px)'`), groups/breadcrumbs/nav at :13-17, :41, :79-82 |
| 9 | Packaging posture | **MOSTLY TRUE — one contradiction (F-2)** | `ui` files `["dist"]` ✓; `ui-svelte` files include `src`, exports → `./src/*` (incl. `./styles.css`, `./catalog.css`, `./controls`, `./component-actions`), deps bits-ui + @internationalized/date + workspace @victframework/*, peer svelte ✓; `ui-preview` files `["dist"]` ✓; `ui-editor` files `["src"]`, exports → `./src/index.ts`, build `tsc -p tsconfig.json` — **but the build is `noEmit`** (tsconfig) and F3 is recorded (see F-2), contradicting the documents' "dist declared / pack dist after repair" statements. F3 recorded evidence exists: `docs/ui-foundation/reviews/u2/U2-COMBINED-VERIFY-04.md:68` (TS2307 ×4, "no Svelte d.ts shim", "tsconfig is `noEmit`", "nothing consumes its dist") — cited, not rebuilt, per mandate |
| 10 | Edit ops + component-definition ops; Inspector authors `connectInteraction` | **TRUE** | `packages/ui/src/edit.ts` — `setProperty` :47, `setAttribute` :54, `setStyleDeclaration` :61, `bindExpression` :83, `connectInteraction` :92, plus `createComponentDefinition` :99 / `updateComponentDefinition` :103 / `fillSlot` :110; `packages/ui-editor/src/Inspector.svelte` — navigate `connectInteraction` at :104, "Connect action" button at :202 (matrix citations `:202` and `:92–104` accurate) |

Additional spot-checks that **passed**: `catalog.css` IS a declared export (`./src/catalog.css` — an earlier filter of mine hid it); the §4 transitive-deps pack list is accurate (runtime→contracts/kernel/sdk; control→contracts/runtime; store-sqlite→runtime; appdata-sqlite→application/contracts/sdk); `renderVictApplication` takes `path` (mount.svelte.ts:16); `catalog.test.ts:29` citation lands on the checkbox-binding test; 38 `catalog/*.ts` recipe files = 38 `./catalog/*` export keys.

## C. The props-only / event / slot gap — verdict: stated precisely

- Gap statement confirmed by source: extensions receive `props` + occurrence identity only; there is **no contract to report value changes or events back** — so a Checkbox rendered as an extension does NOT connect `checked` to authored state (matrix P4 "do NOT assume otherwise"; design §0 rejects hidden DOM side-channels).
- Amendment correctly deferred: design §5 scopes extension v2 (`outputs` + `emit`, same host channels, `EXTENSION_OUTPUT_UNRESOLVED`, minor schema bump, optional field = older documents byte-compatible, registry matching unchanged) and marks it **owner authority required, not implemented in U4**.
- Registered-component route covers the four required proofs without contract changes — with one exception: proof 1.1's canonical P3 route depends on a non-public component (F-3 below). Proofs 1.2/1.4 use public `catalog/*` recipes; 1.3 uses public `AppShell`.

## D. Isolation / packaging — verdict: sound, one contradiction

- Packed tarballs from copies; `file:` into `vendor/`; "never `link:../../packages/...`"; no source aliases; no original-example imports (§4/§5) — consistent and falsifiable.
- ui-svelte shipped source correctly distinguished from "reaching into the checkout" (§4 note: completeness is a U4-01 check, not an assumption).
- Tarball contents/sizes/sha256s required (§2 U4-01 evidence, §11 manifest; tarballs not committed — manifest + reproducible script).
- Carry-forwards correctly attributed: N-2 (dist-dependent tests) → pack script + README build order; V-F1 → consumer implements disclosed fallback, the diagnostic-wipe fix stays owned by U3+ product-host UX, explicitly NOT a U4 obligation (§10).
- **F-2 contradiction** (below) sits exactly here: the pack plan for ui-editor cannot be executed as written.

## E. Founder visibility — verdict: sound

- Design §3: opaque = declared component internals; visible = screens/compositions, action identities, input contracts, feedback declarations, navigation groups, document sources, extension descriptor identities + evaluated props. U4-HANDOFF §3: "business state, action identities and their connections remain visible in the persisted application definition / document source." No proof route hides state/actions in opaque code (design §0 explicitly rejects hidden side-channels; §5 amendment keeps descriptors event/slot-free).

## F. Scope / ownership / outputs / boundaries — verdict: sound, one process note

- Allowed paths + out-of-scope list complete and mutually consistent with §12 (see A).
- Entry-authority SHAs verified live: `16df3bf155fa2a8c9ca0de67996dc6d73450f659` = `origin/codex/ui-foundation-u3` (ls-remote), `952d92da5131d6ab595b45b3bf18bc7ce3b3466d` in history (with reviewed `e0dd026` ancestry per U3-HANDOFF closure section), main baseline `4d2df037d8a82d36c60bf1bff16919650643ce22` = `origin/main`.
- U3-HANDOFF opening vs closure: `git diff 16df3bf..ebc3461` touches **only** the opening status block (now CLOSED — PASS WITH NON-BLOCKING FINDINGS, consistent with the closure section and with `STATE.md` "U4 is NOT authorized and NOT started"); no historical report bytes altered. Referenced artifacts (`reviews/u3/U3-VERIFY-01.md`, `U3-COMBINED-VERIFY-01.md`, `OWNER-FEEDBACK-01.md`) exist.
- Copy-paste prompt consistent; unfamiliar-agent brief bounded (§7: consumer README + packed artifacts + one task), explicitly "No performance target is invented and no universal development-speed claim is made".

---

## Findings

**F-1 — BLOCKER (truthfulness at the pinned tip).** `U4-HANDOFF.md` intro (lines 8-10) and §8 claim the handoff "was independently reviewed (see [U4-HANDOFF-REVIEW-01](reviews/u4/U4-HANDOFF-REVIEW-01.md))" / "This handoff itself was reviewed at preparation time". `docs/ui-foundation/reviews/u4/` is **empty and untracked at `ebc3461`** (`git ls-tree ebc3461 -- docs/ui-foundation/reviews/u4/` = empty); the file exists in no commit of any branch (`git log --all --follow` empty). The candidate bytes assert the existence of an artifact that is not in evidence. *User effect:* an owner or auditor following §8 finds nothing; the "PREPARED, reviewed" status is not truthful at this SHA. *Repair:* commit the review report at the docs tip (this report is written for exactly that path) before or together with any authorization, or reword to "review commissioned; report to be attached at <path>". Re-review at the repaired tip then clears this.

**F-2 — BLOCKER (internally contradictory packaging instructions for ui-editor).** Matrix §1 row: ui-editor "Consumable as: **dist declared**; build FAILS". U4-HANDOFF §4: pack "`@victframework/ui-editor` (dist — **after the F3 repair**)"; §5: "`npm run build # package dists (incl. repaired ui-editor)`". Recorded reality (the documents' own cited evidence, `U2-COMBINED-VERIFY-04.md:68`, re-confirmed in U3 records V-F2): ui-editor has `files: ["src"]`, exports → `./src/index.ts`, tsconfig `noEmit: true`, no Svelte d.ts shim, "nothing consumes its dist". A "type-level … no behavior change" repair cannot produce a packable dist; making dist real requires manifest/tsconfig/build-output changes that §1's scope language ("type-level dist-build repair only") does not clearly authorize. *User effect:* an unfamiliar implementer stalls at the pack step and cannot tell whether changing the packaging posture is authorized. *Repair:* either restate ui-editor's posture (source-exports package, like ui-svelte; the type-level repair makes the type-check clean; dist emission is a separate owner-authorized packaging change), or explicitly widen the §1 scope to include the ui-editor manifest/build-output change. Matrix §1's "dist declared" must be corrected either way (it contradicts `packages/ui-editor/package.json`).

**F-3 — BLOCKER (design's canonical proof route is not executable under the stated scope).** Design §1.1 canonical source: "the registered surface renders the existing `ActionButton`"; matrix §3 route cell: "P3 (`ActionButton` inside ComponentSlot)". `ActionButton.svelte` is **not on any public export surface**: not in root `index.ts`, not in `./controls`, `./primitives`, `./component-actions`, or `./document`; it is imported only internally by `Surface.svelte` (itself not exported). Under the handoff's own isolation rules (packed tarballs, no deep imports — API-SPEC §9: "source aliases or deep imports do not count as reuse") the consumer cannot import it, and `packages/ui-svelte` is **not in §1's allowed paths**, so adding an export is not authorized either. *User effect:* proof 1.1 fails at the first import under the sanctioned setup. *Repair:* re-aim the P3 proof at public components — `Button` + `ActionFeedback` (both root exports) + `actionFeedback()`/`validateActionFeedback` from `@victframework/ui` dist, reproducing ActionButton's documented choreography (pending/`aria-busy`/focus-restore, already unit-covered via the public plan-action-surface path in `action-transition.test.ts`) — or obtain explicit owner authority for an additive `ActionButton` export.

**F-4 — MINOR (public-export list inaccuracies).** Matrix §1 "Key exports (public)" lists `ActionButton`, `FormSurface`, `OverlaySurface` (all internal, reachable only through the built-in `Surface` renderer) and `form-values` (internal module, no export subpath). It also says "catalog/* (41 bits-ui recipes)" — there are **38** recipe files/export keys; 41 is the coverage-family count (3 deferred families — PinInput, RatingGroup, TimeRangeField — have no recipe). *Repair:* mark the four as internal and correct 41→38 recipes / 41 coverage families.

**F-5 — MINOR (portal-target assertion).** Design §1.4 asserts the catalog Dialog "portal renders to `document.body`". `ControlScope.svelte` sets `BitsConfig defaultPortalTo={root}` — inside ControlScope styling (which §2 mandates), bits-ui portals land in the scope root, not body. *Repair:* reword to "portal target is the ControlScope root by default; U4 verifies actual portal containment and focus restore at runtime wherever it lands."

**F-6 — MINOR (nonexistent component named).** Design §1.2 says the catalog Checkbox is composed "inside `ComponentScope`/`ControlScope` styling". `ComponentScope` does not exist anywhere in `packages/` or `examples/`. *Repair:* drop "ComponentScope/"; ControlScope (via the `./controls` subpath) is the real mechanism.

**F-7 — MINOR (record hygiene).** Matrix header date "2026-07-10" is transposed (the companion design doc and the U3 closure are 2026-10-07; 2026-07-10 predates the whole U-track). *Repair:* correct to 2026-10-07.

**F-8 — PROCESS, MINOR.** The pinned candidate `ebc3461` exists only locally; `git ls-remote origin` shows **no** `codex/ui-foundation-u4-handoff` ref and the branch has no upstream. The handoff's own standard ("verify live before starting") cannot be applied to its own tip until pushed. I was mandated read-only and pushed nothing. *Repair:* push the reviewed docs tip and record its SHA before owner authorization.

---

## What I attempted and could not break

- Entry-authority verification (all four pinned SHAs + lineage); freeze-fidelity of STAGES §6 and API-SPEC §6.2/7/10 (byte-identical at the tip); U3-HANDOFF historical-bytes integrity (opening-block-only diff, consistent closure); criteria-mapping fidelity including negatives and the non-relabellable owner requirement; all ten B claim-groups against source bytes; the props-only gap, its consequence, and the amendment's deferral posture; isolation/packaging rules and the transitive pack list; founder-visibility boundary; unfamiliar-agent brief boundedness.

## VERDICT

**U4 HANDOFF REVIEW: FAIL** (revision required)

All three blockers are documentation-repairable at a new docs tip; **no source-code defect was found** — every tested capability claim about the packages themselves verified true, and the plan's structure (criteria mapping, isolation design, honesty legend, authority boundaries, founder checkpoint) is sound. Required for re-review: land the review artifact and repair F-1/F-2/F-3 (F-4..F-7 recommended in the same pass), push the tip (F-8), then a fresh verification of the repaired bytes can credibly return PASS.

*No secrets in any artifact. No builds, servers, or runtime proofs were run. Working tree left untouched; the only file written is this report at the supervisor-designated output path.*

---

## Round 2 (affected recheck)

- **Scope:** affected surfaces only (F-1..F-8 from round 1), same read-only rules; no full re-review.
- **Tested SHA:** `f6bca52b5c5b61c26560318379ffc420eb8d4e64` on `codex/ui-foundation-u4-handoff` (worktree clean; single docs-only commit on `ebc3461`). Diff touches exactly: the three handoff docs, `reviews/u4/.gitattributes` (new, scoped `U4-HANDOFF-REVIEW-01.md -text`), and the imported review report.

### Per-finding disposition

**F-1 — REPAIRED, verified.** `git show f6bca52:docs/ui-foundation/reviews/u4/U4-HANDOFF-REVIEW-01.md` is **byte-identical to the round-1 report I wrote** (SHA-256 `0b4c3ef3c0b118d89a46cd1066ab639abe2ce1d42530c7f8b03fdd71d777a97e` on both blob and my retained copy; 91 lines each; verified BEFORE any edit of my local copy). Scoped `.gitattributes -text` present. U4-HANDOFF §8 now records the round-1 **FAIL (revision required)** verdict at `ebc3461` with the report's sha256 and an accurate F-1..F-8 summary. The citation is now truthful.

**F-2 — PARTIALLY REPAIRED.** The operative sections are corrected and truthful: §1 allowed-paths now states the real posture (`noEmit: true` typecheck-only build, cannot produce dist) and scopes the repair as emitting build + four TS2307 fixes with a documented source-exports fallback; §4 pack list and the §10 carry-forward row match. **But the sweep the recheck demanded does not come back clean — three superseded statements remain:**
1. `U4-HANDOFF.md:221` — the §12 **copy-paste authorization prompt** still says "repair the ui-editor dist build (type-level F3)", contradicting the corrected §1 in the same file. This is the operative owner-facing text; authorizing off it recreates the round-1 stall (type-level fix → no dist → pack fails).
2. `U4-COMPONENT-INTEGRATION-DESIGN.md:192` — §6 decision 2 still says "**type-level fixes only**; no behavior change".
3. `U4-COMPONENT-REUSE-MATRIX.md:29` — the §1 ui-editor row is **untouched** and still says "**dist declared**; build FAILS", the exact false statement round 1 flagged.

**F-3 — REPAIRED, verified.** Design §1.1 now composes public exports only: `Button` (ui-svelte root `index.ts:17`), `ActionFeedback` (root `index.ts:20`), `actionFeedback` (public via `packages/ui/src/index.ts:138` `export * from './feedback.js'`); `ActionButton.svelte` is explicitly cited as the NOT-exported in-repo reference implementation and the text forbids deep imports. No deep import remains in the design. All named exports verified public at `f6bca52`.

**F-4 — REPAIRED, with two new nits.** The matrix §1 ui-svelte row now lists the actual root exports with ActionButton/FormSurface/OverlaySurface/form-values marked internal, and says "38 recipe modules / 41 recorded coverage families (30/8/3)" — all accurate against `src/index.ts` and `catalog-coverage.json`. Nits: (a) the row is prefixed `> ` (blockquote) — line 28 of the matrix is `> | …`, so the corrected row is no longer part of the markdown table and renders as plain blockquote text; (b) `ControlScope` is listed under "public root exports (src/index.ts)" but it is **not** in the root index — it is public via the `./controls` subpath (`controls.ts:2`). Public, wrong shelf.

**F-5 — REPAIRED, verified.** Portal target now stated as the **ControlScope root** (`BitsConfig defaultPortalTo`, "NOT `document.body`") in both matrix P1 caveat and design §1.4 — matches `ControlScope.svelte`.

**F-6 — REPAIRED, verified.** No live "ComponentScope" remains; the only occurrence is the truthful round-1 finding record inside §8's verdict summary.

**F-7 — REPAIRED, verified.** Matrix date is now 2026-10-07.

**F-8 — NOT REPAIRED; made worse.** §8 now asserts "F-8 process (**branch now pushed**)". `git ls-remote origin | grep u4-handoff` → **0 refs** at recheck time; the branch is still local-only. The repair commit introduces a new claim the remote does not support — the same assert-before-evidence class as round-1 F-1. Repair: push the branch (then the claim becomes true) or reword to "push pending".

### New-claims audit (item 5)

Beyond the F-8 "now pushed" claim: §8's sha256 pin is correct; the "imported verbatim" claim is verified byte-for-byte; the §8 summary of round-1 findings is accurate; design/matrix rewrites introduce no capability claims beyond what round 1 already verified (all named exports re-verified public). The §12/design §6.2/matrix-row leftovers are stale rather than new, but they leave the document set internally inconsistent on the exact point F-2 flagged.

### Round-2 disposition

Repaired and verified: F-1, F-3, F-5, F-6, F-7 (and F-4's core). Remaining for one mechanical docs revision: the three F-2 leftovers (§12 prompt, design §6.2, matrix §1 ui-editor row — plus the `> ` blockquote table break and the ControlScope shelf nit while there), and the false "branch now pushed" record (push or reword). Because the operative authorization prompt still carries the superseded repair scope, the set is not yet implementation-ready under the same standard round 1 applied.

**U4 HANDOFF REVIEW ROUND 2: FAIL** (revision required — narrow: F-2 leftovers + F-8 record; everything else verified repaired)

*Round 2 method: read-only git/grep/read at `f6bca52`; no builds, no repairs; report updated by appending this section only; round-1 content above preserved verbatim. The pre-append hash of this file matched the imported blob (`0b4c3ef3…`), so the verbatim-import verification was performed against unmodified round-1 bytes.*

---

## Round 3 (final narrow recheck)

- **Scope:** the four items named by the orchestrator only. **Tested SHA:** `6b9e328` on `codex/ui-foundation-u4-handoff` (worktree clean; history is exactly `ebc3461` → `f6bca52` → `6b9e328` — note: the "one further docs commit recording the round-2 verdict in §8" does NOT exist in history; 6b9e328 touched one line of §12, three lines of design §6.2, the matrix §1 rows, and appended the round-2 report section).

**1. F-2 leftovers — VERIFIED ZERO.** `grep "type-level"` and `grep "dist declared"` across all three docs return nothing (both exit 1). The §12 authorization prompt now reads: "repair ui-editor packaging (F3: emitting build + the four TS2307 declaration fixes, per the handoff's allowed-paths scope)"; design §6.2 matches ("an emitting build plus the four TS2307 declaration fixes; no editor behavior change").

**2. F-8 record — NOT REPAIRED.** The report side checks out: the imported report's round-1 section is still byte-identical to my original (first 91 lines hash `0b4c3ef3…a97e`), the final imported file is 131 lines hashing to `684e486f5f54331ba6b607be14e670ab86064657c81cf37b59dbb6a5d00e5fb7` (matches the orchestrator's stated `684e486f…`; my local file was byte-identical to the import before this append, so round 2 was imported verbatim too). But `U4-HANDOFF.md` §8 was **not modified** in this commit: it still asserts "F-8 process (**branch now pushed**)" — and `git ls-remote origin` at round-3 test time returns **0** `u4-handoff` refs, so the assertion remains false at the tip. §8 also still lacks the round-2 verdict/repairs record and records only the round-1 hash (`0b4c3ef3…`), not both.

**3. Nits — REPAIRED, with one new cosmetic defect.** `grep '^> |'` in the matrix → empty (blockquote row fixed). `ControlScope` is removed from the root-export list and correctly stated as "public via the `./controls` subpath export" — verified against `packages/ui-svelte/package.json` (`"./controls" → "./src/controls.ts"`). New defect: the corrected ui-svelte row contains a **raw newline mid-cell** ("…registry/diagnostic types;⏎`ControlScope` is public…"). In GFM a non-`|` line terminates a table, so the ControlScope sentence renders below the table and the following rows (ui-editor, ui-preview, application, sdk) drop out of the rendered table. Content truthful; rendering broken. Repair: keep the row on one physical line or use an explicit `<br>`.

**4. New-claims audit — CLEAN except the carried-over F-8 sentence.** Every corrected statement verified against source: `files: ["src"]`, exports → `./src/index.ts`, `tsc -p tsconfig.json` with `noEmit: true` (matrix ui-editor row now fully truthful, "currently FAILS" matches the recorded U2 evidence), `./controls` subpath, `./catalog.css`/`./styles.css`, 38 recipes / 41 families. The §12 "per the handoff's allowed-paths scope" cross-reference is accurate. The only unsupported claim in the tree remains the round-1-era "branch now pushed" sentence in §8 — not new, but still false.

**Round-3 disposition:** all substantive packaging/export claims are now truthful and consistent across the three documents, and both report imports are byte-verified. What remains is exactly one record-integrity defect: §8's false "branch now pushed" sentence (disproved by `git ls-remote` at test time), plus the missing round-2 record and second hash that §8 was supposed to gain. Under the same truthfulness standard applied in rounds 1–2, a handoff whose own review record asserts a push the remote disproves cannot PASS. The repair is one small §8 edit (reword F-8 to "local-only at review time; push precedes handoff delivery" with the live remote SHA) plus the actual push, and optionally the table-line cosmetic.

**U4 HANDOFF REVIEW ROUND 3: FAIL** (revision required — single remaining defect class: the §8 F-8 record is still false at the tip and the branch is still absent from origin; all other round-2 findings verified repaired)

*Round 3 method: read-only git/grep/read at `6b9e328`; no builds, no repairs; this section appended only; rounds 1-2 above preserved verbatim.*
