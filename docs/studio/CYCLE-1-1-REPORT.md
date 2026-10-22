# Cycle 1.1 delivery — ready for owner review

2026-10-22, Asia/Kuala_Lumpur. Branch `codex/studio-cycle-1-1`.
Base `d7401bef6e48330796c74ec00c86db9622d48cdf`; authority/handoff
`f2492507ef298827324d5684da2660c26d973a75` (pushed and remote-equal).
Independent verdict: **PASS WITH NON-BLOCKING FINDINGS** on the repaired product.
This delivery record does not mark owner acceptance or authorize Cycle 1.2.

## Delivered implementation

Existing `Conversation` beside the accepted canvas; current screen/selection
context; palette-backed add/modify/move/remove tools. The existing
`composeMastraTurnExecutor`, `AgentProfileRegistry`, `AgentTurnService`, stream
hub, capability bridge, invocation claim/settlement and truthful quiet-write
policy drive real turns. No new agent engine or framework source changes.

The server prepares canonical commands and validates the result. The browser
revalidates against its current document ID, working revision, content digest and
editor epoch, applies through the existing EditorBridge, and acknowledges the
actual resulting revision/digest. A tool succeeds only after this acknowledgement.
Parallel model edit calls serialize. Each applied batch is one existing Undo
entry; saves remain explicit and use the unchanged store format/keys. Reopen or
screen-switch changes the epoch; normal edits/undo/redo have monotonic working
revisions. Drafts refuse edits. No retry/replay blindly reapplies a proposal.

Endpoints require the existing authenticated HttpOnly session, same-origin hook,
explicit JSON content type and session-bound CSRF nonce. The authenticated,
no-store bootstrap exposes only that nonce, model name and configured status.
This additive nonce disclosure is intentional; the session ID and provider/target
credentials remain server-side. Requests, operations, streams, active turns and
acknowledgement waits are bounded. Disconnect/Stop cancels pending work; previously
applied edits stay visible and undoable. Provider errors are stable safe feedback.

Conversation and operational turn stores are ephemeral for this local cycle.
Mastra uses its existing dedicated protected store per turn, flushed/closed with
bounded cleanup and removed from the host-created temporary directory. No restart
recovery or persistent chat claim. Browser-saved screens remain durable locally
through the existing storage mechanism.

## Live provider and launch

Owner's temporary configuration: z.ai, `glm-5.3-flash`, protected local
`~/.pi/agent/auth.json` and `~/.pi/agent/models.json`. No credential value or copy
of either file is committed. Only the `zai.key` field is read from auth; only the
selected provider entry's HTTPS base URL is read from models. The model list in
that temporary file predates the owner's explicitly selected model; the explicit
model selection takes precedence. No external file is edited.

The prepared production review instance is already running at
`http://127.0.0.1:5591/design`. To reproduce from this checkout (PowerShell):

```powershell
Set-Location C:\Users\RZ1\.codex\worktrees\studio-cycle-1-1\260831-VCT-02
npm ci
npm run build
npm run build -w vict-studio
$env:ORIGIN='http://127.0.0.1:5591'
$env:HOST='127.0.0.1'
$env:PORT='5591'
$env:STUDIO_AGENT_MODEL='zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE=Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE=Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
```

Alternatively supply `ZAI_API_KEY` and `STUDIO_AGENT_BASE_URL` in the server
environment. Default z.ai base URL is its coding endpoint. Other configured
providers are OpenAI, Anthropic, OpenRouter and Ollama Cloud; they are not the
owner-selected live acceptance configuration. No automatic provider fallback.

Open `http://127.0.0.1:5591/design`, login `operator` / `studio-local-pass`
unless deployment credentials override the demo. Use an unused port for isolated
verification. Keep the same host/port to reopen its browser-local saved screens.
Never reset the owner's existing 5480/5587 servers or origin storage.

## Builder observations and retained failures

- Real z.ai GLM-5.3-Flash built a fresh registration screen in three acknowledged
  batches. A first invalid tool input was refused at revision `r1#0`; the model
  retried with a valid request and no partial invalid content appeared.
- Selected the exact Email input through Document → Layers. A real follow-up
  changed only placeholder to `Work email address` and border color to `#5269bd`.
  VICT turn: `turn-00397519-0d76-4818-a46a-bc7808e69623`; profile:
  `v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
- A real turn added `No spam.` at the end of the form section, then moved that
  same source node to its start (`r1#5` → `r1#6`). Another real turn removed only
  that note (`r1#7`). Manual Undo restored it; Redo removed it. Save stored
  `r1.r1`; Reload saved version retained all fields, button and email modification.
