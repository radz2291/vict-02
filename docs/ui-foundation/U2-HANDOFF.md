# U2 handoff — designer and workbench breadth

**Status: CLOSED — PASS WITH NON-BLOCKING FINDINGS (2026-10-07). Owner experience
acceptance RECORDED for the integrated Inspector. Current combined implementation:
`471952bb5e9810ec30e370658f812cf9ae6a4eca` (independently verified; repaired from the
round-1 combined FAIL at `2a1ab4c0…`); closure/acceptance record:
[U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md); integration record:
[U2-UX-INTEGRATION-01](reviews/u2/U2-UX-INTEGRATION-01.md); next:
[U3-HANDOFF](U3-HANDOFF.md) PREPARED — IMPLEMENTATION NOT AUTHORIZED.**

> **Historical vs current.** The candidate documented below (`19bb4b9…`, with round-1
> `ebac7bf…` FAILED and independently rechecked repairs) was the **pre-integration U2
> stage result** — its verdicts and reports remain preserved evidence of that exact
> snapshot. The **current result** is the combined candidate: the owner-authorized
> Inspector/Layers UX track (`codex/ui-foundation-u2-inspector-ux`, tested `1bd745a…`,
> records `f31477d…`) merged with lineage preserved (merge `1a61389…` = `e0893fe… ×
> f31477d…`), manager repairs and a bounded repair round later (`2a1ab4c0…` round-1
> combined verification FAIL — canvas selection outline silently inert since U1-era
> `7f49cd0`; repaired at `471952b…` — final independent verdict "PASS WITH NON-BLOCKING
> FINDINGS", [U2-COMBINED-VERIFY-05](reviews/u2/U2-COMBINED-VERIFY-05.md), sha256
> `6ac54af9…`). Nothing below is retracted; sections describe the historical stage
> evidence unless explicitly marked current.

## Baseline and authority

| Item | Value |
| --- | --- |
| Starting remote HEAD (branch `codex/ui-foundation-u1`) | `cb8539372c1f8a9d055de3a7f29dff222262b486` (verified live via `git ls-remote`) |
| Accepted U1 code candidate | `345b5c62f7eae1d02d7697cdd1abc71b0daeee41` |
| Main baseline (must remain untouched) | `4d2df037d8a82d36c60bf1bff16919650643ce22` |
| Frozen amended U0 contract | `9ec87f3e7eb8eb7793f972111258940aac635346` |
| Freeze-record commit | `ea47edd68e302dc5b6cacb2e43635d11781619ad` |
| Worktree | `C:/Users/RZ1/Desktop/RZ/vict-02-u2`, branch `codex/ui-foundation-u2` |

Governing documents: root `AGENTS.md`; `docs/ui-foundation/STATE.md`;
`DECISIONS-AND-EVIDENCE.md`; `U1-HANDOFF.md`; `reviews/U1-ROUND4-REVIEW-05.md`;
frozen `PRODUCT-ARCHITECTURE.md` (§6, §7), `CONTRACTS.md`, `API-SPEC.md`,
`STAGES-AND-VERIFICATION.md` (§4 = U2-01…U2-08, §8), `PROOF-DESIGN.md` (§3.2–3.3, §4–§5).

## Scope (allowed paths)

`packages/ui`, `packages/ui-svelte`, `packages/sdk`, `packages/application`,
`packages/ui-editor`, `packages/ui-preview`, `examples/ui-design-proof` (new),
necessary maintenance of `examples/ui-authoring-proof`, relevant manifests/build wiring/
tests/verification scripts, and UI-foundation documentation.

**Not allowed:** U3/U4 work, the full inspection revision journey, durable backend
replacement, `apps/studio` or other workstreams, merge to main, force-push, publication,
deployment.

## What U2 must deliver (STAGES §4)

- **U2-01** shared component editing, persistent instance overrides, slots, clear
  type/required-slot diagnostics.
- **U2-02** selection provenance through components and repeated records; duplicate-key
  rejection; portal logical ownership.
- **U2-03** grid, overlap, sticky/overflow, tokens, pseudo states, declared
  viewport/environment/container conditions; advanced control uses the same model.
