# VICT — Stage 07A Handoff: Quellight Consumer Foundation

> **Reference:** `docs/VICT-SYSTEM-REFERENCE.md` v0.4.0
> **Repository:** `C:/Users/RZ1/Desktop/RZ/260831-VCT-02`
> (greenfield VICT monorepo; `origin/main` at handoff issuance:
> `c6d2a5a3e4745bfed44c204c6a9c1674e57e03c7`)
> **Verified baseline:** Stages 1–6 independently verified and formally
> closed (Stage 05 and Stage 06 with non-blocking issues; Stage 06 formal
> closure 2026-09-09 at reference v0.3.4, §0.10). Stage 07 is rebaselined
> for Quellight by `docs/architecture/STAGE-07-QUELLIGHT-MINIMUM-WORKABLE-PRODUCT.md`
> and permitted. **This handoff covers ONLY the Stage 07A consumer
> foundation.** Stage 07A is the next permitted implementation increment;
> no Stage 07A work exists yet. Do not start Stage 07B (Quellight
> repository bootstrap) or any product work. Do not mark your own work
> Verified.

---

## Objective

One bounded outcome: make VICT truthfully consumable by an external
Quellight repository — and clear the two accepted Stage 06
carry-forward hygiene items that must precede any live-provider or
real-Quellight claim — without changing any verified VICT semantic,
identity vector, or Stage 01–06 Verified status.

```text
Stage 07A delivers the consumption foundation.
Stage 07A does NOT deliver any Quellight product capability.
```

## Requirements

Stable IDs implemented or exercised by this handoff:

- **SEC/§24.2 N-1:** reject own `__proto__` delivery-snapshot keys with
  a dedicated closed reason (the accepted H-1 audit Low, an early
  Stage 07 hardening acceptance item).
- `ARCH-012` (public packages declare compatibility and use semantic
  versioning) — given its first real consumer obligation.
- `QLT-002` (immutable pinned release-artifact consumption; one
  compatible release set; recorded Node/runtime support) — VICT-side
  half.
- `GOV-002`/`GOV-005` (handoffs reference IDs; architecture changes
  record rationale and impact).
- `TEST-001`/`TEST-002`/`TEST-005`/`TEST-007` (direct automated
  evidence, negative paths, reproduction, leakage/permission tests).
- `MSTR-011` foundations reused: the protected-credential discipline
  this handoff extends to product-facing operator configuration.
- `AI-004`/`AI-002` boundaries preserved (no Mastra leakage into
  neutral packages; credentials never in identity/snapshots).

## In scope (exactly six work items)

### Work item 1 — H-1 N-1 hardening: own `__proto__` delivery-snapshot keys

Accepted finding (reference §23 Stage 6 and §24.2): an own `__proto__`
data key on an otherwise-accepted object is silently dropped (scalar
value) or becomes the delivered container's prototype (object value) at
the governed capability delivery-snapshot boundary
(`captureDeliverySafeSnapshot`, `@vict/mastra` — see
`docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` §2).
No pollution, aliasing, or false completion occurs today, but silent
transformation of model-facing delivery content is unacceptable before
live-provider use.

Implement, at the delivery-snapshot capture boundary:

- Reject any own `__proto__` key (scalar- or object-valued, at any
  depth) with a **dedicated closed reason** — a new stable,
  non-echoing durable code in the existing closed vocabulary style
  (e.g. `VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE` specialization or a
  sibling code; choose one, document it, and keep the vocabulary
  closed).
- Rejection follows the existing effectful-ambiguity rule: fenced
  `outcome_unknown` settlement, one effect, no second effect on retry,
  no `tool.completed`, stable safe model-facing failure. Preserve the
  null-prototype-objects-ACCEPTED behavior (containers built with null
  prototypes remain in the accepted delivery domain).
- Semantics of all previously accepted delivery-domain values are
  byte-for-byte unchanged; Stage 06 identity vectors and all Verified
  statuses are unchanged.
- Negative control: the H-1-era behavior must be demonstrably gone —
  a probe with a scalar-valued own `__proto__` and one with an
  object-valued own `__proto__` (at depth ≥ 2) both produce the new
  stable rejection before durable completion, with no prototype
  mutation of any shared object and no echoed value.
- Update `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md`
  §2's N-1 reference ONLY by appending a dated correction note (the
  historical body stays); update reference §24.2's N-1 bullet to
  CLOSED-in-Stage-07A after the independent audit, not before.

### Work item 2 — Stale Stage 06B verifier success banner

`scripts/verify-stage6b.mjs` summary block (lines ~449–456) still
prints, on success: "Stage 06B corrective finalization complete;
awaiting fresh independent audit." Stage 06B was audited, corrected,
re-verified, and Stage 06 was formally closed 2026-09-09.

