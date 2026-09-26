# Foundation Catalog Coverage — owner review

Status: **FOUNDATION CATALOG READY FOR OWNER REVIEW**.
The composition, drawer and action-feedback direction is provisionally accepted;
this does not claim final visual acceptance or release approval.

## Baseline and isolation

- Verified pushed baseline: `codex/ui-composition-slice-1`, `bf8a0aae5a8f41890db9882c74963063ef68febe`.
- `origin/main` recorded at the initial fetch: `7307f2fee01b1ca3b7cb048ab8b2b75b4973d3b1`.
- Shared `origin/main` reference observed at final review: `00f8e62761787e4673445f5d468ca6267ca29760`. It advanced during this cycle; this task did not modify or merge main.
- Work branch: `codex/ui-foundation-catalog-coverage`.
- Isolated worktree: `C:\Users\RZ1\Desktop\RZ\vict-02-ui-foundation-catalog`.
- Final SHA is recorded in the delivery message and available with `git rev-parse HEAD`.
- Main and the composition branch are untouched. No merge, publishing, npm trust or release work.

## Launch and routes

From the worktree above, with the repository's supported Node runtime:

```powershell
npm ci
npm run catalog
```

The command builds dependencies and starts Vite on **5180**, leaving the previous
composition preview on 5179 available.

| Route | What to review |
| --- | --- |
| http://127.0.0.1:5180/catalog | All 38 implemented families; menus, command palette, disclosure, selection, dates/time, navigation/display and all eight direct compositions |
| http://127.0.0.1:5180/requests/schedule | Real registered product surface: choose a template and receiving team, pick a review date, expand handoff details and schedule a request |
| http://127.0.0.1:5180/requests | Existing compact Requests sidebar, table and form |
| http://127.0.0.1:5180/requests/feedback | Existing failure/denial review |
| http://127.0.0.1:5180/workspace | Existing conversation-centred Workspace, top navigation and supporting context |

## Actual coverage

The [family catalog](../packages/ui-svelte/FOUNDATION-CATALOG.md) links every row
to its public export, executable example, and test. The previous 30/8/3 split was
a target: only seven styled families were represented. The final count is:

| Classification | Count |
| --- | ---: |
| Styled and usable | 30 |
| Supported direct composition, with working examples | 8 |
| Deferred, with reasons and future paths | 3 |

The installed library remains Bits UI **2.19.3**, with Svelte **5.57.0** and
@internationalized/date **3.12.4**. No new primitive dependency was introduced.
The audit checks the installed family namespaces against the coverage ledger,
VICT package exports, examples and named browser checks.

Each granular `@victframework/ui-svelte/catalog/<family>` entry exports the public
Bits parts API. `ControlScope` and the optional `catalog.css` apply VICT tokens,
state styles, focus rings, density conventions and portal scope. Repeated menu,
selection and date rules are shared. `CalendarGrid` removes rendering boilerplate
without owning keyboard, selection, date arithmetic or focus behavior.

The [usage guide](../packages/ui-svelte/CATALOG-USAGE.md) documents all eight
direct compositions, labels/portals, date serialization, rich selection and
registered actions. Consumers use supported public subpaths; they do not import
undocumented Bits internals. The original main-entry components remain compatible.

## Application proof and boundaries

The [Requests Application Definition](../examples/ui-showcase/src/lib/application/composition.ts)
adds a normal screen and route with `cmp.request-planner@1`. Its trusted registry
entry loads the [planner](../examples/ui-showcase/src/lib/components/RequestPlanner.svelte)
separately. It uses exactly the same catalog styles as the gallery. No styling or
layout is selected by route names or action IDs.

The product component receives its declared `submitActionId` and calls
`useVictActions().run`. This Svelte-only binding delegates to the renderer's
existing action path. It rejects undeclared actions, retains safe exception
handling and invalidation, and grants no authority. Server-side contracts,
permissions and the data adapter remain authoritative. Browser checks verify the
submitted team and ISO date and successful mutation response.

The new path does **not** add low-level primitive roles to Application Definitions.
Portable contracts and meaning remain in `@victframework/ui`; the catalog and
component action context live in `ui-svelte`. `renderer-svelte` remains a facade.
Requests and Workspace still select their shells through composition settings.

## Production bundle evidence

Measurements use a cold production navigation with caching disabled. They sum
unique fetched JS/CSS response bytes and deterministic gzip per asset, including
the application runtime. They are not dev-server sizes or source-file totals.

<!-- bundle-table -->
Both existing routes fetched the same totals:

| Route | JS gzip before → after | JS increase | CSS gzip before → after | CSS increase |
| --- | ---: | ---: | ---: | ---: |
| `/requests` | 100,145 → 104,022 bytes | 3,877 bytes (3.87%) | 4,657 → 8,149 bytes | 3,492 bytes |
| `/workspace` | 100,145 → 104,022 bytes | 3,877 bytes (3.87%) | 4,657 → 8,149 bytes | 3,492 bytes |

Combined gzip grows **7,369 bytes per route (7.03%)**. Uncompressed JS changes
from 300,142 to 308,997 bytes; CSS changes from 21,916 to 39,172 bytes.
The full per-asset records are [before](../qa-artifacts/foundation-catalog/bundle-before.json)
and [after](../qa-artifacts/foundation-catalog/bundle-after.json).
<!-- /bundle-table -->

