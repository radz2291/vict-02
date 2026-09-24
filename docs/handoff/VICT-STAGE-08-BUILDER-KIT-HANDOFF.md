# VICT — Stage 08 Handoff: Builder Kit and Self-Hosting

> **Status:** PROPOSED — issued as part of the Stage 8 entry-contract
> candidate for **owner review**. This handoff authorizes NOTHING until the
> owner ratifies the entry contract (architecture document §9). It names
> reference v0.4.28 plus the candidate §0.35 registration (v0.4.29); it is
> valid only against the ratified text of that version or later.
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
- **BLD-001 … BLD-012** (the Stage 8 family defined in the architecture
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
  `vict.builder.tools@1`, `vict.builder.profile@1`,
  `vict.builder.handoff@1`, `vict.builder.result@1`,
  `vict.builder.audit@1` (JSON Schema documents shipped from the package;
  validators plain and dependency-light);
- the deterministic context-pack generator (canonical, insertion-order-
  independent, byte-stable for identical inputs) with the provenance record
  of architecture §3.4;
- the freshness checker implementing every §4.3 drift class;
- the profile-enforcing tool wrapper `vict-builder-kit run` (fs.read /
  fs.write with in-scope enforcement / shell.run by npm-script name /
  git status|diff|log|commit; denial records emitted as structured events);
- the `vict-builder-kit` CLI: `generate`, `verify`, `validate`, `run`,
  `init-app` (generates `BUILDER-KIT.md` + app pack into an external app
  project for P2);
- unit + negative tests inside the package (generator determinism, each
  drift class, each schema's rejection set, profile refusals).

### WP-2 — VICT self-hosting wiring

- Root `BUILDER-KIT.md`, generated and committed (architecture §3.2);
- `docs/builder-kit/context-pack.json` + `docs/builder-kit/PACK.md`,
  generated and committed;
- pack inputs exactly as architecture §3.4 (reference, release-compatibility
  constant, workspace manifests, the named handoff);
- npm scripts: `kit:generate` and `verify:builder-kit` (the new gate),
  leaving every existing script untouched;
- constitution excerpts limited to the §3.3 list; the task overlay binds
  THIS handoff by path + SHA-256 (recomputed at freeze time after
  ratification — placeholder below).

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
implementing architecture §3.9: regenerate-and-compare, anchor recomputation,
schema validation, and the negative-control battery of §Tests below. The
gate MUST fail (non-zero exit, stable reason) on every negative control and
pass on the committed tree. No existing gate is weakened, reordered, or
bypassed.

### WP-5 — Documentation and knowledge-loop verification

- The kit's README (package) and the architecture document's §3 cross-check
  (mismatch = stop);
- demonstration of architecture §4.2: one mechanical rehearsal on a scratch
  branch showing a contract-touching change whose pack regeneration lags →
  gate red → regeneration in the same commit set → gate green (rehearsal
  evidence quoted in the report; the scratch branch is not merged).

### Gate G1 (stop point)

WP-1–WP-5 complete; full ladder green including `verify:builder-kit`;
implementer report filed. **Proofs may not start from a red ladder.**

### WP-6 — Proof P1: self-hosting equivalence

- Owner selects the two hosts (decision D-2). Each session runs fresh
  (new clone or clean worktree, no shared conversation state), bootstraps
  from `BUILDER-KIT.md`, passes the freshness gate, works under
  `builder.selfhost`.
- Task card variants (equal size, no collision):
  - **Variant A:** add a `readingTime` pure/read capability (contract +
    revision + effect/authority declarations + implementation + example +
    permanent tests) to `packs/notes-pack`, and surface a reading-time
    region on the reference application's notes screen via the Application
    Definition with a permanent renderer-level test.
  - **Variant B:** add a `wordFrequency` pure/read capability with the same
    declaration/test completeness, surfaced as a top-terms region on the
    same screen.
- Each session produces: a `vict.builder.result@1` document (validated),
  full-ladder output, the freshness-gate transcript, and its commit(s).
- Equivalence criterion: BOTH sessions satisfy the same exit criteria with
  independently reproducible evidence. Identical diffs are NOT expected.

### WP-7 — Proof P2: greenfield "TaskLedger"

- Consumption medium per owner decision D-1 (architecture §8): **option A**
  registry install of the next owner-published release set including
  `@victframework/builder-kit`, or **option B** packed tarballs from the
  audited release-source commit with recorded per-tarball SHA-256 and a
  no-checkout-leakage probe (claims then say: registry consumption NOT
  exercised by P2).
- Fresh agent host, empty directory outside both repositories, the §P2
  brief verbatim, `vict-builder-kit init-app` as the kit entry.
- Deliver the F1–F8 behaviors, the claim→evidence table of architecture
  §5.4 (real-browser record for usability claims; scripted real-process
  restart probe for F7; definition/component-island wiring for F6; action
  negative probe for F5; application-identity stability for F8), and the
  negative-control run for the P2 session.
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

1. **Pack determinism:** two generations from identical inputs are
   byte-identical; input-order permutations do not change bytes.
2. **Stale anchors:** each §4.3 drift class simulated (moved HEAD, edited
   source, changed release constant, changed workspace identity, tampered
   pack bytes, unregistered input) → `verify:builder-kit` red with the
   stable per-class reason.
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
7. **Out-of-scope detection (host-mediated):** a staged out-of-scope file
   change → gate diff check flags it against the handoff's in-scope set.
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
  separately authorized — including option A of D-1; the implementer stops
  at the G2→G3 boundary and the owner performs any publication);
- production activation or any Application Release select/rollback in any
  non-local environment;
- Stage 9 Studio, Stage 10 ecosystem, Stage 11 cloud scope;
- Quellight repository access or roadmap work; any live-provider or
  credential-bearing integration;
- Product-agent surfaces: no kit tool, profile, or pack on any product path;
- changes to verified semantics: identity algorithms, activation/run/store
  semantics, effect/approval ordering, `vict.agent-stream@1`, release-set
  identity rules;
- edits under `docs/report/` (historical evidence immutable) and `.pi/`
  (never read or written);
- weakening or reordering any existing verification gate; introducing a
  second application model or destructive regeneration;
- marking Stage 8 or any BLD requirement Verified (independent audit +
  owner closure only).

## Autonomy

- Permitted: create `packages/builder-kit/**`, `scripts/verify-builder-kit.mjs`,
  `docs/builder-kit/**`, root `BUILDER-KIT.md`, the two npm script entries,
  P1 variant implementations in `packs/notes-pack` and
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
- P1 evidence package (two result documents, ladder transcripts, commits);
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
evidence (fresh clones; both variants re-verified); re-run at least the
restart probe and one browser check of P2; verify every negative control by
re-execution; reconcile every material claim against observed output; verify
no out-of-scope, `.pi/`, Quellight, gate-weakening, or publication event
occurred; classify findings (gating/corrective/deferred/rejected); and
return a §22.3 disposition. Implementer claims never substitute for audit
reproduction; the disposition vocabulary is PASS / PASS WITH ISSUES / FAIL /
INCONCLUSIVE.

## Exit gate

- The Builder Kit exists as specified: bootstrap, pack with provenance,
  tools with profiles, schemas, gate — all committed, all tested;
- `verify:builder-kit` green on the committed tree and red on every negative
  control;
- P1: two fresh sessions (two hosts, or agent + human) each completed the
  bounded capability + application-surface change from the same handoff with
  equivalent, independently reproducible evidence;
- P2: the fresh-agent TaskLedger app built from an empty project exists,
  exhibits F1–F8, survives a real-process restart, keeps definition-driven
  surfaces and the custom code island cleanly coexisting, and carries the
  claim→evidence records including real-browser evidence for usability
  claims and the clean-consumer record for the chosen consumption medium;
- scope violations prevented or detected; generated and custom surface
  ownership remains clear; all claims carry reproducible observed evidence;
- production activation and release publication were not performed by any
  builder and remain separately authorized;
- independent audit passes (§27.3) and the owner performs formal closure —
  **until then Stage 8 is not Verified and nothing may claim it is**.

**Explicit stop point:** after WP-8 / before any owner closure decision. The
implementer stops at each named gate (G1, G2→G3 boundary if D-1 option A,
post-P2) and reports. Do not start Stage 9.