- A live stale-state challenge started an agent heading change at `r1.r1#0`,
  then manually renamed the screen. The browser refused the older proposal with
  `UI_DOC_STALE_REVISION`; the heading stayed `Create your account`, and the
  manual rename remained. Manual Undo restored the saved name.
- Source and screenshots: [builder evidence](cycle-1-1-2026-10-22/).
- Direct canvas input clicking selected its enclosing section in the builder
  browser; exact field selection via the existing Layers works. Renderer/editor
  framework bytes are unchanged. This is an inherited selection interaction,
  retained for independent challenge; no broad canvas-selection polish is claimed.
- Initial integration failed the existing bridge's depth-8 presentation limit;
  schema guidance was flattened, while strict operation validation remained.
- Next integration failed because the existing AgentTurnService requires an
  explicit ID factory. Host composition now supplies UUID-based IDs.
- Provider-failure/cancellation checking exposed late cancellation against an
  already failed turn; host cancellation now catches that terminal refusal.
  Cleanup is bounded so an upstream settle wait cannot keep the browser waiting.
- Before the owner's z.ai steering, the existing Quellight Ollama key reached
  the live provider, which refused its older GLM model under the account plan.
  No edit applied. An Ollama free-model inventory was read, but no alternate
  provider acceptance is claimed. The owner's z.ai choice supersedes that attempt.
- Dev regeneration reloaded an unsaved test screen during checks. The discarded
  test draft was recreated; existing saved samples remained unchanged. Perform
  final browser verification under production serving, without concurrent dev
  regeneration. Do not run sync/build/test commands against a live dev walkthrough.
- Initial root build hit ENOSPC. A repeat root build passed. Failed logs are
  retained; environment contention is not relabeled a passing first run.

## Checks and independent gate

Original pushed product candidate:
`9c3675c42fc28f719b7052932177eb8461db5a30`. Independent first verdict **FAIL**,
preserved on `codex/studio-cycle-1-1-verification` at
`31a3a357c95ea9243be58341a44230b56a1e0d88`. The production adapter bundled
transitive Mastra/libsql imports and could not resolve the Windows native
module at authenticated agent bootstrap (HTTP 500). The independent initial
129/129 result used a different runner due to a dependency-junction mistake;
that observation remains retained and is not the authoritative local-runner
proof. Builder's original full suite was 128/129 with an intermittent rejected
provider-call timeout. None of these failures is rewritten as PASS.

Bounded repair: declare the already pinned Mastra runtime packages directly in
the private Studio app so adapter-node preserves their Node/native resolution.
A Studio model seam, based on the existing Quellight deadline pattern, keeps the
real router instance, contains raw provider failures as safe SDK error chunks,
propagates AbortSignal and fences the host against a stalled upstream completion.
The host reports failure/Stop honestly without claiming successful inference or
reversing already applied edits. No framework source/ABI/version changes.
New seam probes cover a rejected promise, errored stream, never-settling provider
promise, deadline and quiet-stream Stop. Intermediate typing/fixture failures and
the original timeout logs remain in the evidence directory.

Repaired product candidate:
`8be9ce86dc981ae8c284b4f354a12a3afad8fc8e` (normal-pushed; remote-equal).
The independent verifier's read-only repair challenge also identified a Stop
gap between model streams: the final host now listens directly to its abort
signal, independently of a live model stream. Its exact-source focused recheck
passed 6/6; cancellation before acknowledgement fell from the retained 76-second
observation to 1.68 seconds in the passing run. These are observed timings, not
a performance guarantee. The builder's full repaired Studio suite passed
132/132 tests in 22 files under the pinned local Vitest 3.2.7 runner
(`studio-tests-repaired.log`, 141.85 seconds). The subsequent builder build was
stopped to release disk/resources for independent verification; its partial log
is not a passing build. The independent verifier also passed 132/132 tests in 22 files using the
pinned local 3.2.7 runner (181.45s). Its separate checkout reused unchanged
workspace dependency outputs; a verifier-only Vite fs.allow configuration names
exactly the two roots so linked JavaScript dependencies can load. Earlier ENOSPC
and denied-path runs remain retained environment failures, not product passes.
All planned independent production/live challenges on this exact source passed;
the committed independent verdict and evidence are cited below.

Timing finding retained: Stop was 1.68s in the focused builder run, 8.89s in the
full builder suite and about 19s in the independent loaded suite; provider failure
after an acknowledged edit was about 57s in that independent loaded suite. All
settled within the configured bound. No responsiveness/performance guarantee is
established by these passing assertions.

## Independent final verdict and remaining findings

