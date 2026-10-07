# U2 UX integration — manager record 01 (combined candidate)

**Status: COMBINED CANDIDATE BUILT + BUILDER-VERIFIED (2026-10-07); fresh
independent verification of the exact pushed candidate is the next gate; owner
experience acceptance and U2 closure remain PENDING.**

## Lineage

| Item | SHA |
| --- | --- |
| U2 manager track (origin/codex/ui-foundation-u2 before integration) | `e0893feebc3e9783b7a29026c2285929819f86bb` |
| UX track final records (origin/codex/ui-foundation-u2-inspector-ux tip) | `f31477d804d561f29bcd33fb89050699bfe659a4` |
| UX independently tested implementation (inside the above) | `1bd745a04334af07934db33211ef7803a2e4cd0b` |
| UX branch base (N1-verified U2 candidate) | `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff` |
| Combined candidate | this branch `codex/ui-foundation-u2`; exact SHA recorded in STATE at delivery |

The integration is a normal merge commit whose parents are the U2 manager tip
and the UX tip; both lineages, all failed-candidate reports
(U2-TECHNICAL-REVIEW-01/EXPERIENCE-REVIEW-01 at `ebac7bf…`, UX ROUND-1 and
n1-candidate FAILs) and every earlier verdict remain preserved.

## What the manager changed on top of the two tracks

1. **Mounting (examples/ui-design-proof/src/routes/workbench/+page.svelte)**:
   friendly EditorLabels for both workbench documents; Layers receives the
   canonical working document, labels and the renderer scope; selection goes
   through `bridge.select` so canvas, Layers and Inspector share one occurrence;
   `readEffective` depends on a host `domVersion` signal fed by Svelte ticks,
   the canvas-frame ResizeObserver and window resize; `lastIssues` passed from
   apply outcomes; `knownActionIds`/`knownTokenIds` wired; bridge-owned
   editing, history, revision checks and persistence untouched.
2. **Manager-owned checking repairs**: `UiRenderPlan` import in EditorCanvas;
   workbench `state` → `snapshotState` rename and `$derived.by` typing; the
   design-proof check configuration now includes the generated SvelteKit
   ambient declarations (`.svelte-kit/ambient.d.ts`, `env.d.ts`,
   `non-ambient.d.ts`, `$types.d.ts`) and no longer excludes `.svelte-kit`.
   Broad Svelte check: **0 errors / 2 known warnings** (previously 23 errors).
3. **Combined-candidate defect repair** (packages/ui-editor/src/
   InspectorControl.svelte, found by workbench-level browser testing): bare
   numbers now commit with `px` on both editor paths and the editor branch keys
   on the committed value, so the field no longer switches identity mid-typing.
   Details and rationale in [u2-ux/FINDINGS.md](../../u2-ux/FINDINGS.md).
4. **Evidence protection**: `.prettierignore` covers generated build output and
   the verbatim evidence directories; ITERATION-2-REVIEW.md restored to the
   evaluator's original bytes with a scoped `.gitattributes` rule, reconciling
   the recorded A9E855… checksum (details in FINDINGS, items 6–7).
5. **Selected-state evidence**: screenshots/integration/ captures the selected
   Adaptations card in the combined workbench at 1440×900, 1024×768, 390×844
   and the 480 container preview.

## Builder checks at the combined candidate (pre-verification)

- Root typecheck: 0 errors. check:ui: 0 errors / 2 known warnings.
- Broad design-proof Svelte check: 0 errors / 2 known warnings.
- Renderer suite 124/124 (18 files, including the new regression), unit
  ui/ui-editor 70/70 (7 files), design proof 12/12, integration
  4/4, design-proof typecheck and production build pass, root `format:check`
  clean.
- Builder real-Chrome workbench journey: 19/19 PASS (render + friendly labels;
  canvas→Inspector selection; text-size edit effective 61px with matching
  Browser now; undo 56px/redo 61px; save→reload→reopen; window-resize and
  390-container measurement freshness; shared background edit reaching all
  instances; Adaptations attached override surviving the shared edit; one-step
  shared undo; instance-scoped pink affecting only that wrapper; Reset revealing
  the next cascade value; Reset undo; Layers search + exact selection sync;
  storage-refusal byte preservation with visible banner; 390×844 usability;
  linked padding 29px as one undoable transaction; zero page exceptions).
  Harness kept out-of-repo; this is implementer evidence, not a gate verdict.

Separate branch verdicts do not establish that the combined build passes: the
fresh independent verification of the exact combined candidate does that work
next, followed by the founder checkpoint.

## Round 2 — independent verdict on 2a1ab4c and bounded repairs

