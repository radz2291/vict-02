# Independent chat layout verification — PASS WITH NON-BLOCKING FINDINGS

Exact pushed product assessed: `0f36438f8c8a7f25f9878f7ff626b86f4e25afae`,
`codex/studio-cycle-1-1-chat-layout`. Original `63fc70331aa1cd558d9f7a509a7dfa15fbe47387`
was superseded before checks by the one-line empty-selection omission; this report
does not award a separate verdict on that earlier candidate. Delivery baseline
`63ae937cdcbbe1839b78d85bbb9a8a2ef32dac4f`; remote main remained
`d7401bef6e48330796c74ec00c86db9622d48cdf` at initial and final comparison.

The verifier authored no implementation repair. An isolated checkout/branch
`codex/studio-cycle-1-1-chat-ui-verification` began at the exact candidate.
Original main `4d2df037d8a82d36c60bf1bff16919650643ce22` and its existing untracked
builder-kit archive were untouched. The root AGENTS instructions, canonical
reference, current Stage 9 state/architecture/handoff and Cycle 1.1 handoff,
state and bounded shared-component reconciliation were reviewed. Only this
owner-authorized presentation repair is assessed; historical operator closure,
earlier failed observations and accepted increments remain intact.

## Results

| Claim | Independent result |
| --- | --- |
| Exact candidate production build | PASS; [build log](production-build.log), 52.34 seconds |
| Studio regressions | PASS; [140/140 tests, 26 files](studio-final2.log), own Vitest 3.2.7, 92.46 seconds |
| Shared default and optional Conversation behavior | PASS; [12/12 tests, three affected files](renderer.log), root renderer project, 21.36 seconds |
| Default API behavior | PASS; default input remains single-line, default body escaped, append-only following retained; multiline, custom snippet and streamed following are opt-in |
| Enter / Shift+Enter / IME / refusal draft | PASS; shared regression plus real browser Enter submission, actual Shift+Enter newline and composition event; offline refusal retains input |
| Stream following | PASS; browser ends at transcript bottom at all three sizes, and shared test independently proves a reader's upward scroll is respected |
| Safe message formatting | PASS; AST nodes use Svelte escaping, raw HTML remains inert text, links allow absolute HTTP(S) only with noopener/noreferrer; direct images render alt without requests; focused malicious-link/HTML/image tests pass |
| Layout and details | PASS; own Chrome rendering at 1280×720, 1280×500 and 390×700, long streamed reply and eight bounded activity entries; details remain inside chat and above composer; Escape and outside clicks dismiss |
| Failure layout | PASS; populated narrow provider-failure status and offline retained draft preserve separate composer/status space |
| Production real provider | PASS; z.ai `glm-5.3-flash`, actual streamed text, canonical visible edit, terminal EOF and usable Send |
| Existing editing/history/persistence | PASS; production Undo restores pre-edit source, Redo restores edited source, Save and reload preserve the saved revision/source |
| Credentials | PASS; [selected credential scan](credential-isolation.json) has zero matches in client or evidence, zero server-only markers in client |

The independent affected shared suite is **12 tests**, not the builder's 51.
The builder's 51 includes additional matching projects; its own report remains
separate evidence. The independent full Studio suite covers the repair's renderer
and server interactions without repeating the prior complete acceptance matrix.
The pre-existing local target `localhost:3000` refusal and framework Svelte
warnings are retained in logs. No backend, edit, history, save or catalog semantic
source changes occur in this repair.

## Rendered evidence

The [fixture browser record](fixture-final.json), [driver](fixture-browser.mjs)
and [final log](fixture-browser-final.log) use the committed, visibly labeled
simulated fixture outside SvelteKit routes. These are layout evidence, never
provider evidence. Own screenshots were viewed directly:

- [Desktop transcript](fixture-1280x720.png), [desktop details](fixture-1280x720-details.png)
- [Short transcript](fixture-1280x500.png), [short details](fixture-1280x500-details.png)
- [Narrow transcript](fixture-390x700.png), [narrow details](fixture-390x700-details.png)
- [Populated narrow failure](fixture-narrow-failure.png)

Measured transcript heights are 509, 289 and 173 px respectively. The composer
and status occupy separate rows at all three sizes. Expanded details are 280 px
wide and 320/280/160 px high, contain eight activity entries, and remain above
the composer and within the chat boundary. Activity remains scrollable when its
content exceeds this deliberate disclosure area. The canvas stays outside the
details bounds. These measurements describe these viewports, not every viewport.

The [real production record](production-browser.json), [driver](production-browser.mjs)
and [log](production-browser.log) use an independent headless Chrome profile,
separate source, storage and origin `127.0.0.1:5592`. The secure existing launcher
reads only the authorized external credential/model files into the child
environment. No credential was copied, logged or placed in arguments. Neither
owner origin 5591 nor prior 5480/5587 servers or browser state was accessed.

