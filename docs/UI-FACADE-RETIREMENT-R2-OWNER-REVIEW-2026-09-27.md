# UI facade-retirement candidate — owner-review preparation record (r2, 2026-09-27)

Branch `pi/ui-facade-retirement-r2`, isolated, based on the
facade-retirement candidate `pi/ui-facade-retirement-r1` @
`bac9c01640d1aa4e6d1ee040969fae3d63136853` (itself based on the verified
authoring-tools tip `bd8f580f…`). This branch prepares the r1 candidate
for FINAL owner review. Nothing is merged, nothing is published, the
frozen trusted-publishing contract file is untouched (the §16 amendment
remains an unratified DRAFT), the frozen Stage 8 proof is untouched, G3
remains HELD — stop for owner review.

## 1. Facade-retirement audit — no concrete regression found

Audited on top of r1, with fixes where the audit found real gaps (§2, §3):

- **Facade removal**: `packages/renderer-svelte` absent from the
  workspace; `package-lock.json` carries 0 references; no alias or
  resolution override remains in root `package.json`/`tsconfig.json`/
  `vitest.config.ts`/`eslint.config.js`. Remaining `renderer-svelte`
  strings in the tree are exactly the r1-recorded deliberate history:
  the synthetic control-plane fixture string (`control-conformance.ts` —
  no import/dependency), demo seed transcripts in ui-showcase (narrative
  inside the demo data), the evidence ladder's BOUND 13-member historical
  set, negative assertions in release tests, and comments.
- **Direct `ui-svelte` imports**: all live consumers import
  `@victframework/ui-svelte` (reference app source/tests/manifest,
  showcase manifest, scaffolder templates, root configs); the style path
  is `@victframework/ui-svelte/styles.css` everywhere (0 `theme.css`
  references in live code/templates).
- **Scaffold output** (audited twice: workspace scaffolder AND the packed
  `0.4.0-rc.1` scaffolder in the external proof): 16 files; generated
  host imports `ui-svelte` directly (`VitApp`, `ActionResult`,
  `styles.css`, server renderer imports); 0 facade references;
  `REQUIRED_PLATFORM_PACKAGES` includes `ui-svelte` and the scaffolder
  refuses a set without it.
- **14-package dependency order**: `verify:release-set` machine-validates
  the frozen order as a topological linearization of the ACTUAL manifests
  — passes on the final tree (14 members, one deletion vs §15, no
  reordering).
- **Consumer migration**: reference-app 66/66 and showcase 44/44 suites
  green on the migrated imports (including the real-browser coding-agent
  proof); the packed-consumer gate proves the full former-facade public
  surface (18 values + 8 types) exists directly on installed `ui-svelte`
  with the frozen identity `renderer.svelte-kit@5.0.0`, and proves the
  retired facade absent from the installed consumer tree.

## 2. Inherited root typecheck/lint/format — RESOLVED (root-cause fixes; no check weakened)

All findings inherited from the authoring-tools tip (recorded as
"pre-existing, zero delta" on r1) are now closed. No eslint-disable, no
ts-ignore, no config relaxation; every fix is in the offending test/
fixture/script.

Typecheck (11 error lines → 0):

