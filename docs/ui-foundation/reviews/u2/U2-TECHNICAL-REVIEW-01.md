# U2 INDEPENDENT TECHNICAL VERIFICATION — codex/ui-foundation-u2

Verifier: fresh, independent of the builder; attacks authored by the verifier (out-of-repo harness at `C:/Users/RZ1/Desktop/RZ/u2-technical-falsify/`). No repairs were made; the candidate worktree was left untouched (git status clean at exit, HEAD unchanged).

## Tested snapshots (verified live)

| Item | SHA | Verification |
| --- | --- | --- |
| Candidate HEAD (worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u2`, branch `codex/ui-foundation-u2`) | `ebac7bf766ecc1bee1e510499ce4607fb211675e` | `git rev-parse HEAD`, clean tree |
| Baseline `origin/main` (live `git ls-remote`) | `4d2df037d8a82d36c60bf1bff16919650643ce22` | unmoved ✓ |
| Remote branch tip `refs/heads/codex/ui-foundation-u2` | `ebac7bf766ecc1bee1e510499ce4607fb211675e` | pushed ✓ |
| Starting remote HEAD for U2 (per handoff) | `cb85393…` | used as diff base for preservation checks |

## Verdict per criterion

### U2-01 Components — PASS
Independent attacks (not the candidate's tests), all passing (`u2-technical-falsify/attacks/u2-attacks.test.ts`):
- Definition TEXT node edited through `UiEditSession` → BOTH instances show the new text in the compiled plan; the two occurrences have distinct occurrence keys (per-instance provenance); state survives `save → UiEditSession.open` round trip.
- Duplicate definition id via `createComponentDefinition` → refused (`ok:false`).
- Definition self-cycle (definition body contains an instance of itself) → bounded failure with `UI_DOC_CYCLE`; no hang.
- Required-slot missing (`UI_DOC_REQUIRED_SLOT_MISSING`), undeclared prop (`UI_DOC_UNKNOWN_PROP`), typed prop literal mismatch (`UI_EXPR_TYPE_MISMATCH`) all fire from verifier-built fixtures.
- Instance override (instance-attached local style) persists through definition edit + canonical save→reload; stays instance-local; local (innermost) layer rule present in plan.

### U2-02 Occurrence provenance — PASS
- Nested components (A inside B, two B instances): inner definition-node occurrences get distinct keys carrying BOTH instance path segments (e.g. `n.o1@…`/`n.outInst@…`); `parseOccurrenceKey`/`occurrenceKeyOf` round-trip; forged key (`'garbage-key'`) does not parse.
- Component inside repeat: plan `sourceMap` entry carries `componentInstancePath` containing `n.inst@def.item`; runtime `occurrenceKey(base, repeatKeys)` joins record keys (exported renderer logic).
- Duplicate repeat keys: `uniqueRepeatKeys(['a','a','a'])` → `['a','a#dup1','a#dup2']` (first keeps canonical key) and reports `UI_RENDER_DUPLICATE_KEY` twice; `DocumentHost.svelte` exposes the `onRenderDiagnostic` channel wired to it.
- Portal: children keep logical ownership via `portal:n.port:modal` occurrence-key segment; portal renders as an `unsupported` placeholder with `UI_DOC_UNSUPPORTED_FEATURE` (never silently hidden).

### U2-03 General presentation — **FAIL (one blocker-class defect)**
Passing attacks: media + container conditions compile to `mediaConditionId`/`containerConditionId` rules; environment-conditioned rules are DROPPED with `UI_DOC_UNSUPPORTED_FEATURE` (never silently applied); unknown condition id → `UI_STYLE_CONDITION_UNKNOWN` with rule dropped; frozen cascade declared by the plan (`["token","componentBase","componentVariant","source","local"]`) with conflicting `color` declarations kept in all three of componentBase/source/local layers; grid/`grid-template-columns`/sticky/overflow/z-index pass through as plain CSS declarations.

**BLOCKER F1 — pseudo-state styling is silently inert.** A `hover` style source compiles to a plan rule carrying `pseudo:'hover'`, but its `selector` is the literal, un-interpolated template `` `${selector}:${gating.pseudo}` `` (`packages/ui/src/compile.ts`, the `\${…}` escapes are in the source). The renderer (`packages/ui-svelte/src/document/logic.ts` `styleRulesToCss`) never reads `rule.pseudo` (zero occurrences of "pseudo" in ui-svelte src) and escapes the junk selector, emitting CSS:
```
.root-x \$\{selector\}\:\$\{gating\.pseudo\} { background: navy; }
```
This selector matches nothing. Reproduced end-to-end by the verifier (`attacks/pseudo-css.test.ts`, FAILING). U2-COVERAGE declares "pseudo states | supported | hover/focus/active/disabled selector suffixes"; STAGES §4 U2-03 requires pseudo states. Effect: any hover/focus/active/disabled declaration authored via the model (including the Inspector's condition × pseudo TARGET, which offers `pseudo` on `setConditionalStyle`) silently produces no-op CSS — exactly the "silently unsupported" failure mode the stage forbids for declared-supported features. No candidate test covers pseudo CSS emission; no proof fixture uses pseudo, so the defect is latent in the demos.

MINOR F2 — the `UI_DOC_UNSUPPORTED_FEATURE` diagnostic for environment conditions carries un-interpolated placeholders in `message` ("Style condition kind '${condition.kind}' is unsupported…") and `feature` (`"condition:${condition.kind}"`) — same un-interpolated-template pattern in `compile.ts`. The diagnostic remains actionable (code/documentId) but the `feature` value is wrong.

### U2-04 Inspector clarity — PASS (model/command semantics; UI-level clarity not browser-verified here)
- `setConditionalStyle` on a condition target writes an ATTACHED style source (`src.<node>.<cond>.plain`); base `localStyle` byte-identical after the edit (attack-verified).
- Deterministic source id: a second edit updates the same single source (no duplicates).
- Emptying the last declaration detaches and deletes the source (`styleSources: undefined` on the node).
- Unknown condition id refused (`ok:false`).

### U2-05 Contrasting page — LIMITED PASS (technical aspects only)
Service document compiles; service page chunk contains ZERO editor markers (`uv-canvas`/`uv-inspector`/Layers/History absent). Visual coherence/responsiveness/form accessibility in a real browser was NOT verified here — that evidence belongs to the independent EXPERIENCE review (per U2-HANDOFF verification plan step 2).

### U2-06 Studio-style composition — LIMITED PASS (technical aspects only)
Workbench fixture source declares NO interactions/actions/routes (0 occurrences; regression-tested in `design-proof.test.ts` "no workflow semantics"). Visual adaptivity/keyboard/resize was NOT verified here (EXPERIENCE review's scope).

### U2-07 Reusable tooling — PASS
`examples/ui-design-proof/src/routes/workbench/+page.svelte` imports editor capability ONLY from `@victframework/ui-editor` (EditorBridge et al.) plus local fixture/design modules; zero direct `applyUiEdit(` calls in any route; `service/+page.svelte` has no editor imports at all. Host code is thin composition (blade open/log/select/save wrappers).

### U2-08 Performance/coverage — PASS
- Measurement reproduced independently: `npx tsx test/measure-u2.ts` from `examples/ui-design-proof` → same-process, 30 iterations; p95 compile 27.26 ms (budget 250), edit 18.18 ms (budget 100), reopen 6.23 ms (budget 1000) — all within budget; consistent with `docs/ui-foundation/U2-PERFORMANCE.json` (20.93/13.89/4.85) within normal variance; provenance counts (4 repeat source occurrences, 80 definition occurrences) identical.
- Bundle separation verified on a fresh production build: service page chunk (`nodes/2.CCknQHkT.js`) contains no editor markers; ALL editor markers (`uv-canvas` ×3, `uv-inspector`, Layers, History) confined to the workbench chunk (`nodes/4.eccE0wfV.js`).
- Coverage matrix honesty: the U2-COVERAGE claims I could falsify are accurate EXCEPT the pseudo-state row (F1 above).

## Gates

| Gate | Expected | Result |
| --- | --- | --- |
| `npx vitest run --project unit` | 2497 | First pass: 2493 + 4 flakes (`scripts/test/release-authority.test.mjs`, real-git child-process class). Re-run of that file: 65/65 PASS → effective 2497/2497. Matches disclosed flake class. |
| `npx vitest run --project renderer` | 112 | 112/112 PASS ✓ |
| `npx vitest run --project integration` | 4 | **Suite RED**: `examples/ui-design-proof/test/design-proof.test.ts` fails to COLLECT — the integration project has no Svelte plugin, so importing `packages/ui-editor/src/EditorCanvas.svelte` throws an import-analysis error. The other suite's 4 tests pass. See F3. |
| `npm run typecheck` | 0 | 0 errors ✓ (log clean) |
| `npm run format:check` | pass | PASS on clean re-run; one earlier FAIL was transient pollution by a concurrently-running scaffolder temp dir (`.tmp-scaffold-check-*`, since deleted). Environmental. |
| `npm run check:ui` | 0 errors, 2 warnings | 0 errors, 2 known a11y warnings ✓ |
| `examples/ui-authoring-proof`: vitest + tsc | 33 / 0 | 33/33 PASS; `tsc --noEmit` 0 errors — the carried `compileUiDocument` unbound reference at `store.ts` is fixed ✓ |
| `examples/ui-design-proof`: vitest + typecheck + build | 12 / 0 / clean | 12/12 PASS; typecheck 0; build clean ✓ |

## NEW findings

| # | Severity | Finding | User effect |
| --- | --- | --- | --- |
| F1 | **BLOCKER** | Pseudo-state (hover/focus/active/disabled) style sources emit unmatchable CSS (`${selector}:${gating.pseudo}` template never interpolated; `rule.pseudo` ignored by the renderer). Evidence: `attacks/pseudo-css.test.ts` (failing), `packages/ui/src/compile.ts`, `packages/ui-svelte/src/document/logic.ts`. | Any author-authored hover/focus styling — offered by the Inspector TARGET selector — silently does nothing. Violates U2-03's "pseudo states supported" claim and the no-silent-substitution rule. |
| F2 | Minor | `UI_DOC_UNSUPPORTED_FEATURE` message/feature contain literal `${condition.kind}` placeholders (un-interpolated template strings in `compile.ts`). | Diagnostics look malformed to hosts/users; `feature` value unusable for programmatic matching. |
| F3 | Major | Root integration project is RED: `examples/ui-design-proof/test/design-proof.test.ts` cannot be collected (no Svelte toolchain in that project). The claimed gate "integration (4)" hides a failing suite. | CI/gate runs exit non-zero; the collection failure masks the design-proof integration coverage in the root run. |
| F4 | Note (environmental, matches disclosure) | Pass-1 unit flakes (4, `release-authority.test.mjs`) pass on re-run; transient `format:check` failure from concurrent scaffolder temp dir. | None after re-run. |

## U1 preservation (regression)
- `git diff cb85393..HEAD` under `packages/ui/test`: ONLY the additive `components-u2.test.ts` (+303). U1 suites (guarded two-phase save, save-window ownership, session.save truthfulness, history identity, reopen) are unmodified and pass inside the green unit project.
- `packages/ui-svelte/test/document-renderer.test.ts`: additive U2 duplicate-key test only.
- `examples/ui-authoring-proof/test/authoring-persistence.test.ts` changes are type-cast hygiene only — no semantic contract change.
- Authoring proof 33/33 + tsc 0 (localStorage store/classifyStored persistence suites green).
- Renderer project 112/112 green (DocumentHost/preview surfaces).

## NOT covered (within the 35-minute cap)
- Real-browser interaction walkthroughs at 1440×900/1024×768/390×844/480px — explicitly reserved for the independent EXPERIENCE review; nothing here attests visual coherence (U2-05/06 experience criteria), Inspector UI clarity in use (U2-04 UI-level), or workbench ergonomics.
- Mounted `DocumentHost` DOM rendering of repeat records/portal placeholders (verified via exported renderer functions, source inspection, and renderer-project suites — not a live mounted render by this verifier).
- Live browser check of the owner's demo server (5199) / dev server (5333); both untouched, per instructions.
- Re-execution of preview-fencing/registry-snapshot U1 behaviors as standalone attacks (covered indirectly via untouched U1 suites in the green unit/renderer projects).
- Performance variance beyond two fresh measurement runs; no cross-machine comparison.

## FINAL VERDICT

**U2-TECHNICAL GATE: FAIL**

Reasons:
1. **F1 (BLOCKER)** — a feature U2-03 is required to support and U2-COVERAGE declares supported (pseudo states) is silently inert end-to-end (model → plan → CSS). Reproduced by an independent failing attack at the pinned SHA.
2. **F3 (Major)** — the claimed root integration gate is not green; the design-proof integration suite cannot even be collected by the integration project.

Everything else attacked (U2-01, U2-02, U2-04 command semantics, U2-07, U2-08 measurement + bundle separation, U1 preservation, remaining gates) held under adversarial verification. Repairs must address F1 and F3 (and ideally F2), followed by an independent recheck of affected behavior plus the preservation regressions.
