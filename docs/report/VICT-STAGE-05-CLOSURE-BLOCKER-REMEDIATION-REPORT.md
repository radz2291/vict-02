# VICT Stage 05 — Closure-Blocker Remediation Report

## Outcome

The two identity-boundary defects that the Stage 05 independent closure audit
misclassified as Low — together with three further blockers found by direct
review of the same canonical boundary — are fixed at ONE coherent boundary.
The runtime compiler now structurally rejects every non-plain canonical input
(inherited, non-enumerable, accessor-backed, symbol-keyed, sparse, hostile),
enforces the declared bounded primitive domain for custom-component props,
preserves defensive-copy guarantees (it never freezes, mutates, or retains a
caller-owned object), and treats whitespace-only required display text as
malformed input. All fixes are pinned by permanent regression tests that were
proven (negative controls) to fail against the audited implementation
`9fa89e4` and to pass after correction. Valid `@1` and `@2` identity vectors
are byte-identical to their pre-remediation values at every boundary,
including a packed plain-JavaScript consumer.

**Stage 05 is NOT declared closed by this report.** This remediation is ready
for a focused independent closure re-audit; only that re-audit can decide
closure. Stage 06 has not begun.

## Starting and final SHAs

| Item | SHA |
| --- | --- |
| Required starting SHA (`HEAD == origin/main` after fast-forward) | `50d46feb93d44f93a7e92cce862cac85c7d8525b` |
| Audited implementation under remediation (in ancestry) | `9fa89e4177654ea04399e3191469041107be77cb` |
| Final implementation commit | (this repository, `fix(stage-05): enforce canonical application inputs`) |
| Final documentation commit | (this repository, `docs(stage-05): record canonical boundary remediation`) |
| Final remote tip | see "Commit list and push confirmation" in the completion response |

History is linear; only normal fast-forward pushes were used.

## Reproduced blockers

All blockers were reproduced at the PUBLIC emitted `@vict/application`
compiler boundary (`packages/application/dist`, plain JavaScript) at
`50d46fe` / `9fa89e4` BEFORE any code change, and re-verified after the fix.
Recorded pre-fix results (probe against the built compiler):

| Blocker | Pre-fix observation at `9fa89e4` (emitted boundary) |
| --- | --- |
| **A — executable semantics share one identity** | A prototype-inherited `local` action (`own` enumerable canonical representation `{}`) and a prototype-inherited `navigation` action BOTH compiled; with the minimal fixture their `applicationVersion` was identical (`v1_82e97ac2d18e4f232900aeb98014e10cffdbe8a539b91ee32ee845e130bf57d9` in the negative-control fixture; `v1_46723273294218ba…` with the original review fixture). Manifest action: `[{}]`; plan action: `{"act.same":{}}`. Compiled behaviors differed while identity was identical. |
| **B — malformed input produces a partial plan** | An action whose `kind`, `id`, `revision` were non-enumerable own properties compiled with `ok: true`, `manifest.actions: [{}]`, `plan.actions: {"act.hidden":{}}`, and an `applicationVersion`. Validation read the hidden members; canonicalization and plan copying omitted them. |
| **C — sparse-array identity collision** | `stableJson([, "x"])` returned `[null,"x"]` — byte-identical to `stableJson([null,"x"])`. Through the compile boundary, sparse props and an explicit-null props array produced the SAME `applicationVersion` (`v1_b9afbf6fc8b5f49488fe04aa806757379a670a0bb75bcff5d9782d311184dae0` for both). Root cause: `value.length !== new Set(value.keys()).size` can never be true because `Array.prototype.keys()` yields hole indices. |
| **D — caller-owned object mutation** | An accepted exotic (prototype-derived) action came back `Object.isFrozen(originalAction) === true` and `plan.actions["act.exotic"] === originalAction`: the compiler froze and retained a caller-owned object. Additionally `plan.toJSON()` recomputed the manifest from the LIVE caller object — a post-compile caller mutation (route `path` → `/MUTATED`) visibly leaked into `toJSON()` output. |
| **E — component-prop schema not enforced** | The public model declares `Readonly<Record<string, string | number | boolean>>`, but arrays (`v1_c05b1c63…`), nested objects (`v1_8ff9ba10…`), `undefined`-valued members (silently dropped → `{"real":"v"}`), and a `null` props container were all ACCEPTED with identity. Functions/symbols/BigInt/NaN/±Infinity/−0/Date values were rejected only incidentally at the identity stage, and accessor/inherited/sparse props containers were accepted or rejected inconsistently. |
| **AUDIT-LOW-3 (re-verified)** | `'   '` was ACCEPTED as screen `title`, region `name`, form-field `label`, text `content`, and chart `summary` (both markers). |