[Real populated production screenshot](production-populated.png),
[streaming screenshot](production-streaming.png), and
[saved/reopened screenshot](production-saved-reopened.png) show the actual
provider journey. The final observed turn
`turn-7a0ead8e-f169-4690-a267-76bca0182648` used profile
`v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
It produced 131 text deltas and one acknowledged canonical edit, visibly reading
**Chat layout independently verified**. An initial invalid edit was safely
refused with `STUDIO_AGENT_VALIDATION`; the provider recovered and completed.
That refusal remains in the record. Total turn time was 33.839 seconds; terminal
done and stream EOF were observed in the same millisecond. These are samples,
not timing guarantees. The composer cleared after admission, Stop disappeared,
and a new draft immediately enabled Send. Undo/Redo and saved-source reload
passed with zero browser page errors. Empty selection displays only the screen
name, without the `None` context token.

## Source and artifact integrity

Installed dependencies and unchanged framework dist are reused through junctions;
this is independent source/build verification, not a fresh dependency install.
An app-local `@victframework/ui-svelte` junction points to this verifier's own
package, so AgentChat consumes the independently checked Conversation source.
[Runtime/source record](runtime-dependencies.json) records that realpath and
Conversation SHA-256 `cc79e8188d0f4a180abd094bb6dd27a5d0a42094640a4bad5979bbb7d0adb211`.
The fixture explicitly aliases the same own source. Test-only
[Studio config](studio.config.ts) and [fixture config](fixture.config.ts) allow
exactly the verifier root and the shared dependency root. No product config was
edited to make tests pass.

[Artifact manifest](artifact-manifest.json) contains **202 files**, each with
bytes and SHA-256, producing commit exactly
`0f36438f8c8a7f25f9878f7ff626b86f4e25afae`, and build directory
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-chat-ui-verification/260831-VCT-02/apps/studio/build`.
Its runtime import scan found no absolute or checkout-escaping imports.
The TypeScript AST-based [dependency collector](runtime-dependencies.mjs)
compares all eight actual emitted external module imports with resolution at the
activation destination. All resolve to identical physical files, as do the
selected native `@libsql/win32-x64-msvc` binary and pinned
`mdast-util-from-markdown` 2.0.3 entry. The Markdown parser is bundled in the
artifact, not left as an additional runtime external. This permits local artifact
reuse with the recorded dependency tree; it does not claim portable deployment.

## Retained observations and limits

- The first Studio command supplied a config path relative to an already changed
  root and could not load it. A second run collected 106 tests but refused shared
  dependency files outside Vite's allowed roots; adding the explicit test-only
  two-root allowance led to the full 140/140 pass. [Initial logs](studio.log),
  [dependency-boundary failure](studio-final.log) remain unchanged.
- The first fixture driver asserted outside dismissal before the browser had
  rendered it. The [failed attempt log](fixture-attempt1.log) and
  [screenshot](fixture-failure.png) remain. Waiting for the popover to disappear
  passed; no product repair was made.
- The first production driver compared the reopened saved document with the
  pre-save document and failed. [Attempt record](production-attempt1.json),
  [log](production-attempt1.log) and [screenshot](production-attempt1.png) remain.
  Save intentionally advances the canonical document revision (`session.ts`
  describes that contract). The final driver captures the saved revision first;
  reopening preserves that exact source. This was a verifier assumption error.
- **Low N-1:** reference-style links remain plain text and reference-style image
  nodes currently omit their alt text. The parser produces `imageReference`, while
  MessageNode only explicitly handles direct `image`. This creates no HTML or
  remote-image request; it is a presentation completeness limit. Direct image
  alt, basic lists/headings/emphasis/code and safe links pass. A later bounded
  renderer polish may preserve reference-image alt text; this does not block the
  requested chat layout repair.
- Earlier accepted Cycle 1.1 findings and failed candidates remain scoped to
  their original records. This presentation gate does not repeat or broaden
  their backend/security matrices, certify every CommonMark feature, or establish
  general responsiveness/performance guarantees.

## Next allowed action

This exact Cycle 1.1 chat repair passes with the low presentation limitation
above retained. The parent may use the manifest-checked local artifact and
recorded identical dependencies for the already authorized activation, preserving
old hashed assets and the owner's current canvas/draft/chat without reloading
the owner tab. The verifier has not performed activation. An already loaded
owner client receives new chat code only on a safe refresh. Owner hands-on
review and acceptance remain separate. Stage 9 stays reopened; no main merge,
publication, whole-Stage 9 Verified claim or Cycle 1.2 is authorized by this report.
