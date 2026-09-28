# Authoring-tools slice — `vict check`, machine-readable vocabulary, per-role examples (2026-09-27)

Branch `pi/ui-authoring-tools-r1` in worktree
`C:\Users\RZ1\Desktop\RZ\vict-02-authoring-tools-r1`, based on the
verified UI-convergence tip `pi/ui-convergence-r2` @
`d86e9f2b449f13a7a912cad60072c6ece07b4056` (pushed SHA verified ==
`origin` before starting). Candidate only: nothing merged to `main`,
nothing published, `renderer-svelte` facade untouched, the §15
publishing-order amendment stays a draft, the frozen Stage 8 proof is
untouched, G3 remains HELD — stop for owner review.

This slice implements the follow-up candidate recorded in
`UI-RECONCILIATION-2026-09-27.md` §7: `vict check` + per-role examples.

## 1. What was built

### `vict check <file> [--json]` — local, server-free definition check

- Compiles the author's definition with the SAME authoritative compiler
  the platform uses (`compileApplication`), then prints structured
  diagnostics with stable issue codes, safe definition paths, and —
  derived from the vocabulary — the **allowed values** where applicable
  (unknown surface role → all legal roles; unknown field → legal fields;
  bad sort direction → `asc, desc`; theme tokens; chart kinds; status
  tones; composition choices; feedback outcomes).
- Module conventions mirror the generated host exactly: named
  `application` (+ `resources`, `contracts`, `capabilities`,
  `components`), a default definition, or a default
  `{ application, resources }` input. Contracts/capabilities are reduced
  to the identity entries the compiler reads; compilation never executes
  author handlers and never touches a store.
- **Exit codes**: `0` valid · `1` usage error · `4` invalid definition ·
  `5` unexpected execution error (module load crash) — operator command
  codes (0/1/2/3) and all 26 operator commands are unchanged (real-HTTP
  suite `packages/server/test/cli.test.ts` green).
- **Stable `--json`**: `{ok, file, schema, applicationVersion,
  issueCount, issues:[{code, message, path?, allowedValues?}]}`,
  byte-stable across runs (tested).
- **TypeScript workflow (smallest practical)**: Node's built-in type
  stripping — no tsconfig, no bundler, no ts-node. On Node 22.13 the bin
  re-execs itself with `--experimental-strip-types` (documented
  ExperimentalWarning on stderr; silent from Node 23.6). **Erasable
  TypeScript only** (no enums/namespaces/decorators/parameter
  properties) — stated honestly in the help, the guide, and enforced
  with an actionable exit-5 error. `.js`/`.mjs` definitions load
  directly.

### Machine-readable vocabulary — derived, not hand-written

`vict vocabulary [--json]` / `describeApplicationVocabulary()` exposes:
schema versions; allowed fields per definition object (`@1`/`@2`);
surface roles with per-role fields; action kinds with per-kind fields;
bindings (form widgets, sort directions, component `props`/`input`
binding objects); composition choices (application/page/region/layout);
closed values (tones, chart kinds, resource field types, theme tokens,
feedback outcomes); and every diagnostic code the compiler can emit.

**No second schema exists to drift**: `APPLICATION_VOCABULARY` (compile.ts)
wraps the very constants validation consumes; the `ui` composition and
feedback validators now consume exported rule tables
(`APPLICATION_COMPOSITION_CHOICES`, `PAGE_COMPOSITION_CHOICES`,
`REGION_PRESENTATION_CHOICES`, `LAYOUT_MODES`,
`ACTION_FEEDBACK_OUTCOMES`); `sdk` gained runtime widget constants
(`FORM_FIELD_WIDGETS`, `RESOURCE_PRESENTATION_WIDGETS`) with the type
unions derived from them; `APPLICATION_ISSUE_CODES` is exhaustive by a
compile-time `satisfies` guard. Tests prove vocabulary ↔ validator
agreement in both directions.

### Per-role examples (compile-checked in CI)

`docs/authoring/examples/` — ten short standalone definitions (table
with declared sort/row action/island cell, create/edit forms with select
widgets and governed feedback, count+chart dashboard, conversation,
detail/list, component islands with context bindings, dialog/drawer
overlays, responsive regions/composition, navigation with redirect
route, states/conditions/status/tabs). A test file is present in
`packages/application/test/authoring-examples.test.ts`. The definition
guide is `docs/authoring/README.md` (workflow, exit codes, TS limits,
vocabulary facts).

## 2. Gate matrix on this branch

