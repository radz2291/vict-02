# Cycle 1.2 independent verification — PASS WITH RETAINED NON-BLOCKING FINDINGS

2026-10-23, Asia/Kuala_Lumpur. Exact product candidate
`7874c64158b877c574ceff04e1917773bc03afe6`, pushed branch
`codex/studio-cycle-1-2`. Fresh independent verifier used the clean prior
composer-verification checkout and created `codex/studio-cycle-1-2-verification`
directly from that candidate. No product source was changed by the verifier.

## Authority and lineage

Root AGENTS, canonical reference (including Stage 9 and governance), ordered
Stage 9 state/architecture/handoff, Studio STATE, owner closure, Cycle 1.2
handoff, audit and candidate report were reviewed. Live remote main is unchanged
`d7401bef6e48330796c74ec00c86db9622d48cdf`; owner closure
`da1144c3332a0141aa778fcef26be1b8f6636b85` and candidate match their supplied
remote pins. Accepted Designer `ba0304693487292e354374b1bd93908506eb2da9`,
closure `9010c5aff2afb1fb792bf1a1cb15ddf9a92cae55`, accepted 1.1 product
`9ae689b487d610e3df0581885660fe096f645a88` and delivery
`de71260e07709aef610c028862d3cc5f3251b1df` remain ancestors.

The 1.1 owner closure faithfully records explicit acceptance through those
repairs/refinements, retains original FAIL/HELD observations and remaining
findings, and issues only 1.2. It does not transform historical gate reports
into whole-Stage 9 verification. No repeated owner 1.1 walkthrough was performed.
The original main checkout has unrelated state; it was left untouched. Work
occurred only in the clean isolated verifier checkout.

## Source challenge

Only AgentChat.svelte product source differs from owner closure. Each admitted
send captures the live Designer bridge document, revision/digest/epoch and
selection once; no automatic read, refresh or replay was added. Manual Source
Apply and agent proposals still use the same EditorBridge and history.

Stop marks the specific turn cancelled, clears its run ID before abort/DELETE,
and gives immediate local feedback using its local applied count. DELETE is
fire-and-forget and has no status mutation. Abort is checked after every stream
read and before each queued frame, so buffered proposals/progress/terminal
counts cannot supersede cancellation. The finally block only clears the active
turn it owns. A synchronous browser refusal is acknowledged, then aborts and
cancels that turn; its actual refusal and new-request action survive catch.
No canonical validation, history/storage, server provider, output/thinking,
shared Conversation, package manifest or lockfile behavior changed.

The unchanged synchronous apply boundary compares full document identity,
revision/digest/epoch, refuses pending drafts, validates the complete transaction
and result digest, then calls bridge.apply without an asynchronous gap. Server
edit serialization, sticky browser refusal, pending acknowledgements and abort/
fenced checks remain intact. New requests alone receive a new context snapshot.

## Executed checks

- Full Studio **165/165 PASS**, 28 files, **Vitest 3.2.7**, 69.41s, using the
  exact candidate config plus a verification-only two-root Vite filesystem
  allowance. Command from apps/studio:
  `node node_modules/vitest/vitest.mjs run --config ../../docs/studio/verification-cycle-1-2/studio-reuse.config.ts`.
- TypeScript **PASS**: `npm run check --workspace apps/studio`.
  ESLint **PASS** on the changed product file and candidate regression file.
- Exact production build **PASS**: `npm run build --workspace apps/studio`.
  All **202 files** are hashed with the full producing commit in
  artifact-manifest.json; zero absolute/nonrelocatable runtime imports.
- Three additional independent fixture tests **PASS**, 23.67s: acknowledgement
  transport failure after a real canonical apply retains one effect and Undo;
  a refused old turn's buffered proposal/progress/completed count999 cannot
  revive it or replace new-turn feedback; an invalid multi-operation proposal
  refuses atomically with no history or automatic replay. The mount/bridge
  boilerplate derives from the candidate regression, while these scenarios are
  separate. These are deterministic transports, not live-provider outages.
- Eight runtime externals plus native SQLite and mdast resolve to the same
  physical dependency files as the intended builder checkout. No installation
  or package rebuild occurred. Source equality proves AgentChat, Designer and
  Conversation in both checkouts match exact candidate Git blobs after CRLF/LF
  normalization. Raw hashes are retained.
- Actual selected credential scan: **zero matches** in client/evidence; zero
  server-only markers in the client. Secret values were never printed or copied.

Initial independent full-suite output is retained: 120 passed, nine suites
reported absolute dependency modules missing despite those files physically
existing with unchanged 2026-10-22 timestamps. This is the previously documented
two-worktree Vite filesystem allowance issue. The first tentative missing-dist/
contention diagnosis was disproved by physical paths/timestamps and the successful
unchanged two-root rerun; no disappearance or concurrent rebuild is claimed.
The first independent-test invocation used the wrong working-directory-relative
config path and failed before tests; its log is also retained. No failed test
or product observation was rewritten as passing.