## Root causes

1. **No canonical-INPUT boundary — only an identity-stage canonicalization.**
   Validation read members via `[[Get]]` (so prototype/non-enumerable
   semantics were "seen"), while `canonicalApplicationManifest` and the plan
   copies enumerated own enumerable keys (so those semantics vanished).
   Two definitions could therefore differ in executable semantics yet share
   an empty canonical declaration and one identity (A, B), and
   `cloneForFreeze`'s non-plain passthrough branch let `deepFreeze` freeze a
   caller-owned exotic object (D).
2. **Ineffective sparse-array guard.** `Array.prototype.keys()` yields every
   numeric index of a holey array, so `new Set(keys()).size` always equals
   `length`; holes silently canonicalized to `null` and collided with
   explicit nulls (C).
3. **`props` was never validated.** The declared bounded primitive domain
   existed only as a TypeScript type; the runtime accepted anything that
   survived canonicalization (E).
4. **Display-string policy was length-only.** Whitespace-only required
   display text passed the `length > 0` check (AUDIT-LOW-3).

## Canonical input policy

One strict boundary at the front of `compileApplication`
(`collectCanonicalInputIssues`) walks the ENTIRE input — the application
definition and every provided resource/contract/capability/component binding
— before any semantic validation, canonical manifest construction, plan
construction, or identity hashing:

- Objects: direct prototype must be `Object.prototype` or `null`.
- Members: own, enumerable, string-keyed DATA properties only. Inherited
  semantics, non-enumerable fields, accessors (rejected by DESCRIPTOR
  inspection — never invoked), and symbol-keyed fields are rejected.
- Arrays: dense (own element at every numeric index below `length`), no
  unsupported additional enumerable properties, no non-enumerable index
  descriptors; a real `null` element is valid and distinguishable from an
  absent slot; `undefined` array elements are rejected (positional data has
  no "absent" meaning).
- Numbers: finite, negative zero excluded — anywhere in the input, not only
  along identity paths. `BigInt`, `symbol`, `function` rejected.
- Hostile input: reflection that throws (hostile/revoked proxies) fails
  closed with structured, non-echoing diagnostics; the walk never throws and
  never invokes a getter. Values and thrown messages are never echoed
  (safe type descriptions only).
- Consequence: validation, canonical manifest construction, defensive plan
  copying, and identity hashing operate over exactly the same accepted
  semantic data — no stage can read a value another stage omits or
  reinterprets.

## Identity and plan corrections

- Inherited `local`/`navigation` actions are rejected at BOTH markers;
  neither receives an `applicationVersion`; the pre-fix collision pair can
  no longer compile (pinned by permanent tests at the runtime boundary and
  through the packed consumer).
- Non-enumerable, accessor-backed, and symbol-keyed declaration data is
  rejected with deterministic, path-sorted structural diagnostics; no
  partial plan or empty canonical declaration can compile.
- Sparse-array detection is fixed in the canonicalization implementation
  itself (`canonicalize` detects holes by own-property presence), so
  `stableJson([, "x"])` throws `CanonicalIdentityError (NON_CANONICAL_VALUE)`
  while `stableJson([null, "x"])` keeps its established bytes `[null,"x"]`;
  sparse arrays nested at every accepted canonical-data location
  (`routes`, screen `layout`, region `surfaces`, `breadcrumbs`, theme
  `tokens`, form/view fields, table columns, resource `fields`, top-level
  binding collections) fail closed with no plan and no identity.
- Object insertion order still never affects identity or diagnostics;
  set-like collections still sort by id; ordered semantics still preserve
  order (existing pinned vectors unchanged).

## Component-prop boundary

`props` must be absent, or a plain own-enumerable object whose values are
exactly `string | finite number (excluding −0) | boolean` — the domain the
public model always declared. Rejected with stable structured diagnostics
(`INVALID_SURFACE_DECLARATION` for declared-domain violations, safe paths;
`APPLICATION_NON_CANONICAL_VALUE` for canonical-domain violations): `null`
container, arrays, nested objects, functions, symbols, BigInt, `undefined`,
`NaN`, `±Infinity`, negative zero, Dates, sparse arrays, inherited
properties, non-enumerable properties, accessors, exotic prototypes, and
hostile proxies. Property values are never echoed. Valid primitive props
keep their exact established canonical bytes
(`v1_0c807fad39de28a278b73ae64e182a98ca382645f21316bd73294b0fc0a336d5`,
captured pre-remediation and asserted byte-identical after).

## Defensive-copy behavior

