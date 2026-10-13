# Studio: author one screen, run it

Implementation candidate, 2026-10-13. Independent verification and owner acceptance are pending. This is the implementation handoff, not a Stage 9 gate verdict or closure record.

## Lineage and scope

Branch: `codex/studio-author-one-screen`. Base: foundation closure `e401cea58aae1ca68e2f6e26f9c8caf319d4bc66`, including accepted implementation `dcd3cbea255af9aa3b601236e5ee8639cfcb55a4`. Its main-lineage ancestor is live `origin/main` `4d2df037d8a82d36c60bf1bff16919650643ce22`; both tracks are retained by normal ancestry. Main and the foundation branch were unchanged at the final remote check. The original checkout's untracked tarball was untouched.

The current owner's instruction authorizes this designer integration beyond the foundation's historical read-only Studio ownership. No operator expansion, Stage 9 record rewrite, Quellight edit, merge, publication or deployment is included.

## Launch

From this branch's repository root (PowerShell):

```powershell
npm ci
npm run build
npm run build -w vict-studio
cd apps/studio
$env:ORIGIN='http://127.0.0.1:5480'
$env:HOST='127.0.0.1'
$env:PORT='5480'
node build
```

Open `http://127.0.0.1:5480/design`. With the existing local-demo credential defaults, sign in as `operator` / `studio-local-pass`, then choose **Open UI designer**. No operator target is required for designing. Existing provisioned credentials still take precedence. For development, from `apps/studio`, use `node ../../node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 5480 --strictPort`. Do not run development and build/sync checks concurrently: SvelteKit regenerates route modules and may restart the development session. Storage is origin-specific; keep the same host and port when reopening.

## Architecture and shared interfaces

- `/design` is the actual Studio designer; the operator shell links to it and remains available. Desktop has Insert/Layers/Source, a responsive canvas and the approved Content/Style/Behavior Inspector. Phone layouts expose one panel at a time with independently scrolling content.
- The sole authored visual model is `UiDocument`. `screenApplication()` explicitly references it through `vict.application@3`; `compileScreen()` jointly compiles the application, document, resource, contracts and framework catalog descriptors. Working changes and saved replay participate in application identity. Source JSON edits use the same session, validation, undo/redo and save path as visual edits. The exported JSON includes the application attachment and document.
- `EditorBridge` and `UiEditSession` retain history and expected-revision persistence. Browser-local stores validate in the application context, preserve corrupt bytes and refuse stale saves. Draft screens survive in-session switches; only explicit Save persists source. Reopen resets history and runtime state. Navigation protects unapplied JSON and unsaved authored edits.
- Shared `@victframework/ui-editor` now exports `Composer`, `InsertRecipe`, `CompositionTarget`, `insertSubtree`, `compositionTargets`, `compositionParent`, and `compositionChildren`. The host supplies source-only insertion recipes; no catalog implementations are copied into Studio.
- Additive `UiEditCommand` members: `insert.slotName`, `move.slotName`, `remove.detachFromParent`, and `replaceDocument { document }`. Existing omitted-field behavior remains. Slot insert/move checks declared ownership, cycles and root moves; whole-document validation stays atomic. Source replacement preserves schema/id/revision, validates closure, and is undoable. Same-parent reorder rereads its target after detach; subtree removal deletes descendants without leaving orphans. Existing application/document/component-ABI schema markers are unchanged.
- `/run-screen?screen=<document-id>` is a separate finished entry. It loads stored source, compiles the same @3 application, and renders its attached document plan through `DocumentHost` and framework-owned catalog adapters. It imports neither editor nor preview orchestration. The built route's 15-chunk static dependency closure was inspected; editor/preview markers were absent. The router retains a lazy authoring-route reference, not an eagerly loaded authoring implementation.
- One declared `demo.submit` mutation uses exact input/output contracts and an explicitly simulated `ApplicationDataAdapter`; authoring composes it through the existing preview session, finished replay through `ActionDispatcher`. Permission denial, invalid inputs, reset fencing and pending/result feedback are explicit. Simulation has no target operator access or live effects. Runtime values never become authored history or saved source. Selection alone does not reset execution.

## Builder checks

Executed checks: repository build; Studio production build; root typecheck; Studio `check`; designer Svelte check (**0 errors, 6 inherited warnings**); focused ESLint and TypeScript/CSS/JSON formatting; neutral UI/editor/application tests **108/108**; selected renderer/editor tests **35/35**; complete Studio suite **103/103**. Tests include application identity changes, saved-source round trips, stale/corrupt storage, ownership/slot/cycle refusal, source replacement history, simulated denial/reset, and a mounted designer regression proving pointer selection preserves runtime state and leaves authored history clean.

Genuine browser pointer/keyboard checking covered blank creation, nested insertion, text/property configuration, checkbox state binding/output, typed Button action inputs, action refusal/success, typography/color, linked padding/gap, compact-only alignment, moves/reorder/removal with undo/redo, canonical JSON refusal/apply/undo/redo, save/reopen/run, Dialog slot rendering and Escape focus return. Desktop 1440×900 and phone 390×844 were checked. Production serving also reopened and ran the saved source successfully after server restart. [Builder preview](author-one-screen.jpg).

Retained failed observations: the first ownership challenge accepted an undeclared slot (fixed with declaration checks); the first browser action attempt reset state on pointer selection (fixed by observing authored revision separately, with regression coverage). Early style automation using value-fill + Enter did not commit change-on-blur fields; actual typing + Tab committed and changed the rendered source. The broader `svelte-check --tsconfig ./tsconfig.json` still reports **9 errors in unchanged operator pages** (`changesets`, `confirmations`, `product`); those files are byte-identical to the starting foundation/main. Its initial 9 new designer callback typing errors were repaired; the scoped designer check additionally includes all shared editor Svelte files and generated SvelteKit ambient types.

## Known limits and independent challenges

- First slice: one screen per authored application, ten insertion recipes, one simulated declared action. Source JSON can express supported canonical composition/state beyond the visual palette. General action/resource authoring, arbitrary breakpoint creation, drag geometry, multi-user/server persistence and deployment are outside this slice.
- History and unsaved drafts are session-local. Persistence uses the existing localStorage store, including its existing per-turn expected-revision guarantees; this is not a distributed transactional store. Challenge simultaneous tabs, storage refusal/corruption, stale JSON drafts and pending actions across edits/reset/navigation.
- The approved cascade remains: base local overrides can mask conditional attached sources; the Inspector explains this. Compact presentation uses the named `studio-screen` container in both canvas and replay. Hidden mobile canvas measurements are unavailable while another panel is visible. Challenge conditional precedence, base reset, component targets, narrow overflow, keyboard-only authoring and focus after tree edits/portals.
- The broad existing catalog is registered, although the Insert panel exposes a representative subset. Existing foundation findings and the six shared Svelte warnings remain; SSR/performance budgets are unclaimed. The DOM test renderer also emits its existing dynamic-void-element warning for input.
- Independently repeat create → compose → configure → connect → style → save → reopen → run from a clean origin; compare exact saved document and application identity; challenge old release binding after a UI edit and finished-entry dependency isolation. Then perform comprehensive verification, packaging, evidence/governance records and owner visual acceptance separately.
