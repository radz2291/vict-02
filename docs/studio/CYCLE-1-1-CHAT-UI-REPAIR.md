# Cycle 1.1 chat UI repair — verified, ready for owner review

2026-10-23. Owner-authorized repair after review of a populated chat screenshot:
composer/status overlap, cramped transcript, raw Markdown, excessive activity
noise. Apply the owner's professional creative-software preferences: work first,
compact hierarchy, one home per capability, deliberate disclosure, stable tools,
plain language and recoverable experimentation. No Cycle 1.2 collaboration work.

Clean remote-equal base `63ae937cdcbbe1839b78d85bbb9a8a2ef32dac4f`; main remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Isolated branch
`codex/studio-cycle-1-1-chat-layout`. Earlier accepted and failed evidence stays.

Bounded scope reconciliation: existing Conversation has no custom-body snippet or
multiline composer API, and only follows appended messages rather than streamed
text. CSS alone cannot implement these behaviors safely. Extend ONLY
`packages/ui-svelte/src/Conversation.svelte` with three optional, default-off
presentation props and focused tests. Existing default rendering, input and
submission behavior remain unchanged; no catalog/node/renderer/editing ABI,
global styles, agent framework or backend changes. Studio owns its layout and
safe AST message renderer. Promote existing pinned mdast-util-from-markdown 2.0.3
to an explicit Studio dependency; no new chat SDK or dependency version upgrade.
This bounded optional extension is necessary to retain reuse instead of forking
the chat component. It does not reopen a foundation stage or claim package release.

Gate: exact pushed candidate, independent default/opt-in checks and visual review
at desktop/short/narrow sizes with long streamed replies, expanded details,
failures and keyboard input; production real-agent smoke. No owner canvas reload
or discard for activation. Stop at verified Cycle 1.1 ready for owner review.

## Candidate implementation

One compact header, screen/selection context, one scrollable transcript and a
bottom-anchored multiline composer. Status has its own bounded row. Chat details
holds model, reconnect, the last eight activity entries and the connection record
in one dismissible, bounded popover. It stays inside the chat panel and above the
composer at tested sizes. Removed repeated setup, history/save reminders and
permanently visible activity. Canvas width remains the existing 320px allocation.

Studio renders CommonMark paragraphs, lists, emphasis, modest headings and code
through escaped Svelte AST nodes. Raw HTML remains text; images render alt text
without network requests; links accept absolute HTTP(S) only. There is no HTML
injection path. Replies from separate tool steps get paragraph boundaries.
Streamed text follows the bottom until the reader scrolls away. Enter sends,
Shift+Enter inserts a newline; IME composition does not submit. Failed admission
retains the request. Agent/edit/history/save server contracts are unchanged.

## Builder checks

- Studio: 140/140 tests, 26 files; 74.58s. Expected test-local target connection
  refusal messages remain in the log; no failed tests.
- Shared renderer: 51/51 focused/default regression checks, five files; 19.45s.
- Studio TypeScript check passes. Designer svelte-check: zero errors, six
  inherited warnings in DocumentHost, RenderNode and StateValuesPanel.
- Scoped TypeScript ESLint passes; dependency lock adds one explicit dependency
  line and changes no resolved versions. Refetched main remains the baseline.
- Browser layout fixture at 1280×720, 1280×500 and 390×700: long streamed
  response, formatted lists, eight activity entries, collapsed/expanded details,
  keyboard dismissal and provider failure. Composer/status do not overlap;
  details do not cover the canvas or composer. Narrow details was tightened
  after the first visual observation. Original owner tab was never navigated.

[Builder logs and screenshots](cycle-1-1-chat-ui-2026-10-23/).
The fixture is explicitly labeled, lives outside SvelteKit routes, never writes
saved screens and is NOT real-agent proof. Run it separately with
`node node_modules/vite/bin/vite.js --config apps/studio/tests/visual/vite.config.ts`.
`?scenario=failure` exercises a failure following partial effects;
`?scenario=offline` exercises missing configuration.

