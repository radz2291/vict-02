# Independent revision repair verification — PASS WITH NON-BLOCKING FINDINGS

Exact product: `4700689bf985c83cd3f944ad4cd324f2bfe8d724`, pushed branch
`codex/studio-cycle-1-1-revision-repair`. Main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Product base is prior delivery
`8fd417c91916dfa2f6d801306cf89b7a66f713f7`.

This fresh verifier read the repository instructions, system reference, Stage 9
state/architecture/handoff and current Studio handoff/state/revision repair.
The clean prior verifier checkout at `f9b0560a2f5141db77bebe220c3099e3c2ec9e27`
was explicitly authorized for reuse; a new isolated branch
`codex/studio-cycle-1-1-revision-verification` started at the exact candidate.
The owner main checkout remains behind, with its untracked builder tarball,
and was left untouched. Candidate and main remote SHAs were compared twice.
Only verification evidence is authored here; no implementation repair was made.

## Checks

| Check | Independent result |
| --- | --- |
| Full Studio suite | PASS, 145/145 tests, 26 files, 65.10 seconds; [log](full-suite.log) |
| Studio TypeScript | PASS; [log](check.log) |
| Scoped changed-file ESLint | PASS; [log](lint.log) |
| Exact production build | PASS, adapter completed, server build 41.63 seconds; [log](production-build.log) |
| Saved nonempty screen, real z.ai, multiple batches | PASS; [record](production-browser.json), [driver](production-browser.mjs), [log](production-browser.log) |
| Genuine manual-edit stale and pending-draft browser refusals | PASS, real provider, zero agent effects; [record](browser-fences.json), [driver](browser-fences.mjs), [log](browser-fences.log) |
| Undo/Redo/Save/reopen | PASS in the real saved-screen production journey |
| Client/evidence credential isolation | PASS; [scan](credential-isolation.json) |
| Artifact/runtime identity | 202 files, relocatable imports, destination dependencies are same physical files; [manifest](artifact-manifest.json), [runtime record](runtime-dependencies.json) |

Commands ran in this checkout with its existing pinned dependencies; Studio's
own Vitest **3.2.7**, rather than the different root Vitest, ran from
`apps/studio` with the [test-only filesystem allowlist](studio.config.ts).
The initial root-cwd invocation found no test files. This failed setup attempt
is retained in [setup observation](setup-observation.txt), not counted as a
passed run. The corrected full-suite log is complete. Existing Svelte warnings,
circular dependency notices and test-local connection refusals remain in logs.
The staged whitespace check flags trailing spaces/blank EOF lines in those raw
tool logs only; they are retained as emitted rather than rewritten.

## Real saved-screen proof

The secure existing launcher ran only on verifier origin `127.0.0.1:5592`,
using the owner-selected `zai/glm-5.3-flash` and external authorized auth/model
files. Headless Chrome used a fresh isolated profile and storage. No owner tab,
canvas, chat, draft, browser storage or 5591/5480/5587 server was accessed or
modified. The verifier performs no activation.

The driver used the actual Document source authoring action to add a valid
heading, saved twice and reopened it before the request. The starting screen
was visibly nonempty and saved, with source revision **`r1.r2`**. A single
request directly converted that screen into a Quellight AI platform landing
page in exactly two acknowledged batches. It did not create a screen or ask
for a new go-ahead, and did not substitute a registration form.

| Evidence | Captured value |
| --- | --- |
| Initial saved source revision | `r1.r2` |
| Submitted working cursor / first proposed edit token | `r1.r2#0` / `r1.r2#0` |
| First browser acknowledgement | success, next revision `r1.r2#1` |
| Second proposal cursor / edit token | `r1.r2#1` / `r1.r2#1` |
| Second browser acknowledgement | success, next revision `r1.r2#2` |
| Terminal result | completed, 2 applied edits, 0 refusals |
| Turn | `turn-ca313149-9705-4c97-bbc7-da08a54049b2` |
| Profile | `v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d` |

The original screen ID stays the same. The final canvas has the Quellight hero,
description, features section and Get started catalog button. The provider
correctly states the button is a local preview and Save belongs to the user.
Undo removes only the second batch, leaving the hero; Redo restores the exact
canonical document. Save and reopen preserve the exact saved landing page at
source revision `r1.r3`. There are 206 streamed text deltas, zero page errors,
and terminal EOF arrived in the same recorded millisecond as done. Observed
turn time was 91.920 seconds; this is a sample, not a performance guarantee.

