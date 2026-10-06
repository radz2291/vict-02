# U2 handoff — designer and workbench breadth

**Status: authorized (2026-10-06). U1 ACCEPTED by the owner at the verified round-4
candidate `345b5c62f7eae1d02d7697cdd1abc71b0daeee41`, with its disclosed non-blocking
notes retained. U2 ONLY is authorized. U3/U4 are not.**

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

## Verification plan

1. Independent technical challenge at an exact committed candidate (fresh verifier,
   out-of-repo harness, did not implement; attacks per criterion + regressions + gates).
2. Independent EXPERIENCE review through actual browser use at 1440×900, 1024×768,
   390×844 and a 480 CSS-px container, against PROOF-DESIGN §4 visual criteria — not
   inferred from tests.
3. Representative performance measurement (disclosed environment/method; budgets frozen
   in PROOF-DESIGN §5).
4. Repairs → new candidate → independent recheck of affected behavior + regressions.
   Red evidence preserved.

## Checkpoint

The owner checkpoint is a founder-facing walkthrough (~10 min, ordinary tasks, plain
labels; advanced detail optional). Independent technical/experience verdicts are
necessary but NOT sufficient: **owner experience acceptance remains pending** at the end
of this stage.
