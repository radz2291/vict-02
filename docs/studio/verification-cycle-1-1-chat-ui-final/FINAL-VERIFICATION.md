# Final independent recheck — PASS WITH NON-BLOCKING FINDINGS

Exact product: `3e2717f0377209cc9c777fb2531ab19349ba08a4` on
`codex/studio-cycle-1-1-chat-layout`, independently compared with the pushed
remote. Main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`.
The verifier switched its own isolated checkout to a fresh branch
`codex/studio-cycle-1-1-chat-ui-verification-final` at exactly this candidate.
Product source/lockfile had zero diff from the candidate during build/checks.
No implementation was authored by the verifier; only evidence is added afterward.

The earlier candidate `0f36438f8c8a7f25f9878f7ff626b86f4e25afae` remains
**FAIL**, with the [superseding failure report](../verification-cycle-1-1-chat-ui/FAIL-0F36438-PRODUCTION-SHELL.md)
and independent evidence `8ac2040a3b2c0ae40fac6f3b4d9e1c765882b06a` preserved.
Its earlier passing decision was superseded when the actual production
ControlScope revealed a 360 px popover spilling into the canvas and overlapping
the composer at short height. This final verdict applies only to the repaired SHA.

## Checks and results

| Claim | Exact final candidate result |
| --- | --- |
| Production build | PASS; [log](production-build.log), client 30.73 seconds / server 63 seconds, adapter completed |
| Affected Studio UI and safe AST formatting | PASS; [6/6 tests, two files](affected-ui.log), 37.22 seconds |
| Shared default/optional Conversation regression | PASS; [12/12 tests, three files](renderer.log), 27.97 seconds |
| Real z.ai streamed edit and terminal Send | PASS; [production browser record](production-browser.json), [driver](production-browser.mjs), [log](production-browser.log) |
| Actual production details at 1280×720, 1280×500, 390×700 | PASS on the live provider page; canvas, transcript, composer and status remain separate |
| Maximum eight-entry details in actual shell | PASS; [explicit recorded-response replay](production-shell-layout.json), no new provider claim |
| Open details during failure/refusal and retained draft | PASS for ordinary interaction; [explicit delayed replay](dynamic-shell-layout.json), [driver](dynamic-shell-layout.mjs), [log](dynamic-shell-layout.log) |
| Undo/Redo, Save and reload saved revision | PASS in the same final real production journey |
| Server credential isolation | PASS; [credential scan](credential-isolation.json), zero selected-key matches or client server-only markers |

The full 140/140 Studio run belongs to the original candidate and is retained
as such in the previous audit. This final change alters bounded popover layout,
its collision boundary, the layout fixture and reference-image alt handling;
the six affected Studio cases plus twelve shared defaults/opt-ins are the
independent final regression recheck. Earlier broad Cycle 1.1 acceptance and
backend failure matrices remain scoped to their own candidates. Existing Svelte
and circular-dependency build warnings are retained; no warning is relabeled a
new failure or silently removed.

## Real provider and actual production layout

The secure existing launcher ran the final artifact only on the verifier's
`127.0.0.1:5592` origin with `zai/glm-5.3-flash` and the authorized external
auth/model files. An isolated headless Chrome profile/storage was used.
No credential was copied or printed; no owner tab, source, storage, or 5591,
5480 or 5587 process was accessed. This verifier performed no activation.

Final real turn `turn-143840e6-b19b-488b-84c8-f72e233a263f` used profile
`v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
It produced **76 text deltas**, one valid browser-acknowledged canonical edit,
zero edit refusals, and visibly added **Chat layout independently verified**.
Observed turn time was 25.842 seconds; EOF followed terminal done by 1 ms.
These are samples, not performance guarantees. The provider's heading, bullets,
bold and inline code render as formatted content. The composer clears after
admission and a new draft enables Send after completion. Undo restores the exact
pre-edit document, Redo restores the edited source, and Save/reload preserves
the exact saved `r1.r1` document. Zero page errors were recorded. Empty selection
shows the screen name without a `None` token.