- **U2-04** inspector provenance clarity (authored/effective/inherited/token/condition);
  switching preview sizes must not silently modify base styling.
- **U2-05** coherent responsive service/editorial page with an accessible form
  (hero, overlapping card, grid, sticky section, reusable cards, responsive typography,
  keyboard-accessible validated form).
- **U2-06** usable Studio-style workbench (navigation, workspace, adjustable inspector,
  activity; long labels, scrolling, keyboard, small screens). Graph-shaped fixture is
  presentation-only — no workflow engine, no live operator controls.
- **U2-07** reusable exported canvas, layers, inspector, history modules — composed by
  the proof host, not proof-host-only handlers.
- **U2-08** measured representative workload (PROOF-DESIGN §5), accurate model/render/
  editor coverage, explicit unsupported-feature diagnostics.

Both proofs live in `examples/ui-design-proof`, use the canonical UI document and the
shared renderer; the editor edits the source the application renders. Reusable behavior
goes in public package modules; the host composes them.

## Carried obligations absorbed into U2

- Fix the pre-existing unbound `compileUiDocument` type reference at
  `examples/ui-authoring-proof/src/lib/authoring/store.ts:144` and establish meaningful
  typechecking for proof code (the example is currently excluded from root typecheck).
- Resolve build wiring needed for U2 consumption; report supported build commands
  truthfully.
- Preserve U1 behavior: guarded two-phase save, persistence, history (history identity),
  preview fencing, registry snapshots.
- Document safe orchestration for hosts using the lower-level session API
  (save-window ownership, stage/commit, releaseSaveWindow).

## Verification plan — EXECUTED (2026-10-06, extended 2026-10-07)

1. ✅ Independent technical challenge at `ebac7bf` (FAIL: pseudo CSS blocker, red
   integration gate; U2-01/02/04/07/08 passed) — report preserved.
2. ✅ Independent experience review at `ebac7bf` (FAIL: persisted edits never reached the
   finished page; instance styling no-op; corrupt-store hard-fail) — report preserved.
3. ✅ Repairs at `19bb4b9` (all five findings; regression-pinned) + independent recheck
   "U2-RECHECK: PASS WITH FINDINGS" + independent experience re-verification
   "U2-EXPERIENCE-RECHECK: PASS WITH FINDINGS" at the required sizes — reports + evidence
   preserved under `reviews/u2/`.
4. ✅ Performance measured within all frozen budgets (`U2-PERFORMANCE.json`).
5. ✅ **(Current)** Inspector/Layers integration verified end-to-end: manager integration
   records [U2-UX-INTEGRATION-01](reviews/u2/U2-UX-INTEGRATION-01.md); combined round-1
   independent verification at `2a1ab4c0…` **FAIL** (outline finding; report preserved
   verbatim with full evidence); bounded repairs at `471952b…`; combined round-2
   independent re-verification **PASS WITH NON-BLOCKING FINDINGS**
   ([U2-COMBINED-VERIFY-05](reviews/u2/U2-COMBINED-VERIFY-05.md)) — all eight journeys,
   zero page exceptions, battery reproduced (renderer 125/125, unit 70/70, integration
   4/4, design 12/12, root typecheck 0, check:ui 0/2, broad Svelte check 0/2 known,
   design tsc 0, production build).
6. ✅ **(Current)** Owner acceptance recorded and stage closed:
   [U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md).

## Checkpoint — SATISFIED (2026-10-07)

The owner checkpoint was a founder-facing walkthrough (~10 min, ordinary tasks, plain
labels; advanced detail optional). Independent technical/experience verdicts are
necessary but NOT sufficient. **The owner reviewed and approved the integrated Inspector
experience (the walkthrough as amended); acceptance is recorded with exact scope in
[U2-OWNER-ACCEPTANCE-01](reviews/u2/U2-OWNER-ACCEPTANCE-01.md), and U2 is closed as PASS
WITH NON-BLOCKING FINDINGS.** Retained findings, owners and next checks are in that
record. U3 remains unauthorized until the owner accepts [U3-HANDOFF](U3-HANDOFF.md).