**PASS WITH NON-BLOCKING FINDINGS**, independent evidence branch
`codex/studio-cycle-1-1-verification-final`, commit
`6610c4db571868b299747d3da4995f5f180e2e38` (pushed and remote-equal).
[Full independent report and criterion matrix](verification-cycle-1-1/FINAL-VERIFICATION.md).
Its separate source checkout and production build exercised real z.ai
`glm-5.3-flash`; unchanged dependencies/framework outputs were reused through
junctions, so this was not a separate npm installation or framework rebuild.

All planned challenges passed: blank registration, selected-field-only edit,
add/move/remove, Undo/Redo, exact saved-byte reopen, atomic invalid refusal,
manual/undo/reopen stale-state refusal, draft-before-send and draft-arriving-late,
live disconnect with two earlier batches visible and undoable, and actual z.ai
invalid-credential failure (14.8s, safe code, zero proposals/effects). The
post-acknowledgement provider failure uses an offline model through the genuine
pinned Mastra executor; no real mid-turn upstream outage is claimed. Independent
checks include 132/132 tests, eight model-seam probes, and 33 production HTTP probes
(30 expected responses and three fail-closed oversized-request socket resets).

Remaining non-blocking findings:

- V-2: oversized 256001-byte JSON requests reset the adapter-node socket instead
  of returning the helper's intended 413. They produce no edit/authority bypass;
  stable transport feedback is a follow-up.
- Exact input selection through Document → Layers works. Direct canvas clicks
  may select the enclosing section, an inherited editor interaction.
- Failure/Stop settle time varies under load, as recorded above. Existing
  diagnostics and dependency notices remain retained. Chat/turn state is
  ephemeral; broader collaboration, restart recovery, deployment readiness and
  performance guarantees are outside this cycle.

No blocking finding remains. Evidence integration after the product candidate is
documentation only; Studio product tree remains
`66a993a9a8e1d6ef8cc9df911949af512e76897a`. The original FAIL is preserved at
`31a3a357c95ea9243be58341a44230b56a1e0d88` and its original report is included
unchanged beside the final independent report. Original main and the accepted
Designer lineage were preserved; no main merge occurred.

## Final builder production recheck at 8be9ce8

`production-build-8be.log`: adapter-node build PASS. The authenticated production
browser at 5591 reopened the existing registration screen with every field and the
saved email styling preserved. Real z.ai `glm-5.3-flash` changed only the selected
email placeholder to `Company email`, one acknowledged batch. VICT turn
`turn-aee0f7f8-f7dd-4f5d-b469-5d03a4f0fa33`, profile
`v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
Save produced `r1.r2`; full page reload retained the edit. Canonical source diff
against the earlier captured registration has exactly two paths: revision and
`/nodes/input-email/attributes/placeholder`. Screenshots, both canonical sources,
and machine-readable diff are in the evidence directory. Production remains
running at 5591 for owner review; original owner servers and origins are untouched.

`client-boundary-8be.json`: PASS across 45 client files, including actual selected
provider credential checked in memory against client bytes and committed diff.
No server composition markers occur in client artifacts. The saved-replay static
dependency closure excludes the authoring positive controls. This is a static
bundle check, not a browser network trace. All builder text evidence was also
checked for the actual provider key; no credential value is recorded.

## Hands-on review

1. File → New screen; choose a new name. In chat ask for a registration form.
   Watch batches appear; unsaved changes and Undo remain the existing controls.
2. Document → Layers → choose the Email input. Ask to change only its placeholder.
   The chat context identifies the selected source element.
3. Ask to add a Text note, move it to the start of the section, then remove it.
   Edit → Undo/Redo traverses the same history as manual changes.
4. File → Save, then Reload saved version. The saved canonical source reopens
   through the existing store. Preview → Run saved retains its existing scope.
5. Start an agent edit and manually rename the screen before its proposal arrives.
   The stale edit is refused; send a fresh request. Pending source/property drafts
   also refuse requests. Stop or a provider failure preserves already applied
   batches; inspect the canvas before retrying and use Undo as needed.

Checks: canonical editing/HTTP 4/4; focused repaired model/Mastra probes 6/6
(offline models, explicitly not live-provider proof); root typecheck, Studio
check and scoped ESLint pass. Designer check: 0 errors, 6 inherited warnings. Final
production build, full builder 132/132 suite and static client/credential isolation
pass. Independent exact-candidate full 132/132 suite and real-provider production
walkthrough pass. Dependency/engine and inherited Svelte accessibility/circular
import notices remain visible in the logs; no broad baseline cleanup is claimed.

Stop at independently verified Cycle 1.1, ready for owner review. Stage 9 remains
reopened; no owner acceptance, main merge, publication, deployment or Cycle 1.2.
