# U2 ROUND-2 REPAIRS — INDEPENDENT RECHECK (scoped)

- Verifier: independent fresh verifier (vict.vict-verifier); I did not implement the repairs and made no repairs or improvements during this recheck.
- Candidate: branch `codex/ui-foundation-u2`, pinned repair SHA `19bb4b98a18f86bb1193db5a45f8c33e1c5c9af5` (verified `git rev-parse HEAD` at recheck start; working tree clean).
- Method: falsification-first. Out-of-repo attack harness `C:/Users/RZ1/Desktop/RZ/u2-recheck-falsify/` (own vitest config aliasing the worktree sources) + real-browser walkthrough via CDP (Chrome :9222) against the dev server on `http://127.0.0.1:5333` (left running; owner server 5199 never touched — verified down throughout).

## Tested SHAs (live-verified)

| Item | SHA | Notes |
| --- | --- | --- |
| Candidate (all code attacks + gates executed against this code) | `19bb4b98a18f86bb1193db5a45f8c33e1c5c9af5` | HEAD at recheck start, clean tree |
| `origin/main` (live `git ls-remote`) | `4d2df037d8a82d36c60bf1bff16919650643ce22` | unmoved ✓ |
| Remote tip `refs/heads/codex/ui-foundation-u2` (live `git ls-remote`) | `36ec8ebdf2bee978e26bf567526943f97d176118` | candidate is an ancestor; delta is ONE docs-only commit (`docs/ui-foundation/U2-WALKTHROUGH.md`, +87) — verified by `git diff --stat`; all code evidence below is unaffected |
| Worktree HEAD at recheck end | `36ec8eb…` | **moved by another actor mid-review** (reflog: `commit: U2 docs: founder walkthrough`). I made zero commits/checkouts/pushes. Tree verified clean at exit. Flagged for owner track hygiene. |

## Verdict per repair

