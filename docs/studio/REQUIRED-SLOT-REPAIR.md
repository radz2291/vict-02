# Studio B-1 required-slot repair candidate

2026-10-22. Builder repair only; independent re-verification is pending.

Base: `67a47c3732a2527c8c7086dfcae184672f1aae96`. Isolated branch: `codex/studio-required-slot-repair`. Worktree: `C:/Users/RZ1/.codex/worktrees/studio-required-slot-repair/260831-VCT-02`. The original `codex/studio-canvas-first` branch, main, owner port5480 and verifier port5587 are unchanged. No merge, publication, deployment, feature or unrelated Stage9 work.

## Finding and repair

The independent verifier demonstrated that missing/empty required Dialog body slots were refused only at rendering. Canonical screen validation accepted them; direct store saves and Run saved could accept invalid source. The original handoff's explicit Save/Run-blocking claim was false at the reviewed candidate. Its historical text is retained. Independent red evidence: `codex/studio-designer-independent-verification` at `9a681c8f41611ff09ef77ed2a8e039cc9e8d0d43`; no verifier files or branch were edited.

Required-slot constraints belong to the registered renderer implementation contract, so this repair does not duplicate them as Dialog-specific UI checks or change the framework-neutral application/document ABI. New shared `validateSvelteComponentPlan(plan, descriptors, implementations)` preflights compiled component occurrences with the existing `resolveSvelteComponent` authority. It traverses element children, local component bodies and fills, catalog fills, conditional branches, repeat templates and fallback instructions without mounting, executing or reading runtime state. All component-resolution failures are refused, including absent registrations. The renderer's normal incomplete-draft diagnostics remain available to authoring.

Studio's `compileScreen` now composes this preflight after canonical application compilation. The same composition is used by source validation, Save readiness, execution dispatch, saved-source storage validation and finished replay. Invalid source returns diagnostics rather than an executable application plan. Valid `vict.application@3` identity/compilation, canonical sessions/history, adapter ownership and finished-entry separation are unchanged.

The generic `createLocalStorageDocumentStore` now applies its existing optional host validator to incoming saves as well as loaded envelopes. Validation errors/throws refuse with `UI_EDIT_VALIDATION_FAILED` before writes. Existing corrupt-envelope/stale-revision precedence and the last saved bytes/revision are preserved. A valid replacement can still replace a readable invalid envelope using its recorded revision. No new option or serialized marker is introduced. Hosts omitting validation keep their prior behavior.

Incomplete slot edits still apply through the shared editor session. The owner can insert a Dialog, enter its empty composition and add content, or undo removal. Save/Run is refused until the runtime component contract is satisfied. Previously persisted invalid source is classified invalid with its diagnostic, and its bytes are preserved rather than run.

## Changed paths

- `packages/ui-svelte/src/document/extensions.ts`: additive shared preflight export (public index already exports this module).
- `packages/ui/src/local-storage-store.ts`: enforce the composed validator before persistence.
- `apps/studio/src/lib/designer/application.ts`: compose authoritative renderer preflight for stored/executable screens.
- `packages/ui-svelte/test/component-preflight.test.ts`, `packages/ui/test/local-storage-validation.test.ts`, `apps/studio/tests/designer-required-slots.test.ts`: regression coverage.
- This repair record, an appended handoff note and two builder screenshots. No lockfile/manifest/version changes.

## Builder checks

- `npm ci --ignore-scripts`; repository `npm run build`: pass.
- `npm run typecheck`: pass.
- `npm run build -w vict-studio`: pass.
- `npm run check:designer -w vict-studio`:0 errors,6 inherited warnings.
- Focused shared tests: storage validation2/2, component preflight2/2, existing component ABI resolution/rendering10/10.
- Studio tests: required-slot boundaries5/5; existing canonical designer4/4, composition3/3, saved replay3/3. Total15 Studio checks across focused runs.
- ESLint on all six changed source/test files and `git diff --check`: pass.
- Retained builder failures: the first preflight test used the wrong compileUiDocument call signature; corrected to the public positional API. The first final-child test omitted the editor's required detachFromParent flag, correctly refusing structural removal; corrected to exercise Studio's actual Remove selection command. Both were rerun passing; these were test-fixture errors, not claimed passing observations.

Genuine pointer/keyboard checking used a separate production server at5591 and a fresh browser origin. Insert Dialog produced `UI_COMPONENT_SLOT_REQUIRED`; Ctrl+S reported Resolve source diagnostics before saving. Entering composition and inserting Text restored a valid save r1.r1. Arrange/Remove selection removed the last body child, after which Ctrl+S was refused. Undo and Ctrl+S restored a valid save r1.r2. Preview/Run saved rendered that same saved application identity `v1_b30d4048eec3…`; opening More details rendered its saved body. [Refused invalid save](required-slot-repair-refusal.png), [Valid saved replay](required-slot-repair-replay.png).

## Independent recheck

Challenge both absent slot entries and explicit empty arrays; closed/nested compositions, repeats/conditional branches, local definitions and required fallback/slot projection; final-child removal and Keep aside; direct store-port writes and persisted old invalid bytes; unchanged bytes/revision after refusal; refill/undo/save/reload/run equality; component-registration refusal and finished-entry isolation. N-1 narrow Open screen submenu clipping remains for later polish and was not changed.

Launch from this worktree with the ordinary repository/Studio builds, then from apps/studio use ORIGIN=http://127.0.0.1:5591, HOST=127.0.0.1, PORT=5591 and node build. Local defaults remain operator / studio-local-pass. Independent re-verification owns the verdict; this report does not close B-1 or mark Stage9 Verified.