- [Real populated production screen](production-populated.png)
- [Real streaming screen](production-streaming.png)
- [Real desktop details](production-live-1280x720-details.png)
- [Real short details](production-live-1280x500-details.png)
- [Real narrow details](production-live-390x700-details.png)
- [Saved/reopened screen](production-saved-reopened.png)

These images were independently viewed. The separate eight-activity replay uses
the actual production Designer, toolbar, footer and ControlScope; it explicitly
replays recorded text plus labeled activity and makes no provider or edit claim.
Measured details widths/heights are 264×320, 264×228 and 280×139 px.
At short height, details right=284 is inside panel right=320 and bottom=326
is above composer top=369. At narrow size, details right=355 is inside panel
right=390 and bottom=237 is above composer top=272. The original failure's
48 px canvas spill and composer overlap are resolved.

The delayed replay opens details while a simulated stream is still active, then
ends in provider failure. Details bottom=311 remains above composer top=354.
A second delayed admission refusal grows the send-error area to 49.5 px and
retains the exact request; details bottom=255 remains above composer top=298.5.
Pointer interaction with the textarea dismisses details. During the busy state,
five Tab presses remain on the only enabled popup control (Close); typing into
the composer behind the popup is not reachable by that keyboard path. Escape
dismissal also passes in the real production journey.

## Artifact and dependency integrity

[Final manifest](artifact-manifest.json) records **202 files** with bytes and
SHA-256, producing commit exactly
`3e2717f0377209cc9c777fb2531ab19349ba08a4`, build directory
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02/apps/studio/build`.
No absolute or checkout-escaping runtime imports were found.
[Runtime/source dependency record](runtime-dependencies.json) confirms all eight
actual emitted external imports resolve to the same physical files at the
activation destination, as do the selected native libsql binary and pinned
`mdast-util-from-markdown` 2.0.3 entry. The Markdown parser is bundled.

Dependency junctions reuse the builder's pinned installation and unchanged
framework dist. This is independent source/build verification, not a fresh
dependency installation. The app-local ui-svelte junction resolves this verifier's
own source; the record includes its realpath and Conversation SHA-256
`cc79e8188d0f4a180abd094bb6dd27a5d0a42094640a4bad5979bbb7d0adb211`.
The test-only Studio configuration allows the two exact verifier/dependency
roots. Product configuration was not modified to pass checks.

## Retained findings and limits

- Original production-shell FAIL and all earlier collector/setup failures remain
  unchanged in the prior audit directory. The old manifest is historical and
  is not the activation manifest.
- The original low reference-image alt loss is **resolved** by the final explicit
  `imageReference` case and passing focused regression. Reference-style links
  intentionally remain plain text. No general complete CommonMark claim is made.
- **Low N-2 — synthetic retained-popup resize:** a programmatic input event can
  grow the textarea from 64 to 112 px while forcibly retaining an open popup.
  Floating positioning does not immediately recompute the sibling feed boundary;
  popup bottom stays 311 while composer top moves to 306. This is a 5 px overlap
  of the form gutter. The textarea starts at 317 and is not covered; the canvas
  remains untouched. [Original synthetic record](dynamic-growth-attempt.json),
  [keyboard follow-up](dynamic-growth-keyboard-attempt.json),
  [driver](dynamic-growth-driver.mjs) and
  [screenshot](dynamic-growth-composer-grew.png) preserve the failed observation.
  Pointer entry dismisses the popup and busy keyboard focus remains inside it;
  ordinary active-to-failure and admission-error transitions pass. No reachable
  user control or canvas overlap was demonstrated. This artificial state is a
  documented nonblocking limit, not a silently passing assertion.
- Inherited Cycle 1.1 findings and historical closure decisions remain scoped
  to their original evidence. This repair does not certify every viewport,
  general deployment portability, whole Stage 9 or a later Studio cycle.

## Next allowed action

The final repair passes for owner review with the synthetic limit retained.
The parent may activate only this final manifest-checked local artifact with the
recorded identical dependencies, preserving old hashed assets and the owner's
canvas/draft/chat without reloading the owner tab. An already loaded owner
client receives new chat code only on a safe refresh. Owner acceptance remains
separate; Stage 9 stays reopened, and no main merge, publication, whole-Stage 9
Verified claim or Cycle 1.2 is issued by this audit.