| Location | Cause | Fix |
| --- | --- | --- |
| `packages/application/test/authoring-examples.test.ts` 95 | `noUncheckedIndexedAccess`: `screens[0]` possibly undefined | explicit `?.` + guard throw |
| same file 114 (×2) | `result.issues` on the `CompileApplicationResult` union after a non-narrowing `expect` | `if (result.ok) throw` narrowing guard (runtime-strengthening) |
| `packages/application/test/vocabulary.test.ts` 108 | intentionally-invalid input (`role: 'nope'`) written as a typed literal | invalid definition built as `Record<string, unknown>` + cast at the compiler boundary (the compiler is the authority that rejects it at runtime); same narrowing guard for `issues` |
| `packages/cli/test/bin.test.ts` 43 | caught spawn error typed without `stdout` | `stdout: string` added to the caught shape + `if (!failed) throw` guard replacing the post-hoc cast |
| `packages/cli/test/fixtures/check/broken.ts` 17–18 | intentionally-broken `vict check` fixture written as a typed `defineApplication` literal (`colour`, `gauge`) | invalid surfaces injected as an untyped patch over an otherwise well-typed definition; identical runtime diagnostics (exit 4, both issue codes asserted by the suite) |
| `packages/ui-svelte/test/action-transition.test.ts` 157 | `.value` on `Element` | cast to `HTMLInputElement \| null` |
| `packages/ui-svelte/test/fixtures.ts` 147/153 | `extra?.components` typed `readonly unknown[]` feeding `ComponentReference[]` | parameter typed `readonly ComponentReference[]` (type imported from `@victframework/sdk`) |

Lint (3 errors → 0):

| Location | Cause | Fix |
| --- | --- | --- |
| `packages/ui-svelte/test/composition-feedback.test.ts` 246 | destructured `feedback` unused | renamed to `_feedback` (allowed pattern; the strip behavior unchanged) |
| `scripts/verify-ui-composition.mjs` 1 | `Event` declared in the `/* global */` comment — already a built-in global | dropped from the comment (usages unchanged, still linted) |
| `scripts/verify-ui-composition.mjs` 65 | `focused` helper defined, never used | dead helper removed |

Format (23 tracked files → 0): `prettier --write` over exactly the
23 drifted tracked files (line-joining and wrapping only; the spot-checked
source diffs contain no semantic change). The 24th flagged file was
untracked working-tree session junk never part of the commit or CI;
it was parked outside the tree during gate runs and restored after
(recorded environment-hygiene deviation, same category as the prior
slices' screenshot-overwrite note).

`format:check`, `lint`, and `typecheck` now all EXIT 0 on the final tree.

## 3. New coherent candidate version: `0.4.0-rc.1`

**Registry discovery (audit finding):** live registry reads on
2026-09-27 show stable `0.3.1` IS published and `latest` on all 13
historical members (publish time `2026-09-22T04:53:06.374Z`; also
`0.3.1-rc.2`; snapshot in the external proof's
`published-registry-snapshot.txt`). `@victframework/ui` and
`@victframework/ui-svelte` have NO registry presence (404). Therefore
the r1 prepared 14-member record at `0.3.1` (contentId `v1_e31858f1…`)
was already un-publishable when filed — 13 members have that version and
§6 forbids any re-publish; a coordinated set needs ONE coherent version
across all 14. The r1 record's caveat ("13 members of the `0.3.1`
version line are already published") pointed here; this branch executes
the required correction and records the full evidence.

**Selection per the frozen rules:** `0.4.0-rc.1`.

- NEW version (unpublished for every member) — satisfies §6
  immutability; the `0.3.1` line is closed.
- Minor step in the repository's 0.x convention: the candidate differs
  from the published `0.3.1` stable line by two added members (`ui`,
  `ui-svelte`) and one retired member (`renderer-svelte`), plus the
  P1–P5 UI foundation and authoring surface.
- Candidate-first per §7: first publication of this line would be
  `0.4.0-rc.1` under the non-latest tag `vict-0.4.0-rc`; stable `0.4.0`
  under `latest` only after independent verification.

**Consistent updates:** all 14 release manifests (version + exact
internal pins), `package-lock.json` (52 line pairs), example pins that
track the workspace version (`ui-showcase` ×5; reference-app's
`ui-svelte` pin — its `0.2.0` registry pins for older packages are
deliberate published-version fixtures and stay), the release-set
fixture in the scaffolder suite, `RELEASE-COMPATIBILITY.md` §2 record
+ provenance + §3 + §5 + intro entry, the §16 draft identity/points,
the builder-kit stable layer, and the external proof.

**Release-set identity RECOMPUTED** (sha256 over the sorted
`name@version` list — the version change is itself a new identity):

- identity `vict-release-set@1/0.4.0-rc.1`
- contentId `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399`
- members: the 14-package set at `0.4.0-rc.1`
- the 14-member `0.3.1` identity `v1_e31858f1…` is recorded as
  superseded-unpublished and is NOT presented as this candidate's
  identity (also pinned by a regression coupling in
  `scripts/test/release-evidence.test.mjs`).

`verify:release-set`: ALL CHECKS PASSED — 14 packages, `0.4.0-rc.1`,
`v1_2a70a29a…` (fail-closed derivation unchanged; frozen order still
topologically valid).

## 4. §16 amendment draft — reconciled; frozen contract change PREPARED, UNRATIFIED

- The consolidated §16 DRAFT is reconciled with the final version and
  graph: point 3 records the FINAL identity `v1_2a70a29a…` at
  `0.4.0-rc.1` and explicitly demotes the r1 `0.3.1` identity to
  superseded-unpublished; new point 3a records the version selection and
  the registry evidence; the implementation-status section lists this
  branch's consuming changes.
- **Appendix A** now contains the EXACT frozen-contract substitution
  text: upon ratification, replace §5's heading and body (through the
  order fence, before `## 6.`) verbatim with the 14-member inventory and
  order text — nothing else in the frozen file changes, the §14 record
  stays as history, and the version stays out of the contract text (§6
  validates it per release).