- `cloneForFreeze` always produces fresh VICT-owned plain objects/arrays; the
  non-plain passthrough branch (which `deepFreeze` then froze in place) is
  removed.
- The plan is built entirely from captured VICT-owned copies; every capture
  is deep-frozen; the plan container is frozen.
- `plan.toJSON()` now serves the SAME captured copies instead of recomputing
  from (or re-spreading) the caller's live objects.
- Valid caller inputs remain unfrozen and unmutated; rejected exotic inputs
  remain unfrozen; plans never retain caller object references; mutating a
  caller object after compilation cannot change the plan, manifest, version,
  or `toJSON()` output (all pinned by permanent tests).
- No plan or `applicationVersion` exists when any capture fails.
- Official SDK capture semantics (`defineApplication` frozen captures) are
  unchanged and accepted: frozen plain data is valid canonical data (the
  boundary rejects only non-enumerable/accessor/symbol descriptors, never
  mere frozenness). Contract/capability function-reference rules and
  everything outside the Application Definition boundary are untouched.

## Audit-finding dispositions

| Finding | Disposition | Evidence |
| --- | --- | --- |
| Blocker A (audit LOW-2 portion) | FIXED — prototype-inherited semantics rejected structurally; collision impossible | `canonical-boundary.test.ts` (both markers, runtime + packed boundaries); negative control shows baseline collision |
| Blocker B (audit LOW-2 portion) | FIXED — non-enumerable members rejected; no partial plan | same |
| Blocker C (AUDIT-LOW-1) | FIXED — guard corrected in `canonicalize` itself + boundary walk; permanent sparse coverage at every canonical location | `stableJson` tests + nested-location tests; negative control shows baseline collision |
| Blocker D | FIXED — caller-ownership guarantees restored and pinned; `toJSON` capture leak removed | ownership tests; negative control shows baseline freeze + `/MUTATED` leak |
| Blocker E | FIXED — declared bounded primitive props domain enforced at both markers | props matrix tests; negative control shows baseline acceptance |
| AUDIT-LOW-3 | FIXED — whitespace-only required display text rejected with the SAME code as empty at each site; no schema markers changed | 20 new whitespace cases (both markers, all display members); negative control: all 20 fail at baseline |
| AUDIT-LOW-4 | CLOSED — permanent coverage added: status `value` XOR `field` (both directions), dialog/drawer required members + empty content, breadcrumb label + route references, surface-level view/form/action/component/conversation reference absence, exact codes/paths, no partial plan/version. These tests PASS at baseline (20/787) and after — permanent regression coverage of already-correct behavior, exactly as the audit recommended | `required-members.test.ts` AUDIT-LOW-4 block; negative control |
| AUDIT-INFO-1 | DOCUMENTED — `UNKNOWN_*_REFERENCE` codes for absent surface-level references are retained deliberately (enforcement structurally guaranteed; codes are more precise, not cosmetic); policy recorded in the Stage 05 architecture §2.3 | architecture doc update; no code change |
| AUDIT-INFO-2 | NO CHANGE — environmental npm 10.9.2/vitest 4.x arborist issue; honestly documented in architecture §2.4; the `verify:stage5` workaround remains scoped to the generated-host install; the plain packed-consumer install path uses default npm (exit 0, this remediation) | architecture doc; packed-consumer run |

## Files changed

| File | Purpose |
| --- | --- |
| `packages/application/src/compile.ts` | Canonical input boundary walk; `canonicalize` sparse-array fix; `cloneForFreeze` defensive-copy fix; `toJSON`/plan capture fix; component-prop domain check; display-string whitespace policy |
| `packages/application/test/canonical-boundary.test.ts` | NEW — 57 permanent tests: semantic identity (A/B/LOW-2), sparse arrays (C/LOW-1), component props (E), caller ownership (D), structural diagnostic discipline, compatibility (pinned vectors, frozen captures, JSON.parse boundary) |
| `packages/application/test/required-members.test.ts` | +40 permanent tests: AUDIT-LOW-3 whitespace matrix (20), AUDIT-LOW-4 coverage (20) |
| `docs/architecture/STAGE-05-APPLICATION-DELIVERY.md` | §2.3 whitespace policy + reference-code policy (AUDIT-INFO-1); NEW §2.4 canonical input boundary, props domain, defensive-copy behavior, AUDIT-INFO-2 note; §5 props wording |
| `docs/report/VICT-STAGE-05-CLOSURE-BLOCKER-REMEDIATION-REPORT.md` | NEW — this report |

