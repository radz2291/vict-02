# Cycle 1.3 delivery record

Status: PAUSED AT OWNER REQUEST — product candidate `e6fa5f976b71150d8c334d4a2bd973fd4a653012`, branch `codex/studio-cycle-1-3`, pushed with remote equality confirmed. Implementation is complete; final independent verification is held. This is not a ready-for-owner-review verdict or owner acceptance. [Resume checkpoint](CYCLE-1-3-CHECKPOINT.md); [authorized scope](CYCLE-1-3-HANDOFF.md); [accepted Cycle 1.2 closure](CYCLE-1-2-OWNER-CLOSURE.md); [independent record](CYCLE-1-3-INDEPENDENT.md).

## Package boundaries

- `@victframework/ui-ai-svelte`: optional, source-exported Svelte conversation presentation. Pinned shadcn-svelte styled source and all 21 AI Elements patterns, Markdown/code and host-controlled interactions. Default Conversation has no endpoint, credentials or AI SDK transport. `adapters.ts` maps presentation data; Studio retains VICT/Mastra request/proposal/acknowledgement/cancellation behavior.
- `@victframework/ui-flow-svelte`: optional Svelte Flow public exports plus a convenience FlowCanvas including background, controls and minimap. Layout and interactions are presentation. Studio source projection and canonical move adapter are separate.
- Existing neutral UI/compiler/editor/renderer remain authoritative. Shared recipes and metadata expose the accepted renderer catalog to manual and agent authoring. Saved source schema is unchanged.

Studio replaces its custom message renderer and composer consumption with the new AI package. The existing generic `ui-svelte` Conversation remains for older application-plan consumers; Studio does not render both. Removing the older public export would break those unrelated consumers, so migration is explicit rather than an unannounced API break.

## Upstream and coverage

shadcn-svelte immutable source `b10f153250b18abfccf49a06e1c4c68945edffa5`, official AI Elements October 2026 source family; upstream MIT license retained. Exact dependency/source hashes, local adaptations, all pattern dispositions and upgrade procedure live in `packages/ui-ai-svelte/UPSTREAM.md`, `upstream-manifest.json` and `COVERAGE.md`.

Svelte Flow `@xyflow/svelte@1.7.0`, upstream source `3d35b57317576b0916c0bfeaaedd573aaacc2839`, MIT; see `packages/ui-flow-svelte/UPSTREAM.md`. No paid examples purchased. Neutral packages gain no Svelte Flow dependency.

[Designer audit](CYCLE-1-3-DESIGNER-COVERAGE.md) separates exported parts, canonical descriptors, renderer registrations, palette, Inspector and provider tool coverage. The palette has 83 recipes (78 catalog registrations plus five semantic elements), using all 80 existing descriptors/implementations. Thirty-seven of 38 catalog families have palette coverage. RadioGroup and AppShell remain omitted because their contracts require object-array view data; foundation deferrals for PIN, Rating and TimeRange remain. Typed list values use declared local state references, preserving the frozen scalar/null expression-literal contract. Context-dependent child parts require compatible rendered providers. Inspector connections target compatible local state or already-declared actions, with no invented backend behavior.

All 21 selected AI Elements patterns have reusable exports/examples and explicit dispositions in the package matrix. Pattern fixtures never establish a backend capability. Attachments/approval/model selection/checkpoints/subagents remain host integration contracts, not new Studio backend features. Mermaid is shown as inert code; unsafe links and raw HTML remain inert, and image syntax does not fetch remote media. Studio uses the default conversation and typed adapters through public package exports.

## Evidence and retained observations

Evidence is collected under `cycle-1-3/`. Builder evidence is not an independent gate. Exact check progression is retained rather than converting earlier failures into an all-green run:

| Check | Result and evidence |
| --- | --- |
| Ordered workspace build and types | Eighteen-package build passed; root TypeScript and Studio TypeScript passed. `build-final.log`, `context-root-typecheck.log`, `context-studio-typecheck.log`. |
| Svelte checks | AI and Flow packages: zero errors/warnings. Designer: zero errors and six pre-existing warnings in three files. `ai-check-final.log`, Flow builder record, `context-designer-check.log`. |
| Studio regressions | Full first integrated suite passed178/178. After context repair,185 passed and one new test oracle failed; corrected targeted context/lifecycle suite passed9/9. `studio-tests-final.log`, `studio-tests-repair.log`, `context-tests-final.log`. |
| Shared editor regressions | Initial80/81 exposed a real multi-slot palette regression. Restoring unrestricted recipes as disabled until slot choice passed all four affected tests. `editor-regressions.log`, `palette-regression-recheck.log`. |
| Flow identity repair | Seven focused tests passed, including encoded hostile identifiers, stable source mapping, guarded move and stale/malformed refusals. Original real-browser selector failures retained. |
| Real VICT/Mastra operation | Six actual provider turns;16 assertions passed and zero browser exceptions. Initial form, manual edit then continuation, Stop after a committed batch, mixed history, Save/reopen, continued editing, real stale/draft proposal refusal. `real-provider-final/continuous-real-provider.json`. Timing seams delay actual proposal delivery only; they do not fabricate proposals. |
| Independent packed consumer | Fresh npm-packed install and production build passed, with no Studio imports, aliases or workspace links.165 installed source/manifest files exactly match candidate sources. One Bits UI2.19.3, Svelte5.57.0 and Svelte Flow1.7.0 dependency set. `consumer.json`, independent package audit. |
| Final Studio production and manual journey | Build passed and 247 artifacts sealed to `e6fa5f9`. Real Flow move/refusal/shared selection, contextual recipes, typed lists, property/output bindings, all 14 mutations through Undo/Redo and exact Save/reopen passed with no browser exceptions. `studio-build-flow-repair.log`, `production-manifest.json`, `designer-browser-2026-10-23T09-01-10-091Z/`. |
| Packed consumer browser | 25/25 checks passed: keyboard/stream/Stop/draft/copy, all 21 patterns, simulated host callbacks, keyboard model selector, styled portal, native host CSS isolation, real Flow connection/keyboard/controls/minimap and three responsive sizes. No backend API calls or browser exceptions. `package-browser-final/package-browser.json`. |