- The draft remains UNRATIFIED; `docs/RELEASE-TRUSTED-PUBLISHING-CONTRACT.md`
  is byte-untouched on this branch; release-set verification against the
  frozen text stays intentionally red (fail-closed) until ratification.
  No publication, no dist-tag change, no deprecation.

## 5. Builder-kit stable layer — regenerated on the final tree

Per the freshness rule (workspace-map content changed):
`a4e5668a…` → `3b1f40d5dbeaa755d2156808809b1490cc73603b7a425e6cfa9256f8da551440`
(deterministic: second generation identical). Recorded in
`docs/BUILDER-KIT-REGEN-UI-FACADE-RETIREMENT-R2-2026-09-27.md`. An
intermediate `0f6eeb76…` over a pre-final §2 draft was caught by the
freshness gate's regenerate-compare (content-drift FAIL → regenerate →
PASS): the fail-closed rule working as designed. `verify:builder-kit`
18/18 on the final tree.

## 6. Gate matrix on the final tree

| Gate | Outcome |
| --- | --- |
| Full build (14 packages) | EXIT 0 |
| Root vitest (all projects) | **2651 passed \| 3 skipped (2654) — EXIT 0** |
| typecheck / lint / format:check | **0 / 0 / 0 — all EXIT 0** (inherited findings resolved, §2) |
| `check:ui` (svelte-check) | 0 errors, 0 warnings |
| Reference-app suite | 66/66, 6 files — EXIT 0 |
| ui-showcase suite (incl. coding-agent real-browser proof) | 44/44, 8 files — EXIT 0 |
| `test:foundation` | 10 browser checks — EXIT 0 |
| `test:composition` | 18 browser groups — EXIT 0 |
| `test:catalog` | 46 catalog browser checks — EXIT 0 |
| Scaffolder suite (re-run after fixture version bump) | 19/19 |
| CLI + release-script tests (incl. new identity coupling) | 170/170 |
| `verify:release-set` | ALL — 14 packages, 0.4.0-rc.1, `v1_2a70a29a…` |
| `verify:release-consumer` (14 tarballs → isolated install → strict typecheck → renderer composition → former-facade surface completeness → facade absence) | ALL CHECKS PASSED |
| `verify:stage5` (packed scaffolder → isolated host build → emitted-compiler negative probes) | ALL CHECKS PASSED |
| `verify:builder-kit` | ALL (18 checks), final packId `3b1f40d5…` |

Environment notes: browser suites rewrite committed `qa-artifacts`
screenshots; restored to the committed state after the runs (recorded
hygiene deviation). A stale preview server from a prior session was
found occupying the proof port and was killed before the external proof.

