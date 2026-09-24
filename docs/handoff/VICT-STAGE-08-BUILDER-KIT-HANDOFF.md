# VICT — Stage 08 Handoff: Builder Kit and Self-Hosting

> **Status:** PROPOSED — issued as part of the Stage 8 entry-contract
> candidate for **owner review**. This handoff authorizes NOTHING until the
> owner ratifies the entry contract (architecture document §9). It names
> reference v0.4.28 plus the candidate registrations §0.35 (v0.4.29) and
> §0.36 (v0.4.30 — corrective pass per owner review: identity rules,
> stable/task pack split, capability catalog, starting-tree pinning, P1
> same-task worktrees, `docs/report/` alignment, P2 brief purity, D-1–D-5
> recommended dispositions); it is valid only against the ratified text of
> that version or later.
>
> **Reference:** `docs/VICT-SYSTEM-REFERENCE.md` v0.4.28 + candidate §0.35
> **Architecture:** `docs/architecture/STAGE-08-BUILDER-KIT-AND-SELF-HOSTING.md`
> (PROPOSED; ratification required)
> **Repository:** `C:/Users/RZ1/Desktop/RZ/260831-VCT-02` (branch `main`;
> tip at issuance `0bf9d911f81bcbab7407936ee78e650d48450a2a` == `origin/main`)
> **Verified baseline:** Stages 1, 1.1, 2, 3, 4, 5, and 6 independently
> verified and formally closed (Stage 05/06 with non-blocking issues);
> Stage 07 (Minimum Workable Quellight) FORMALLY CLOSED (v0.4.28, §0.34;
> Quellight closure `5f709a5…`). **No Stage 8 implementation exists.**
> Do not mark your own work Verified. Do not start Stage 9. Do not touch the
> Quellight repository.

---

## Objective

One bounded outcome: implement the Vict Builder Kit — the host-neutral
bootstrap, generated context pack, typed tools, schemas, permission
profiles, and the `verify:builder-kit` gate — inside the VICT repository, and
produce the two Stage 8 acceptance proofs with complete evidence:

- **Proof P1 (self-hosting, preserved exit gate):** a bounded capability plus
  application-surface change on VICT itself, completed from the same handoff
  by two fresh builder sessions on two different supported hosts (or one
  agent host plus one human), with equivalent evidence.
- **Proof P2 (strengthened greenfield proof):** a runnable new application —
  "TaskLedger" — created by a fresh coding agent from an empty project and
  the natural-language brief in §P2, exercising VICT's real application,
  data, capability, and UI delivery path.

```text
Stage 08 delivers the Builder Kit and its two proofs.
Stage 08 does NOT deliver Studio (Stage 9), cloud (Stage 11),
any release publication, or any production activation.
```

## Requirements

Stable IDs implemented or exercised:

- **AGNT-001** (kit usable by multiple hosts and humans) — primary;
- **AGNT-002** (handoff defines scope, exclusions, requirements, commands,
  evidence, stop conditions) — this document is an instance;
- **AGNT-003 / AGNT-004 / AGNT-008** (explicit per-environment authority;
  repository write ≠ production activation; no self-granted tools/secrets/
  approvals/roles);
- **AGNT-005 / AGNT-006 / AGNT-007** (product-agent separation preserved;
  no kit or repository authority for Product Agents; kit never on the
  product fast path);
- **BLD-001 … BLD-013** (the Stage 8 family defined in the architecture
  document §6; all Planned — this stage is their first delivery);
- **API-004** (MCP adapter only, if implemented at all);
- **PRD-006 / PRD-007 / PRD-008** and **APP-001 / APP-003 / APP-008 /
  APP-010 / APP-012 / APP-014 / APP-015 / APP-016** — exercised by P2
  through the verified delivery path (not re-proven; cited);
- **GOV-002 / GOV-004 / GOV-005 / GOV-007** (IDs in handoffs; no future
  behavior described as current; recorded architecture rationale; VICT
  semantic authority);
- **TEST-001 / TEST-002 / TEST-004 / TEST-005 / TEST-007** (direct automated
  evidence, negative paths, observed counts, independent reproduction,
  leakage/permission tests);
- **DATA-007 / SEC-002 / SEC-003** boundaries preserved (secrets resolved
  just in time; authorization below the UI; secrets out of prompts, traces,
  errors, events);
- **AI-014** discipline applied to the kit: pack and repository content are
  untrusted data, never instructions.

