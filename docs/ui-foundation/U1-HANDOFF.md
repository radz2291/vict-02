# U1 handoff — first runnable rendering, editing and simulated product loop

Status: AUTHORIZED by the owner on 2026-10-06. This file records the exact grant, baseline,
scope, acceptance authority, verification protocol and stop boundary for U1. It is the routing
entry for every agent that touches U1.

## 1. Authorization and baselines (verify live before any work)

- Grant: the owner accepted the amended U0 contract and authorized **U1 only** — "the first
  runnable rendering, editing and simulated product loop". The owner granted end-to-end
  ownership (implementation, independent verification, repair/reverify cycles, evidence,
  normal push, reporting) with routine technical choices and in-scope defects resolved
  autonomously. Return-to-owner is required at the U1 owner checkpoint, not per iteration.
- Repository: https://github.com/radz2291/vict-02.
- Branch: `codex/ui-foundation-u1`, isolated worktree `vict-02-u1`.
- Starting commit: `97346903e0c1a242b4bab0477c92bc3f34c43c38` (the pushed U0 closure commit).
- Frozen amended contract authority: candidate `9ec87f3e7eb8eb7793f972111258940aac635346`;
  freeze-record commit `ea47edd68e302dc5b6cacb2e43635d11781619ad` (FREEZE.json v2, 22 pins).
  Frozen contract bytes are resolved at the contract SHA via
  `git cat-file blob 9ec87f3e7eb8eb7793f972111258940aac635346:<path>`; later evidence
  additions on the branch are reporting history and never amend frozen semantics.
- Previously verified main baseline: `4d2df037d8a82d36c60bf1bff16919650643ce22` (origin/main;
  must remain unmoved — verified live at U1 start).

## 2. Acceptance authority

`docs/ui-foundation/STAGES-AND-VERIFICATION.md` §3, criteria **U1-01 … U1-08**, are the
acceptance authority, implemented per the frozen `API-SPEC` (document model §3, plan §4,
expressions/styles/conditions §5, edit/preview protocols §6, diagnostics §7, API surface §8,
module plan §9), `CONTRACTS`, `PRODUCT-ARCHITECTURE` and `PROOF-DESIGN` (inspection domain §1,
scenario matrix §2, visual criteria §4, performance environment/budgets §5).

U1 bounded slice (STAGES §3): element/text/component nodes, simple repeat, literal and typed
references, basic interactions, local state, flex/grid essentials, token/local styles and a
viewport condition. Everything else in the model stays explicitly pending (later stages).

**Explicitly out of scope for U1** (owner boundary): the complete rejection→correction→
resubmission journey UI (the revise loop is a frozen fixture and U3 journey), broad designer
features, the contrasting page/workbench proofs (`examples/ui-design-proof` is U2), and
durable replacement (U3-05).

## 3. Implementation scope (frozen at API-SPEC §9)

`packages/ui`, `packages/ui-svelte`, `packages/sdk`, `packages/application`,
`packages/ui-editor` (new), `packages/ui-preview` (new), `examples/ui-authoring-proof` (new),
plus necessary workspace manifests, lockfiles, build wiring, focused tests and documentation.
A bounded normal-application consumer is included for U1-02. Package manifests stay on the
existing `0.4.0-rc.1` source version line. The dependency graph stays acyclic
(ui → nothing; sdk → contracts, ui; application → contracts, sdk, ui; ui-svelte →
application, sdk, ui + svelte; ui-editor → ui, ui-svelte, application(types); ui-preview →
application, runtime, sdk, ui). Reusable functionality lives in public package exports; the
proof host composes capabilities and never becomes their hidden implementation. Editor and
scenario infrastructure stay out of the normal application entry graph.

## 4. Required verification protocol

1. Meaningful automated checks for source identity (U1-01), transactions (U1-03),
   persistence/round trip (U1-04), execution boundaries (U1-05/U1-06), compatibility and
   regression safety of the existing `@1`/`@2` behavior.
2. Actual browser walkthroughs at 1440×900, 1024×768 and 390×844 (PROOF-DESIGN §4) with
   console-error inspection; recorded commands, environment, fixtures, measurements and direct
   evidence. Design-fixture inspection alone does not establish runtime behavior.
3. An **exact candidate commit**, then a **fresh independent verifier** (a separate instance
   that did not implement the candidate) attempts to falsify U1-01 … U1-08. The verifier never
   silently repairs the audited candidate. Failures are preserved; repairs go through the
   builder/integrator; a new exact candidate is committed and affected behavior plus relevant
   regressions are reverified. Continue until the gate passes or a genuine stop condition
   remains.
4. Finish with truthful STATE/evidence updates, a normal push of `codex/ui-foundation-u1`,
   and live remote-SHA verification. Report criterion verdicts, candidate/verifier/final
   SHAs, retained findings, supported limits and exact launch instructions with a short
   owner-walkthrough.

## 5. Stop boundary

Stop at the U1 owner checkpoint. Do **not** start U2. No `apps/studio` or Stage 9 changes, no
merge to main, no force-push, no publication, no production activation. The U0 freeze records
(`ffbafc0a…`, `ea47edd6…`) are preserved untouched. If a material contract change becomes
necessary, document the evidence and the concrete choice instead of silently changing the
frozen authority.

## 6. U1 evidence index (maintained as work proceeds)

- Candidate and verification records: `docs/ui-foundation/reviews/` (U1 review reports),
  DECISIONS-AND-EVIDENCE.md §U1 entries, STATE.md gate ledger.
- Walkthrough/launch instructions: `examples/ui-authoring-proof/README.md` and the final owner
  report.
