# U2 round-3 repair (N1 cascade fix) — INDEPENDENT VERIFIER REPORT

Verifier: fresh independent verifier (vict.vict-verifier). I did not build the candidate; this run was falsification-only. No candidate file was modified (worktree byte-clean at exit, re-verified after the session interruption).

## Tested SHAs (all live-verified)

| Ref | SHA | Status |
|---|---|---|
| Candidate HEAD (worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u2`, branch `codex/ui-foundation-u2`) | `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff` | verified live at run start AND re-verified after interruption; `git status --porcelain` = 0 entries at exit |
| Remote tip `origin/codex/ui-foundation-u2` | `83ba87f7aa112a1d93e7236c9c3ec2f4505f6cff` | `git ls-remote` — identical to HEAD |
| `origin/main` | `4d2df037d8a82d36c60bf1bff16919650643ce22` | `git ls-remote` — unmoved |

Dev server: `vite dev` on `http://127.0.0.1:5333`, process command line confirmed started from the candidate worktree (`examples/ui-design-proof`); left running. Port 5199 untouched (not listening).

## The repair under test

`packages/ui/src/compile.ts` line ~390: definition-body `localStyle` layer assignment changed from `'local'` to `scope.inDefinition ? 'componentBase' : 'local'` — one line, exactly as claimed. `inDefinition` is threaded through definition expansion and inherited by children (compile.ts:467, :576). Frozen layer order declared by the plan: `['token','componentBase','componentVariant','source','local']` (compile.ts:618). I additionally confirmed the **built `packages/ui/dist/compile.js` contains the exact fixed ternary** — this matters because the dev server resolves `@victframework/ui` to the workspace package's `dist` output, so the browser demonstrably served the repaired compiler.

## Per-demonstration verdicts

Real-browser walkthroughs were driven over CDP against the live dev server, with `localStorage` cleared between journeys. Computed styles were read via `getComputedStyle` in the page; timestamps/revision numbers below come from the workbench activity log visible in the captured screenshots.

### D1 — Instance pink → shared blue: PASS
Sequence (screenshot `evidence/D1-canvas-pink-blue.png`, activity log): 23:37:19 `Applied setStyleDeclaration on svc.cardAdaptations` (scope "this instance only", pink) → 23:37:25 **Saved revision 2** → 23:38:01 `Applied setStyleDeclaration on svc.card` (scope "the shared definition (all instances)", blue) → 23:38:07 **Saved revision 3**.
Result on canvas: Adaptations `rgb(255,192,203)` (pink); overlapCard, Kitchens, Bathrooms, stickyCard all `rgb(0,0,255)` (blue). Fresh `/service` load rendered the identical distinction. **The pre-repair failure mode (shared blue flattening all five cards) did not occur.**

### D2 — Shared blue → instance pink (reverse order): PASS
Screenshot `evidence/D2-canvas-sharedblue-then-pink.png`, activity log: 23:43:45 shared blue on `svc.card` → rev 2 → 23:44:37 instance pink on `svc.cardAdaptations` → rev 3. Final canvas identical to D1 (Adaptations pink, four others blue). Both authoring orders converge on the same correct cascade.

### D3 — Seed accent-override survives shared edits: PASS
Seed baseline (fresh storage): Adaptations tint `rgb(231,242,236)`, border-left `4px solid rgb(31,111,84)` (via `src.accent-override`, source layer). After the shared-definition blue edit (activity: `Applied setStyleDeclaration on svc.card`), Adaptations **kept** `rgb(231,242,236)` AND the border-left — the instance source-layer override both persists and outranks the new shared componentBase rule, per the frozen cascade. The teal border-left is also visible in the D2 screenshot.

### D4 — Undo/redo + save/reload/reopen preserve the distinction: PASS
From the D2 final state (rev 3): undo #1 removed only the instance pink (Adaptations → tint, others blue); undo #2 removed the shared blue (seed state); redo #1 restored shared blue; redo #2 restored instance pink (fresh read: Adaptations pink, Kitchens blue, `canRedo=false` — history exhausted). Shared and instance edits step **independently**. Save + full workbench reload rendered the same distinction; **"Reload stored"** reopened stored revision 4 (history cleared) with the same rendering; fresh `/service` tab identical.

### D5 — Removing an override: PASS at model level; UI gap recorded (finding F1)
No UI removal affordance exists: `packages/ui-editor/src/commands.ts` exposes no `removeStyleDeclaration`/clear op (ops: insert, move, setStyleDeclaration, setAttribute, bindExpression, connectInteraction, fillSlot, setConditionalStyle, remove, setProperty), and the Inspector explicitly disables empty-value apply ("Enter a value first (an empty value would be a silent no-op)"). Model-level demonstration: deleting the instance `localStyle` from the stored document bytes (`svc.cardAdaptations`) and reloading → Adaptations follows shared/seed styling again (`rgb(231,242,236)`), no banner, and a subsequent fresh `/service` load renders exactly the stored state. The state model has no ratchet; the gap is UI-only.

### D6 — PRESERVED storage: PASS (full)
Stored `vict.u2.service.doc` = `{corrupt-not-json` (invalid JSON) → reload → banner: "Stored design data is unreadable and has been **PRESERVED** (stored authoring data is not valid JSON (stored bytes preserved)). Save will fail until the site data for this key is cleared."; seed rendered. Applied an instance edit (gold on Kitchens) → **Save FAILED (UI_STORE_CORRUPT): refusing to overwrite preserved data**. Banner **still visible** after the refusal; stored bytes **byte-identical** (`'{corrupt-not-json'`).

### D7 — Successful replacement clears the warning: PASS (full)
Stored a readable envelope (`format:'vict.design-store@1'`, `storedRevision:'1'`) whose document was schema-corrupted (root → missing node) → banner: "Stored design data was **not usable** (stored document invalid: UI_DOC_UNKNOWN_NODE …). A fresh seed was loaded; the next successful save **replaces** the stored data." (Note: an envelope-less or wrong-`schema`-field payload classifies as PRESERVED, not overwritable — the classifier at `local-storage-store.ts` requires `format`.) After an edit + save: banner **cleared**, "Saved as stored revision 2", stored envelope re-parsed valid (`vict.design-store@1`, rev 2, root resolves).

## Re-verified criteria

- **U2-01 (instance overrides persist across shared edits)** — SATISFIED. D1–D4 all pass, both authoring orders, across undo/redo/reload/reopen and the finished page.
- **U2-03 (frozen cascade in the compiled plan)** — SATISFIED at plan level with independent attacks (`evidence/plan-cascade.mjs`, 20/20 checks): shared-body `localStyle` → `componentBase` and never `local`; instance `localStyle` → `local`; definition-body styleSource → `componentBase`, instance styleSource → `source`; `local` after `componentBase` after `token`; `source` after `componentBase`; `local` beats `source` on the same node; exactly one local rule under both authoring orders; nested definition-body localStyle → `componentBase`. Builder's pinned test `packages/ui/test/cascade-n1.test.ts` passes 2/2 in my own run.
- **U2-04 (scope targeting + empty-value guard)** — SATISFIED. "Edits apply to"=shared targeted the definition (`svc.card`, "5 instances update together" shown); =instance targeted `svc.cardAdaptations`; empty-value apply verified disabled (no silent no-op).

## Gates reproduced (my own runs, exit code 0 each)

| Suite | Result | Log |
|---|---|---|
| unit (`vitest run --project unit`) | **2499/2499 passed, 129 files** (incl. cascade-n1) | `evidence/unit.log` |
| renderer (`--project renderer`) | **116/116 passed, 16 files** | `evidence/renderer.log` |
| integration (`--project integration`) | **4/4 passed, 1 file** | `evidence/integration.log` |

## NEW findings

- **F1 (minor, non-blocking, UI gap — D5):** No UI affordance removes an instance style override (no remove command; empty-value apply disabled). User effect: a user cannot un-apply an intentional override from the Inspector; only byte-level/programmatic editing removes it. State model and persistence behave correctly. Suggested follow-up: a `removeStyleDeclaration` op + Inspector affordance.
- **F2 (observation, UNVERIFIED, non-blocking):** In both screenshots the Inspector's "effective value" annotation shows a value inconsistent with the rendered canvas (D1: `rgb(255,255,255)` while the selected Kitchens card renders blue; D2: `rgb(231,242,236)` while Adaptations renders pink). Possibly a stale read or the `readEffective` hook resolving the definition node instead of the canvas occurrence. This touches U2-04's explanation feature, not the N1 cascade; canvas truth was verified directly via `getComputedStyle`. Would verify: instrument/read `readEffective` mapping in `examples/ui-design-proof/src/lib/design/adapter.ts` against the live selection.
- Method note (not a product finding): synchronous CDP evaluation reads DOM state one Svelte flush behind after click-driven mutations; all anomalies I hit were artifacts of this and resolved by re-reading after a task boundary.

## Not covered

- Root typecheck (claimed 0) — not run (time cap).
- Design proof suite (claimed 12 + typecheck 0) and authoring suite (claimed 33) — not run.
- Known-environmental pass-1 subprocess/scaffolder suites — not re-run.
- D5 UI-level removal — not executable; affordance does not exist (that IS finding F1).
- Journeys used the persistent CDP Chrome profile with `localStorage` cleared between journeys rather than a brand-new browser profile.

## Verdict

**U2-N1-VERIFY: PASS WITH FINDINGS**

All seven required demonstrations passed (D5 at model level, per its own instruction), the plan-level cascade survives independent falsification attacks, the three logged gates reproduce exactly (2499 / 116 / 4), the pinned SHA and origin/main were live-verified, and the candidate worktree was left byte-clean. The two findings above are non-blocking.