## In scope (work packages)

### WP-1 — `@victframework/builder-kit` package (new workspace member)

Create `packages/builder-kit` as an ordinary workspace package following the
established package discipline (ARCH-012 compatibility declaration; no
Mastra types; zod, if used, confined per the verified subpath discipline;
build emits declarations):

- schema constants and validators for `vict.builder.context-pack@1`,
  `vict.builder.task-pack@1`, `vict.builder.catalog@1`,
  `vict.builder.tools@1`, `vict.builder.profile@1`,
  `vict.builder.handoff@1`, `vict.builder.result@1`,
  `vict.builder.audit@1` (JSON Schema documents shipped from the package;
  validators plain and dependency-light);
- the deterministic base-pack generator (canonical, key-sorted,
  insertion-order-independent, byte-stable for identical inputs) with the
  provenance record of architecture §3.4 and the identity rule of
  §3.3/§4.4 (`packId` over canonical bytes with `packId` omitted; no
  timestamp, no carrying-commit SHA, no environment data anywhere in the
  output);
- the capability-catalog generator producing `vict.builder.catalog@1` per
  the architecture §4.1 verified design: import first-party workspace pack
  modules only (the same trust envelope as the verified ladder) and
  serialize their frozen, fully declarative manifests — handlers never
  invoked, bodies never serialized or hashed — recording exactly the
  genuinely available metadata (capability id/revision/effect/contract
  refs; declared idempotency/retry/ambiguity/permissions/configuration/
  secrets where present; pack id/version, `documentation.summary`,
  pack-level permission/configuration/secret descriptions, doubles,
  evaluations) with `summary: null` recorded explicitly for the absent
  per-capability description (the manifest closed vocabulary has none
  today — none may be invented); enumeration completeness proven by the
  static TypeScript-compiler scan (parsing only) of
  `defineCapabilityPack`/`defineCapability` call-sites and `capabilities:`
  literal entries versus the committed catalog;
- the per-handoff task-pack generator (base pack + handoff → isolated
  `.builder-kit/packs/<slug>-<handoffSha8>/`; records the operator-supplied
  `baseTree`, the in-scope set, the ignore manifest, and the profile);
- the freshness checker implementing every §4.3 drift class (content
  drift, catalog drift/dangling, release/workspace identity, `pack-tamper`,
  unregistered input, baseline escape incl. renames and untracked files);
- the profile-enforcing tool wrapper `vict-builder-kit run` (fs.read /
  fs.write with in-scope enforcement / shell.run by npm-script name /
  git status|diff|log|commit; denial records emitted as structured events);
- the `vict-builder-kit` CLI: `generate`, `catalog`, `verify`, `validate`,
  `run`, `task-pack`, `init-app` (generates `BUILDER-KIT.md` + the
  app-local base pack into an external app project for P2);
- unit + negative tests inside the package (generator determinism, the
  identity-exclusion rule, each drift class, each schema's rejection set,
  profile refusals).

### WP-2 — VICT self-hosting wiring

- Root `BUILDER-KIT.md`, generated and committed (architecture §3.2 — the
  stable layer);
- the committed stable layer: `docs/builder-kit/context-pack.json`,
  `docs/builder-kit/PACK.md`, and `docs/builder-kit/capability-catalog.json`
  — regenerated only when a recorded input changes (architecture §4.2),
  never per-commit;
- base-pack inputs exactly as architecture §3.4 (reference, release-
  compatibility constant, workspace manifests, capability catalog) — the
  Stage 8 handoff is bound by the TASK layer, not the committed base pack;
- npm scripts: `kit:generate` and `verify:builder-kit` (the new gate),
  leaving every existing script untouched;
- constitution excerpts limited to the §3.3 list.

### WP-3 — Permission profiles and control tools

- `builder.read`, `builder.change`, `builder.selfhost` as
  `vict.builder.profile@1` data with the architecture §3.7 denials;
- optional control-tool bindings over the existing `@victframework/cli`
  surface (validate/propose/simulate/inspect; local dev/test activation
  only) — omit if they add risk; record the omission truthfully;
- the escalation-recording path (denial events persist as structured
  records quotable into evidence).

### WP-4 — `verify:builder-kit` gate and permanent negative controls