- Replace the stale success line with a truthful one (e.g. "Stage 06
  closed; verification ladder re-confirmed"), keeping exit codes and
  all gate behavior byte-compatible. Do not weaken, reorder, or remove
  any gate.
- Add this to the deliverable report: before/after banner text and the
  confirmation that gate logic, gate list, and failure output are
  unchanged.

### Work item 3 — VICT package release/consumer mechanism

Current reality: every `@vict/*` manifest is version `0.1.0` and
`private: true`. No publish mechanism exists. Compare realistic
mechanisms and implement the smallest trustworthy one.

**Mechanism decision (record rationale in the report; deviate only with
recorded reasoning):** publish exact-versioned `@vict/*` release
artifacts to a **private npm registry** (an npm registry account with
restricted access, GitHub Packages, or an equivalent private registry —
choose one and record it). Chosen over the alternatives because:

- git-dependency/submodule consumption resolves mutable branches and
  couples VICT's commit history to Quellight installs (violates
  immutability); vendored tarballs lack dependency resolution and
  drift; `file:`/`link:` works only inside one machine and proves
  nothing about a clean external clone. A private registry gives
  immutable versioned artifacts, per-artifact integrity hashes via the
  consumer lockfile, one compatible release set through exact
  inter-package version pins, and standard rollback (install a prior
  exact version). Public publication to the global npm registry is NOT
  required or performed.

Implement:

- Remove `private: true` and assign a real semantic version to each
  published `@vict/*` package (publishable set: `contracts`, `sdk`,
  `kernel`, `runtime`, `store-sqlite`, `application`,
  `renderer-svelte`, `appdata-sqlite`, `scaffolder`, `mastra`,
  `control`, `server`, `cli`). Unchanged versions of unpublished
  workspace-only examples/packs stay workspace-private.
- Internal `@vict/*` dependencies resolve as **exact** versions of the
  same release set (no ranges, no `workspace:` leakage into published
  manifests).
- Record, in a VICT-authored compatibility document delivered with the
  release (e.g. `docs/RELEASE-COMPATIBILITY.md` — new file, in scope):
  exact published versions, the one compatible release-set identity
  (work item 4), supported Node/runtime versions (`engines`,
  observed Node v22.13.1 / v24.19.0 evidence), registry location and
  access requirements, install/rollback procedure for consumers, and
  the integrity mechanism (lockfile `integrity` hashes).
- Publishing is reproducible: a documented, scripted path from a clean
  checkout + version tag to published artifacts (build → pack →
  publish), with no interactive steps and no secrets in the repo.
  Registry credentials live only in the publishing environment.

### Work item 4 — Immutable compatible release-set identity

- Define and record one **compatible release-set identity**: a single
  immutable identifier (e.g. `vict-release-set@1/<version>` or a
  content-derived ID over the exact published version list) naming the
  exact set of `@vict/*` versions that are verified to work together.
- All internal dependency pins inside the release set MUST match the
  set exactly; a consumer installing the set gets one coherent graph.
- Rollback behavior: a consumer rolls back by pinning a prior
  release-set identity (all prior published versions remain in the
  registry; nothing is unpublished or mutated — never `npm unpublish`
  / never re-publish a used version). Document the compatibility rule:
  a release-set identity is immutable; changing any member version
  creates a NEW set identity; consumers upgrade explicitly.
- Negative control: a manifest whose internal pins do not match any
  recorded release set must be detectable (a set-consistency check in
  CI that fails the release if pins and the recorded set disagree).

### Work item 5 — Isolated clean-consumer verification

Prove installation, typecheck, build, and a minimal
runtime/renderer composition entirely outside the VICT monorepo:

- New verification script (e.g. `scripts/verify-release-consumer.mjs`,
  new file, in scope) that, in a fresh temp directory OUTSIDE the
  repository: installs the published release set from the registry into
  a minimal consumer package; typechecks a consumer that imports the
  neutral packages (`contracts`/`sdk`/`runtime`/`application`/
  `renderer-svelte` type surface) and executes a minimal runtime
  composition (e.g. one contract, one capability, one graph run on the
  SQLite store, plus one `@vict/application` Application Definition
  compile + `@vict/renderer-svelte` composition check); asserts
  installed versions match the recorded release set exactly; asserts
  lockfile integrity hashes are present.
- The consumer must NOT resolve any dependency from the VICT checkout,
  a `file:` path, or any mutable `main` branch. Add a negative probe:
  attempt resolution with the registry unreachable from the checkout
  (or with registry URLs only) to prove no monorepo leakage.
- Wire the script as an npm script (e.g. `verify:release-consumer`);
  it runs green in the publishing environment and is the CI gate
  VICT runs after publishing. CI requirement (recorded in the
  compatibility document): publish → verify-release-consumer must pass
  before a release-set identity is recorded.

### Work item 6 — Protected configuration foundations (pre-Quellight)

Before the Quellight repository is bootstrapped, VICT must provide the
product-facing configuration boundary it will consume:

- A documented, typed **operator configuration resolution foundation**
  for the future product composition: model-provider profile
  selection, provider credential variable NAME (never value), store
  locations, and retention bounds — resolved from environment /
  operator configuration only, following the Verified
  `protectCredentialPort`/`requireCredential` discipline
  (Stage 06A §10): name-pattern validation, values never logged,
  serialized, or persisted, fail-closed unavailable-credential
  behavior with stable non-echoing codes.
