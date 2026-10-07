# Independent technical/source-ownership review — candidate 1

Candidate: `8d99f3645691b4c3882cdfe88f298d6f0306eae0`, branch `codex/ui-foundation-u3-experience`. Date: 7 October 2026 (Malaysia). Fresh technical reviewer, no implementation/repair role; report and execution evidence only. Owner authority is OWNER-INSTRUCTION.txt. Reviewed canonical VICT/foundation architecture, contracts, API/proof semantics, U3 handoff/coverage/walkthrough and original U3 independent report. The original U2 Inspector acceptance is retained.

## Verdict

**TECHNICAL CORE PASS; EXPERIENCE REPAIR GATE HELD / REQUIRED DEMO TRUTHFULNESS REPAIR.** Canonical ownership, reusable public rendering bridge, mappings, save/version behavior, runtime preservation and supported application builds passed my checks. The independently reproduced experience failure concerning Demo controls is material to owner requirements and must be repaired and re-reviewed before the complete candidate can pass. This is not owner acceptance or U3 closure.

## Executed bytes and scope

Reused installed dependencies in the candidate worktree, as allowed by verifier brief. `git rev-parse HEAD` was the exact SHA above and `git diff --exit-code HEAD` passed before work, during battery and after all checks immediately before the builder's next repair. Workspace package junctions resolve into this same worktree (`packages/ui`, `ui-svelte`, `ui-preview`), not a different implementation. Test configs explicitly resolve package source; actual product build consumes public package exports. No candidate tracked file was changed by me. Concurrent untracked handoff, experience evidence and builder build log were preserved. Live remote main remained `4d2df037d8a82d36c60bf1bff16919650643ce22`, U3 `aaeea16f9cabccad05650eefdd8771c756326f17`.

Diff from U3 final records contains no domain implementation, server/durable adapter, scenario declarations, packages/ui-preview, apps/studio or frozen governance changes. Route loader changes add queue loadError from the real inspection.list result and detail mode from the active product server; existing failure-row fallback remains in place. They do not change domain/server implementation. Preview-session runtime is unchanged. Editor changes narrowly forward generic registration/state props; Inspector/Layers implementations are unchanged.

## Ownership and reuse findings

- `documents.ts` is canonical `vict.ui-document@1` data: navigation/hierarchy, queue, detail/status/findings/evidence, decisions and correction forms, action IDs/input bindings, one activity trail, conditions and responsive styles are authored. It imports no Svelte implementation. Host routes contain orchestration/data/error translation; they mount DocumentHost rather than duplicate primary HTML workflows.
- Public Button, StatusBadge, Feedback are actually instantiated by explicit registered wrappers. Layout imports packaged styles.css and mounts `.vict-app`; named inspection container activates authored conditions. Native editable Approve uses packaged button classes; evidence is a clearly labelled unavailable-image/note implementation. AppShell and unrelated catalog controls are honestly inventoried, not claimed as reused.
- Generic registry matches compiled extension ID+revision and descriptor rendererImplementationId, requires unique matches and fails closed on missing/duplicate/wrong implementation. Events/slots unsupported by current instruction are visibly rejected. No inspection-specific logic or arbitrary component import in generic renderer. Only props plus occurrenceKey/nodeId reach implementation; no hidden domain data or dispatch authority. Runtime-prop safety comes from canonical compiler descriptor validation, not a claim that Record<string,unknown> alone validates arbitrary caller bytes.
- stateValues only seeds/merges declared finite primitive keys matching declared types; invalid values produce diagnostic, local input edits are preserved and reset applies before supplied values. Dedicated DOM regression exercised merge/reset/invalid keys.
- Product and EditorCanvas forward the same descriptor/implementation arrays into DocumentHost. Renderer regressions exercise registrations through visual definitions, slots and branches, repeat occurrence mapping, bound props and native form submit in product and selection hosts. Source metadata remains on wrapper/inner authored nodes. Existing accepted mapping/Inspector tests pass.
- Independent probe saved an ordinary Approve-label edit through createAuthoringStore, loaded the saved bytes, then called the exact inspectionPlan entry used by product. Application version changed from `v1_50c9abcc3bdcf220f507b2309a811ffef5819abbbad4519dea3e21b18cb39795` to `v1_3a7364cdc4c773d1686b4e1faa0d28c54269831e7a783a1a89f33f055a18f822`, source digest changed and saved text remained. Product onMount reads that same store and compiles loaded source. Real-browser rendered-save proof belongs to separate experience reviewer, not this source probe.

## Independent checks