`scripts/verify-builder-kit.mjs` (npm script `verify:builder-kit`)
implementing architecture §3.9: regenerate-and-compare for both pack
layers, identity recomputation with the §3.3/§4.4 exclusions,
capability-catalog recomputation from typed declarations, schema validation,
the baseline comparison versus the task pack's pinned `baseTree`
(committed, renamed, and untracked changes classified through the ignore
manifest), and the negative-control battery of §Tests below. The gate MUST
fail (non-zero exit, stable reason) on every negative control and pass on
the committed tree. No existing gate is weakened, reordered, or bypassed.

### WP-5 — Documentation and knowledge-loop verification

- The kit's README (package) and the architecture document's §3 cross-check
  (mismatch = stop);
- demonstration of architecture §4.2/§4.4: two mechanical rehearsals on a
  scratch branch — (a) a capability declaration change whose catalog/pack
  regeneration lags → gate red (`catalog-drift`) → declaration + catalog +
  base pack landed in one commit set → gate green; (b) an unrelated commit
  changing no recorded input → gate stays green with no pack churn
  (rehearsal evidence quoted in the report; the scratch branch is not
  merged).

### Gate G1 (stop point)

WP-1–WP-5 complete; full ladder green including `verify:builder-kit`;
implementer report filed. **Proofs may not start from a red ladder.**

### WP-6 — Proof P1: self-hosting equivalence

- Owner selects the two hosts (decision D-2). The operator accepts the
  handoff, pins the starting tree `baseTree = B`, and issues **one task
  card with one set of acceptance criteria to both hosts**: add a
  `readingTime` pure/read capability (contract + revision +
  effect/authority declarations + implementation + example + permanent
  tests) to `packs/notes-pack`, and surface a reading-time region on the
  reference application's notes screen via the Application Definition with
  a permanent renderer-level test.
- Two isolated worktrees are created from exactly `B`
  (`git worktree add ../vict-p1-hostA B`, `git worktree add
  ../vict-p1-hostB B`). Each session runs fresh inside its own worktree
  (no shared conversation state, no shared files), bootstraps from its
  worktree's `BUILDER-KIT.md`, passes the freshness gate, and works under
  `builder.selfhost`.
- Each session produces: a `vict.builder.result@1` document (validated),
  full-ladder output, the freshness-gate transcript, and its commit(s) on
  its worktree branch.
- Evaluation: both results are compared against the identical acceptance
  criteria; the comparison and the selection rationale are recorded; ONLY
  the selected worktree's commit(s) are integrated into `main`. The
  unselected worktree is preserved as evidence (branch or bundle) and
  never merged.
- Equivalence criterion: BOTH sessions independently satisfy the same
  acceptance criteria with independently reproducible evidence. Identical
  diffs are NOT expected.

### WP-7 — Proof P2: greenfield "TaskLedger"

- Consumption medium per D-1′ (architecture §8; owner may override): the
  13 platform packages installed from the existing published
  `vict-release-set@1/0.3.1` (registry, lockfile integrity) plus
  `@victframework/builder-kit` as an integrity-recorded local artifact
  (recorded SHA-256; exact `0.3.1` internal pins; no-checkout-leakage
  probe retained). No new publication is performed or required.
- Fresh agent host, empty directory outside both repositories. **Builder
  inputs: the kit, the kit's generic documentation, the public VICT
  documentation shipped with the packages, and the §P2 brief verbatim —
  the brief is the ONLY product specification.** Evaluator isolation is
  explicit: the F1–F8 list, the claim→evidence table, and this Stage 8
  handoff itself remain OUTSIDE the builder's supplied workspace and
  context. The brief and the rubric are byte-pinned separately for audit
  (two independent SHA-256 digests in the evidence: exact brief bytes
  supplied, exact rubric bytes scored against).
- The evaluator scores the delivered application against F1–F8 and the
  claim→evidence table of architecture §5.4 (real-browser record for
  usability claims; scripted real-process restart probe for F7;
  definition/component-island wiring for F6; action negative probe for F5;
  application-identity stability for F8), plus the negative-control run
  for the P2 session.
- The P2 app is agent-free: no model provider, no credentials, no network
  AI service.

### WP-8 — Implementer report and documentation reconciliation

- Report at `docs/report/VICT-STAGE-08-IMPLEMENTATION-REPORT.md` in the
  format below;
- truthful documentation updates permitted: dated notes appending Stage 8
  status to reference §23 Stage 8 and §24 — explicitly NOT marking anything
  Verified, NOT updating requirement delivery cells (that is §27.4,
  post-audit), NOT touching `docs/report/` historical files.