- Scope guard: this is the **foundation** (resolution types, loader,
  validation, documentation, and tests) consumed later by the Quellight
  composition — NOT a real provider integration, NOT a live-provider
  wrapper, and NOT any Quellight product code. No real provider
  account is configured by this handoff. Place the foundation in the
  neutral surface it belongs to (runtime/server composition layer —
  implementation site at implementer's judgment, respecting AI-002
  Mastra-freedom of neutral packages) with a real offline test using
  canary credential values proving non-leakage across logs, errors,
  and any persisted surface.

## Tests and negative controls (minimum set)

1. **N-1 rejection tests:** scalar-valued and object-valued own
   `__proto__` at multiple depths → new stable closed reason; no
   `Object.prototype` mutation; no echoed value; fenced
   `outcome_unknown`; exactly one effect; retry performs no second
   effect. Include a null-prototype container POSITIVE case (still
   accepted).
2. **Regression proof:** the full existing delivery-snapshot suite
   (68/68 exact-bound checks class) and the real-path truthfulness
   matrix remain green; no previously accepted delivery value's
   behavior changed.
3. **Verifier banner:** before/after capture; all gates still run and
   fail correctly (introduce a deliberate temporary failure in a
   scratch run to prove failure output and non-zero exit are intact,
   then revert).
4. **Release-set consistency check:** mismatched internal pins vs the
   recorded set → CI failure; matching pins → green.
5. **Clean-consumer verification:** green run recorded with exact
   commands, counts, and the temp-consumer file list; negative
   no-monorepo-leakage probe recorded.
6. **Credential-foundation canary tests:** unique canary credential
   values planted in env/config; assert absence from every log,
   error, serialized profile, and persisted byte; unavailable
   credential → stable non-echoing code.
7. **Mastra-freedom and declaration checks:** packed-consumer
   declaration scans still prove neutral packages free of Mastra
   types (`AI-002`) after manifest changes.
8. Full ladder: `npm run format:check`, `npm run lint`,
   `npm run typecheck`, `npm test`, `npm run build`,
   `verify:stage6b`, `verify:clean-clone`, and the new
   `verify:release-consumer`.

## Out of scope (explicit stop boundaries)

- Creating the Quellight repository or any Quellight product code,
  UI, Shared World store, or requirements implementation.
- Any live model-provider integration, real provider account, or
  provider credential in any test, fixture, or committed file.
- Publishing to the public npm registry; publishing anything not in
  the declared release set; re-publishing or mutating any used
  version.
- Changing any verified semantic: identity algorithms, activation/
  run/store semantics, effect/approval/bridge ordering, stream
  schema (`vict.agent-stream@1`), store schemas beyond what N-1's
  closed-reason code requires (none expected — it is a capture-layer
  rejection).
- Stage 07B+ product work: conversation surfaces, Shared World
  semantics, context assembly, retention policy implementation,
  `MSTR-012` real-use proofs.
- Modifying files under `docs/report/` (historical evidence is
  immutable), except the explicitly permitted dated correction notes
  to `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md`
  and the reference's N-1 status bullet (neither is under
  `docs/report/`).

## Autonomy

- Permitted: edit `packages/**` source/tests at the named boundaries,
  `scripts/verify-stage6b.mjs` (banner text only), add the new
  verification script, compatibility document, and npm script;
  update `package.json` manifests of the release set; append dated
  notes to the two named architecture docs.
- Requires a stop and human decision: registry choice/credentials
  unavailable; a release-mechanism deviation from the decision above;
  any need to change a verified semantic or a Stage 01–06 Verified
  status; any conflict between this handoff and reference v0.4.0;
  test-suite failures whose cause is not attributable to handoff
  changes.

## Deliverables

- Implementation + tests for work items 1–6 (code, tests, scripts).
- `docs/RELEASE-COMPATIBILITY.md`: versions, release-set identity,
  registry, engines, integrity, install/rollback, CI gate.
- Updated `package.json` manifests for the release set (real
  versions, exact internal pins, `private` removed where published).
- Dated correction note appended to
  `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` §2
  (N-1 corrected in Stage 07A) and reference §24.2 N-1 bullet
  reconciled after audit.
- Factual report at `docs/report/VICT-STAGE-07A-REPORT.md` (observed
  counts, exact commands and exit codes, files changed, deviations,
  explicit stop point). The report is an implementer claim — NOT
  independently authoritative.

## Exit gate

- N-1: own `__proto__` keys rejected with the dedicated closed reason
  before durable completion; all negative controls green; delivery
  behavior otherwise unchanged; banner truthful.
- A clean consumer outside the monorepo installs the exact recorded
  release set from the private registry, typechecks, builds, runs the
  minimal runtime/renderer composition, and passes the no-leakage
  probe; release-set consistency check green.
- Protected configuration foundation proven with canary tests; no
  credential value anywhere it must not be.
- Full verification ladder green from a clean clone:
  format:check, lint, typecheck, full tests, build,
  `verify:stage6b`, `verify:clean-clone`, `verify:release-consumer`.
- No Stage 01–06 Verified status changed; no Quellight capability
  claimed; report records observed evidence only.
- Independent audit passes (per reference §27.3) before any
  live-provider or real-Quellight work begins.
