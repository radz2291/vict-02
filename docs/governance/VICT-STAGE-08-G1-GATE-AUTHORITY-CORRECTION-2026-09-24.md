# Stage 8 G1 Gate-Authority Correction — Governance Record (2026-09-24)

> **Document type:** corrective-pass evidence record, filed OUTSIDE
> `docs/report/` (companion to
> `VICT-STAGE-08-G1-CORRECTIVE-PASS-2026-09-24.md`). Claim record, NOT
> independently authoritative; nothing here assigns a Verified status.
> **Stage 8 is NOT Verified; P1/P2 have NOT started.** Owner-directed and
> owner-bounded (start `88032bce65e16b40c871a19c329fc61adcb82c5a`, verified
> == `origin/main` at start; frozen architecture committed-byte digest
> re-verified `ba3fde1b51e9b24b6b9dcef393593fe9fb3e7dc476c87fafd7d6a4fc1ed4c57a`
> unchanged; `.pi/` never read; every `scratch/*` ref excluded from
> worktrees, evidence, and pushes).

## A. The finding and the contract analysis

**Finding (owner-reported, confirmed by inspection):**
`verify:builder-kit` recomputed an active task pack's `packId` and compared
the working tree against its `baseTree`, but trusted the pack's OWN
`inScopePaths`, `permissionProfile`, and `ignoreManifest`. A pack whose
scope was altered and whose `packId` was then recomputed — perfectly
self-consistent bytes — became accepted authority. The tool wrapper
(`run --task-pack …`) read the scope from unvalidated pack JSON.

**No amendment required; none made.** The frozen contract already mandates
the missing enforcement: architecture §3.9 composes the gate from
"schema validation of all `vict.builder.*` documents in scope" and
"regenerating a task pack from the base pack + handoff must reproduce it
exactly"; §3.3 makes the handoff the **sole task authority** whose
`inScopePaths` the pack merely **carries**, requires `baseTree` to be an
"exact existing commit SHA", and lists the base-pack `packId` binding and
the ignore-manifest digest among the members; §4.3 defines the failure
classes. Closing the gap **enforces** the ratified text. What the frozen
text does NOT do is make prose machine-checkable — which the directive
itself supplies: "an explicitly accepted machine-checkable representation
of that handoff".

**Correction (commit `3740faca36fe693d800e9788b9d7e0303a62a700`, 13 files,
all under `packages/builder-kit/` plus the committed record):**

1. **Gate** — every active task pack (`.builder-kit/packs/*/task-pack.json`)
   passes eight checks BEFORE its scope is used: closed-vocabulary schema
   (`vict.builder.task-pack@1`); canonical identity (§4.4 exclusion rule);
   committed base-pack binding; current handoff path + byte digest;
   ignore-manifest digest coherence; pinned `baseTree` existing as an exact
   commit; carried scope/profile/ignore coverage by the committed
   accepted-task-scope record for the SAME handoff bytes (conservative,
   fail-closed glob coverage: equality or accepted `prefix/**` — a record
   is widened by its owner, never stretched by the consumer); and
   deterministic regeneration from exactly the §3.3 inputs. Failure
   classes reuse the §4.3 vocabulary (`schema-invalid`, `pack-tamper`,
   `content-drift`, `baseline-escape`). Baseline comparison runs only for
   authority-verified packs and is explicitly withheld otherwise.
2. **Wrapper** — `run --task-pack` refuses an invalid or stale pack
   (structured reason listing the failed checks) BEFORE its scope is used;
   the CLI entry point is guarded so the refusal logic is importable and
   testable.
3. **Accepted representation** — new kit-owned, COMMITTED protocol document
   `vict.builder.accepted-task-scope@1` at
   `docs/builder-kit/accepted-task-scope.json` (`packId 64cdb2034a3f9555…`),
   shipped JSON Schema + closed-vocabulary validator + the same canonical
   identity rule, filed via the new `accept-scope` command with a mandatory
   `--notes` derivation statement. It is NOT a base-pack recorded input:
   the stable-layer bytes and the VICT `packId bdb2d50a…` are unchanged and
   the gate's 18 standing checks still pass.