## Continuous production journey with the real provider

`continuous-real-provider.mjs` ran headless Chrome with a disposable profile at
authenticated isolated `http://127.0.0.1:5592`, serving the exact build. All six
turns used real z.ai GLM-5.3-Flash through the existing VICT/Mastra host, preserved
131072 output/default thinking configuration, and natural prompts. Requests,
events, actual proposals, acknowledgements, canonical documents, screenshots
and timing summaries are retained in JSON. No fixture supplied a positive
journey edit.

| Requirement | Independent result |
| --- | --- |
| Build UI | PASS: real registration form, one validated browser-acknowledged batch; first proposal35.721s, completion43.734s. |
| Manual edit/selection then continue | PASS: changed the heading text through public Document → Source → Apply source to “Manual registration title retained”; selected its actual occurrence through Document → Layers. Next real request contains the exact manual document and selected occurrence, and changes its color while preserving manual content. |
| Stop after actual effects | PASS: third real turn adds the benefits section; operator Stop follows its first successful acknowledgement. One local batch remains visible/undoable; DELETE200 arrives49ms after that acknowledgement. No further canonical effects occur after cancellation; local status says Stopped with one applied edit. The stream aborts without a normal terminal done event, which is expected. |
| Shared mixed history | PASS: three Undo steps reach pre-interruption state, then manual state before agent continuation, then initial agent state before the manual Source edit. Three Redo steps restore the exact interrupted document. |
| Save/reopen and continue | PASS: Save and Reload saved version preserve exact canonical source at r1.r1. Fourth real request captures that saved source and adds the privacy note while retaining the manual title and previous content. |
| Stale manual protection | PASS: only a labelled transport timing seam delays delivery of the actual fifth provider proposal. A real public Source Apply changes the canonical document, then the unchanged proposal is released. Correct UI_DOC_STALE_REVISION acknowledgement, zero successful effects, DELETE200, Send available with new-request action within236ms; exact manual state survives. |
| Fresh request after refusal | PASS: sixth explicit user request contains the exact fifth-turn manual document and a changed digest/revision r1.r1#2. Exactly six explicit requests occur; no automatic replay or mid-turn refresh. Existing manual title remains present. |
| Pending draft protection | PASS: the same labelled timing seam delays the actual sixth provider proposal while a real public Source draft is opened. Correct STUDIO_AGENT_DRAFT acknowledgement, zero successful effects, DELETE200, composer settles138ms after release; draft remains byte-exact. Discard draft reveals unchanged canonical source. |

The timing seams affect delivery time only; they do not replace/edit provider
proposal bytes, validation, acknowledgements or canonical state. Timings are
samples, not guarantees. The first four turns form one continuous positive
journey in a single page/profile/document. Screenshots 01–04 were retained;
registration, Stop and real stale-refusal surfaces were directly inspected.
No browser exceptions occurred. The accepted shared feed/history carries2/4/6/
8/10 prior messages into later requests, including the interrupted turn.

## Presentation and targeted negatives

Reused/adapted production-composer.mjs runs the exact production shell with an
explicit deterministic fetch fixture. **26/26 assertions PASS** at1280×720,
1280×500 and390×700: single Send/Stop, busy keyboard guard, repeated Stop
idempotence, editable next drafts, hide/show, compact footer, useful failure,
long composer and popup growth/resize. Screenshots of short desktop, mobile
failure and real refusal were directly inspected: status/details/composer do
not overlap; full refusal remains available in its title/details. This script
does not prove a live provider failure or an agent edit.

Candidate five handoff regressions independently pass in the full suite,
including delayed DELETE/new-turn status and late-frame cancellation. The new
three fixture cases above add interrupted acknowledgement, stale old-turn
interleaving and invalid atomicity. Existing full-suite canonical digest/draft/
epoch/replay/invalid transaction tests pass. Broad unchanged auth/CSRF/provider
configuration and prior genuine upstream rejection evidence remain scoped to
accepted 1.1 reports. No new actual upstream outage after an applied edit is
claimed; that limit remains retained.

## Disposition and next allowed action

**PASS WITH RETAINED NON-BLOCKING FINDINGS** for exact candidate7874c641…;
no new blocking or non-blocking product finding. The 1.1 closure's retained
oversized socket-reset, exact-selection interaction, latency, assistant copy,
existing diagnostics and ephemeral-chat/deployment limits remain unchanged.

The verifier never accessed owner5591 browser, session/store, process or serving
build. No owner login renewal, tab reload, request replay, Save or saved-data
mutation occurred. Own headless browsers closed; own5592 server stopped. Exact
202-file build is preserved at
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02/apps/studio/build`.
The parent may recheck manifest/runtime equality and launch a separate preview
on **localhost:5593**, preserving the owner's127.0.0.1:5591 cookies and sessions.

This is independent candidate verification ready for owner review. It does not
grant owner acceptance of1.2, main merge, publication, Stage9 closure or1.3.
Evidence branch is pushed and its full remote SHA is reported in the handover.