The registered planner is dynamically loaded. The multi-route preview preloads
the small shared catalog CSS; its cost is included above, rather than hidden.
The standalone [minimal consumer measurement](../qa-artifacts/foundation-catalog/minimal-import.json)
builds Checkbox and ControlScope, including the Svelte runtime. Its rendered Bits
modules contain only Checkbox and supporting configuration/hidden-input code;
calendar, command, menu, select, date-picker and dialog code are absent.
That isolated consumer measures **93,874 bytes raw / 27,508 bytes gzip**; shared
optional CSS is separate. This demonstrates JS granularity, not zero runtime cost.

## Inspected screenshots

| View | Evidence |
| --- | --- |
| Gallery landing | [1440px](../qa-artifacts/foundation-catalog/catalog-1440.png), [390px](../qa-artifacts/foundation-catalog/catalog-390.png), [320px](../qa-artifacts/foundation-catalog/catalog-320.png) |
| Desktop families | [Actions/disclosure](../qa-artifacts/foundation-catalog/actions-1440.png), [selection](../qa-artifacts/foundation-catalog/selection-1440.png), [dates/time](../qa-artifacts/foundation-catalog/dates-1440.png), [navigation/display](../qa-artifacts/foundation-catalog/display-1440.png), [direct composition](../qa-artifacts/foundation-catalog/direct-1440.png) |
| Mobile selection | [390px](../qa-artifacts/foundation-catalog/selection-390.png) |
| Open calendar | [390px](../qa-artifacts/foundation-catalog/calendar-open-390.png), [range picker at 320px](../qa-artifacts/foundation-catalog/calendar-open-320.png) |
| Registered request flow | [1440px](../qa-artifacts/foundation-catalog/request-flow-1440.png), [390px](../qa-artifacts/foundation-catalog/request-flow-390.png), [320px](../qa-artifacts/foundation-catalog/request-flow-320.png) |
| Integrated action states | [320px validation](../qa-artifacts/foundation-catalog/request-invalid-320.png), [390px menu](../qa-artifacts/foundation-catalog/menu-open-390.png), [390px success](../qa-artifacts/foundation-catalog/request-saved-390.png) |
| Preserved Requests and Workspace | [Composition regression captures](../qa-artifacts/foundation-catalog/composition-regression) |

Inspection corrected menu/combobox/range-calendar selector variants, shared link
colors, range endpoint emphasis, and mobile control target spacing. The date
error example explicitly associates its message with the segmented field and
clears it when corrected. Field messages stack below their controls; floating
calendar recipes keep a 16px viewport inset. Mobile success captures include the
confirmation beside the action.

## Verification

```powershell
npm run build
npm run typecheck
npm run check:ui
npx svelte-check --tsconfig examples/ui-showcase/tsconfig.json
npx vitest run --project renderer
npx vitest run --project unit packages/application/test packages/ui/test
npm run test -w ui-showcase -- test/composition.test.ts test/foundation.test.ts test/definition.test.ts test/dom.test.ts
node scripts/audit-ui-catalog.mjs
node scripts/check-catalog-imports.mjs
npm run test:catalog
node scripts/measure-ui-bundle.mjs after
$env:VICT_QA_OUTPUT = 'qa-artifacts/foundation-catalog/composition-regression'
node scripts/verify-ui-composition.mjs
$env:VICT_QA_OUTPUT = 'qa-artifacts/foundation-catalog/foundation-regression'
node scripts/verify-ui-foundation.mjs
Remove-Item Env:VICT_QA_OUTPUT
```

The production [catalog browser results](../qa-artifacts/foundation-catalog/checks.json)
cover every implemented family, keyboard selection and focus, disabled/mixed
states, menu nesting, command filtering, calendar ranges, segmented fields,
responsive overflow, Axe checks and actual registered-action submission.
Package tests cover bound values, date serialization, host invalidation and
undeclared-action rejection. Existing contracts, default rendering, facade,
composition, drawer and feedback regressions are also checked. Automated Axe and
keyboard checks do not constitute a full assistive-technology certification.

Passed results: **84 renderer tests**, **965 UI/application contract tests**, and
**13 showcase definition tests**. Browser suites pass **46 catalog checks**,
**18 composition groups** and **10 legacy foundation checks**. The composition
[results](../qa-artifacts/foundation-catalog/composition-regression/checks.json)
include both application drawers at 430, 390 and 320px, keyboard/focus/backdrop
behavior, and the existing invalid/success/failure/denial feedback states. The
legacy [results](../qa-artifacts/foundation-catalog/foundation-regression/verification.json)
cover defaults, native forms and conversation dispatch. Root builds/typechecks,
library and showcase Svelte checks, the family audit and granular-import check pass.
Svelte checks report zero errors and warnings. Production builds retain upstream
`@internationalized/date` circular-dependency warnings.

## Remaining limits

- PIN Input, Rating Group and Time Range Field remain deferred for the reasons in the catalog. They are not counted as implemented.
- Remote combobox option fetching, cancellation, date availability, DST/overnight rules and application-specific command authorization remain product concerns. The primitive parts support those compositions; no generic remote data policy was invented.
- Rich controls are available to registered product surfaces; the generic manifest form vocabulary remains its existing smaller set of widgets.
- The catalog uses the Bits UI 2 parts API. A primitive major upgrade needs a new compatibility audit. Scope-based portal styling requires a scope outside clipped or transformed containers.
- Passive system notices, table-query error presentation and custom product feedback policies retain their composition-slice behavior. No toast system, docking engine, or full-height workbench template was added.

The owner can now review breadth and consistency before choosing product stress slices.