## B. The accepted scope — derivation from the authoritative handoff

Source of authority: `docs/handoff/VICT-STAGE-08-BUILDER-KIT-HANDOFF.md`
(bytes `4aa83c1510faa4877becaeadd3a4335c87a8b02cc4812e0db93c5ebd737ad3e2`,
bound in the record). Derivation of every field:

| Record field | Derivation |
| --- | --- |
| `packages/builder-kit/**` | §Autonomy permitted: "create `packages/builder-kit/**`" |
| `scripts/verify-builder-kit.mjs` | §Autonomy permitted (same sentence) |
| `docs/builder-kit/**` | §Autonomy permitted (same sentence) |
| `BUILDER-KIT.md` | §Autonomy permitted: root `BUILDER-KIT.md` |
| `package.json` | §Autonomy permitted: "the two npm script entries" |
| `packs/notes-pack/**`, `examples/reference-app/**` | §Autonomy permitted: "the P1 task implementation in `packs/notes-pack` and `examples/reference-app`" |
| `docs/VICT-SYSTEM-REFERENCE.md` | §Autonomy permitted: dated §23/§24 status notes |
| `scripts/verify-stage6a.mjs`, `scripts/lib/release-set.mjs` | Owner-ratified bounded retrospective exceptions (§D of this record, 2026-09-24) |
| `docs/governance/**` | Owner-directed governance location (2026-09-24) |
| `permissionProfiles: builder.read, builder.change, builder.selfhost` | The kit-shipped profiles; the effective profile is named per task pack |
| `ignoreManifest: .builder-kit/**, .git/**, .pi/**, docs/report/**, node_modules/**` | Detection-only, never write authority: `.pi/**` owner-local (never read), `docs/report/**` named denial (the handoff-named new report file remains permitted), the rest structural |

Acceptance chain: the record was filed by explicit owner direction in the
2026-09-24 directive (which commissioned exactly this machine-checkable
representation), is committed (auditable at every commit, consistent with
D-4), and is identity-bound so any later edit re-detectable. Future
handoffs get their own record at acceptance; an unrepresented handoff
grants NO task-pack authority.

## C. Negative controls and green cases (permanent tests)

`packages/builder-kit/test/task-pack-authority.test.ts` (kit suite now
60/60; full repo 2468 passed / 3 skipped of 2471):

- **GREEN** — a valid active task pack with the filed record: all eight
  authority checks pass; the full gate is green.
- **GREEN** — an unchanged-input descendant commit (`--allow-empty`):
  regeneration stays byte-identical (head movement is not drift); gate
  green.
- **RED `content-drift`** — changed handoff bytes: stale binding detected;
  regeneration from the §3.3 inputs no longer reproduces the pack;
  baseline comparison withheld.
- **RED `content-drift`** — changed base-pack binding with a recomputed
  `packId`: the identity check itself PASSES (bytes are self-consistent)
  and the base-pack-binding check refuses — the exact finding scenario.
- **RED `schema-invalid`** — malformed task pack.
- **RED `baseline-escape`** — expanded scope (`docs/**` added) with a
  recomputed `packId`: refused, naming the un-granted glob, while identity
  passes.
- **RED `baseline-escape`** — expanded ignore set (`**` added) with a
  recomputed `packId`: refused ("ignore not granted").
- **WRAPPER** — refusal precedes scope use: an expanded-scope pack yields
  the structured refusal (exit-shape `task pack refused …`), no un-granted
  write occurs, and a valid pack still yields a working context (in-scope
  read succeeds; out-of-scope write is denied as usual).

## D. Owner decisions recorded (2026-09-24) — no precedent

1. **Retained — bounded retrospective exceptions.** The owner retains (a)
   the Stage 6A pin repair (`ada71ba`: expected neutral-pin version derived
   from the recorded release-set record; exact-pin semantics preserved) and
   (b) the private-package release-inventory change (`f2fab61`:
   `deriveReleaseInventory` skips `private` manifests; the frozen
   13-package closed set, its content-derived identity, and the ladder gate
   untouched). Basis: both repairs preserved the normative checks — exact
   pins and the frozen 13-package release-set assertions — as
   re-established in `VICT-STAGE-08-G1-CORRECTIVE-PASS-2026-09-24.md` §D
   and by the continuous green `verify:release-set`
   ("13 packages, 0.3.1, v1_1c695280d3afec5…"). Scope of the retention:
   these two changes only; it ratifies neither the process deviations below
   nor any future repair-without-stop.