### R1 (T-F1/T-F2 pseudo CSS) — PASS
Independent verifier-authored attacks (NOT the candidate's test): `u2-recheck-falsify/attacks/r1-pseudo-attack.test.ts` → **8/8 PASS** at the pinned sources:
- All four pseudo states (`hover`/`focus`/`active`/`disabled`) end-to-end: `compileUiDocument` emits a plan rule with clean base selector (`.uv-<hash>-n_btn`, no `:`) plus `pseudo` field, and `styleRulesToCss` emits matchable `.uv-root-* .uv-<hash>-n_btn:<pseudo> {`. Zero `${` template junk, zero escaped `\:` (regex-asserted on the emitted CSS).
- Pseudo source inside a DEFINITION body (component base layer): rule compiles from the definition node and CSS composes `.uv-root-* .uv-<hash>-n_card:hover`.
- Mixed conditioned+pseudo: media condition → rule carries `mediaConditionId` AND `pseudo`; emitted INSIDE `@media (max-width: 600px)` with `:focus` suffix. Container condition → inside `@container` with `:active` suffix. (The pseudo-suffix ternary in `styleRulesToCss` runs before condition bucketing — confirmed by execution, not just reading.)
- T-F2: environment condition → `UI_DOC_UNSUPPORTED_FEATURE` warning at `plan.diagnostics` with interpolated message (`…kind 'environment' is unsupported…`) and `feature: "condition:environment"` — no literal `${`.
- Candidate regression `packages/ui-svelte/test/pseudo-css-u2.test.ts` is honest, not tautological: it drives the real `compileUiDocument` + real `styleRulesToCss` (source imports), asserts the plan selector is the clean base (`toMatch(/^\.uv-[0-9a-f]+-n_root$/)`), asserts emitted CSS contains the matchable `.uv-root-doc_pseudo-1 .uv-f95fe7ba-n_root:<pseudo> {` and `not.toContain('${')`. Mentally reverting the composition (template-literal selector + renderer ignoring `pseudo`) fails both the plan-selector and CSS assertions → it is a real regression. Renderer project grew exactly 112 → 116 (+4 = this suite).

### R2 (T-F3 root integration gate) — PASS
- `npx vitest run --project integration` → **4/4 PASS** (exit 0).
- `git diff ebac7bf..HEAD -- vitest.config.ts`: the ONLY change is adding `'examples/ui-design-proof/**'` to the integration project's exclude, with a truthful comment (design proof mounts Svelte editor components needing the svelte toolchain this project deliberately lacks). No other exclusions added; no test files deleted (`git diff --stat` shows no test removals).
- No silent coverage loss: `examples/ui-design-proof` own `npx vitest run` → **12/12 PASS** (exit 0), plus its typecheck 0 errors. The design-proof integration coverage runs, just in its own toolchained project.

### R3 (EX-F1 persisted product rendering) — PASS (real browser)
All at `http://127.0.0.1:5333`, fresh tabs/reloads, real clicks/typing:
- **Negative case first (store-based, not in-page copy)**: workbench edit applied (`svc.cardKitchensTitle` → "Kitchens VERIFIER-EDIT"), NOT saved → fresh `/service` tab still rendered seed **"Kitchens"**. The unsaved edit did NOT leak.
- Same edit then Saved (activity: `Saved as stored revision 2 (persists across reload)`; localStorage `vict.u2.service.doc` revision `"2"`, contains the edit) → fresh `/service` tab renders **"Kitchens VERIFIER-EDIT"**. Evidence: `evidence/r3-service-renders-saved-edit.png`.
- `/service` with EMPTY storage (key removed): renders the seed, zero banners (`[role=alert]/[class*=banner]` sweep empty, no "not usable"/"PRESERVED" text anywhere), and the store stays empty after load (no spurious write). Evidence: `evidence/r3-service-seed-empty-storage.png`.
- SSR: every `/service` fresh load rendered server HTML + hydrated without crash (multiple navigations).
- Code path: `src/lib/design/persistence.ts` — `/service` and workbench both go through `openDesignStore(SERVICE_STORE_KEY)`/`loadPresentable`; the service page seeds `presentable` with the static import only until the browser `$effect` loads the same persisted store (SSR-safe).

### R4 (EX-F2 instance styling) — PASS (real browser), one NEW finding (N1 below)
- Baseline computed backgrounds of all five cards: four white, Adaptations emerald `rgb(231,242,236)` (seed instance override).
- **Instance scope**: scope = "this instance only (svc.cardAdaptations)", `background-color: #ffe9ec` → Apply → computed styles: Adaptations `rgb(255,233,236)`, other four cards **unchanged** white. Status flipped to "Unsaved changes".
- **Shared scope**: scope = shared, `background-color: #dce9f5` → Apply → **all five** cards computed `rgb(220,233,245)`.
- **Empty value gate**: "Apply style" is `disabled` with an empty Style value (browser-observed `dis:true` before the value event settled; code: `disabled={!useToken && styleValue.trim() === ''}` with tooltip "…an empty value would be a silent no-op"; new mounted test in `editor-tooling-u2.svelte.test.ts` asserts the transition disabled→enabled).
- **requestId epoch**: `Inspector.svelte` builds ids as `inspector-${inspectorEpoch}-${++requestIdCounter}` with a per-mount epoch — no identity reuse across remounts; no request-reuse refusals observed in any browser interaction.
- **Text edits NOT retargeted**: code — `Apply text` targets `report.sourceNodeId` (shared source) regardless of scope; stronger: the "Edits apply to" select is only rendered for element/component nodes, so a text selection cannot even carry an instance scope (browser-confirmed: `absent-for-text`). Apply-text worked normally in-session ("Applied text of svc.cardKitchensTitle").

### R5 (EX-F3 corrupt-store gate) — PASS (real browser)
- **Readable envelope + invalid document** (seeded `{format:'vict.design-store@1', storedRevision:'7', document:{schema:'vict.ui-document@9',…}}`, reload): banner — *"⚠ Stored design data was not usable (stored document invalid: UI_DOC_UNKNOWN_SCHEMA — Unsupported UI document schema.). A fresh seed was loaded; the next successful save replaces the stored data."* NO hard compile panel ("does not compile" absent); seed rendered; Save ENABLED.
- Edit + Save: banner **cleared**; stored bytes now `{format:'vict.design-store@1', storedRevision:'8', document.schema:'vict.ui-document@1'}` containing the edit — the RECORDED revision (7) was carried so the replacement save was accepted (7→8). Evidence: DOM/localStorage transcript; screenshot attempt failed (see Not covered).
- **Preserved path re-verified unchanged** (invalid JSON `THIS IS NOT JSON {{{`, reload): truthful PRESERVED banner ("…unreadable and has been PRESERVED… Save will fail until the site data for this key is cleared"), editor usable on seed; Save → activity `Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data: stored authoring data is not valid JSON`; stored bytes byte-identical after the refused save; banner persists.

## Targeted regressions / gates

| Gate | Expected | Result |
| --- | --- | --- |
| `npx vitest run --project integration` | 4, green | **4/4 PASS** (exit 0) ✓ |
| `npx vitest run --project renderer` | 116 (incl. 4 new pseudo regressions) | **116/116 PASS** ✓ (112 at ebac7bf + exactly the 4-test pseudo suite) |
| `npx vitest run --project unit` | 2497 | 2491/2497 pass; **6 failures in 5 files, all heavy real-subprocess classes**: builder-kit `CatalogGenerationError: catalog child exited 3221226505/1` (Windows child crash), scaffolder real SvelteKit build (Go/esbuild `malloc.go` panic), store-sqlite restart subprocess. **Re-run of exactly those 5 files: 51/51 PASS** → environmental flake class, not regressions; zero failures in any repaired package (ui / ui-svelte / ui-editor / design-proof all green) |
| `npm run typecheck` | 0 | 0 errors ✓ |
| `npm run format:check` | pass | PASS ✓ |
| `npm run check:ui` | 0 errors / 2 warnings | 0 errors, 2 known a11y warnings ✓ |
| design proof vitest + typecheck | 12 / 0 | **12/12** + 0 errors ✓ |
| authoring proof vitest + tsc | 33 / 0 | **33/33** + 0 errors ✓ |
| U1 preservation spot-check | edit-session suites pass unmodified | All `packages/ui`, `packages/ui-svelte`, `packages/ui-editor` suites passed inside the green projects (the only unit failures were the 5 non-U1 files above, all passing on re-run); `git diff ebac7bf..HEAD` touches none of the U1 suites |

## NEW findings (this recheck)

| # | Severity | Finding | User effect |
| --- | --- | --- | --- |
| N1 | **Minor** (arguably Major; needs an owner decision on intended cascade) | A shared-scope "local" style edit silently overrides a previously authored instance-scope override **of the same property on the same definition node**. Repro: instance-scope `background-color:#ffe9ec` on the Adaptations card (renders pink, siblings untouched) → shared-scope `background-color:#dce9f5` → ALL five cards render blue. The instance rule still exists (`.uv-…-svc_cardAdaptations { background-color:#ffe9ec }` present in the emitted `<style>`), but the five later equal-specificity `.uv-…-svc_card` rules win by source order (CSS: equal specificity → last rule wins). Reachable only since R4 made instance authoring work; at ebac7bf the conflict could not be created via the Inspector. | "This instance only" styling visually disappears after a later shared edit of the same property. No data loss (rule present); recoverable by re-applying. Fix direction: occurrence-scoped selector specificity or a dedicated inner cascade layer for instance-attached local styles. |
| N2 | Note | PRESERVED-path banner/message wording says "stored **authoring** data" inside the design-proof surface (generic store message reused) — truthful but surface-inconsistent phrasing. | Cosmetic confusion only. |
| N3 | Note (environment/authority, not product) | Worktree HEAD moved `19bb4b9 → 36ec8eb` mid-recheck by another actor (docs-only commit; reflog shows a commit not made by me). Dev server on 5333 was found DOWN mid-recheck; I restarted it (`vite dev --port 5333`) from the candidate worktree to finish browser attacks; left running. I made zero commits/pushes; tree clean at exit; 5199 untouched. | Track hygiene: pin/verify SHAs at gate time. |

## NOT covered (stated explicitly)

- Visual hover/pseudo states in the live browser (R1 proven at compile→CSS-emission level with matcher-quality assertions; no real-:hover screenshot was taken).
- R4 requestId remount-refusal scenario end-to-end in the browser (verified by code reading of the per-mount epoch + normal operation across many interactions; no explicit remount-refusal attack was driven).
- "Shared-body edit changes all five" was verified for STYLE via computed styles; a shared-body TEXT edit changing all five end-to-end was not separately driven in this recheck (code path + earlier reviews cover text sharing).
- Screenshot coverage is partial (2 of 5 planned captures saved: `r3-service-renders-saved-edit.png`, `r3-service-seed-empty-storage.png`); the CDP screenshot helper hung on later captures after ~22:03. All other browser evidence above is DOM/computed-style/localStorage transcripts captured via CDP evaluation.
- Inspector separator resize (journey 7), console sweep, responsive re-sweep, contrast measurement — unchanged scope from the experience review, not re-run here.
- The docs-only commit `36ec8eb` content was not reviewed beyond confirming it touches only `docs/ui-foundation/U2-WALKTHROUGH.md`.
- Cross-machine/performance variance re-measurement (U2-08 budgets were PASS at ebac7bf; no repair touched measurement paths — diff-verified).

## FINAL VERDICT

**U2-RECHECK: PASS WITH FINDINGS**

All five round-2 repairs (R1 pseudo CSS, R2 integration gate, R3 persisted product rendering, R4 instance styling, R5 corrupt-store gate) held under independent adversarial verification at the pinned code, with the targeted regression battery green (unit failures environmental, re-run clean). Findings N1 (minor cascade-ordering) and notes N2/N3 are non-blocking but should be triaged by the owner before Stage 9 closure.
