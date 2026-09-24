# VICT Stage 8 — G1 Checkpoint Report (Builder Kit, WP-1–WP-5)

> **Document type:** implementer checkpoint report — a claim record, NOT
> independently authoritative. Per the ratified contract, nothing in this
> document assigns a Verified status: **Stage 8 is NOT Verified.** That
> requires the proofs (P1/P2, gates G2/G3), the independent audit
> (§27.3), and owner closure. This report is distinct from the final
> implementation report (`VICT-STAGE-08-IMPLEMENTATION-REPORT.md`, WP-8,
> not yet written) and from the audit record. Existing historical files
> under `docs/report/` are untouched; this is a NEW file.
>
> **Checkpoint:** gate G1 (handoff: "WP-1–WP-5 complete; full ladder green
> including `verify:builder-kit`; implementer report filed"). **Explicit
> stop point: after this report.** No proof was started or executed; P1
> and P2 have NOT run. No release publication, no production activation,
> no Quellight change, no Stage 9 work.

---

## 1. Session and repository identity

| Item | Value |
| --- | --- |
| Repository | `C:/Users/RZ1/Desktop/RZ/260831-VCT-02`, branch `main` |
| Starting point | G0 ratification commit `c4f37d9efd1e2804f3234319bb6b839b1633e952` (verified == `origin/main` before any change; fetch clean) |
| Frozen contract verified at start | `docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md` working-tree **and** committed-object SHA-256 = `ba3fde1b51e9b24b6b9dcef393593fe9fb3e7dc476c87fafd7d6a4fc1ed4c57a` (matches the digest pinned in the handoff) |
| Architecture digest after G1 | unchanged: `ba3fde1b…4c57a` (the frozen contract was NOT modified) |
| Quellight repository | untouched (never read or written during G1) |
| `.pi/` | never read or written |
| Environment | Windows (MINGW64/git-bash), Node v22.13.1, npm 10.9.2 |

## 2. Implementation commits

| Commit | Content |
| --- | --- |
| `f2fab6148ad44b9015c63ac4d5134925a92ce3a5` | WP-1–WP-4: the `@victframework/builder-kit` package, VICT self-hosting wiring (committed stable layer + two npm script entries), permission profiles, the `verify:builder-kit` gate with permanent negative controls, and 47 package tests. 54 files changed, +7645/−30. Includes the regenerated stable layer in the SAME commit set as the new workspace manifest (BLD-011 discipline demonstrated by construction). |
| `ada71ba52922e249a969c4911f09814d39ec964b` | Ladder repair (finding F-2, §8): pre-existing `verify:stage6a` failure fixed by deriving the expected neutral-pin version from the recorded release-set identity. One file changed. Proven pre-existing: `git show c4f37d9:packages/mastra/package.json` already pins the four neutral packages at `0.3.1` while the verifier demanded `0.2.0` — the failure exists at the G0 baseline and predates all G1 work. |

Changed files (implementation commit): `packages/builder-kit/**` (source,
schemas, data, tests, README, bin shim, tsconfig, package.json),
`scripts/verify-builder-kit.mjs` (new), `BUILDER-KIT.md` (generated),
`docs/builder-kit/context-pack.json`, `docs/builder-kit/PACK.md`,
`docs/builder-kit/capability-catalog.json` (generated), root
`package.json` (exactly two script entries added: `kit:generate`,
`verify:builder-kit` — every existing script untouched),
`package-lock.json` (mechanical workspace update), `.gitignore`
(`.builder-kit/` — task packs and denial records are gitignored per
architecture §3.3), and `scripts/lib/release-set.mjs` (finding F-1, §8).

## 3. What was implemented (WP-1–WP-4)

Classification: `implemented` = code exists in the committed tree with
permanent automated evidence; `exercised` = executed during G1 with
observed output; `not-done` = explicitly out of G1 scope.

| Area | Status | Evidence |
| --- | --- | --- |
| Schema constants + closed-vocabulary validators for all eight `vict.builder.*@1` documents; JSON Schema (draft 2020-12) documents shipped from the package | implemented | `packages/builder-kit/src/validate/*`, `schemas/*.schema.json`; rejection tests in `test/validators.test.ts` |
| Canonical JSON serialization (key-sorted, insertion-order-independent, byte-stable, Prettier-parity) and the identity rule `packId = SHA-256(canonical bytes with packId omitted)` | implemented | `src/canonical.ts`; determinism/order/prettier-parity/identity tests in `test/canonical.test.ts` |
| Deterministic base-pack generator with content-addressed provenance `{path, contentSha256}`; no timestamp, no random data, no host paths, no carrying-commit SHA anywhere in the output | implemented | `src/generate/context-pack.ts`; byte-stability and volatile-data tests |
| Capability catalog `vict.builder.catalog@1` from the real `@victframework/sdk` authoring ABI: isolated credential-free child process imports first-party pack modules and serializes frozen declarative manifests; handlers never invoked; per-capability `summary: null` recorded explicitly (no description exists in the manifest closed vocabulary; none invented) | implemented | `src/catalog/generate.ts`; committed catalog covers `vict.example.ledger` (2 capabilities) and `vict.example.notes` (2 capabilities) with the full write-path metadata (idempotency/retry/ambiguity/permissions/configuration/secrets) |
| Static TypeScript-compiler completeness scan (parsing only) of first-party pack/package sources; fail-closed `catalog-unresolved` on any unresolvable declaration; `catalog-drift` / `catalog-dangling` classes | implemented | `src/catalog/static-scan.ts`; gate checks + fixture tests (computed capability entry → RED `catalog-unresolved`) |
| On-demand task-pack generator into isolated gitignored `.builder-kit/packs/<slug>-<handoffSha8>/`; regeneration from exactly four inputs; byte-identical | implemented | `src/generate/task-pack.ts`; regeneration/identity tests |
| Typed tool manifest `vict.builder.tools@1` + profile-enforcing wrapper (`fs.read`, `fs.write` in-scope, `shell.run` by allowlisted npm-script name, `git.status/diff/log/commit`, `kit.verify/validate/generate`); denial records persisted as structured events; escalation-shaped attempts classified as stop conditions | implemented | `src/runtime/wrapper.ts`, `data/tools.json`; refusal/escalation tests |
| Permission profiles `builder.read`, `builder.change`, `builder.selfhost` as default-deny `vict.builder.profile@1` data with the architecture §3.7 named denials | implemented | `data/profiles.json`; validated by the gate and tests |
| `verify:builder-kit` gate: regenerate-and-compare both layers, identity recomputation with the §3.3 exclusions, catalog recomputation + static completeness + dangling detection, schema validation, release/workspace/reference identity, tool+profile digests, canary hygiene, unconditional rendering comparison, baseline comparison (committed/renamed/untracked through the ignore manifest) | implemented | `src/verify/*`, `scripts/verify-builder-kit.mjs`; 18 checks, all green on the committed tree; full drift-class battery in `test/fixture-gate.test.ts` |
| CLI `generate`, `catalog`, `verify`, `validate`, `run`, `task-pack`, `init-app` | implemented | `src/cli.ts`; `generate`/`catalog`/`verify`/`task-pack` exercised during G1 (observed output in this report); `validate`/`run`/`init-app` covered by package tests |
| **Control-tool bindings (`control.validate/propose/simulate/inspect/activateDev`)** | **omitted — recorded truthfully** | WP-3 permits omission "if they add risk". Binding the live `@victframework/cli` control surface would add coupling and risk without being needed by any G1 outcome. The omission is declared in `data/tools.json` (`absent[]`), every `control.*` attempt through the wrapper is refused as `tool-absent` with the reason recorded, and no profile grants control authority. |
| External-app bootstrap for P2 (`init-app`) | implemented (command + test) | P2 itself is out of G1 scope; not exercised against a real consumer install |
| MCP adapter | not-done (explicitly optional; API-004) | architecture §3.10: the protocol is complete without MCP |

## 4. Committed stable layer (WP-2) — validated result data

Observed from the committed artifacts (regeneration is idempotent: a
second `npm run kit:generate` produces byte-identical files, packId
unchanged — observed twice during G1):

| Item | Observed value |
| --- | --- |
| Base pack packId | `bdb2d50a9a8382f488c7c1ab9251a465b4d35028778ab6f46858545777d604ea` |
| Reference truth recorded | `0.4.32` |
| Release truth recorded | `vict-release-set@1/0.3.1` |
| Recorded inputs | 24 (reference, release compatibility, catalog, root manifest, 21 workspace member manifests) |
| Constitution excerpts | 19 (§2 principles, §21.1 controls, §21.2 trust facts, 16 requirement rows: GOV-002/004/005/007, AGNT-003/004/006/007/008, SEC-002/003, TEST-001/002/004/005/007) |
| Repository map entries | 20 workspace members |
| Verified-baseline pointer | reference §24.1, full-section digest + current-truth extract ("Stage 07 — the Minimum Workable Quellight — is FORMALLY CLOSED …") |
| Capability catalog | 2 packs, 4 capabilities (`ledger.audit@1`, `ledger.apply@1`, `notes.format@1`, `notes.stats@1`), each with `summary: null` recorded explicitly |
| Generated files | `BUILDER-KIT.md` (2890 bytes), `docs/builder-kit/context-pack.json` (24366 bytes), `docs/builder-kit/PACK.md` (8543 bytes), `docs/builder-kit/capability-catalog.json` (5395 bytes) |

## 5. Full G1 verification ladder — OBSERVED exit codes

The ladder was run three times. Runs are reported honestly:

- **Run #1** (at `f2fab61^` working state): `npm test` FAILED (exit 1) —
  5 failures in 2 files: (a) the existing `scripts/test/trusted-publishing.test.mjs`
  inventory test saw the new 14th package (finding F-1, repaired), and
  (b) four kit fixture tests exceeded vitest's 5 s default timeout under
  full-suite parallel load (my tests; explicit 120 s timeouts added).
- **Run #2** (at `f2fab61`): everything green except `verify:stage6a`
  (exit 1) — **pre-existing**, proven at the G0 baseline (finding F-2,
  repaired at `ada71ba`).
- **Run #3** (at `ada71ba`, the committed tree): **all 13 ladder commands
  exit 0** — the table below. The ladder was executed in the exact order
  of architecture §3.9 with the new gate appended; no existing gate was
  weakened, reordered, or bypassed.

| # | Command | Observed exit code |
| --- | --- | --- |
| 1 | `npm run format:check` | 0 |
| 2 | `npm run lint` | 0 |
| 3 | `npm run typecheck` | 0 |
| 4 | `npm test` | 0 — OBSERVED: 131 test files passed, 1 skipped (132 total); 2455 tests passed, 3 skipped (2458 total); includes 47 `packages/builder-kit` tests |
| 5 | `npm run build` | 0 |
| 6 | `npm run build -w @victframework/builder-kit` | 0 (additional recorded command, not a ladder replacement: package discipline — declarations emitted to `dist/`) |
| 7 | `npm run verify:stage5` | 0 |
| 8 | `npm run verify:stage6a` | 0 (after the F-2 repair; failed exit 1 in run #2 with the pre-existing defect) |
| 9 | `npm run verify:stage6b` | 0 |
| 10 | `npm run verify:stage7a` | 0 |
| 11 | `npm run verify:release-set` | 0 — OBSERVED: "ALL CHECKS PASSED — 13 packages, 0.3.1, v1_1c695280d3afec5…" |
| 12 | `npm run verify:clean-clone` | 0 (fresh clone → `npm ci` → typecheck → build → `verify:stage6b`) |
| 13 | `npm run verify:builder-kit` | 0 — OBSERVED: ALL CHECKS PASSED (18 checks) |

The `verify:builder-kit` check list (observed, all `ok`): schema:context-pack,
schema:catalog, schema:tools, schema:profiles ×3, identity:base-pack
("packId matches canonical bytes with packId omitted (and differs from the
including-packId hash)"), catalog:static-resolvable (4 declarations),
catalog:regenerate-compare, canary:catalog, catalog:completeness,
catalog:dangling, pack:regenerate-compare, canary:base-pack,
pack:renderings, identity:release-set, identity:workspace (20 manifests),
identity:reference-version (v0.4.32), identity:tools-profiles,
baseline:comparison (no task pack present — not applicable on this tree;
task-pack baseline classes are exercised by the permanent fixture tests
and the task-pack CLI was exercised in tests).

## 6. Negative-control evidence (permanent automated controls)

All negative controls live as permanent vitest tests in
`packages/builder-kit/test/` (47 tests, all passing). Observed outcomes:

| Handoff control | Observable outcome (observed in G1) |
| --- | --- |
| #1 Pack determinism + identity | two generations byte-identical; input-order permutation changes no bytes; Prettier-parity asserted byte-for-byte; `packId` recomputed over canonical bytes with `packId` omitted matches; the hash over bytes INCLUDING `packId` provably differs (exclusion enforced); a flipped committed byte → `pack-tamper` RED |
| #2 Freshness classes | each architecture §4.3 class simulated on a fixture repository and observed RED with the stable reason: `content-drift` (edited recorded input), `catalog-drift` (capability added without regeneration; also catalog byte-inequality), `catalog-dangling` (contract reference severed), `release-identity-drift` (changed release constant), `workspace-identity-drift` (changed root manifest), `pack-tamper` (flipped pack byte), `unregistered-input` (deleted recorded input), `baseline-escape` (§ below). **Negative-of-the-negative:** an unrelated commit changing no recorded input stays GREEN with byte-identical pack (head movement alone is NOT drift) |
| #2b Fail-closed catalog completeness | a computed capability entry (`` id: `fx.${'read'}` ``) → static enumerator resolves nothing and reports `catalog-unresolved` RED — never a silent omission; credential canaries planted for generation appear in NO catalog or pack byte; parent-process handler invocation counter stays 0 through generation; a module that pollutes the child's stdout protocol → generation FAILS closed (`CatalogGenerationError`); SDK ABI untouched (no SDK source change in the diff) |
| #3 Schema rejection | malformed documents rejected with structured diagnostics across all eight schema families; unknown fields rejected (closed vocabulary); invented capability summaries rejected (`INVENTED_SUMMARY`); result documents without integer exit codes rejected; invalid audit dispositions rejected; diagnostics are non-echoing (asserted: a planted secret-looking value never appears in any issue message) |
| #4 Profile enforcement | `fs.write` outside the in-scope set → refused (`out-of-scope-write`) + recorded; `shell.run` with an unlisted script → refused (`unlisted-script`); `git.push` → not available (`tool-absent`; absent from every profile by construction) |
| #5 Escalation shapes | publish-shaped script → `escalation:publish` + `stop:escalation-publish`; `control.activate` → `stop:escalation-production-activation`; `control.approve` → `stop:escalation-approval`; role-shape → `stop:escalation-role-change`; `.env`/`.pi/` read → `stop:secret-or-pi-content`; every denial persisted as a structured JSONL event with timestamp, profile, tool, class, stop condition, path, reason |
| #6 Secret canaries | deterministic canary values planted in the gate's environment for every catalog generation: absent from regenerated catalog bytes and pack bytes (two dedicated gate checks, both green; asserted in tests) |
| #7 Baseline detection (host-mediated) | versus a pinned `baseTree` through the ignore manifest: out-of-scope COMMITTED edit → `baseline-escape` … [committed]; out-of-scope RENAME → … [renamed]; out-of-scope UNTRACKED file → … [untracked]; ignore-manifest matches and in-scope changes do NOT flag baseline (a stale in-scope rendering is instead caught as `generated-artifact-drift`) |
| #8 Invalid references | catalog entries referencing a missing declaring module or a nonexistent contract revision → `catalog-dangling` RED with a structured, non-echoing diagnostic |
| #9 Existing gates intact | full existing ladder observed green (§5), unchanged and in order; `verify:release-set` still asserts the frozen 13-package set |
| #10 P2-specific controls | out of G1 scope (belong to P2/G3); not executed |

## 7. WP-5 rehearsal evidence (scratch branches, NOT merged, NOT pushed)

**Rehearsal (a) — the §4.2 knowledge loop.** Branch
`scratch/g1-rehearsal` (tip `710627b778b4b5889a1898268edcd69e2b49fda0`,
based on `ada71ba`):

1. A real third capability (`notes.wordCount@1`, read, contract
   `notes.count@1`) was declared in `packs/notes-pack/src/index.ts` with
   the catalog/pack regeneration deliberately lagging.
2. `npm run verify:builder-kit` → **exit 1**, observed:
   `FAIL catalog:regenerate-compare [catalog-drift] — regenerated catalog
   differs from the committed catalog`; `FAIL catalog:completeness
   [catalog-drift] — missing from catalog: notes.wordCount@1; absent from
   source: none`. (Detected by the static declaration scan — parsing
   only, no execution needed to catch the omission.)
3. `npm run kit:generate` (catalog → base pack → renderings regenerated;
   new packId `0d15453197fbf5a43e6bbd58a94d325f54a945a8b85913fde6362dd78b7c2ad6`)
   and the declaration + catalog + pack landed in ONE commit set.
4. `npm run verify:builder-kit` → **exit 0**, "ALL CHECKS PASSED
   (18 checks)".

**Rehearsal (b) — no input change, no churn.** Branch
`scratch/g1-rehearsal-b` (tip `b37b1d25a0f93a2976014f6fe933cf98dc02b988`,
based on `ada71ba`):

1. An unrelated maintenance commit touched only `README.md` (not a
   recorded input).
2. `npm run verify:builder-kit` → **exit 0**, "ALL CHECKS PASSED
   (18 checks)".
3. Pack churn: the committed `context-pack.json` bytes are
   **byte-identical** across the unrelated commit
   (`a61ee1dcddc61108d765546e97cab0425572b1ee24e0adadca92ccc3f110f112`
   before == after), and the working tree shows no regenerated changes —
   the gate stays green with zero pack churn, exactly as §4.3 requires
   ("head movement alone is not drift").

Both branches remain in the local repository as evidence and were NOT
merged into `main` and NOT pushed, per the handoff.

## 8. Findings and limitations

**F-1 (corrective, applied): release-set inventory derivation vs. the D-3 disposition.**
The existing `deriveReleaseInventory` (`scripts/lib/release-set.mjs`,
consumed by the trusted-publishing unit tests and the publish preflight)
read every directory under `packages/` and demanded exactly the frozen
13-member inventory with one coherent version. The kit is deliberately
NOT a release-set member (ratified D-3: publication deferred; the kit is
an integrity-recorded local artifact). Repair: the kit manifest is
`private: true` (truthful — `npm pack` still produces the local tarball,
observed during G1), and the inventory derivation skips `private`
manifests explicitly (standard npm publishability semantics), recording
the rationale in place. The frozen-set, coherence, and exact-pin checks
are unchanged: any future NON-private 14th package still fails as an
unauthorized new set identity. `verify:release-set` (the ladder gate with
its own fixed 13-package list) was never touched.

**F-2 (corrective, applied): pre-existing `verify:stage6a` failure.**
`scripts/verify-stage6a.mjs` hard-coded `'0.2.0'` as the expected mastra
package pin for the four neutral packages, while the live (and G0-baseline)
tree pins them at `0.3.1` — proven via
`git show c4f37d9:packages/mastra/package.json`. The failure therefore
predates all G1 work and was exposed by the first full-ladder run.
Repair: the expected version is now parsed from the authoritative
machine-readable release-set record (the same record
`verify:release-set` reads); the exact-pin assertion semantics are
unchanged and NOT weakened; an unparsable record fails the check
explicitly. Committed separately (`ada71ba`) for audit traceability.

**F-3 (finding, NOT repaired — recorded for the owner): stale handoff-header
lines.** The Stage 8 handoff's metadata block still carries two stale
pre-ratification lines — "**Reference:** `docs/VICT-SYSTEM-REFERENCE.md`
v0.4.28 + candidate §0.35" and "**Architecture:** … (PROPOSED;
ratification required)" — which conflict with the same document's RATIFIED
status banner (updated at G0) and with reference §0.38. The G1 status
authority is the dated G0 ratification (reference v0.4.32, §0.38) and the
frozen architecture digest `ba3fde1b…`, both verified at session start.
The handoff Markdown is not the digest-pinned artifact (only the
architecture document is), but G1's authorized file scope does not
include handoff edits, so the stale lines were left untouched and are
recorded here. Owner may direct a future documentation-only correction.

**L-1 (limitation, truthful): control-tool bindings omitted** (WP-3
option) — see §3. No control authority is reachable through the kit;
profile rows still declare the intended control scope for a future
authorized binding.

**L-2 (limitation, truthful): baseline comparison on the committed tree is
"not applicable"** because no handoff has been accepted with a task pack
yet (task packs are generated at acceptance, per contract). The baseline
classes are permanently exercised by the fixture battery (§6 #7) and the
task-pack CLI by package tests.

**L-3 (limitation, truthful): kit distribution shape.** The root npm
scripts run the kit CLI from source through tsx (the established
repository tooling pattern); the package also builds to `dist/` with
declarations (observed exit 0) and packs to a tarball (`npm pack`, 88
files, observed) for the D-1′ local-artifact path. The bin shim
(`vict-builder-kit`) runs the built `dist`.

**L-4:** The kit's runtime `dependencies` are `typescript` (the parsing
scan) and `tsx` (the isolated child loader) — declared, resolved in-workspace.

## 9. Requirement claims (G1 scope only)

Classifications: `implemented` (committed code + permanent automated
evidence) | `exercised` (executed with observed output during G1) |
`not-done` (out of G1 scope).

| ID | Claim | Classification | Evidence |
| --- | --- | --- | --- |
| BLD-001 | Kit bootstrappable from repository artifacts (host-neutral `BUILDER-KIT.md`, no host-specific load-bearing config) | implemented (host breadth itself is P1's proof) | `BUILDER-KIT.md`, §5 run observations |
| BLD-002 | Generated pack with per-input provenance; hand-authored pack content fails the gate | implemented | regenerate-and-compare + identity checks; §6 #1/#2 |
| BLD-003 | Fail-closed drift classes incl. head-movement-is-not-drift | implemented | §6 #2 (every class observed RED; unrelated commit GREEN) |
| BLD-004 | Handoff/result/audit schemas with observed-counts shape | implemented | validators + rejection tests |
| BLD-005 | Default-deny profiles; escalation recorded as stop conditions | implemented | §6 #4/#5 |
| BLD-006 | No production/publication/approval/secret/role authority | implemented | absent tools + escalation classifications; tools.json `absent[]` |
| BLD-007 | Product Agents receive nothing | implemented (by construction: no kit surface on any product path; no product-agent code changed) | diff scope |
| BLD-008 | Self-hosting operation on VICT itself | implemented | committed stable layer + gate green on this repository |
| BLD-009 | External-app creation support (scaffolder path) | implemented (support only; the P2 proof is G3) | `init-app` + test |
| BLD-010 | Violations prevented (wrapper) or detected (gate/audit); §5.5 classes automated | implemented | §6 |
| BLD-011 | Same-commit-set landing; no churn without input change | implemented + exercised | implementation commit bundles manifest + regenerated layer; rehearsal (a)/(b) |
| BLD-012 | MCP pure-adapter-only | not-done (nothing to enforce — no MCP surface exists) | — |
| BLD-013 | Catalog as the only capability knowledge; drift/dangling/unresolved fail verification; no hand-written capability descriptions | implemented | §6 #2/#2b/#8 |
| AGNT-001..008, GOV/SEC/TEST builder-relevant rows | exercised at kit level as cited above | exercised | §3, §5, §6 |

**Nothing is claimed Verified.** Every claim above is a commit-scoped
implementer claim subject to independent audit re-derivation.

## 10. Stop point

**G1 stop.** WP-1–WP-5 are complete; the full ladder (run #3) is green
including `verify:builder-kit`; this report is filed. Work stops here:

- P1 (WP-6) and P2 (WP-7) have NOT started — they belong to gates G2/G3
  with their own operator stop points (D-2 hosts: Codex and Claude Code;
  if either is unavailable when P1 begins, the implementer stops).
- No release publication, no production activation, no Quellight access,
  no Stage 9 work.
- Stage 8 and every BLD requirement remain **not Verified**; the next
  steps are the proofs, then the independent audit (§27.3), then owner
  closure.
- Local branch state at filing: `main` = `ada71ba52922e249a969c4911f09814d39ec964b`
  (2 commits ahead of `origin/main` at the pre-push moment; this report's
  commit follows), with unmerged local evidence branches
  `scratch/g1-rehearsal` (`710627b…`) and `scratch/g1-rehearsal-b`
  (`b37b1d2…`).

---

## Erratum (recorded at filing, 2026-09-24)

**E-1 — owner-local `.pi/` staging incident (recovered; main and origin never affected).**
During rehearsal (a), the fold-in commit used `git add -A`, which also
staged the owner-local `.pi/` directory (18 paths) into the scratch-branch
commit `710627b…` — a boundary violation by mechanism, even though `.pi/`
was never read or written by the implementer. Discovered in the final
state sweep (a clean working tree without the expected untracked `.pi/`
entry after checking out `main`). Recovery, verified: `git log main -- .pi`
is empty (main NEVER contained `.pi/`); the remote carries exactly one
branch (`main`, at `d4ec245…`), so nothing was ever pushed; the working
tree copy was restored byte-exact from `710627b`'s stored objects via
`git restore --source=… --worktree -- .pi` (paths listed as metadata only;
file contents were never read or displayed); the scratch branch tip was
rewritten to `c6ef18a0f5b9` (parent = `710627b…`, so the quoted rehearsal
SHA remains valid evidence) with `.pi/` removed from its tree. Root cause:
untracked-aware staging (`git add -A`) instead of explicit paths; the
implementation and report commits used explicit paths throughout. Lesson
applied going forward: staging must always enumerate explicit paths when
owner-local untracked material exists.