Retained failed observations: the first new shared test checked an async error
before rendering settled (50/51, corrected to wait); initial svelte-check caught
two new type errors, now fixed. A fixture-only Vite restart after formatting left
a blank page; blank captures are explicitly named, reload restored the fixture.
No production failure is inferred from that development-server restart.

## Actual-shell failure and repair loop

Initial product `0f36438f8c8a7f25f9878f7ff626b86f4e25afae` received an
initial independent PASS at evidence `f4e63d72fa34a1a21c9ef217bafdcb564de5aec8`.
A parent-requested challenge in the actual production Designer shell then found
the global ControlScope catalog popover recipe overriding width/padding/display.
At 1280×500, details were 360px wide and extended 48px beyond the chat, with 9px
of composer-region overlap. The standalone fixture lacked those global styles
and the real toolbar/footer. The initial PASS is **superseded by FAIL**, evidence
`8ac2040a3b2c0ae40fac6f3b4d9e1c765882b06a`.
[Failed actual-shell challenge](verification-cycle-1-1-chat-ui/FAIL-0F36438-PRODUCTION-SHELL.md).
That failed artifact was never activated. Earlier reports and screenshots stay.

Repair: Studio details now explicitly owns block layout, spacing and sizing
with a scoped selector that wins the generic catalog recipe. Floating collision
and available-size bounds use the actual transcript element rather than the
whole panel or viewport-height arithmetic, accounting for toolbar, footer,
composer growth and errors. The fixture now includes the same ControlScope,
catalog/workspace CSS, 44px toolbar and 24px footer. No global catalog CSS changed.
Also preserve reference-image alt text without fetching the image; reference
links intentionally remain text rather than complete CommonMark resolution.

Builder repaired-shell observations: 1280×500 details are 264×228, contained
within the 320px panel and ending at y326 before composer y369. At 390×700,
details are 280×139 ending at y237 before composer y272. The corrected fixture
screenshots/rects are retained. Six affected UI/formatting tests pass (27.60s);
Designer check passes with zero errors and the same six inherited warnings;
scoped lint passes. Earlier full 140/140 and shared 51/51 apply to the initial
presentation candidate; they are not silently relabeled as a new full-suite run.

## Final independent gate and local activation

Final exact product: `3e2717f0377209cc9c777fb2531ab19349ba08a4` on
`codex/studio-cycle-1-1-chat-layout`. Independent **PASS WITH NON-BLOCKING
FINDINGS**, evidence `f9b0560a2f5141db77bebe220c3099e3c2ec9e27` on
`codex/studio-cycle-1-1-chat-ui-verification-final`, pushed and remote-verified.
[Final independent report](verification-cycle-1-1-chat-ui-final/FINAL-VERIFICATION.md).
Studio source tree `676cd6dce30dd1a87265fd32f3e694c098663f09` and shared
ui-svelte tree `0a9df142b415701a7fb086dcb4e83acf6409b1b4` stay identical
after this product; later delivery changes are documentation/evidence only.

The final exact-candidate production build, six affected UI tests and 12 shared
default/opt-in tests pass. Actual production Designer at 1280×720, 1280×500 and
390×700 passes details containment, with both a real provider transcript and
explicitly labeled eight-activity replay. Normal active-to-provider-failure and
admission-error transitions keep the input usable with details open. The final
real z.ai turn produced 76 text deltas and one acknowledged visible canonical
edit, completed with terminal EOF, and passed Undo/Redo plus Save/reopen with
zero browser page errors. The reference-image alt finding is resolved.

Remaining nonblocking limits: reference-style links render as readable text.
A synthetic programmatic textarea-growth event while forcibly retaining the
popover can leave 5px of form-gutter overlap; neither textarea nor canvas is
covered. Pointer entry dismisses details and the busy keyboard focus stays in
the popup. Ordinary failure/refusal flows pass. The exact failed synthetic
observation and scope are retained in the independent report. Earlier inherited
findings remain in their original records.