| Gate | Outcome |
| --- | --- |
| Root vitest (all projects, after clean full build) | **2658 passed \| 3 skipped (2661), 155 files — EXIT 0** (includes new vocabulary/check/examples suites and the unchanged real-HTTP operator CLI suite) |
| Renderer project (ui-svelte/renderer-svelte) | **EXIT 0** |
| `check:ui` | **0 errors, 0 warnings** |
| Reference-app suite | **EXIT 0** |
| ui-showcase suite (incl. coding-agent real-browser proof) | **EXIT 0** |
| `verify:builder-kit` | **ALL CHECKS PASSED (18)** after the mandated regeneration (below) |
| `verify:release-set` | **ALL CHECKS PASSED — 15 packages, 0.3.1, identity `v1_3a82c0651bb4b0d…` UNCHANGED** |
| `verify:stage5` (packed scaffolder → isolated install → build → negative probe incl. the emitted compiler rejecting invalid definitions) | **ALL CHECKS PASSED — EXIT 0** |

Environment note (unchanged from prior slices): a fresh worktree needs
`npm run build` before real-process tests; running browser suites
rewrites committed `qa-artifacts` screenshots (restored; recorded
deviation).

## 3. Package / API impact

- `@victframework/cli` **0.3.1 (candidate, unpublished)**: NEW local
  commands `check` + `vocabulary` (additive; the closed operator command
  table is untouched); NEW runtime dependency `@victframework/application`
  (the only manifest change in the workspace); bin re-exec for TS
  stripping; exports `runCheckCommand`, `runVocabularyCommand`,
  `extractCompileInput`, `isTypeScriptPath`, `VictCheckJson`,
  `VictVocabularyJson`.
- `@victframework/application`: NEW exports `APPLICATION_VOCABULARY`,
  `describeApplicationVocabulary`, `APPLICATION_ISSUE_CODES`, types
  `ApplicationVocabulary`/`VocabularyObject`; validation behavior
  unchanged (sort directions and theme field sets promoted to named
  constants consumed by the same code paths).
- `@victframework/sdk`: NEW runtime constants `FORM_FIELD_WIDGETS`,
  `RESOURCE_PRESENTATION_WIDGETS`; the `widget?` unions are now derived
  from them (identical member sets — no type-level change).
- `@victframework/ui`: NEW exported rule tables (composition/layout/
  feedback); validators consume them (behavior-identical).
- Published `0.3.1` packages on npm: untouched and not republishable
  as-is; candidate tarballs label themselves 0.3.1 but are unpublished.

## 4. Generated identity changes

- Builder-kit stable layer regenerated per the kit's freshness rule
  (BUILDER-KIT.md §2 — same procedure as the convergence slice's
  FINDING-2 closure): packId `bed2e5c2…` → `f5a691a1f27eeccc…`; the only
  content deltas are the cli manifest digest and the cli
  runtime-dependency line; capability catalog byte-identical; workspace
  map still 23 manifests; second generation byte-identical. Recorded in
  `docs/BUILDER-KIT-REGEN-AUTHORING-TOOLS-2026-09-27.md`.
- Release-set identity **unchanged** (`v1_3a82c0651bb4b0d…`) — it covers
  the published package/version/registry set; nothing was published.

## 5. External-consumer proof

`C:\Users\RZ1\Desktop\RZ\vict-02-authoring-proof-20260927` — fresh app,
ONLY the packed candidate tarballs (cli, sdk, application, ui,
contracts), no workspace aliases, no server, no vitest. Full transcript
in `invocation-transcript.txt`, summary in its README. Highlights:
valid → exit 0 with canonical `applicationVersion`; three planted
violations → exit 4 with codes, paths and allowed values; usage errors →
1; load crashes → 5; `vocabulary --json` stable; operator commands still
require endpoint/token and exit 1 without them. Package delta vs the
convergence candidate: exactly `cli`/`application`/`sdk`/`ui` changed;
the other 8 tarballs byte-identical (scaffolder byte-identical ⇒ the
proven TaskLedger scaffold bytes carry over unchanged).

## 6. Remaining limitations

- TS support is erasable-syntax-only, by design of Node's type
  stripping; non-erasable definitions must be compiled to `.js` first
  (documented, exit 5 with the Node error code otherwise).
- The ExperimentalWarning appears on stderr for TS checks on Node 22.x.
- `vict check` reports compiler diagnostics only; it does not run
  data-layer conformance, renderer resolution, or server authorization
  (those remain governed server-side runs).
- The `--json` result schema is versioned only by the package version
  (no separate negotiation endpoint); consumers pin the candidate.
- Renderer-side verification of the composition rule-table refactor was
  behavior-identical and covered by the full renderer/refapp/showcase
  gates; a fresh TaskLedger browser re-proof was NOT repeated in this
  slice (the scaffolder and generated host bytes are byte-identical to
  the convergence proof; flagged for the owner).
- G3 remains HELD; nothing here claims Verified; no merge to `main`, no
  publication, no deprecation, no rubric amendment.