## 7. External-consumer proof (TaskLedger, packed tarballs only)

Directory `C:\Users\RZ1\Desktop\RZ\vict-02-ui-facade-retirement-r2-proof-20260927`
(README + `evidence-summary.json` inside; methodology and authoring
byte-identical to the four prior proofs). Highlights:

- **10 unpublished candidate tarballs at `0.4.0-rc.1`** (SHA-256
  recorded; no facade tarball); scaffold via the PACKED scaffolder
  through an isolated pack-consumer: 16 files, direct `ui-svelte`
  imports (`VitApp`/`ActionResult`/`styles.css`/server renderer), **0
  facade references**, 0 `theme.css` references.
- **Host integrity: 14/14 immutable host files byte-identical** after
  identical authoring; only author-owned `definition.ts`/`registry.ts`
  edited and presentational `PriorityBadge.svelte` added — **the badge
  remains the only custom Svelte product component**; 0 unexpected
  changes.
- **Generated host has NO façade dependency**: built and served from the
  10 tarballs alone (adapter-node build clean; consumer tree contains 10
  `@victframework/*` packages, no `renderer-svelte` anywhere).
- **Governed actions and validation hold**: 12 tasks created through the
  declared form; declared-sort pagination 12/12 zero-overlap; server
  search "ra"→Bravo; user-sort pagination; governed row Complete with
  declared feedback "The task was completed." and live dashboard
  count/chart refresh (12→11 laptop, 11→10 phone on an open row, chart
  09-28 qty 1→2); re-Complete of a done row does not double-count;
  badge palettes 3 distinct computed palettes; negative probes ALL
  refused BEFORE any run (`UNKNOWN_ACTION`/`UNSUPPORTED_ACTION`/
  `CONTRACT_REJECTED` ×3/`INVALID_REQUEST`) with the durable ledger
  content-identical across the battery.
- **Restart persistence**: full server kill + restart → 12 rows and the
  ledger (4 runs / 16 events / 1 activation) byte-identical; post-
  restart flow live at both viewports.
- **`applicationVersion v1_e42187a7…` identical to ALL prior proofs** —
  the renderer contract did not move.
- **Published `0.3.1` untouched**: read-only registry snapshot —
  `latest = 0.3.1` on all 13 historical members (incl.
  `renderer-svelte@0.3.1`), `time.modified` still 2026-09-22,
  `ui`/`ui-svelte` 404. This branch published nothing.

## 8. Remaining limitations / owner-review items

- The §16 amendment remains a DRAFT; until ratified, the frozen contract
  §5 (15 members) and the tooling (14 members) disagree BY DESIGN and
  any release action fails closed. Ratification requires the owner
  decision below; then Appendix A applies verbatim.
- The evidence ladder stays BOUND to the historical 13-member `0.3.1`
  candidate (`scripts/lib/evidence-rules.mjs`, untouched) — historical
  evidence verifies against its own recorded set.
- `docs/UI-FACADE-RETIREMENT-2026-09-27.md` (r1 record) and its §7
  limitation list are preserved byte-identical as filed; this r2 record
  supersedes its open items (typecheck/lint/format now resolved; version
  now selected). Its statement "latest remains 0.3.0 and stable 0.3.1 is
  NOT published" was a stale registry description when filed; today's
  registry truth is recorded in §3 above and in the proof snapshot.
- The generated host's `npm test` exits 1 ("No test files found") on the
  pristine scaffold — identical to all prior proofs; host tests are an
  authoring decision, not a gate.
- `docs/VICT-SYSTEM-REFERENCE.md` current-truth rows still describe the
  Stage 5 renderer under its historical package name; a reference
  update with its own version bump can follow ratification (unchanged
  from r1).
- G3 remains HELD; nothing here is marked Verified; no merge to `main`;
  no publication; no deprecation; no Stage 8 amendment.