The six-turn provider and package proofs were taken on `67a024f21f1b2b423955c44e7e5a762beaf6af1a`. The verifier checked that `e6fa5f9` changes only Studio structure IDs, their tests and the Flow report; those unaffected proofs carry forward explicitly. Final production/node replay passed. Independent context replay and complex component-provider verification, plus the final Studio composer layout rerun, remain unexecuted at this owner-requested pause.

Initial environment/setup observations retained:

- `npm ci` succeeded in the fresh worktree. Installed dependency `posthog-node@5.51.6` warns that Node22.13.1 is below its declared engine; this is inherited baseline dependency metadata, not silently relabeled as a product test pass.
- An accidental all-workspaces alphabetical build was interrupted: dependent packages reported missing unbuilt workspace dist. The supported root ordered build then built the existing package chain. This failed command was not a valid ordered build oracle.
- The first ordered build reached the AI package before its CSS build script had been written by the parallel builder, and failed with MODULE_NOT_FOUND. Log retained; the completed package must pass a later build.
- New typed-list agent tests exposed a successful compile carrying error diagnostics. Agent acceptance now rejects those diagnostics; the original failure remains in the designer coverage record.
- Independent IV-1 found a contextual SelectItem could reach rendering outside its provider through Composer reuse or Source intake. Shared rendered-placement validation now protects canonical editing, source intake, save and reopen; neutral source schemas remain unchanged. The initial report's generic move-helper concern was narrowed after checking the actual disabled Studio Layers wiring.
- Real pointer connection exposed IV-2: raw JSON graph IDs broke Svelte Flow's quoted CSS selector. Deterministic URI-encoded node/edge tuples preserve exact source identities and avoid selector metacharacters. Original page errors and failed runs remain.
- A queued Layers focus callback after component destruction was bounded to a live root. Initial role-selector/oracle failures, malformed generated provider-schema capture, and the disabled multi-slot recipe regression are recorded with their repairs.
- Parallel heavy checks exhausted memory; serialized checks passed. Low C: free space later caused ENOSPC/SQLITE_FULL during a provisional journey. The affected file was restored from its committed candidate and production rebuilt; the entire six-turn journey subsequently passed. Failed logs and partial evidence remain. Automatic approval review rejected deletion of test temporary directories; that deletion was not retried through another mechanism. Low disk space is a retained local environment risk.
- Existing build chunk-size/circular-dependency/unused-upstream-import notices and six Svelte warnings remain. Chromium keyboard/geometry checks do not establish screen-reader or cross-browser acceptance. Existing foundation and Cycle1.2 findings remain retained.
- The first packed-consumer browser run passed its other checks but screenshot I/O and per-character automation consumed the short fixture stream before Stop was selected. The retained failure is `package-browser-output/`; the corrected probe uses one real browser text insertion operation and captures after Stop. The final 25-check run passed without a product change.

No owner tabs, sessions, data, provider files or serving builds have been modified. Listeners observed before review setup: 127.0.0.1:5591 PID71088 and localhost/[::1]:5593 PID83192. Other ports require fresh ownership inspection before use.

## Review launch and walkthrough

The isolated production review uses `http://127.0.0.2:5594/design`, a separate cookie host from the two owner listeners. The packed consumer uses `http://127.0.0.1:5595`. Login uses the repository's existing local operator setup; provider credentials remain server-side and are neither embedded in evidence nor copied into client code.

From the Cycle1.3 worktree, after dependency installation, run `npm run build` and `npm run build -w vict-studio`, then `powershell -File docs/studio/cycle-1-3/launch-review.ps1`. The script refuses an occupied5594 port. It starts only this checkout's built candidate using existing private provider configuration. For a fresh independent consumer, run `node scripts/verify-cycle-1-3-consumer.mjs`; the output records its isolated install location, from which `npm run preview -- --host 127.0.0.1 --port 5595 --strictPort` serves the built showcase. Do not replace an existing listener.

1. Open the isolated Studio, create a screen, and ask the agent for a small form. Select a heading, edit it manually, then ask the agent to continue. Inspect the applied-edit activity and try Stop during a later request.
2. Insert Tabs, a multiple-value Select, Slider or Toggle. Use Inspector properties, declared-state bindings and outputs. Context-dependent parts appear only at compatible insertion targets.
3. Open Structure, select a source node, pan/zoom and inspect containment/binding edges. Opt into moves and connect a permitted child to a parent. Use Undo/Redo, then Save/reopen. Diagram positioning is temporary presentation and does not edit source/history.
4. Open the separate consumer and try the conversation, all21 pattern examples, model-selector portal and Flow connections/controls/minimap. Its chat/tool callbacks are clearly simulated presentation fixtures.

## Stop boundary

Stage 9 remains REOPENED / IN PROGRESS. No main merge, package publication, deployment, Cycle 1.4, Milestone 2 or owner acceptance of Cycle 1.3. Readiness requires the fresh independent verifier's final verdict against the exact committed product, linked above.
