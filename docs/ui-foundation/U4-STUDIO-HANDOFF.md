# U4 → Studio handoff (2026-10-13, documentation-only closure)

**Accepted baseline:** `dcd3cbea255af9aa3b601236e5ee8639cfcb55a4`
**Closure records:** `43a2c74cca5ad1d7…` (branch `codex/ui-foundation-u4-combined-verify-05`)
**Verdict:** U4/B1–B5 CLOSED — **PASS WITH FINDINGS under owner scoped acceptance**
(owner statement and scope recorded verbatim in
[DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md) and [STATE](STATE.md)).
This handoff prepares Studio work; it authorizes no implementation by itself.

## 1. Reusable capabilities (what Studio builds on)

- **Document model + compiler** (`@victframework/ui`): `UiDocument`
  (`vict.ui-document@1`), expressions, `compile` → `vict.ui-render-plan@1`,
  edit ops (`applyUiEdit`, `UiEditCommand*`), diagnostics, scenario.
- **Renderer + catalog** (`@victframework/ui-svelte`): `renderVictApplication`
  / `DocumentHost`, `ControlScope` (via the `./controls` subpath),
  `catalog/*` sub-exports for **38 recipe modules / 41 families**
  (30 styled-and-usable, 8 supported direct composition, 3 deferred —
  honest tiers preserved in `catalog-coverage.json`).
  **bits-ui is pinned to exactly 2.19.3.**
- **Authoring surface** (`@victframework/ui-editor`, source-exported):
  `EditorCanvas`, `Inspector` (Content/Style/Behavior), `Layers`,
  `HistoryPanel`, `commands`, `bridge` — including the round-5 additions:
  slot-owned label annotation map (16 component ids), badInput-aware
  numeric/list editing, accordion accessible group naming.
- **Application/runtime** (`@victframework/application`, `sdk`,
  `ui-preview`): versioned component registry, preview orchestration,
  `defineApplication`/`defineContract`/`defineResource`.

## 2. Public consumption requirements (do not bypass)

1. **Bundler required** — source exports + bare specifiers; use Vite (or
   equivalent) with `optimizeDeps.exclude` for the `@victframework/*`
   packages (working config: `examples/u4-consumer/vite.config.ts`).
2. **Namespace exports** — `import { Button } from
   '@victframework/ui-svelte/catalog/button'` gives `Button.Root` etc.;
   the module itself is not callable (README requirement verified by the
   independent cold-start gate).
3. **`ControlScope` + `catalog.css`** must wrap/precede any catalog render.
4. **Fresh build before pack** — `node scripts/pack-u4-consumer.mjs` builds
   every workspace package, packs the closure, creates the isolated
   directory (hard-delete: stop servers from it first; `U4_ISOLATED_ROOT`
   relocates it, forward-slash/relative both work — G-C fix verified).

## 3. Accepted Inspector/Layers baseline (verified behaviors)

- Content/Style/Behavior tabs with per-slot ExpressionEditors (Enter
  commits literals; booleans on change); Layers search + row selection
  (`[aria-label="Search layers"]`, `button[data-key*="|<nodeId>"]`).
- **Slot-owned labels annotated truthfully**: "Shown from the 'X' slot
  content while that slot is filled; this value is the fallback text."
  (16 component ids; precedence preserved — slot wins over `label`).
- **Numeric/list editing**: truthful `badInput` feedback ("Enter a valid
  number."), invalid visible drafts are never committed (Add refuses the
  stale valid prefix — independently rechecked in genuine Chrome),
  deliberate empty clears, no spurious dirty/revision.
- Workbench rail per blade: Undo/Redo/Save/Reload stored/Reset to seed;
  `.rail .status` shows dirty+revision.

## 4. Remaining UX refinements and limitations (honest carry-forward)

- **Portal depth**: sibling page-level portals share depth 100
  (popover == dialog tie-break by DOM order) — hardening note.
- **Button loading**: label→spinner width swap (anchor x/y stable; the
  width change is an observation, not a failure).
- **10 plan-tier journeys**: menu open/close, disclosure and geometry
  behavior asserted instead of value echoes (tiering is honest, not a gap).
- **step snapping display**: a list Add of 70 displays 75 when bound to a
  `step: 15` slider (data echo through the bound control's valueChange).
- **Combobox**: two inputs exist (one visually hidden) — drive the visible
  `[data-combobox-input]` in the detail Corrections tab.
- **SSR and performance budgets: UNCLAIMED** — no claims exist; Studio
  must not inherit any.
- Known flaky-under-load fixtures: `restart-sigkill`,
  `agent-governance-corrective`, `release-authority` (green in isolation).

## 5. Real Studio tasks requiring owner acceptance

Owner statement (2026-10-13): the only behavior they can fully accept is
"from the actual studio itself" — so each of these needs owner eyes:

1. **Composing screens** — authoring new documents/blades in the editor.
2. **Configuring components** — Inspector-driven property/slot work at
   authoring speed (U4-04 criterion was met for the bounded brief; owner
   pace is the real test).
3. **Connecting behavior** — expressions, controls, task/action wiring
   (task.schedule pending ~600 ms with `aria-busy`).
4. **Styling** — theme/catalog.css customization against the accepted look.
5. **Saving / reopening** — persistence round-trips (`rawLoad` echo path).
6. **Finished-app replay** — `/app.html?doc=<route>` with real documents.

## 6. Shared-package refinements (reusable, not Studio-only)

Any fix that generalizes belongs in the shared packages (ui / ui-svelte /
ui-editor / application), with a corrected oracle in the same commit —
per the round-4/5 precedent (corrected tests IN the candidate; oracle
corrections recorded + historical supersessions preserved). Do not fork a
Studio-only copy of catalog or editor behavior; extend the descriptor/
contract surface instead (`UiExtensionDescriptor` frozen contract
untouched through round 5).

## 7. Launch (reproducible, from the accepted candidate)

```bash
git worktree add ../u4-accepted dcd3cbea255af9aa3b601236e5ee8639cfcb55a4
cd ../u4-accepted && npm ci && npm run build
U4_ISOLATED_ROOT=../u4-accepted-iso node scripts/pack-u4-consumer.mjs
cd ../u4-accepted-iso/u4-consumer && npx vite preview --port 5460 --host 127.0.0.1
# authoring: http://127.0.0.1:5460/   finished app: /app.html?doc=<route>
```
`examples/u4-consumer/README.md` carries the full consumer path
(5 requirements, all independently verified). Founder preview currently
running from `C:/Users/RZ1/Desktop/RZ/u4-consumer-isolated/u4-consumer`
(packed from the accepted tree).