The wire record captures submitted context, proposal arguments and receipts.
It does not expose the provider's private read-tool result. The candidate's
`agentContext` directly supplies top-level `expectedRevision` from that cursor;
the independent full run also exercises captured actual Mastra read/edit tool
results and same-turn wrong-token recovery. No claim of additional live read
tracing is made.

Independently viewed screenshots:

- [Saved nonempty screen before request](existing-saved-before.png)
- [Streaming real-provider screen](production-streaming.png)
- [Applied Quellight landing page](production-quellight-existing.png)
- [Saved and reopened landing page](production-saved-reopened.png)

## Safety and failure evidence

Code inspection confirms document ID/digest mismatch still produces genuine
`UI_DOC_STALE_REVISION` before the new wrong-argument classification. A wrong
`expectedRevision` is refused without effects as
`STUDIO_AGENT_REVISION_MISMATCH`; no token is silently substituted. Successful
edits still await the browser acknowledgement and return the next token.
Browser epoch/revision/digest checks, canonical transaction validation, history,
draft guard and sticky browser-refusal fence are unchanged.

Full regression execution proves wrong saved-version arguments cause zero
effects, correction can continue in the same governed Mastra turn, real manual
stale refusal stays fenced after a model re-read/retry, and draft/replay/undo
ABA/reopen protections still refuse. Authentication/CSRF and failed/cancelled
provider cases also pass in the same full run.

Two additional production browser controls use the real provider. A documented
test-only transport delay holds its unchanged proposal before the actual
Designer consumes it, allowing deterministic human intervention:

1. A manual canonical root-label edit is applied while the proposal waits.
   Browser acknowledgement refuses with `UI_DOC_STALE_REVISION`; terminal
   applied=0, exact manual document retained. The agent explains genuine stale
   state and asks for fresh direction, which is appropriate for this case.
   Turn `turn-13ef7b31-a2e4-4ed1-bb6a-3f39f39d7cdf`.
2. After a fresh request, a source draft is opened while the proposal waits.
   Acknowledgement refuses with `STUDIO_AGENT_DRAFT`; terminal applied=0 and
   the exact draft is retained. Discard reveals the unchanged canonical source.
   Turn `turn-140e2504-68db-4099-910a-3b9c4c647777`.

The second control first received `STUDIO_AGENT_VALIDATION` /
`UI_EDIT_VALIDATION_FAILED` for an invalid operation. The provider re-read and
corrected its payload in the same request, then reached the intentional draft
refusal. That intermediate failed observation remains in the record; the
positive saved-screen turn had no refusals. The model's explanation of why its
first payload was invalid is speculation, not an independently established cause.

- [Actual stale refusal](browser-real-stale-refusal.png)
- [Actual retained draft refusal](browser-real-draft-refusal.png)

The owner's original raw tool arguments were not captured. Saved-version
substitution remains an inference supported by the reported `r1.r2`, exact
server error path and the deterministic regression; it is not relabeled as
captured original evidence. The repair addresses both ambiguous revision
guidance and the stop-on-stale instruction interaction, plus the unconditional
form example. It preserves the requirement to stop for a genuine canvas refusal.

## Artifact and disposition

The [202-file manifest](artifact-manifest.json) binds byte count/SHA-256 to
producing product `4700689bf985c83cd3f944ad4cd324f2bfe8d724` and build directory
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02/apps/studio/build`.
No nonrelocatable runtime imports were found. Eight external runtime dependency
entries plus selected Markdown/native-libsql dependencies resolve to the same
physical files at the builder destination. The local ui-svelte package resolves
to this verifier's own source; Conversation SHA-256 is
`cc79e8188d0f4a180abd094bb6dd27a5d0a42094640a4bad5979bbb7d0adb211`.
Product Studio tree is `2922600773758df5dde65c369d5fdca3f6423b18`.

The selected key is read only for the authorized scan and secure launcher;
its value is never printed/copied. The client has zero matches for that key
and zero server-only credential/runtime markers. This scan also covers the
verification text evidence. The own 5592 listener was stopped after testing;
[cleanup](cleanup.json) confirms absence. The build remains available for the
parent's separately managed manifest-checked local activation.

No new gating defect was found. Retained nonblocking limits from earlier
Cycle 1.1 gates remain unchanged: bounded local preview/persistence, inherited
diagnostics and usability observations, and no production/performance guarantee.
The unchanged chat/framework presentation matrix is not rerun or relabeled here.

**Next allowed action:** parent reconciles this pushed independent evidence,
performs the authorized local artifact activation while preserving the owner's
loaded canvas/chat/draft, then offers the existing-screen owner walkthrough.
Owner acceptance remains separate. Stage 9 remains reopened; no Cycle 1.2,
main merge, package publication, or production deployment is authorized.