2. **Recorded — deviations, no precedent.** The implementer's failure to
   STOP at the stage6a failure (the handoff's Autonomy section requires a
   stop and owner decision for "test failures not attributable to handoff
   work") and the post-push amendment of the filed G1 checkpoint (erratum
   E-1 appended instead of filing a new record) were **process deviations**
   from the ratified handoff and the filing discipline. They are recorded
   as such, establish **no precedent**, and the correction pattern used
   here and in the corrective pass (new governance records; the filed
   checkpoint untouched) is the required pattern going forward. The G1
   checkpoint has not been edited again.
3. **Scratch history — preserved, not deleted or rewritten.** The prior
   metadata finding stands: the `.pi/`-staging commit `710627b778b4…` is
   reachable from exactly one local ref, `refs/heads/scratch/g1-rehearsal`
   (tip `c6ef18a0f5b9`, child of the offending commit); no tag, no remote
   ref, and no other branch reaches it; the remote carries only `main`.
   `scratch/g1-rehearsal` and `scratch/g1-rehearsal-b` remain local-only,
   undeleted, unrewritten; remediation (if any) remains owner-owned, and
   ALL `scratch/*` refs stay out-of-bounds for proofs, audit scopes, and
   pushes.

## E. Full G1 ladder with an active P1-shaped task pack (run #6)

The active task pack (handoff `4aa83c15…`, `baseTree = 3740faca…`, full
accepted scope, profile `builder.change`, `packId 15a14154e207e11a…`) was
generated at the implementation commit and present for every gate run. All
eight authority checks and the baseline comparison executed green inside
the ladder's `verify:builder-kit` (26 checks, up from 18; 8 task-pack
authority lines + baseline observed ok). Log:
`.builder-kit/g1-ladder/ladder6.log`.

| # | Command | Observed exit code |
| --- | --- | --- |
| 1 | `npm run format:check` | 0 |
| 2 | `npm run lint` | 0 |
| 3 | `npm run typecheck` | 0 |
| 4 | `npm test` | 0 — OBSERVED: 133 test files passed, 1 skipped (134 total); 2468 tests passed, 3 skipped (2471 total); includes 60 `packages/builder-kit` tests |
| 5 | `npm run build` | 0 |
| 6 | `npm run build -w @victframework/builder-kit` | 0 |
| 7 | `npm run verify:stage5` | 0 |
| 8 | `npm run verify:stage6a` | 0 |
| 9 | `npm run verify:stage6b` | 0 |
| 10 | `npm run verify:stage7a` | 0 |
| 11 | `npm run verify:release-set` | 0 — OBSERVED: "ALL CHECKS PASSED — 13 packages, 0.3.1, v1_1c695280d3afec5…" |
| 12 | `npm run verify:clean-clone` | 0 |
| 13 | `npm run verify:builder-kit` | 0 — OBSERVED: ALL CHECKS PASSED (26 checks; active task pack verified) |

The gate was green before work (baseline state) and detects the mandated
tampering via the permanent controls in §C (observed failure classes
listed there).

## F. `verify --app` scope note (G3 obligation, unchanged)

`verify --app` checks installed platform versions against the app-local
pack's recorded release set (the kit itself excluded as a tool, not a
platform member). The exact PUBLISHED 13-package consumption record —
proving the consuming app received precisely the published, identity-pinned
artifacts — remains a **G3 evidence obligation** of P2 and is NOT claimed
here.

## G. Stop point

G1 (gate correction) stops here. No P1 sessions were run (no Codex, no
Claude Code), no proof result integrated, P2 not started, nothing
published, no production activation, no Quellight access, no Builder Kit
directory move. **Stage 8 and every BLD requirement remain NOT Verified** —
the independent audit (reference §27.3) and owner closure are still
required. Scratch refs were excluded from all work and remain untouched.