No other file changed. No Stage 06 or Mastra dependency, code, or
documentation was added. `docs/VICT-SYSTEM-REFERENCE.md` and every prior
report are byte-identical to `50d46fe`.

## Negative-control evidence

Temporary detached worktree at `9fa89e4177654ea04399e3191469041107be77cb`
(no junctions, symlinks, or shared `node_modules`; real isolated
`npm ci --legacy-peer-deps` exit 0 + full `npm run build` exit 0; the two
new/updated test files copied in as temporary files; the worktree and its
`node_modules` fully removed afterwards, `git worktree list` back to the
single main tree).

- `canonical-boundary.test.ts` at `9fa89e4`: **40 failed / 17 passed (57)**.
  The 17 passing are compatibility-behavior tests that must pass at both
  revisions (pinned vectors, explicit-null bytes, valid minimal apps,
  absent/valid props, frozen-capture acceptance, revoked-proxy/canary
  discipline).
- `required-members.test.ts` at `9fa89e4`: **20 failed / 787 passed (807)**.
  The 20 failures are exactly the AUDIT-LOW-3 whitespace cases (baseline
  accepted whitespace-only display text); the 20 AUDIT-LOW-4 coverage tests
  PASS at baseline — proving the compiler behavior was already correct and
  the new tests are pure regression coverage; the 767 original tests pass
  unchanged.
- Direct emitted-boundary probe at `9fa89e4` (representative outputs):
  - inherited local and navigation actions: BOTH `v1_82e97ac2…` →
    `COLLISION: true`; manifest action `[{}]`; plan `{"act.same":{}}`
  - non-enumerable action: `ok=true`, manifest `[{}]`, plan
    `{"act.hidden":{}}` (partial plan)
  - `stableJson([, "x"]) == stableJson([null, "x"]) == [null,"x"]`
  - exotic action: `ok=true`, `caller frozen: true`,
    `plan retains caller object: true`
  - props array `ACCEPTED v1_c05b1c63…`; props nested-object
    `ACCEPTED v1_8ff9ba10…`; whitespace-only title `ACCEPTED`
- Post-fix, the same suite runs pass at the corrected tree (see Verification
  evidence), and the emitted-boundary probe rejects every case above.

## Compatibility and identity evidence

- Existing valid `@1` identity vector byte-identical:
  `v1_377edb54188aa02f2562d771d7eee7b55b98cb78e0ceb16573c5e4fb1753b5a0`
  (runtime suite + packed consumer).
- Existing valid `@2` identity vector byte-identical:
  `v1_145586e982dae2154371728f6331821ead7c72a5180b8797b315c179572228ec`
  (runtime suite + packed consumer).
- Canonical-manifest bytes for both markers byte-identical to the
  pre-correction strings pinned since `d346bad`.
- Auditor-constructed minimal valid applications at both markers still
  compile with stable `v1_<64 hex>` versions; valid primitive props keep
  their pre-remediation vector `v1_0c807fad…`.
- No new schema marker: `APPLICATION_IDENTITY_SCHEMA` /
  `APPLICATION_IDENTITY_SCHEMA_V2` unchanged; `vict.application@3` does not
  exist.
- All Stage 04/05 valid examples compile and behave consistently (Stage 04
  proof 17/17, reference application suites, Stage 05 verifiers — see
  Verification evidence).

## Packed-consumer evidence

`@vict/contracts`, `@vict/sdk`, `@vict/application` packed from the
corrected tree; isolated plain-JavaScript consumer created OUTSIDE the
workspace with `file:` tarball dependencies; plain `npm install` (default
npm, no `--legacy-peer-deps`) exit 0; probe runs on emitted `dist/`
JavaScript only:

- **19/19 probe assertions passed**, covering: inherited/exotic/
  non-enumerable declarations fail (no identity); sparse arrays fail
  (`stableJson` + compile boundary); invalid props fail (array, `null`
  container, nested object, NaN, Date); valid primitive props compile with
  the pinned pre-remediation vector; diagnostics structured and canary-free;
  accessor rejected WITHOUT invocation; valid `@1`/`@2` vectors unchanged.
- Isolation proven: the consumer resolves `@vict/application` from its own
  `node_modules` (no workspace hoisting) and the emitted declarations are
  complete in the tarball. No TypeScript checking involved.
- This corrects the prior audit's claim that exotic inputs are unreachable
  from a packed consumer: a JavaScript consumer CAN construct exotic objects,
  and the packed artifact now rejects every category.

## Verification evidence