| Check | Result | Evidence |
| --- | --- | --- |
| Renderer + editor DOM regression | 131/131, 20 files | check-0.txt |
| Product authoring/runtime suite | 68/68, 9 files | check-1.txt |
| Root integration | 4/4 | integration.txt |
| Root typecheck | exit 0 | check-3.txt |
| Shared UI Svelte check | 0 errors, 2 known text-span a11y warnings | check-4.txt |
| Application Svelte check | 0 errors, same 2 warnings | app-check.txt |
| Product production build | exit 0, adapter-node completed | product-build.txt |
| ui-svelte package build | exit 0 | ui-svelte-build.txt |
| ui-editor workspace build | FAIL, 4 pre-existing TS2307 Svelte declaration errors | ui-editor-build.txt |
| Same-source simulated/durable identity and SQLite reopen | PASS | parity-correct-cwd.txt |
| Own saved-edit identity + both-adapter correction/conflict/replay probe | PASS | independent-probe.mts/.txt |
| Actual production process terminate/relaunch with own SQLite file | PASS | process-before.json, process-after.json, process-restart-verdict.txt |

The ui-editor standalone build failure exactly matches accepted U2 F-3 (U2-COMBINED-VERIFY-05): exports currently consume src, product Svelte builds/checks pass, dist packaging is not a claimed working deliverable. Preserve it as a non-blocking prior limitation; do not report every package build green.

Same repaired-source digests reproduced: queue `fcad3ea856aa53a9142be89f18cbc97d5f93a4c6bbb312584231b1cb2c6b4fc0`, detail `1a001e8c6e21a3f5cc5d39e40765ccb8cfd40234c31febed9652995954dc7426`, interaction digest `9be43237c4cef657e2d9d043959117db90f65b094f915ff2db31fbf7689f8ab8`. Both modes approved with same revision/trail and unchanged application identity.

My own probe independently drove reject→revise→finding/evidence correction→resubmit→stale refusal→fresh approve against both fresh simulated and SQLite adapters; direct technician approve denied, keyed replay refused, final approved revision7 in both. Existing passing suites additionally cover permissions, lifecycle, idempotency conflicts, scenarios and reset/in-flight fencing.

Actual process proof is distinct from SQLite handle-close tests: production `node build` on own5222/session95224/PID33640, approve i-101 durable revision4, terminate only owned exec session via CtrlC (exit1), fresh process/session93668/PID19296 at same path, recover approved revision4 and persisted approval trail from SQLite, then simulated negative control returns submitted revision3. Both owned sessions terminated; primary5221 never altered. No server memory survived this relaunch.

## Failures and limitations preserved

1. Required candidate1 defect reported by independent experience reviewer: Demo controls offers failure/denied/conflict/missing/latency as ordinary product Scenario choices, but primary product server `instantiate` only selects scenarioSeed and `dispatch` directly calls real domain server. Scenario declared outcomes run in the separate preview console. Thus choosing Failure on primary product does not demonstrate failure; approval succeeds. My source review corroborates the disconnect. Required repair: truthful record-preset choices and explicit navigation to outcome console, or coordinated product-outcome behavior; no silent domain change.
2. First integration command used guessed nonexistent filter examples/ui-foundation-integration: no test files/exit1 (`check-2.txt`). Correct root integration subsequently passed4/4. Harness error, not hidden.
3. First parity run from repo root failed `$lib` resolution (`parity.txt`); correct application cwd passed (`parity-correct-cwd.txt`). No source repair.
4. First independent temp probe used Windows C:/ import specifier and failed unsupported URL scheme (`probe-failed-windows-import.txt`). Corrected only own probe to file:/// imports; passes, implementation untouched.
5. Optional PowerShell hidden Start-Process + returned-own-PID termination/relaunch command was automatically rejected before execution, stated reason `blocked by policy`. No permission escalation. Safer owned foreground exec-session launch/termination method then succeeded as above.
6. An initial guessed historical report path omitted reviews/u3 and failed read; correct path read. An invalid Get-Content LiteralPath null command failed before any file read/mutation; corrected source read followed.
7. Existing text-span two a11y warnings and U2 F-3/F-4 limitations are retained. Full root unit suite and fresh-published-package consumer are not claimed by this bounded review. Product experience/keyboard/viewport judgment is separate independent report.

Next allowed action: builder repair truthful Demo controls, commit new candidate and obtain affected technical/experience rechecks. Preserve this exact-candidate report and failures; no merge/main/publication/Stage9/U4 continuation authorized.

Report-time concurrent-work disclosure: the builder began the explicitly announced DemoControls/docs repair after the exact-byte checks and execution battery. Final report-write git diff therefore exits1 for those legitimate edits. This report tests candidate1 only; no repaired source is promoted to verified by these old results. Production restart used the already-built candidate1 executable and unchanged server/domain boundary.


Candidate1 runtime evidence correction: my production rebuild in the shared worktree replaced output chunks while primary5221 was still running. The experience reviewer observed a500/missing error chunk and primary server log reported ERR_MODULE_NOT_FOUND. This is a verification environment collision caused by replacing a running process's lazy output, not proof the candidate source error page is defective. Preserve original experience screenshots/log; coordinator stopped primary for the next production build and will restart/recheck. Future builds must be coordinated while primary is stopped or use a separate output worktree.
