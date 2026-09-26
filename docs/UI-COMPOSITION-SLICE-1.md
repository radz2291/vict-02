# Composition Slice 1 — owner review

Status: COMPOSITION AND MOBILE DRAWER READY FOR OWNER REVIEW.
Visual acceptance remains with the owner.

## Baseline and isolation

- Foundation: `codex/ui-foundation-slice-20260926` at `a047ecd616943d07cbaf732d83313e35d64668da`.
- Fetched `origin/main`: `7307f2fee01b1ca3b7cb048ab8b2b75b4973d3b1`.
- Work branch: `codex/ui-composition-slice-1`, created from that foundation SHA.
- Worktree: `C:\Users\RZ1\Desktop\RZ\vict-02-ui-composition-slice-1`.
- No merge, publication, release changes, or primitive-catalog expansion. Final commit is recorded in the delivery message and can be read with `git rev-parse HEAD`.

## Run and review

From this worktree, on Node 22.13 or newer:

```powershell
npm ci
npm run composition
```

The command builds the dependent workspace packages and starts the isolated preview on port 5179.

| Application | Route | Configuration |
| --- | --- | --- |
| Requests (`app.requests`) | http://127.0.0.1:5179/requests | `navigation: 'sidebar'`, `density: 'compact'`, `contentWidth: 'wide'`, `responsive.navigationAt: 'small'` |
| Workspace (`app.workspace`) | http://127.0.0.1:5179/workspace | `navigation: 'top'`, `density: 'comfortable'`, `contentWidth: 'wide'`, `responsive.navigationAt: 'medium'` |
| Feedback review | http://127.0.0.1:5179/requests/feedback | Requests page override: standard width, comfortable density; tabs for server failure and denial |
| Shared notes | http://127.0.0.1:5179/workspace/notes | Workspace page override: standard width |

These are **two separate normal Application Definitions**, each compiled to its own immutable plan and application identity. The generic preview host registers both and resolves their declared routes. The action endpoint is scoped by application ID. Neither routes nor action IDs select CSS or layout. No scenario-specific Svelte pages, custom product components, or host styles were added.

The definitions are in [composition.ts](../examples/ui-showcase/src/lib/application/composition.ts). Requests uses an ordered full-width introduction, main table and supporting form. Workspace puts the conversation directly in the main region, without the foundation's dashboard introduction or conversation tabs, with a narrow context region beside it.

## Contract and renderer ownership

`@victframework/ui` owns portable composition types, default resolution and closed runtime validators. `@victframework/sdk` references these neutral types. `@victframework/application` invokes the validators, includes the choices in canonical identity and freezes them in the compiled plan. Neither SDK nor UI contracts import Svelte or Bits UI.

`@victframework/ui-svelte` owns the reusable shell, CSS mappings, media-query interaction and modal navigation. `renderer-svelte` remains a compatibility facade.

The optional additions are accepted only by `vict.application@2`; `@1` stays closed. Existing definitions without them retain sidebar/wide/comfortable defaults and their previous identities.

| Owner | Choice | Meaning |
| --- | --- | --- |
| Application `composition` | `navigation: sidebar / top / none` | Desktop primary navigation placement, or omission. No declared navigation links also means no navigation trigger. |
| Application | `contentWidth: standard / wide / full` | Default main-region width. Svelte maps these to 1120px, 1440px, or available width, including main padding. |
| Application | `density: comfortable / compact` | Default spacing/control density. Compact retains readable type and mobile touch targets. |
| Application | `responsive.navigationAt: small / medium` | Closed modal drawer below 720px or 960px respectively. Desktop navigation above that threshold. |
| Page `composition` | `contentWidth`, `density` | Page overrides inherited application defaults. |
| Page | `supportingWidth: narrow / standard` | Svelte supporting columns: 260px or the existing 280–312px range. |
| Page | `stackAt: small / medium / large` | Split regions stack in declaration order below 720px, 960px or 1100px. Default: large. |
| Page/regions (existing) | `layoutMode: stack / split`; `size: full / main / aside`; `appearance: plain / panel`; `flow: stack / inline` | Arrange the existing VICT surfaces. Types and validation now share the portable UI owner. |

Requests uses `layoutMode: 'split'`, a standard supporting region and `stackAt: 'large'`. Workspace uses split, a narrow supporting region and `stackAt: 'medium'`. The navigation threshold and content stacking threshold are independent.

A later specialized product surface belongs behind the existing neutral `component` surface and versioned component reference, resolved by the trusted renderer-side ComponentRegistry. This is the extension point for an editor or other specialized product interaction; it does not require embedding Svelte components in the manifest.

## Mobile drawer

