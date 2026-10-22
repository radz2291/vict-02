# Cycle 1.1 chat UI repair — in progress

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

Independent exact-repair build, actual-shell geometry and real-agent recheck
are pending. This builder report is a candidate, not a gate verdict.
