# Coding Agent Workspace — Product Proof 1 — owner review

Status: **CODING AGENT PRODUCT SLICE READY FOR OWNER REVIEW**.
This is a product proof of the UI foundation, not an acceptance of the full UI
system, not a release, and not the trading proof.

## Question this slice answers

> Can an app with a distinct workflow and layout be built mostly from VICT
> definitions, composition, and reusable UI components, while keeping
> app-specific code small?

## Baseline and isolation

- Verified pushed baseline: `codex/ui-foundation-catalog-coverage`,
  `dc69768a3736f609626a34bea06e28aee7543355` (includes the owner's five
  corrections: error-list spacing, dialog action spacing, form dropdown
  alignment, SVG select chevron, calendar grid width — `ChevronDown.svelte`,
  the `vict-control-*` spacing utilities and the calendar width rule are all in
  this baseline and are consumed by this product).
- `origin/main` recorded at the initial fetch: `e86d03234e9a603ac30de0331488515aebd8ae7c`.
- Work branch: `pi/coding-agent-workspace-p1` (isolated worktree,
  `C:\Users\RZ1\Desktop\RZ\vict-02-coding-agent-workspace`).
- Final SHA is in the delivery message; `git rev-parse HEAD` confirms.
- Main and the catalog branch are untouched. No merge, no publishing, no
  release work.

## Launch (one command, one URL)

From the worktree above, with the repository's supported Node runtime:

```powershell
npm ci          # once, in a fresh worktree
npm run workspace
```

The command builds the UI packages and starts the preview on **5181**.

| URL | What it is |
| --- | --- |
| http://127.0.0.1:5181/agent | Sessions — choose a project and a session |
| http://127.0.0.1:5181/agent/sessions/AGW-101 | Session workspace — a session WAITING for approval |
| http://127.0.0.1:5181/agent/sessions/AGW-102 | A RUNNING session |
| http://127.0.0.1:5181/agent/sessions/AGW-103 | A RUNNING session (another project) |
| http://127.0.0.1:5181/agent/sessions/AGW-104 | A COMPLETED session |
| http://127.0.0.1:5181/agent/sessions/AGW-105 | A FAILED session |

## The product flow

One coherent coding-agent workspace (brand: “Victor Workspace”) — not a gallery:

1. **Choose a project and a session** — the sessions screen filters by project
   (catalog Select) and lists sessions with status, task, branch, progress.
   Waiting sessions are triaged first.
2. **Work a conversation** — the standard VICT conversation surface, scoped to
   the session. Sends are real mutations whose handling composes a real Vict
   capability run for the deterministic assistant reply. Sending while the
   session is stopped fails safely and the draft is retained.
3. **See the current task, progress and activity** — status badge, task,
   model/branch/tokens meta, a catalog Progress bar, and an Activity list.
4. **Inspect changed files** — per-session file changes with change type.
5. **Tool output log** — a real engineering log (monospace, leveled,
   scroll-area), never a generic alert.
6. **Approval handling** — a waiting session presents Approve (resume) or
   Decline (close without applying), deterministically.
7. **State switching** — running / completed / failed / waiting sessions exist
   as data (chooser), and the console controls move the CURRENT session
   between states: approve → running, advance → progress (+25, completes at
   100), simulate failure → failed, retry from checkpoint → running.
8. **Recovery from a simulated failure** — retry resumes from the checkpoint
   with the progress intact; log and activity record the whole arc.
9. **Reset** — “Reset demo data” (catalog AlertDialog on the sessions screen)
   restores the exact seed state. All behaviour is deterministic and local; a
   dev-server restart resets it too. Interactions during a session retain
   their state (the conversation, feedback, and controls are stable across
   unrelated invalidations).

No AI agent or Mastra infrastructure is built in this phase — the server
(`agent-server.ts`) is the deterministic local stand-in for the future agent
backend, and its writes cross the normal application-data boundary with
declared contracts.

## VICT boundary proof — every visible region

| Region | Source |
| --- | --- |
| Application shell, sidebar navigation, mobile navigation drawer, header, breadcrumbs, layout regions (split main/aside, panel appearance, stack-at-medium) | **1 — Application Definition + standard renderer** (`composition` + `layoutMode: 'split'`) |
| Screen headings, intro copy, inspector heading, drawer guide | **1 — Application Definition** (`text` surfaces, `drawer` role) |
| Session status badges (chooser cards + console) | **1 + 3** — standard `status` tones in the definition vocabulary; the console island reuses the same `vict-status` classes |
| Sessions triage list (project filter, status-first ordering, progress, links) | **3 — registered product surface** `cmp.session-picker@1` |
| Task console (task, progress bar, approval panel, state controls) | **3 — registered product surface** `cmp.session-console@1` |
| Tool output log (monospace, levels, scroll area) | **3 — registered product surface** `cmp.output-log@1` |
| Conversation + composer (draft retention on failure) | **1 — Application Definition** (`conversation` surface) rendered by the standard renderer |
| Changed files list, activity list | **1 — Application Definition** (`list` surfaces, session-scoped views) |
| Progress bar, project Select, reset AlertDialog, log ScrollArea | **2 — reusable `ui-svelte`** catalog components (`catalog/progress`, `catalog/select`, `catalog/alert-dialog`, `catalog/scroll-area`) + `controls` (`ControlScope`, `ChevronDown`) |
| Route data, action boundary, contracts, permissions, deterministic state machine, capability reply | **4 — host/server bootstrap** (`agent-server.ts`, `agent-data.ts`) — the stand-in backend, not UI |
| Page host, `?path=` route-identity glue, query-vs-mutation invalidation boundary, registry wiring, lazy-surface wrapper, launch script | **4 — host/bootstrap** (`+page.svelte`, `+page.server.ts`, `api/act`, `preview-server.ts`, `registry.ts`, `AgentSurface.svelte`, `ui-workspace.mjs`) |