The shared shell uses the already adopted [Bits UI Dialog](https://bits-ui.com/docs/components/dialog), presented as a left-side drawer. It is closed initially. The named trigger exposes its expanded state and dialog relationship. The primitive owns focus trapping, return to the trigger, Escape/outside dismissal and background scroll locking. Selecting any navigation link closes it, including the current page. Crossing back to desktop closes an open drawer and releases modal behavior.

The drawer is at most 340px wide and leaves a backdrop strip at narrow widths. Its contents can scroll independently. Desktop navigation retains ordinary links and current-page semantics.

## Integrated action feedback

The host-level and nested-overlay “Done.” cards are removed. Forms and action buttons own their result state close to the action.

- Required/conversion errors and safe server `fieldErrors` appear beside the field with `aria-invalid` and `aria-describedby`. Invalid submission focuses the first field. Multiple errors get a compact linked summary; a single mapped error does not.
- A successful Requests Save says “Request saved. It’s now in the team’s queue.” beside Save. The default for other forms is “Changes saved.”
- Server failure and denial remain beside Save with useful next steps. Drafts survive failure. Errors do not expire on a timer.
- A new attempt clears the previous outcome before validation or dispatch. Editing clears a prior success. A changed record/action discards late results; an ordinary data refresh preserves the confirmation.
- `actions[].feedback` can declare non-empty `success`, `validation`, `denied`, and `failure` text. Precedence is action text, safe result text (including existing screen-state overrides), then a sensible default.
- The renderer result accepts optional safe field-keyed `fieldErrors`; successful results can also supply `message`. Raw caught exceptions are never displayed.
- Persistent polite success and assertive error live regions announce outcomes. Focus remains with the task; server field errors focus the field when the user is still in that form.
- Conversation sends use their own inline send error and preserve the draft. Successful messages are announced through the conversation feed; they do not produce Save-style confirmation.
- Passive badges, empty states, stale/partial-data notices, route-not-found and structural renderer errors retain their existing presentation. The shared `Feedback` component remains available for those cases; this slice does not restyle passive system notices or arbitrary registered components.

The review failure/denial forms dispatch normal declared actions to deterministic server responses. They demonstrate real renderer behavior without pretending to cause a production outage or changing user permissions. The Requests priority constraint is also exercised through real server contract rejection and returned as a field error.

## Evidence

Images are captured from the built application, then inspected. The narrower supporting heading and the Save-confirmation refresh fix came from that inspection.

| Layout | 1440px | 390px closed | 390px open |
| --- | --- | --- | --- |
| Requests | [Desktop](../qa-artifacts/composition-slice-1/requests-1440.png) | [Closed](../qa-artifacts/composition-slice-1/requests-390-closed.png) | [Drawer](../qa-artifacts/composition-slice-1/requests-390-open.png) |
| Workspace | [Desktop](../qa-artifacts/composition-slice-1/workspace-1440.png) | [Closed](../qa-artifacts/composition-slice-1/workspace-390-closed.png) | [Drawer](../qa-artifacts/composition-slice-1/workspace-390-open.png) |

[Requests drawer at 320px](../qa-artifacts/composition-slice-1/requests-320-open.png).

| Feedback | 1440px | 390px |
| --- | --- | --- |
| Invalid submission | [Desktop](../qa-artifacts/composition-slice-1/feedback-invalid-1440.png) | [Mobile](../qa-artifacts/composition-slice-1/feedback-invalid-390.png) |
| Save success | [Desktop](../qa-artifacts/composition-slice-1/feedback-saved-1440.png) | [Mobile](../qa-artifacts/composition-slice-1/feedback-saved-390.png) |
| Server field validation | [Desktop](../qa-artifacts/composition-slice-1/feedback-server-validation-1440.png) | [Mobile](../qa-artifacts/composition-slice-1/feedback-server-validation-390.png) |
| Server failure | [Desktop](../qa-artifacts/composition-slice-1/feedback-failure-1440.png) | [Mobile](../qa-artifacts/composition-slice-1/feedback-failure-390.png) |
| Denial | [Desktop](../qa-artifacts/composition-slice-1/feedback-denial-1440.png) | [Mobile](../qa-artifacts/composition-slice-1/feedback-denial-390.png) |

## Verification commands

```powershell
npm run build
npm run typecheck
npm run check:ui
npm run check -w ui-showcase
npx vitest run --project renderer
npx vitest run --project unit packages/application/test packages/ui/test
npm run test -w ui-showcase -- test/composition.test.ts test/foundation.test.ts test/definition.test.ts test/dom.test.ts
npm run test:composition
$env:VICT_QA_OUTPUT = 'qa-artifacts/composition-slice-1/legacy-foundation'
node scripts/verify-ui-foundation.mjs
Remove-Item Env:VICT_QA_OUTPUT
```

[Browser results](../qa-artifacts/composition-slice-1/checks.json) cover both shells, drawer states at 430/390/320px, keyboard focus containment and return, Escape/close/backdrop, scroll lock, link selection, desktop resize, the different 800px navigation behavior, overflow, Save lifecycle and application-scoped dispatch. Axe checks run on the captured composition and feedback states, with no serious or critical violations. Automated accessibility checks do not replace screen-reader testing.

Contract/renderer coverage includes malformed/unknown choices, @1 compatibility, canonical identity, immutable plans, omitted defaults, page overrides, optional navigation, local/server field association, no-dispatch invalid input, pending/retry replacement, safe exception handling, ordinary refresh and late-result handling. The compatibility facade is tested separately. The unchanged foundation definition is also rendered with its default composition in the legacy browser check.

Two pre-existing test assumptions exposed during this cycle were corrected: the foundation select-options parameter table now passes entire option arrays, and the showcase tabs test uses semantic Bits tab roles rather than obsolete generated IDs.

## Visible limits

This is a one-main-region/optional-supporting-region composition foundation, not a docking system. There are no resizable panels, reorderable panes, arbitrary breakpoints, mobile bottom navigation, or saved drawer state. Supporting content follows the main task on mobile; long tables retain their own horizontal scrolling, and conversations retain a contained scrolling feed. There is no specialized full-height chat/workbench template. Localization and custom-component feedback policy remain application responsibilities.

Table query failure presentation is outside this form/action feedback pass and retains its existing behavior. The remaining passive-state cards listed above are intentionally identifiable for a later review. No owner visual acceptance is claimed.
