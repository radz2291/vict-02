# Independent bounded candidate challenge — 2026-10-28

Verifier: fresh delegated read-only reviewer; authored none of the candidate repairs.

Candidate and verifier source SHA: `2e457b6b4f2f8bebddbf142e6391273c54369d13`, branch `codex/authoring-foundation`.
Review base: `59212b031d49163f7e1ebc40088f6a8ab2ae1b1e`; included media commit `6bb78bf`.
Repository: `https://github.com/radz2291/vict-02.git`.
Local origin/main: `d7401bef6e48330796c74ec00c86db9622d48cdf`, confirmed ancestor of candidate. No fetch or remote-head claim.
The designated isolated checkout was clean at entry. During review, the root added two staged-build evidence logs in fresh-integration-20261028; those were preserved and not reviewed as my executed checks. HEAD remained the exact candidate.

**Scoped source/offline verdict: PASS WITH NON-BLOCKING FINDINGS. Integrated CF-01 / AI-EX01 acceptance: HELD.** No blocking source defect was established in this bounded delta. This is not a native-browser, provider, device, installed-package, or product acceptance verdict.

## Scope and architecture challenge

Read AGENTS.md, canonical VICT authority/invariants, UI-foundation state/architecture/contracts/stages/handoff, current-status rollup, CF-01, AI-EX01, applicable builder reports and changed source/tests. Historical U0-only allowed paths are superseded for this review by the delegated current authoring-foundation scope; no Stage 9 or source edits were performed.

| Change | Independent finding |
| --- | --- |
| Archive export | Calls the existing verified managed-byte boundary before counting/encoding each selected asset. Requested identity, digest, size and media admission are checked. Export remains read-only; prior archive format and aggregate limits remain. Corruption/substitution negatives and normal roundtrip pass. No new asset semantics or store authority. |
| Embed lifecycle | Retains native titled allowlisted iframe and explicit host opt-in. Keyed replacement plus current-frame/source check fences prior-frame events; timer clears on load/error/source change/policy removal/unmount. Status says frame loading/slow rather than playback success. Disabled remote loading in tests is explicit. Browser iframe load/error cannot prove cross-origin video availability; actual playback/failure proof remains missing. |
| Adopted-node popup repair | Shared Element DOM method replaces destination-realm instanceof. HTML surfaces retain namespace requirement; generic SVG event targets remain admissible for icons. Same-document containment, canonical/sibling owner exclusion, source visibility/disabled/inert/disclosure and referenced branch pairing remain in the shared engine. No private dependency access or per-app popup engine introduced. |
| Inner viewport container | Optional prop defaults to no container. Named inline-size container lives on the actual application-content ancestor inside the iframe, retaining vict-controls scope and source children. Designer/Interact and saved Run pass studio-screen explicitly. Dynamic establish/rename/clear preserves child identity. Disposal guard prevents late iframe start after unmount. |
| Agent guidance/identity | Guidance now matches iframe media/container semantics, warns ancestry cannot cross documents and keeps nonportable host facts separate. Instruction/profile revisions advance for both editing and observation profiles. No provider/tool/approval/history authority change is introduced by this delta. |

## Executed checks

Existing installed toolchain, PowerShell, task-scoped TEMP/TMP under this evidence directory. No build, browser, provider, server, dependency install, source edits, staging/commit, push or merge.

- `node_modules/.bin/vitest.cmd run --project renderer packages/ui-svelte/test/owned-popup-adopted.test.ts packages/ui-svelte/test/viewport-host.svelte.test.ts` — exit 0; **2 files / 6 tests PASS**. `renderer-targeted.log`.
- `node_modules/.bin/vitest.cmd run --config packages/ui-media-svelte/vitest.config.ts packages/ui-media-svelte/test/assets.test.ts packages/ui-media-svelte/test/embed.svelte.test.ts` — exit 0; **2 files / 21 tests PASS**. `media-targeted.log`. Expected Happy DOM disabled-iframe-loading diagnostics are retained, not evidence of a real provider request or provider failure.
- `git diff --check 59212b0..HEAD -- packages apps` — PASS.
- Whole-delta `git diff --check` — findings only in retained evidence logs: blank final lines and trailing whitespace in earlier failed typecheck output. Non-blocking archival hygiene; no source defect. Preserve failed evidence rather than rewriting it for cosmetic cleanliness.

Reviewed builder checks (not rerun or relabeled as my checks): 30 shared popup cases, Studio host/guidance 2 cases, package/Studio types, and prior media lifecycle/asset checks. Broader suites were intentionally not repeated.

## Missing demonstrations and next action

Required native evidence remains **NOT DEMONSTRATED by this review**: real saved authored dropdown pointer/keyboard/focus/Escape and owned panel appearance; nested/sibling app isolation; actual container/media response across width presets and Run; copied CSS/theme/portal/capture behavior; actual upload/decode/IndexedDB/media play/captions/provider behavior and asset save/reopen/export/import; real-device keyboard/safe-area/touch checks. Happy DOM's adoption fixture deliberately models distinct constructors and cannot replace native realm proof. Inline style assertions do not evaluate CSS container queries.

The retained actual-agent artifact has an inactive `compact` container name and unconditional declarations masking responsive ones. The earlier actual claim remains unpassed. Root should preserve owner styling, obtain bounded actual-agent correction where authorized, and reobserve the completed saved app after loading this candidate. No offline pass closes that product finding.