### Product-specific UI code count (category 3)

| File | Lines | Purpose |
| --- | ---: | --- |
| `src/lib/components/agent/SessionPicker.svelte` | 322 | project + session chooser |
| `src/lib/components/agent/SessionConsole.svelte` | 306 | task console: progress, approval, state controls |
| `src/lib/components/agent/OutputLog.svelte` | 185 | tool output log |
| `src/lib/components/agent/AgentSurface.svelte` | 26 | lazy wrapper (keeps islands out of the shared bundle) |
| `src/lib/components/agent/bus.ts` | 24 | island refresh coordination (product-local) |
| `src/lib/components/agent/eager.ts` | 16 | eager registrations for DOM tests |
| **Total product UI** | **879** | |

Supporting (NOT UI, listed for honesty):

- `src/lib/application/agent.ts` (398 lines) — the Application Definition:
  framework-neutral, no Svelte, compiles to the plan.
- `src/lib/application/agent-data.ts` (960 lines) — contracts, resources,
  deterministic seeds (most of it is seed data).
- `src/lib/server/agent-server.ts` (600 lines) — deterministic local backend
  behaviour (state machine, capability reply, scoped route data).
- Host glue diff on shared files: ~+95/−27 lines across `+page.svelte`,
  `+page.server.ts`, `api/act`, `preview-server.ts`, `application-server.ts`
  (server interface), `registry.ts`, `vitest.config.ts` (test aliases),
  `package.json`/`scripts/ui-workspace.mjs` (launch).

The islands are genuinely product-specific composition (an agent state
machine and a tool log do not exist in the shared vocabulary). Everything
ordinary — shell, navigation, conversation, lists, badges, overlays, forms of
feedback — is the standard renderer. No generic contract was added to the
foundation for a one-off detail, and no catalog primitive is displayed merely
to show coverage.

### Foundation limits exposed (recorded, not patched)

1. **Component surfaces receive only static props** — route parameters and
   view data are not injected into registered surfaces, so self-fetching
   islands read the workspace id from the URL and fetch through declared
   query actions (the documented TaskTable/RequestPlanner pattern). A
   supported “record-scoped component surface” would remove the URL-reading
   and the per-island fetch boilerplate.
2. **No read-only invalidation boundary in the renderer** — every successful
   action (including declared queries) triggers the host’s invalidation hook,
   and re-render churn remounts component surfaces behind lazy snippets. The
   host now skips invalidation for `query`-kind actions
   (`+page.svelte::handleInvalidate`). A renderer/host contract for
   read-vs-write invalidation would remove host glue.
3. **The standard table is too wide for a 280–312 px supporting column** —
   the changed-files inspector uses the standard list instead; a narrow-panel
   table presentation is a plausible future addition to `ui-svelte`.

## Owner corrections carried forward

The five corrections pushed as `dc69768` are preserved untouched and are
visible in the product: the select chevron is the shared `ChevronDown` SVG
(project filter), dialog content uses the shared 16px action spacing (reset
dialog), control stacks/labels use the corrected spacing utilities, and the
standard feedback behaviour (persistent live-region action feedback, draft
retention on failure) is used by the console and the conversation.

## Verification

- Focused tests (vitest, ui-showcase workspace):
  - `test/agent.test.ts` — 10 node-level checks: plan compilation, routes,
    scoped views, and the full deterministic state machine (waiting →
    running → completed; decline; fail → retry with progress intact; reset).
  - `test/agent-dom.test.ts` — 3 DOM-level checks: the real renderer mounts
    the product through the eager registry; approve/advance/fail operate
    IN THE DOM with visible feedback and log lines.
  - `test/agent-browser.test.ts` — real-browser run of the complete
    interaction path (chooser + project filter by keyboard, approval,
    advance, failure, output log, retry, message with reply, draft retention
    on a stopped session, reset dialog, mobile drawer with Escape +
    focus restore, responsive task-first stacking at 768/390/320, document
    overflow ≤ 2px at 1440/768/390/320, axe-core smoke scan with zero
    serious/critical violations). Screenshots:
    `qa-artifacts/agent-workspace/*.png`.
- App typecheck: `npm run check -w ui-showcase` — clean.
- Whole showcase suite (`npx vitest run`, includes the pre-existing P6D
  browser suite and screenshots): green on this branch, with ONE one-line
  correction to a pre-existing baseline defect:
  `browser.test.ts` asserted `expect(attributeString).toBe(true)`, which can
  never pass; corrected to `toBeTruthy()` (the underlying behaviour — focus
  moving into the overlay — was already correct). The file is otherwise
  byte-identical to the baseline.
- Package builds: contracts, ui, sdk, kernel, runtime, application, ui-svelte,
  renderer-svelte all build clean on this branch.

## Comparison with Requests and the earlier Workspace

The product shares the VICT design system (same tokens, shell, statuses,
buttons, conversation, overlays, catalog controls) but has its own hierarchy
and working rhythm: a sessions sidebar, a task console that leads the
workspace, a transcript-first main column, and an inspector (files / activity
/ log) as supporting context — a distinct workflow, not a restyled demo
screen.

## Standing limits

- The catalog composition remains provisionally accepted; nothing here claims
  final visual acceptance of the UI system.
- The deterministic backend is a stand-in: no real agent, no Mastra, no
  persistence beyond the dev-server process.
- One dev-server process holds the demo state; a restart resets it (the
  product says so out loud and offers the reset control).