Fresh independent verification at exact pushed candidate
`2a1ab4c0843ac0512ce23519bbe3569d8479a116` (separate detached worktree, own
port 5210 and Chrome profile): **FAIL** — one blocking finding (F-1: canvas
selection outline silently never rendered; a Svelte expression inside the
markup style element is not interpolated, so the selector never matched;
byte-identical since U1-era `7f49cd0` and never previously tested), plus
non-blocking F-2 (390×844 first-screen reachability of the Text size control on
the workbench), F-3 (pre-existing ui-editor workspace build TS2307, not a
claimed gate) and F-4 (Inspector scope persistence sharp edge). All lineage,
checksums and automated check numbers were independently reproduced; seven of
eight demonstrations passed in full. Report imported verbatim:
[U2-COMBINED-VERIFY-04.md](U2-COMBINED-VERIFY-04.md) (sha256
4f43202343096cb60dcea89cf102c77ceaa4503d2364ffb8bd91578848061957) with all
evidence under [combined-verify-evidence/](combined-verify-evidence/).

Manager repairs at the follow-up candidate (this commit):

- **F-1**: EditorCanvas marks the exact selected occurrence with
  `data-ui-selected` (effect + tick; moved on selection/source changes) and a
  static CSS rule draws the outline; regression-pinned (renderer 125/125).
  Builder browser recheck: solid 2px outline via mouse AND keyboard selection,
  exactly one marked element, zero page exceptions.
- **F-2**: the ≤860px workbench layout bounds the canvas region so it scrolls
  internally; the Inspector with the Text size control now starts within the
  first screen at 390×844 (observed y≈757), no horizontal overflow.
- F-3/F-4 remain recorded, non-blocking.

Battery at the repaired candidate: root typecheck 0; check:ui 0/2 known; broad
svelte-check 0/2 known; renderer 125/125; unit 70/70; design 12/12; integration
4/4; design tsc + production build; format clean. Selected-state screenshots
refreshed (outline now visible). Fresh independent re-verification of the exact
repaired candidate is the next gate; the combined candidate verdict remains
FAIL-then-pending until that re-verification returns.

## Round 3 — independent re-verification verdict (final combined verdict)

Fresh independent re-verification at exact pushed candidate
`471952bb5e9810ec30e370658f812cf9ae6a4eca`: **PASS WITH NON-BLOCKING
FINDINGS**. Report imported verbatim:
[U2-COMBINED-VERIFY-05.md](U2-COMBINED-VERIFY-05.md) (sha256
6ac54af9eb4ff29c8732ab3de282803448a6afa55b3ba269af6b4ece1bf3ec0d). Round-1
FAIL at `2a1ab4c0` stands preserved in U2-COMBINED-VERIFY-04.md.

- Delta boundedness verified (72 files, exactly the claimed scope); the
  round-1 report import confirmed byte-identical both ways (sha256
  4f432023…); 5/5 evidence spot-checks byte-identical.
- F-1/E6 outline: PASS 14/14 (solid outline on the exact selected occurrence
  after mouse AND keyboard selection, exactly one marked element, moves and
  clears correctly). F-2/E8: PASS 10/10 (Text size first screen at 390×844 —
  y≈682 vs 3499 in round 1; no horizontal overflow; honest annotations).
- Regression journeys E1–E5/E7: PASS with identical values to round 1; zero
  page exceptions across all 8 journeys. Automated battery independently
  reproduced: renderer 125/125, unit 70/70, integration 4/4, design 12/12,
  root typecheck 0, check:ui 0/2, broad svelte-check 0/2, design tsc 0,
  production build pass.
- Carried non-blocking findings: **NF-1** — root `format:check` failed at the
  pushed round-2 candidate on the 40 imported verifier evidence files; the
  round-2 record's "format clean" line was true of the pre-import working
  tree and is amended here. Fixed by a records-only `.prettierignore` scope
  for `docs/ui-foundation/reviews/u2/combined-verify-evidence/` (evidence
  bytes untouched; `format:check` now clean at the follow-up records commit).
  **NF-2** — favicon.png 404 console noise (verifier falsified it as
  pre-existing by probing both SHAs). **F-3** — ui-editor workspace build
  TS2307 (pre-existing; nothing consumes the dist; not a claimed gate).
  **F-4** — Inspector scope persists across selection changes (badge always
  names the active destination). NOT DEMONSTRATED (carried honestly): literal
  browser-process restart; owner/founder experience acceptance.

**Combined candidate verdict: PASS WITH NON-BLOCKING FINDINGS at
`471952bb5e9810ec30e370658f812cf9ae6a4eca`** (with the records-only NF-1
follow-up commit on top). Owner experience acceptance and U2 closure remain
PENDING; this verdict does not authorize U3/U4, apps/studio changes, merge to
main, publication or deployment.

## Round 4 — owner acceptance recorded; U2 closed (2026-10-07)

The owner approved the integrated Inspector (exact scope recorded in
[U2-OWNER-ACCEPTANCE-01](U2-OWNER-ACCEPTANCE-01.md)). That satisfied the only
pending U2 owner item, so **U2 is formally CLOSED as PASS WITH NON-BLOCKING
FINDINGS** at combined implementation `471952bb…` (records `1fe5383…` and the
closure commit). This integration record remains the manager-side account of
the integration and repair cycle; the acceptance record owns the closure
statement and the retained-findings disposition table. U3 is PREPARED —
IMPLEMENTATION NOT AUTHORIZED ([U3-HANDOFF](../../U3-HANDOFF.md)); nothing in
this closure authorizes U3/U4 implementation, `apps/studio` changes, merge to
main, publication or deployment.
