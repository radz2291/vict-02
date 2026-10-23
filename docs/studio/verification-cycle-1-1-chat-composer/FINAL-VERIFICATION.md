# Independent compact composer verification — PASS

2026-10-23, Asia/Kuala_Lumpur. Exact product candidate `9ae689b487d610e3df0581885660fe096f645a88`, branch `codex/studio-cycle-1-1-chat-composer`, independently confirmed pushed. Evidence branch `codex/studio-cycle-1-1-chat-composer-verification` starts at that exact candidate. Main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. Prior verifier checkout was clean before reuse; earlier evidence remains committed and unchanged. Original owner checkout and 5591 browser/store were never accessed. Root AGENTS, canonical reference, ordered Stage 9 state/architecture/handoff, current Studio STATE and Cycle 1.1 handoff/composer amendment reviewed.

## Scope and architecture

The amendment starts at remote-equal delivery `a56ca3aa844a59e76d49748e62bb0cb9a5a1d3b0`. Product changes are confined to AgentChat.svelte, shared Conversation.svelte and focused tests. Documentation records the owner's bounded shared-component amendment. No server, provider, framework semantics, canonical edit/history/save, package manifest or lockfile changes. Source is untouched by the verifier.

Conversation adds an optional presentation callback and renders one native type=button Stop while its existing send promise is pending and the callback is supplied. Studio supplies its existing stop handler only while busy. The existing send guard and Enter preventDefault retain one in-flight request. The existing handler clears runId before abort and DELETE, so repeated immediate clicks cannot issue another DELETE. Existing finally/catch settlement returns the composer to Send. Draft clearing still requires successful send AND unchanged submitted draft; edited next drafts survive. Callback-absent consumers retain their existing disabled Sending behavior. No new cancellation authority, backend path or second composer is introduced.

Screen label remains an input for context comparison but its repeated footer rendering is removed. Meaningful selected-object context remains in details. Status and details share one flex footer; busy copy is Working while full activity remains in details.

## Executed checks

- Shared composer: **6/6 PASS**, root Vitest4.1.11 renderer project,3.14s. Covers cancellable and callback-absent pending behavior, editable next drafts, keyboard guard, multiline/IME, custom/default escaped rendering and streamed follow behavior.
- Affected Studio: **10/10 PASS**, explicit Studio Vitest3.2.7,31.95s (`affected-tests-studio3.log`): chat-controls1, agent-chat5, chat-message4. The failure tests cover pre-admission errors and admitted provider/output/incomplete-tool failures. Additional root-toolchain runs also passed10/10, retained separately.
- TypeScript **PASS** (`npm run check --workspace apps/studio`). Exact production build **PASS** (client18.12s, SSR49.00s). Existing unrelated initial-capture, span keyboard/role, StateValuesPanel label warnings and date-library circular imports remain in the full log.
- **202 files** hashed with exact producingCommit in artifact-manifest.json; zero absolute/nonrelocatable runtime imports. Exact build preserved at `C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02/apps/studio/build`.
- Eight runtime external dependencies, native SQLite .node and mdast2.0.3 resolve to the same physical files as the intended builder activation checkout. No dependency installation occurred. Shared UI resolves to the verifier source entry. Checkouts have CRLF/LF differences: source-equality.json retains raw hashes and proves both copies of Conversation, AgentChat and Designer match the exact candidate Git blobs after line-ending normalization.
- Actual selected credential leakage scan **PASS**, zero credential matches in client/evidence; zero server-only markers across44 client files. Values were never copied or printed.

The first npm exec invocation misparsed --config and found no tests; its log is retained as a harness failure. An npm workspace attempt also consumed the config flag and used root Vitest4. These are not candidate failures or substituted Studio3 evidence: the final direct Studio3 command above ran the intended config and all ten checks. No failing test was relabeled.

## Production browser proof

`production-composer.mjs` renders the exact built production Designer/Conversation/catalog CSS on isolated authenticated5592 in headless Chrome. All **26 assertions PASS**. The fetch boundary is explicitly a deterministic transport fixture; no provider request or edit proposal occurs. Prior real-z.ai proof applies only within its historical unchanged provider/edit scope. No new live-provider claim is made.

| Criterion | Verdict and evidence |
| --- | --- |
| One composer action | PASS: exactly one native Send at rest, one type=button Stop while pending; no footer Stop. |
| Busy Enter and cancellation race | PASS: Enter adds zero POST; two synchronous Stop click events produce exactly one DELETE and return Send. |
| Cancel, provider failure and completion | PASS: each settles to Send; useful failure/Stopped/completion status remains. Each separately edited next draft is retained. Three total POST, one DELETE. |
| Mounted View hide/show | PASS: unsent draft retained; canvas expands960 to1280px. During a turn, a new delta arrives while hidden, remains on restore, with canvas/draft unchanged and no cancel/resubmit. |
| No repeated screen name | PASS: old context footer and chat heading absent; screen identity remains only in the Designer header. |
| Status/details share one row | PASS at1280x720,1280x500,390x700, including two-line failure status: their vertical centers align and no horizontal overlap occurs. |
| Details avoid composer/canvas overlap | PASS at all three sizes: popup remains inside transcript and four pixels above composer. Busy reconnect disabled. |
| Long input and resize | PASS: eight-line draft, dynamic growth while popup open and mobile-to-short-desktop resize retain bounded popup above input. Dynamic growth is programmatic; normal pointer input dismisses the existing Popover. |
| Long records | PASS: eight activity rows and long connection record remain reachable by scrolling within popup. |

Screenshots were directly inspected at short desktop, mobile busy and mobile failure; raw rectangles/counters are retained in production-composer.json. Broader history/save/edit/live-provider tests were not repeated for this presentation amendment; existing evidence is retained without a new full-suite claim.

## Disposition and next action

**PASS** for this bounded compact composer amendment. No new blocking or nonblocking product finding in this scope. Prior scope limits and broader Cycle1.1 findings remain. Own5592 server stopped; isolated headless browser closed; exact build preserved. No owner tab/store access, reload, request retry or activation occurred in this verifier.

Parent may activate this exact independently built artifact after rechecking all202 hashes/runtime dependency identity, preserving the owner's current purple Solehaus document/chat/draft and saved screens, and show a separate fresh review page. Ready for owner review only; no owner acceptance, main merge, publication, Stage9 closure or Cycle1.2 authority is inferred.