Next permitted action: root's supported build/relaunch and native integrated re-observation against exact loaded bytes, followed by affected independent review. Keep integrated acceptance HELD until required demonstrations exist. No publication, main merge, Stage 9 closure or owner acceptance follows from this scoped verdict.

## Follow-up: actual launcher multiple-resolution failure

Root reports the approved integrated staged build succeeded and the old process pair was stopped with backup preserved. The helper then failed **before Start-Process launched anything**: its original `(Get-Command node -CommandType Application -ErrorAction Stop).Source` returned `Object[]` from multiple installed node resolutions. This actual failure is retained here; the prior bounded launcher review did not execute a launch and did not establish this path.

Root's only source amendment is `| Select-Object -First 1` before `.Source`. Independent expression-only challenge **PASS** at the uncommitted helper SHA-256 `d2f97f1bb2f31e9d632737f2dbf4c4a9cb1a2d9ea0498793e81dc12bef64fac7` on candidate HEAD `2e457b6b4f2f8bebddbf142e6391273c54369d13`. This amendment is outside the original exact-commit verdict and is associated by source hash, not mislabeled committed.

`launcher-node-resolution.ps1` parses the current helper and evaluates only the AST-extracted `$node` right-hand expression. Actual installed Application resolution produces **3 results**; revised expression selects the first existing executable as **System.String**. A local function mock supplies two Application results with paths containing spaces; revised expression selects the first path as one string. The same mocked inputs evaluated with the AST-extracted pre-fix HEAD expression produce **System.Object[] / 2 members**, reproducing the failed precondition without attempting Start-Process. Lookup name, Application filter and Stop behavior remain asserted.

Evidence: `launcher-node-resolution.ps1`, `launcher-node-resolution.json`, `launcher-node-resolution.log` (successful execution). No helper invocation, process launch/stop, listener inventory, browser/provider/network action or source edit was performed by this verifier. Root owns subsequent approved launch/reachability evidence; this regression pass does not establish relaunch success or change integrated HELD status.

## Follow-up: retained native Matrix/compact evidence challenge

**Scoped evidence review PASS** for source preservation and the bounded responsive correction. This is an independent review of root's retained native observations, not a second independent browser execution. No new tests or browser/server/provider/source actions were performed. Original missing-proof statements above describe the earlier checkpoint; the narrower observations below now supply evidence for the specific Matrix app, without closing the overall integrated gate.

Compared complete saved `actual-ai-review-owner-matrix-saved-r1r2.json` and `actual-ai-review-matrix-compact-saved-r1r3.json`; comparison/hashes retained in `matrix-source-comparison.json`. Same document ID, same 23 nodes. Only `screen` changed: remove local gap14px and reorder source references to always → root-base → conditional. All other 22 nodes are structurally identical, including parts, props/text, bindings and controls. Other top-level registries are unchanged except the recorded style/condition additions and document revision.

Existing Matrix panel/hover sources, root background/text/font/scanline declarations, child order, and both old conditions are unchanged. The old conditional source keeps its ID and 16px/12px declarations, but its conditionId intentionally changes from `cond-compact` to new `cond-screen-compact`. New condition explicitly names `studio-screen`, max-width760px; new unconditioned root-base holds gap14px. There is no remaining root-local gap that can mask it, and conditional follows the wide22px padding source and base14px gap. The public final's shorthand "old condition/source left intact" should be read as preserved identity/declarations: the existing source's condition pointer did change. No unintended source loss found.

`compact-correction-terminal-public.dom.txt` supports one acknowledged atomic edit, source rereads and one observation. Its final explicitly leaves narrow behavior untested; subsequent root measurements, rather than the agent's final, supply that check. Root's `INTEGRATED-NATIVE-PROGRESS.md` reports wide804px → padding22px/gap14px. The agent terminal independently records wide padding22px and Matrix colors, but not a measured wide gap. The separately retained narrow reopen JSON records actual main width375.2px, clientWidth=scrollWidth375, padding16px/gap12px; Run JSON records the same compact styles/colors/width. These support the observed widths, not exact760/761 breakpoint or general overflow guarantees.

Reviewed pixels for `matrix-dropdown-open-native.png`, `matrix-compact-native.png`, and `matrix-run-popup-native.png`: genuine open menu appears in both Interact and saved Run; the narrow app retains Matrix treatment and legible wrapped content. `matrix-popup-native-result.json` records pointer/ArrowDown opening, first-item focus, Escape/trigger-focus restoration, real `studio-screen` inline-size host and `.vict-controls`/owner scope with Matrix computed paint. DOM corroborates expanded trigger, menu and active first item. Focus transition booleans are root's event observations, not independently replayed by this reviewer.

`matrix-run-native.dom.txt` corroborates saved revisionr1.r3, local boolean true, composer text echoed after Enter, and open menu/active first item. Save/reopen compact styling is supported by the retained reopen measurements and saved source. This is local presentation/typed intent, not provider execution or approval authority. Screenshots/DOM are partial visible-state records: they do not establish all-screen accessibility, nested/multiple-app isolation, capture equivalence, physical-device behavior or a different recovered responsive app.

No blocking contradiction found in these bounded claims. Native Matrix popup and compact-save/Run gaps now have scoped supporting evidence. Overall CF-01/AI-EX01/integrated acceptance remains **HELD** for the remaining declared matrix, media, device and independent integrated coverage; no broad closure follows from this addendum.