## Tests and negative controls (minimum permanent set)

1. **Pack determinism and identity:** two generations from identical
   inputs are byte-identical; input-order permutations do not change bytes;
   output contains no timestamp, no random data, no host paths, and no
   carrying-commit SHA; `packId` recomputed over canonical bytes with
   `packId` omitted matches, and recomputation over bytes INCLUDING
   `packId` fails (the exclusion rule is enforced).
2. **Freshness classes:** each §4.3 drift class simulated (edited input
   content, catalog drift, dangling catalog entry, changed release
   constant, changed workspace identity, tampered pack bytes /
   identity-exclusion breach, unregistered input, baseline escape) →
   `verify:builder-kit` red with the stable per-class reason; and the
   negative-of-the-negative: regenerating at a descendant commit with
   unchanged inputs reproduces the committed bytes (head movement alone is
   GREEN). The catalog-drift case is detected by the static declaration
   scan (parsing only — no pack execution is needed to catch the
   omission).
3. **Schema rejection:** malformed handoff/result/audit/pack/profile
   documents → validator rejects with structured diagnostics (closed
   vocabulary, non-echoing).
4. **Profile enforcement:** fs.write outside the in-scope set → refused +
   recorded; `shell.run` with an unlisted script → refused; `git.push`
   → not available.
5. **Escalation shapes:** simulated publish / production-activation /
   approval / secret-access requests → refused + recorded + stop-condition
   classification.
6. **Secret canaries:** canary values in env/config → absent from all logs,
   errors, reports, pack bytes, and any persisted surface (TEST-007).
7. **Baseline detection (host-mediated):** out-of-scope changes versus the
   pinned `baseTree` — a committed edit, a renamed file, and an untracked
   file (each outside the ignore manifest) → the gate's baseline comparison
   flags each with its class; in-scope changes do not flag.
8. **Invalid references:** a definition referencing a nonexistent component/
   action/contract revision → structured fail-closed diagnostic (§17.3).
9. **Existing gates intact:** the full existing ladder runs unchanged
   (format:check, lint, typecheck, test, build, verify:stage5…verify:stage7a,
   verify:release-set, verify:clean-clone) plus `verify:builder-kit`.
10. **P2-specific:** F5 action refuses undeclared input; F7 restart probe
    green; F8 identity stable; scaffolder one-time contract respected
    (generated host files byte-unchanged after the custom component lands).

**Observed baseline:** every count above is recorded from actual run output
at implementation time. This handoff sets NO expectations of specific test
counts. Where a future observed value belongs, the report uses the
placeholder `OBSERVED: <TBD — record from actual output>` and MUST NOT copy
numbers from any prior stage.

## P2 brief (verbatim task text)

> Build a small personal task ledger application. A task has a title, notes,
> a priority (low/medium/high), and an open/done status. I want: (1) a form
> to create and edit tasks with validation (title required, priority one of
> the three values); (2) a task table I can search, sort by title or
> priority, and paginate; (3) a dashboard showing tasks completed per day
> over the last 14 days as a chart and a count of open tasks; (4) a
> "complete task" action on each row that marks it done and is recorded as a
> governed durable action, not just a UI toggle; (5) a custom priority badge
> component (colored per priority) shown in the table; (6) everything I
> create must still be there after I close and reopen the app. Keep it
> plain, fast, and usable on a narrow phone screen as well as a laptop.

## Out of scope (explicit stop boundaries)

- Any release publication, candidate tag, or registry write (owner-only,
  separately authorized; under the recommended D-1′ disposition no
  publication is required for P2 at all, and none may be performed by a
  builder);
- production activation or any Application Release select/rollback in any
  non-local environment;
- Stage 9 Studio, Stage 10 ecosystem, Stage 11 cloud scope;
- Quellight repository access or roadmap work; any live-provider or
  credential-bearing integration;
- Product-agent surfaces: no kit tool, profile, or pack on any product path;
- changes to verified semantics: identity algorithms, activation/run/store
  semantics, effect/approval ordering, `vict.agent-stream@1`, release-set
  identity rules;
- modifying or deleting existing files under `docs/report/` (historical
  evidence is immutable; CREATING the handoff-named new report files named
  under Deliverables is in scope) and `.pi/` (never read or written);
- weakening or reordering any existing verification gate; introducing a
  second application model or destructive regeneration;