| Command | Exit | Result |
| --- | --- | --- |
| `npm ci` | 0 | clean install |
| `npm run typecheck` (before build) | 0 | strict, zero errors |
| `npm run format:check` | 0 | all files formatted |
| `npm run lint` | 0 | no findings |
| `npm run build` | 0 | 9 packages emit cleanly |
| `npm run test:unit` | 0 | 55 files / 1426 tests |
| `npm run test:integration` | 0 | 1 file / 4 tests |
| `npm test` (×3 consecutive) | 0, 0, 0 | 59 files / 1475 tests each run |
| `npm run verify:consumer` | 0 | packed neutral/Zod/SQLite consumers pass |
| `npm run verify:stage2` | 0 | PASSED |
| `npm run verify:stage3` | 0 | PASSED |
| `npm run verify:stage4` | 0 | PASSED (application proof 17/17) |
| `npm run verify:stage5` | 0, 1, 0, 0, 0 | 5 executions: run 1, 3, 4, 5 — ALL checks passed (full suite 59/1475; warning-free reference build with explicit scans; reference suites 4 files / 44 tests incl. real-browser HIGH-05-A + MED-05-A regressions; packed scaffolder install→generate→install→build in isolation; packed required-member probe). Run 2 — exit 1; its output was lost to a redirection mistake in the execution harness, so the failing check could not be identified post hoc; every subsequent run with full capture passed. This matches the repo's documented LOW-05-B Stage 03-era fixture load-sensitivity carry-forward (load-dependent flake, never reproduced with captured output); recorded honestly, not rerun into passing — no sleeps added, no warnings suppressed, no assertions weakened |
| `npm run example` | 0 | ARA proof 13 ordered events |
| `npm run bench` | 0 | 10 events per completed run, re-validated from SQLite |
| `npm run example:application` | 0 | Stage 04 proof 17/17 |
| `git diff --check` | 0 | no whitespace errors |
| `git status --short` | — | only the remediation's five files (plus the pre-existing, unstaged owner deletion of the two root-level `VICT-STAGE-02-*.md` duplicates, preserved untouched) |
| canonical-boundary suite (×5 consecutive) | 0, 0, 0, 0, 0 | 57/57 each run |
| required-member suite (×3 consecutive) | 0, 0, 0 | 807/807 each run |
| reference application/browser suite (×3 consecutive) | 0, 0, 0 | 4 files / 44 tests each run |

Full-suite arithmetic (`npm test` 59 files / 1475): 55 unit files / 1426
tests + 3 renderer-project files / 45 tests + 1 integration file / 4 tests
= 1475. No sleeps added, no warnings suppressed, no assertions weakened, no
tests excluded. Node v22.13.1 (satisfies `>=22.13.0`); Node 24 and a second
OS are NOT available in this environment — not executed, not claimed.

## Remaining genuine limitations

- Node 24 and a second operating system were not available; all evidence is
  from Windows 11 / win32-x64 / Node v22.13.1.
- One `verify:stage5` execution (of five) exited 1 while its output was
  inadvertently redirected; the failure could not be attributed afterwards.
  Four fully-captured executions — including two consecutive back-to-back
  runs — passed all checks. This is consistent with the documented LOW-05-B
  Stage 03-era fixture load sensitivity (a pre-existing, non-blocking
  carry-forward that did not reproduce in any captured run of this
  remediation).
- The npm 10.9.2 arborist crash when installing `vitest` 4.x
  devDependencies remains environmental (AUDIT-INFO-2); the scoped
  `--legacy-peer-deps` workaround for the generated-host install remains
  necessary until npm/vitest versions change.
- A hostile `Proxy` whose traps throw only on specific `get` keys passes the
  structural walk (descriptor inspection cannot detect it without invoking
  the trap) and is then rejected by the existing fail-closed member-read
  conversion (`APPLICATION_COMPILATION_FAILED`) — rejected with no partial
  plan and no echo, but with the generic code. This is pre-existing,
  documented fail-closed behavior, now bounded by the structural walk
  everywhere else.
- Optional display members (e.g. `emptyMessage`, `inputPlaceholder`) remain
  optional; the whitespace rule intentionally covers REQUIRED display text
  only, as scoped by the audit finding.
- npm-audit advisories in the dev toolchain and the `node:sqlite`
  experimental warning remain pre-existing and exit-neutral.
- Screen-reader UX beyond prior automated checks remains a manual activity
  (unchanged from prior audits).

## Ready for focused independent closure re-audit?

**Yes.** Every blocker has a pinned, negative-controlled fix; identity is
provably preserved for valid definitions at every boundary; the documentation
records the new canonical-input policy; and all prior audits and owner work
are preserved byte-identical. Stage 05 canonical identity remediation is
complete and ready for focused independent closure re-audit. Stage 06 has
not begun.