Local activation reused the independent exact-source build instead of running
a redundant second builder build. [Activation record](cycle-1-1-chat-ui-2026-10-23/activation.json)
verifies all 202 manifest file hashes after copying, with old hashed assets
retained for existing clients. The manifest and same-physical-file runtime
dependency record are in the final independent evidence directory. This permits
this prepared local review environment; it is not a portability/publication claim.

The idle 5591 instance was restarted through the secure launcher. A new same-origin
review tab renewed the local session and shows the updated UI with the existing
saved Untitled screen at revision @3. The original owner tab was neither reloaded
nor navigated; Reconnect refreshed only its session/CSRF configuration.
[Preservation check](cycle-1-1-chat-ui-2026-10-23/owner-preservation.json) confirms
canvas DOM, draft and chat feed remained identical. Its mounted editor/history
remains intact. [Updated review view](cycle-1-1-chat-ui-2026-10-23/activated-review-tab.jpg)
and [configured details](cycle-1-1-chat-ui-2026-10-23/activated-details.jpg) are retained.
No saved screen was authored or overwritten during activation. External auth/model
files were neither copied nor modified. The selected temporary provider stays
server-side; independent actual-key/client-marker scans pass.

The updated review tab is open at `http://127.0.0.1:5591/design`. The older
preserved tab keeps its already loaded client; save any dirty work before
refreshing it. Earlier historical PASS/FAIL/HELD records remain unchanged.
Cycle 1.1 is verified and ready for owner review, not owner accepted. Stage 9
remains reopened; no main merge, publication or Cycle 1.2 was begun.

## Launch and hands-on review

The existing local review origin is `http://127.0.0.1:5591/design`. The temporary
owner-selected provider remains z.ai `glm-5.3-flash`. Keys are loaded by the
existing launcher into the server child environment; external credential/model
files are not copied, modified or committed.

For a fresh launch from this prepared checkout, stop its existing instance
before rebuilding, then run PowerShell:

```powershell
Set-Location 'C:\Users\RZ1\.codex\worktrees\studio-cycle-1-1\260831-VCT-02'
npm run build -w vict-studio
$env:ORIGIN = 'http://127.0.0.1:5591'
$env:HOST = '127.0.0.1'
$env:PORT = '5591'
$env:STUDIO_AGENT_MODEL = 'zai/glm-5.3-flash'
$env:STUDIO_AGENT_AUTH_FILE = Join-Path $env:USERPROFILE '.pi/agent/auth.json'
$env:STUDIO_AGENT_MODELS_FILE = Join-Path $env:USERPROFILE '.pi/agent/models.json'
node apps/studio/scripts/launch-agent.mjs
```

This uses the prepared pinned dependencies/framework outputs. Independent
source/build isolation reuses that installed dependency tree; a fresh dependency
installation or general deployment portability is not claimed. Local demo login:
`operator` / `studio-local-pass`.

1. Create a blank screen through File. Ask: “Create a registration form with
   name, email, password and a Register button.” Watch streamed text and valid
   canvas edits; the short status reports completion.
2. Select the email field (Layers supports precise nested selection). Ask:
   “Change the selected field label to Work email.” The context line follows
   the selection. Manual and agent edits use the same document and history.
3. Ask to add a phone field, move it above Password, then remove it. Try Undo
   and Redo. Save, then reopen through File and inspect the saved result.
4. Open the header’s Chat details for recent activity, model and connection
   record; dismiss with Escape or an outside click. Enter sends; Shift+Enter
   adds a line. A request refused before admission remains available to retry.
   Provider/stale/invalid edits have visible feedback; earlier applied changes
   remain on the canvas and undoable. The original broader acceptance matrix
   and its real-provider evidence remain in CYCLE-1-1-REPORT.md.

Chat is session-local and clears on leaving Designer. Reference-style links
remain readable text. Inherited backend/selection findings stay in the original
reports; this presentation repair does not relabel them as resolved. Owner
review/acceptance remains separate; broader Stage 9 stays reopened and Cycle 1.2
has not begun.