- marking Stage 8 or any BLD requirement Verified (independent audit +
  owner closure only).

## Autonomy

- Permitted: create `packages/builder-kit/**`, `scripts/verify-builder-kit.mjs`,
  `docs/builder-kit/**`, root `BUILDER-KIT.md`, the two npm script entries,
  the P1 task implementation in `packs/notes-pack` and
  `examples/reference-app`, and the P2 app in its separate empty directory;
  append dated Stage 8 status notes to reference §23/§24.
- Requires a stop and owner decision: D-1 (consumption medium) and D-2
  (host pair) unresolved; a kit defect that would require changing a
  verified semantic to fix; any conflict between this handoff and the
  reference; test failures not attributable to handoff work; any publication
  or production-activation request; missing credentials or environment
  prerequisites for a proof.

## Deliverables

- `packages/builder-kit` (source, schemas, generator, validator, wrapper,
  CLI, tests); `scripts/verify-builder-kit.mjs`; npm script entries;
- committed generated artifacts: `BUILDER-KIT.md`, `docs/builder-kit/*`;
- P1 evidence package (two result documents, ladder transcripts, worktree
  commits, the evaluator's comparison/selection record, and the integrated
  selected result);
- P2 evidence package (app repository, F1–F8 records, restart probe, browser
  record, negative-control transcript, consumption-medium integrity record);
- `docs/report/VICT-STAGE-08-IMPLEMENTATION-REPORT.md` — implementer claim,
  NOT independently authoritative, containing: commit and environment
  identity; every command with observed exit code; observed counts
  (placeholders until actually run); files/packages changed; requirement
  claims classified `implemented | exercised | not-done`; deviations; known
  debt; explicit stop point. The report MUST distinguish accepted
  architecture (reference §15/§23 + ratified decisions), proposed design
  choices realized (architecture §§3–5), implemented code, and verified
  evidence (none for Stage 8 until the independent audit).

## Independent-audit instructions (for the Stage 8 audit)

Per reference §27.3 and §22: the auditor receives this handoff, the report,
the VICT repository path, the P2 app repository path, and the reference.
The auditor MUST: inspect kit source and tests; re-run the full ladder
including `verify:builder-kit`; independently re-derive both P1 sessions'
evidence (fresh clones; both worktree sessions re-verified); re-run at least the
restart probe and one browser check of P2; verify every negative control by
re-execution; reconcile every material claim against observed output; verify
no out-of-scope, `.pi/`, Quellight, gate-weakening, or publication event
occurred; classify findings (gating/corrective/deferred/rejected); and
return a §22.3 disposition. Implementer claims never substitute for audit
reproduction; the disposition vocabulary is PASS / PASS WITH ISSUES / FAIL /
INCONCLUSIVE. The auditor files its record as
`docs/report/VICT-STAGE-08-INDEPENDENT-AUDIT.md` (a new file; existing
`docs/report/` evidence untouched).

## Exit gate

- The Builder Kit exists as specified: stable bootstrap layer (bootstrap,
  base pack, capability catalog) committed with provenance, per-handoff
  task packs, tools with profiles, schemas, gate — all tested;
- `verify:builder-kit` green on the committed tree and red on every negative
  control, with the identity-exclusion rule enforced;
- P1: two fresh sessions (two hosts, or agent + human) each completed the
  SAME bounded capability + application-surface change in isolated
  worktrees from the same handoff and pinned starting tree, with
  equivalent, independently reproducible evidence; only the selected
  result integrated;
- P2: the fresh-agent TaskLedger app built from an empty project exists
  and, scored by the evaluator against F1–F8 (never shown to the builder),
  survives a real-process restart, keeps definition-driven surfaces and
  the custom code island cleanly coexisting, and carries the claim→evidence
  records including real-browser evidence for usability claims and the
  D-1′ consumption record (0.3.1 registry packages + integrity-recorded
  local kit artifact);
- scope violations prevented or detected; generated and custom surface
  ownership remains clear; all claims carry reproducible observed evidence;
- production activation and release publication were not performed by any
  builder and remain separately authorized;
- independent audit passes (§27.3) and the owner performs formal closure —
  **until then Stage 8 is not Verified and nothing may claim it is**.

**Explicit stop point:** after WP-8 / before any owner closure decision. The
implementer stops at each named gate (G1, post-P1, post-P2) and reports. Do
not start Stage 9.
