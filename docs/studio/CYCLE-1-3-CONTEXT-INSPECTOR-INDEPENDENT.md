# Context menus and shared Document Inspector — independent challenge

2026-10-24. Fresh verifier; no product repairs performed by this reviewer.

**Final disposition: REVERTED / NOT ACCEPTED at the owner's request.** The owner explicitly requested Git revert during the correction round. Verification and further product work stopped. There is **no final independent PASS** for either contextual-menu/shared-Inspector candidate. The builder owns the revert and its final exact Git identity; the observations below remain historical evidence, not acceptance of the reverted UI.

## Exact candidate and authority

Challenged product `ac8b696e048658f163b909eb292827c160d20a79`, branch `codex/studio-cycle-1-3-completion`; local clean tree and remote branch equality checked before review. Remote main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Prior delivery `0877fe5df7f1d4c6ecd41fce07b5c6130d12f0d2`; owner-authorized scope is [the scoped handoff](CYCLE-1-3-CONTEXT-INSPECTOR.md). Review uses the separately served production build on `127.0.0.8:5602`, isolated from owner previews on 5599, 5600 and 5601. Only disposable synthetic source was authored through Studio's Source editor; no model requests or owner-document edits.

## Initial verdict: FAIL — repairs required

- **CI-01, blocking, Structure graph disappears.** At 1280×720, opening Document → Structure with the shared Inspector open shows a completely blank graph area. `.structure-body` and `.structure-context` measure 274.2px high, but `.structure-canvas` and `.svelte-flow` measure **0px** high. Closing Inspector leaves graph height 0px as well. Computed context-trigger `align-items` is `center`; its generic catalog trigger presentation interferes with graph stretching. Independent screenshot retained locally at `C:/Users/RZ1/AppData/Local/Temp/vict-context-CI01-blank-graph.png`. This failure is invisible to DOM-only assertions that merely check graph existence.
- **CI-02, blocking, first secondary click loses the menu.** With Inspector closed, right-clicking a different canvas heading changes selection and opens the floating Format palette, but no context menu appears. A second right-click on the same heading opens the menu. Reproduced twice on the real browser pointer sequence. With Inspector already open, right-clicking a different target opens the menu correctly. Existing tests dispatch only `contextmenu` and miss the earlier pointer-selection lifecycle.

Both concerns were sent immediately to the builder. No gate PASS is implied by green unit checks.

CI-01 also reproduces in the showcase Text input recipe: the shared Inspector is visible at 280px while its Structure canvas measures 0px. The same component failure reaches both hosts. Showcase Interact input remained exactly `Independent runtime preserved` across Layers → Structure transitions. Keyboard Shift+F10 on the full Designer's empty canvas wrapper opens the canvas menu correctly.

## Independent checks on the initial candidate

- Affected tests **18/18 PASS**, four files: `tests/ui/context-inspector.test.ts`, `tests/ui/composition.test.ts`, `tests/ui/structure.test.ts`, `tests/structure-presentation.test.ts`. Direct existing root Vitest executable, `--maxWorkers=1 --no-file-parallelism`, from `apps/studio`. Log: `%TEMP%/vict-context-independent-tests-serial.log`.
- Svelte check **0 errors / 6 retained warnings** in unchanged renderer/editor files. Direct existing `svelte-check` executable with `tsconfig.designer.json`. Log: `%TEMP%/vict-context-independent-svelte-direct.log`.
- `git diff --check` PASS; product source unchanged by verifier.
- Real browser positives: context target selection; shared Inspector follows canvas selection, stays the same pane across Layers/Structure; keyboard height change to 296 remembered; maximize makes underlying Layers inert and excludes its tree from native accessibility; Tab from Restore reaches Close; pending text draft survives refused Document close and object right-click; canonical Duplicate targets the second heading; Delete removes that target; Undo restores byte-equivalent parsed saved JSON; native input and Interact secondary clicks do not open editor menus.

Retained environment observations: initial `pnpm` invocations unexpectedly triggered dependency-status auto-install and failed against private workspace package registry lookups; no source/lockfile change. An incorrect direct app-local Vitest path was absent; root executable corrected. First concurrent Vitest run completed 11 passing assertions but had an unexpected worker exit and is not counted as a clean pass. Serial rerun above completed cleanly. Tests emit caught AgentChat localhost:3000 connection-refused logs; no provider requests were sent.

Remaining actual-browser challenge of Structure node selection, menus, metadata synchrony, responsive graph/Inspector geometry, and showcase parity is pending repair of CI-01. Broader agent reliability findings, owner acceptance and Stage 9 closure are outside this gate.

## Owner correction during challenge

The owner clarified: “I say inspect is usable for both structure and layers.. not the floating tool which already nicely on canvas”. This supersedes the builder's interpretation that the shared pane should replace canvas editing tools. The corrected gate must demonstrate shared **source facts/properties and relationships inspection** beneath Layers/Structure, while ordinary canvas editing retains its existing floating tools. An explicit Edit properties handoff may open those tools. Candidate `9421543071d604c4c9d5df27ea8150e96c7a76dc` repairs CI-01/CI-02 but is not independently accepted and predates this corrected scope; verification is held for the next exact corrected candidate. Earlier failure evidence remains valid for its original candidate.

The subsequent owner-requested revert supersedes that pending correction gate. The reviewer stopped without a repair verdict, further browser actions or further test invocations. Checks already in flight at the correction message are not final-product evidence and are not counted as acceptance. CI-01 and CI-02 remain preserved against `ac8b696e048658f163b909eb292827c160d20a79`. Owner previews and documents were not modified by this reviewer; only the isolated `127.0.0.8:5602` disposable fixture was used. No owner acceptance or Stage 9 closure is claimed.
