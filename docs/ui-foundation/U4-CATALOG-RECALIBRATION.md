# U4 catalog recalibration — full-catalog authoring architecture and delivery plan

Status: **PROPOSED — UNDER INDEPENDENT REVIEW (implementation NOT authorized)**
Supersedes: the five-family scope limit of
[U4-COMPONENT-AMENDMENT](U4-COMPONENT-AMENDMENT.md) §8 (and its §9
"must not expand" non-goal) — per the owner clarification recorded in
[DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md) decision 8. The frozen
contract mechanics (ABI marker gate, output binding path, identity/revision
pinning, failure model) stay governing; this document extends the value
vocabulary and plans the batches. Everything labelled "proposed" here is
**unimplemented**; nothing in this document may be reported as existing
until a later authorized implementation batch demonstrates it.

Entry lineage (verified before work began):

| Artifact | SHA |
| --- | --- |
| Recalibration base (= superseding amendment freeze final records) | `7a9477f934b1f30f9f603775b163c0e8a3a1e385` |
| Superseding amendment freeze payload | `460d9632eeb6e1eb7eb57c10458562158236baa9` |
| First amendment freeze payload (superseded, preserved) | `68e166f3eeb27657ff5b28e21c255960256ccdc6` |
| Verified combined implementation (legacy resolver reference) | `952d92da5131d6ab595b45b3bf18bc7ce3b3466d` |
| Frozen amended U0 authority | `9ec87f3e7eb8eb7793f972111258940aac635346` |
| U3 closure records | `16df3bf155fa2a8c9ca0de67996dc6d73450f659` |

Branch: `codex/ui-foundation-u4-catalog-recalibration` from `7a9477f…`
(isolated worktree; the amendment branch and all other tracks untouched).
U0–U3 remain closed. U4 runtime implementation remains unauthorized.

---

## 1. The owner clarification (what changed)

> The existing UI library is much richer than the five compositions in the
> current U4 amendment. The owner requires an architecture and delivery plan
> that account for the full catalog, including richer modes within each
> component: all 41 recorded families reconciled with the 38 exported recipe
> modules, higher-level public components inventoried, capability described
> at family-and-mode level, the authoring contract challenged against that
> inventory, and delivery recalibrated into explicit batches with a
> recommended first batch.

This authorizes source investigation, documentation/design amendments,
disposable probes, independent review, repairs, and a superseding contract
freeze where needed. It does **not** authorize U4 runtime implementation.

Preserved, untouched: U0–U3 closure records; the approved
Inspector/Layers experience baseline (U2); both earlier freezes and all
reports (byte-preserved at their commits); concurrent tracks (stage9
branches observed on the remote during entry verification; not read, not
modified). The seven governing U4 criteria and every preserved guarantee
(declared-action authority, exact identity/revision resolution,
compatibility rejection, occurrence isolation, generation fencing,
transactional editing, packaging isolation, preview/production parity,
bundle separation, unfamiliar-agent exercise, founder acceptance) stay
governing — §8 adds traceable coverage obligations for the broader
requirement.

## 2. Inventory method and evidence legend

Read-only source inspection of this worktree at the entry SHA, plus the
pinned upstream typings the catalog re-exports. No runtime probes were
needed for the inventory: every value shape cited below is (a) declared in
the pinned `bits-ui@2.19.3` TypeScript declarations (recorded,
version-pinned by `catalog-coverage.json` `bitsVersion`), or (b) declared
in `packages/ui/src/*.ts`, or (c) exercised by the recorded showcase
examples and `packages/ui-svelte/test/catalog.test.ts`. A disposable probe
was considered for renderer-side richer-value behavior and rejected as
unnecessary for a contract-stage recalibration: the renderer consumes the
plan, and the plan's value vocabulary is decided by `packages/ui` types —
the exact files cited below. Probe limitations are recorded where they
exist (§7.5).

Status vocabulary used throughout (the owner's five-way distinction):

- **E — expressible by the frozen contract** (`460d963…`): the capability
  fits the frozen value vocabulary and binding path as written.
- **I — implemented in the library** (catalog module or VICT component
  exists with the mode, usable today via P1/P3 routes).
- **D — independently demonstrated** (a committed recorded test or a
  verification record asserts it — never inferred from an export).
- **M — missing from the contract** (not expressible as frozen; needs the
  §6 extension or a batch obligation).
- **X — explicitly deferred** (named exclusion with reason; no silent gap).

An exported Svelte component or a working handwritten showcase example is
evidence of **I** only — never of canonical authoring support. Authoring
support is claimed **only** at family-and-mode level, only per batch, and
only after that batch's direct evidence exists.

## 3. The complete catalog surface — 41 families reconciled with 38 modules

`packages/ui-svelte/catalog-coverage.json` records **41 families**: 30
"styled and usable", 8 "supported direct composition", 3 "deferred".
`packages/ui-svelte/src/catalog/` contains **38 recipe modules**. The
arithmetic reconciles exactly: the three deferred families
(`pin-input`, `rating-group`, `time-range-field`) have **no recipe
module** — they exist in the coverage file as planned/deferred entries
only (upstream `bits-ui` ships them; VICT has not adopted: no module, no
styling, no showcase example). 38 modules + 3 deferred entries = 41.

### 3.1 Value-shape evidence (pinned bits-ui 2.19.3 declarations)

| Family (module) | Parts exported | Value mode(s) and shape (source) |
| --- | --- | --- |
| Select | Root/Trigger/Portal/Content/Item/Group/Viewport/Scroll* | `type:"single"` → `value: string`; `type:"multiple"` → `value: string[]` (`bits-ui/dist/bits/select/types.d.ts:95–135`); showcase exercises both (`SelectionExamples.svelte` "Teams to notify · multiple", "Priority · single") |
| Combobox | Root/Input/Trigger/Portal/Content(ContentStatic)/Item/Group/… | single|multiple union, `string` / `string[]` (`combobox/types.d.ts:18`; re-uses select parts) |
| ToggleGroup | Root/Item | `type:"single"` → `string`; `type:"multiple"` → `string[]` (`toggle-group/types.d.ts:33–41`); showcase exercises both (`SelectionExamples.svelte:155–161`; recorded test "keeps multiple toggle values and ignores a disabled option", `catalog.test.ts:38`) |
| Accordion | Root/Item/Header/Trigger/Content | `type:"single"` (string) / multiple (`string[]`) (`accordion/types.d.ts:33,61–65`) |
| Slider | Root (single: `value?: number`, `slider/types.d.ts:137`) / multi-Root (range: `value?: number[]`, `:160`) | Range = multiple thumbs (`type:"multiple"`), `step?: number \| number[]` (`:85`); showcase range with two labelled thumbs (`SelectionExamples.svelte:126–138`) |
| Checkbox | Root (+ checked binding) | `checked: boolean`, `indeterminate: boolean` (`checkbox/types.d.ts:4–5`); showcase checked / indeterminate / disabled rows (`SelectionExamples.svelte:38–41`); recorded independent-binding test (`catalog.test.ts:29`) |
| RadioGroup | Root/Item | scalar string (single-required choice; showcase `SelectionExamples.svelte`) |
| Switch, Toggle | Root | boolean scalar; recorded independent binding (`catalog.test.ts:29,38`) |
| Calendar / RangeCalendar | Root (+ display parts) | `DateValue` / `DateRange` (`@internationalized/date` types through the module re-export) |
| DateField / DatePicker | Root/Field/Segment/… | `value?: DateValue`, `onValueChange(DateValue \| undefined)` (`date-field/types.d.ts:1,12–17`); showcase `parseDate('2026-10-08')` (`DateExamples.svelte:10–13`); recorded test "serializes a calendar date without timezone conversion" (`catalog.test.ts:47`) |
| DateRangeField / DateRangePicker | Root/… | `value?: DateRange` = `{ start: DateValue \| undefined; end: DateValue \| undefined }` (`date-range-field/types.d.ts:7–17`; showcase `DateExamples.svelte:14–17,108–110`) |
| TimeField | Root/… | `Time`/`TimeValue` (`time-field/types.d.ts:1,6`), `granularity`, `hourCycle` 12/24 (`time-field/types.d.ts:76,95`) |
| Dialog / AlertDialog | Root/Trigger/Portal/Content/Title/Description/Close | `open` boolean (controlled loop), focus scope + portal (overlay/focus pattern; portal to ControlScope root per the integration design) |
| Popover / Tooltip | Root/Trigger/Portal/Content/… | `open` boolean (popover) / hover-triggered (tooltip); portal + collision |
| DropdownMenu / ContextMenu / Menubar | Root/Trigger/Content/Item/Sub*/CheckboxItem/RadioItem/Label/Separator | nested menu composition (Sub* parts), item actions, CheckboxItem (`checked` boolean), RadioItem (scalar string); keyboard/roving focus per bits-ui menu primitives |
| Command | Root/Input/List/Empty/Group/Item/… | searchable menu composition (input string + item actions) |
| NavigationMenu / Tabs / Toolbar / Collapsible | Root/List/Trigger/Content, Root/… | composition families; Tabs `value: string` single-active (VICT `Tabs.svelte` drives catalog `Tabs.Root` with `UiTab[]` + panel snippet — `src/Tabs.svelte:1–10`); Collapsible `open` boolean |
| Pagination | Root/Prev/Next/Page/… | `page?: number`, `count`, `perPage`, visible siblings (`pagination/types.d.ts:17–33`) |
| Meter / Progress | Root | `value?: number` (`meter/types.d.ts:9`); Progress `value?: number \| null` — null = indeterminate bar (`progress/types.d.ts:10`) |
| Avatar | Root/Image/Fallback | display (src string + fallback composition), no value state |
| AspectRatio / Separator / Label / ScrollArea / LinkPreview | Root/… | display/composition; Label associates a control (`for`); LinkPreview hover card (portal) |
| PinInput / RatingGroup / TimeRangeField | — (no VICT module) | **X deferred** (coverage entries only; upstream exists, adoption not scheduled) |

### 3.2 The 38 modules ↔ 41 families reconciliation table

The authority for per-family status is `catalog-coverage.json` — 30
"styled and usable", 8 "supported direct composition", 3 "deferred"
(pin-input, rating-group, time-range-field); this document deliberately
does not re-enumerate the buckets by slug (a prose list drifts; the
coverage file cannot). The reconciliation arithmetic: 38 `.ts` recipe
modules exist (each a one-line bits-ui re-export with the ControlScope
styling note — verified by reading every file); the 38 covered families
comprise the 30 styled-and-usable plus the 8 direct-composition families;
the 3 deferred families have no module. 38 + 3 = 41. The precise
per-family status strings live in
`catalog-coverage.json`, which is the recorded authority.)

## 4. Higher-level public components (`src/index.ts` exports)

Two distinct populations must not be conflated:

**(a) Catalog adapters / thin VICT components** — candidates for document
authoring through the component ABI: `Button` (variant primary/secondary/
danger, disabled, onclick — `src/Button.svelte`), `Select` (**native**
`<select>` wrapper: value/options/invalid/describedBy — `src/Select.svelte`,
11 lines), `Popover`/`Tooltip` (thin bits-ui wrappers with VICT styling —
`src/Popover.svelte`, `src/Tooltip.svelte`), `Tabs` (bits-ui `Tabs.Root`
driven by `UiTab[]` + panel snippet — `src/Tabs.svelte`), `AppShell`
(brand/title/path/groups/breadcrumbs + responsive nav, composition from the
application manifest — `src/AppShell.svelte`), `ActionFeedback`/`Feedback`
(validated kinds empty/status/error/denied — `src/Feedback.svelte:7–27`),
`StatusBadge`/`Text`/`Count` (display), `Overlay` (`UiOverlayIntent`
dialog|drawer), internal `ActionButton` (pending/aria-busy/feedback — the
amendment's `loading` adaptation source).

**(b) Application-surface components** — driven by application-plan intents
(U0 contracts), NOT document nodes: `RecordsTable` (`UiTableIntent`:
columns with component islands, search/filter/sort/page callbacks, row
actions, FT-1 row links — `src/RecordsTable.svelte:9–33`), `Chart` (`kind:
'bar'|'line'`, `UiChartPoint[]` — `src/Chart.svelte`), `Conversation`
(`UiConversationMessage[]` + `onSend` — `src/Conversation.svelte`),
`DataView`/`List`/`Detail` (`UiListItem[]`/`UiDisplayField[]`),
`Form`/`FormField`/internal `FormSurface` (`UiFormField` with widget
vocabulary `'text'|'number'|'boolean'|'date'|'json'|'select'` —
`packages/ui/src/index.ts:132–149`), `VitApp` (the plan renderer),
`DocumentHost`/`DocumentRenderNode`/`ComponentSlot` (renderer machinery).

These application-surface components are **governed by the application
plan contracts, not by the document model**. A document cannot contain a
RecordsTable node today; one can reach them inside a document only through
the registered-component/extension routes (P3/P4). The recalibration
records them, plans no document-node authoring for them, and marks that
position explicitly (§5 rows A-1…A-9) so the boundary is a decision, not an
oversight.

### 4.0 Display components are ALREADY document-mountable — and the
higher-level authoring roadmap (repair correction)

The blanket "document-node authoring: **No**" in trace rows A-1…A-9 was
overbroad: it conflated permanent non-goals with unresolved future work.
The recorded U3 evidence shows three public components ALREADY mount in
documents through the extension route (descriptors + registered
implementations + authored instances in the product documents):

| Component | Extension route (U3 evidence) | What works today (direct evidence) | Not yet founder-editable | Proposed editing surface (PENDING owner decision — not approved work) |
| --- | --- | --- | --- | --- |
| StatusBadge | `ext.status` rev 1 / `impl.vict.status` (`StatusExtension.svelte` wraps the PUBLIC `StatusBadge`); authored instances `ext('n.cardSeverity', 'ext.status', …)` with conditional `tone` expressions (`documents.ts:523–531`) | typed props (`value: string`, `tone: string` with conditional literals), rendering inside document cards, conditional tone switching | Inspector editors for the wrapper's prop vocabulary; tone-vocabulary validation; output connections | descriptor-driven Inspector editors (existing pattern); owner decides batch placement |
| Feedback | `ext.feedback` rev 1 / `impl.vict.feedback` (`FeedbackExtension.svelte` wraps the PUBLIC `Feedback`); authored instance `ext('n.feedback', 'ext.feedback', …)` (`documents.ts:666`) | typed props (`message`, `kind` empty/status/error/denied), focus-target wrapper, in-document feedback display | same as above + kind vocabulary guard | same pattern |
| Button (VICT presentational) | `ext.button` rev 1 / `impl.vict.button.submit` (`ButtonExtension.svelte` wraps the PUBLIC `Button`, variant/disabled) | typed props incl. boolean `disabled`, submit behavior in authored documents | pending/loading/feedback choreography as authored contract (the amendment's U4 target, currently contract-stage) | the amendment's catalog wrapper proof (B1) |

For every REMAINING higher-level component the canonical configuration
source, the working evidence and the unresolved authoring work are:

- **RecordsTable** — config: `UiTableIntent` (columns + component islands,
  search/filter/sort/page callbacks, row actions, FT-1 links,
  `RecordsTable.svelte:9–33`). Works: plan-driven tables in U3 product
  (renderer suites). Unavailable to founder editing: column set, island
  composition, row-action wiring — plan-authored only. Proposed (pending):
  Studio inspects/edits the intent through a table-intent editor; NOT a
  document node.
- **Chart** — config: `UiChartPoint[]` + `kind`. Works: plan surfaces.
  Unavailable: data binding, kind, axes. Proposed (pending): intent
  editor in Studio; document-node authoring not planned.
- **Conversation** — config: `UiConversationMessage[]` + `onSend`. Works:
  U0/U2 surfaces. Unavailable: message schemas, send wiring. Proposed
  (pending): plan-surface editing only.
- **DataView / List / Detail** — config: `UiListItem[]` /
  `UiDisplayField[]`. Works: plan surfaces. Unavailable: field
  composition, item templates. Proposed (pending): intent editors.
- **Form / FormField / FormSurface** — config: `UiFormField` widget
  vocabulary (`index.ts:132–149`). Works: U3 product forms (authored P2
  elements + form surfaces). Unavailable: widget-level document authoring
  (P2 authored elements remain the document-side form route).
- **VitApp** — the plan renderer itself (renders compiled plans, not a
  config surface); recorded as renderer machinery, no authoring roadmap.
- **AppShell** — ALREADY a document-authoring target (frozen five; B1
  ledger row) — listed here only because §4(a)/(b) previously blurred it.
- **Text / Count** — display; document-mounted routes not yet evidenced;
  status recorded as pending investigation with the same extension-route
  pattern as StatusBadge/Feedback (no claim made either way).

**Ownership statement (replacing the overbroad one):** application-plan
ownership is retained where it exists (the intent-driven components
above). That ownership does NOT permanently exclude founder editing of a
component's CONFIGURATION: a component can stay application-plan governed
while its configuration becomes inspectable and editable in Studio. All
such Studio editing work is recorded here as PENDING with the proposed
delivery location (Studio Inspector intent editors, later batch or Stage
9 planning) and requires explicit owner authorization — an agent-selected
boundary is not owner acceptance. `apps/studio` work remains outside this
task.

### 4.1 Name overlaps (disambiguation)

| Name | `src/<Name>.svelte` | `catalog/<slug>.ts` | Difference that matters |
| --- | --- | --- | --- |
| Select | native `<select>` wrapper (value string, options prop, invalid/describedBy) | bits-ui Select (single string / multiple `string[]`, portal content, item composition) | different DOM, different value modes; both exist; authoring route must say **which** Select it means |
| Button | VICT presentational button (variant/type/disabled/onclick) | bits-ui Button (headless, `type`/`disabled`/`onclick`) | VICT Button is the amendment's proof target via the wrapper (with ActionButton's pending pattern for `loading`) |
| Tabs | VICT composition component over catalog Tabs (`UiTab[]` + panel snippet) | bits-ui Tabs parts | the VICT one is the P3-surface shape; document authoring composes catalog Tabs content directly |
| Popover / Tooltip | thin VICT wrappers (label/text props) | bits-ui parts | wrappers fix styling and a11y defaults; catalog parts are the composition substrate |
| Dialog | `Overlay` (`UiOverlayIntent` dialog|drawer) + internal `OverlaySurface` | bits-ui Dialog/AlertDialog | different mechanisms; the amendment authors the catalog Dialog |
| Form | `Form`/`FormField` (application-surface, `UiFormField`) | — (no catalog form) | application-surface; document-side forms are authored P2 elements today (U3 product proof) |

## 5. Contract challenge — the trace, family by family

The frozen contract (`460d963…`) path is: canonical instance (`component`
node + `definitionId` + revision pin + typed props + instance `outputs`
map + slot fills) → descriptor (id/revision, `propDecls`, ABI marker in
`events`, `abi`, `outputs: UiOutputDecl[]`) → compile (descriptor-driven
`propDecls` closure, output-payload checks, `$output` scoping, state/action
target checks, `outputDecls` artifact marker) → registered implementation
(`abi` match, `io.emit`, slot snippets, generation-gated stale-drop) →
Inspector (descriptor-driven property editors, output-connection editor) →
`UiEditSession` undo/redo/transactions → two-phase save → finished app.

| # | Capability (family · mode) | E frozen? | I? | D? | Verdict |
| --- | --- | --- | --- | --- | --- |
| S-1 | Boolean scalar state + change output (checkbox, switch, toggle, collapsible open, dialog open) | Yes — payload `boolean`, state `boolean` | Yes | D for binding mechanics (`catalog.test.ts:29`); D for authored route: contract-stage only (C) | **E — the loop pattern is proven at B1 on B1's own families; per-family ledger rows re-run it (collapsible re-runs the loop at B5, matrix §6)** |
| S-2 | String scalar (radio-group, select single, tabs value, toggle-group single, combobox single) | Yes — payload/state `string` | Yes (modules) | D for multi-toggle/select styling+binding; **empty-value convention missing** (below) | **E + empty-value rule needed** — B1/B2 |
| S-3 | Number scalar (slider one thumb, meter, progress, pagination page) | Yes — payload/state `number` | Yes | D: slider/meter/progress styled (`catalog-coverage`); no recorded change-output test | **E** — B3 proves |
| L-1 | `string[]` values (select multiple, toggle-group multiple, combobox multiple, accordion multiple) | **No** — `UiOutputDecl.payload` is `'void' \| UiPrimitiveType` (amendment §3.2); `UiLocalStateDecl.type` is `UiPrimitiveType` (`document.ts:135–139` — `initial: string \| number \| boolean`); `UiPropDecl.type` is `UiPrimitiveType` (`document.ts:148–152`) | Yes (modules + showcase) | D for native-library behavior (`catalog.test.ts:38`; showcase) | **M — value-vocabulary extension (§6.1)** — B2 |
| L-2 | `number[]` values (slider range thumbs) | **No** — same ceiling | Yes (showcase range) | D for library behavior (showcase; no recorded test asserts range binding) | **M — same extension** — B3 |
| L-3 | Options/item lists as authored content (select items, menu items, tabs panels, accordion sections) | Partially — slot composition exists (§3.7); **no documented item-authoring shape** for list controls (options are content, not value state) | Yes | D styling only | **M — content-authoring rule (§6.3)** — B2/B4 |
| T-1 | Date/time values (calendar, date-field, date-picker, time-field) | **No as typed values** — `DateValue`/`Time` are library objects; the frozen contract has only primitives; no ISO date type, no format validation, no date-aware Inspector editor | Yes | D for serialization discipline (`catalog.test.ts:47` — "without timezone conversion") | **M — typed ISO markers (§6.2)** — B3 |
| T-2 | Date ranges (date-range-field/picker, range-calendar) | **No** — range is a structured `{start,end}` object; contract has no structure | Yes | D library behavior (showcase) | **M — dual-scalar pattern (§6.2)** — B3 |
| N-1 | Nested composition (dropdown/context/menubar Sub*, command groups, navigation-menu) | Slot composition exists but **nested/dynamic item structure is undesigned** (no repeat-inside-slot rule documented for menus) | Yes | D styling only | **M — composition rule (§6.3)** — B4 |
| N-2 | Tabs/accordion panel composition | Slot fills resolved in instance scope (frozen §3.7) — panels are content | Yes | D (VICT Tabs uses exactly this shape natively) | **E (rule needs stating for document-authored panels)** — B2/B5 |
| R-1 | Repeated items / structured rows (repeat nodes over view arrays; RecordsTable/DataView/List application surfaces) | Document `repeat` nodes + array view fields exist (frozen U1); array-typed props reference-only (frozen §3.2/§3.6) | Yes | D (renderer tests; U3 product) | **E for document repeat; application surfaces out of document scope (§4(b))** — compare in B2 proof |
| X-1 | Tri-state checkbox (indeterminate) | `checked` boolean state yes; **indeterminate as authored presentation binding undesigned** | Yes (`checkbox/types.d.ts:5`; showcase:41) | D styling | **E via prop-binding rule (§6.4)** — B2 |
| X-2 | Empty values (unset select, cleared date, indeterminate progress) | **Missing conventions**: state `initial` is `string\|number\|boolean` — no null; literal `null` exists in expressions but is not a state type; bits Progress `value?: number \| null` | Yes | — | **M — empty-value conventions (§6.5)** — B1–B3 |
| X-3 | Rich text / JSON field editing (application `json` widget) | Application-surface widget (`UiFieldWidget`); no document equivalent | Yes (application surface) | D (U3 product forms) | **Out of document scope; recorded** — §4(b) row |
| D-1 | Overlays/focus/portal (dialog, alert-dialog, popover, tooltip, link-preview; portal to ControlScope root) | Yes for dialog via frozen §6; alert-dialog/popover/tooltip same mechanism, undesigned rows | Yes | D styling; portal-to-root recorded in design | **E (mechanism); per ledger: dialog authored B1 (P-overlay), alert-dialog/popover/tooltip/link-preview B5** |
| A-1…A-9 | Application-surface components (RecordsTable, Chart, Conversation, DataView, List, Detail, Form/FormSurface, VitApp; display components tracked separately in §4.0) | Document-NODE authoring for the intent-driven surfaces: **No** (application-plan config is canonical); **display components StatusBadge/Feedback/Button ALREADY document-mounted** via `ext.status`/`ext.feedback`/`ext.button` (§4.0 evidence) | Yes (P3/plan surfaces; extension route for the display three) | D (U3 product: authored `ext.status`/`ext.feedback` instances; renderer suites) | **Intent-driven: recorded boundary; config inspect/edit = PENDING owner decision (§4.0 roadmap). Display three: E via extension route; editor depth = pending** |
| DEF | pin-input, rating-group, time-range-field | No | **No module** | — | **X deferred (unchanged status)** |

### 5.1 What the trace establishes

1. The frozen contract carries scalar values end-to-end (boolean/string/
   number payloads, state, props, Inspector filtering, `$output` scoping)
   — S-1/S-2/S-3 are **E** and need batches, not contract changes.
2. The single hard contract ceiling is the **value vocabulary**: lists and
   typed date/time markers cannot be declared as state, prop, or payload
   types (L-1, L-2, T-1, T-2). Everything richer rests on that one
   extension — this is the smallest coherent solution point.
3. Composition (slots) is sound for panels/sections but lacks stated rules
   for **item content** and **nested menus** (L-3, N-1) — documentation
   and fixtures, not new mechanics.
4. **Empty values** lack declared conventions (X-2) — a correctness rule,
   not a mechanism.
5. Application-surface components are governed by their plan contracts
   (§4/§4.0): the intent-driven surfaces are not document nodes; the
   display components already mount through the extension route. Studio
   config editing for either group is PENDING owner authorization, not a
   recorded acceptance.
6. The deferred three stay deferred (no module exists to wrap).

## 6. The smallest coherent solution to the actual gaps

### 6.1 Value-type vocabulary (the one contract extension — proposed, unimplemented)

Introduce one additive union and use it everywhere a value type is
declared today:

```ts
/** Additive widening (amendment §3.2/§3.6): values beyond primitives. */
export type UiValueType =
  | UiPrimitiveType            // 'string' | 'number' | 'boolean' (unchanged)
  | 'stringList' | 'numberList' // JSON arrays of scalars (L-1, L-2)
  | 'isoDate' | 'isoTime';      // string-encoded, format-validated markers (T-1)

/** The serializable VALUE carrier crossing every UiValueType boundary
 *  (amendment §10.1a — the authoritative boundary table lives there). */
export type UiValue =
  | string | number | boolean
  | readonly string[] | readonly number[];
```

The complete value path — the `UiValue` carrier, the ONE shared type
guard (`isUiValueOfType`, new `packages/ui/src/values.ts`), and the
boundary-by-boundary widening (emit payload, state initials, prop
defaults, host `stateValues`, renderer validation replacing the
`typeof value === declaration.type` check, author-time validation
replacing the three-way `typeof` conjunction, compiled `outputDecls` /
`actionInputs` typing, editor/preview forwarding), plus ownership/copy
discipline for mutable arrays — is specified in amendment §10.1a and is
not duplicated here. Note the repair finding it fixes: the current host
check (`DocumentHost.svelte:95`) and current validator
(`validate.ts:383–385`) cannot recognize the new type labels at all; the
widening of BOTH is B1 plumbing, contract-stage until landed.

- `UiLocalStateDecl.type: UiPrimitiveType` → `UiValueType`; `initial`
  widens to `readonly (string|number)[]` for the list types (JSON-serializable
  canonical form — `[]` default per §6.5).
- `UiPropDecl.type: UiPrimitiveType` → `UiValueType` (descriptors' `propDecls`
  follow; array-typed props keep the frozen reference-only binding rule and
  gain list-state references as legal sources — uniform rule: the bound
  expression's type must be `array`-shaped: an array view field or a list
  state key; the expression language still has no array literal — verified
  `document.ts:37`).
- `UiOutputDecl.payload: 'void' | UiPrimitiveType` → `'void' | UiValueType`.
  `setState`/input bindings type-check against the same union
  (`UI_COMPONENT_BINDING_INCOMPATIBLE` rows extend: `stringList` payload →
  `stringList` state only; no implicit coercion ever).
- **No schema-string change** (`vict.ui-document@1` additive optional
  fields/values only, per the frozen §4.3 decision — the property-based
  old compiler drops unknown optional fields and the ABI marker still
  fail-closes the artifact; the §4.3 matrix rows apply unchanged).
- **Svelte/bits/date-library objects stay outside the neutral contract**
  (frozen non-goal): `DateValue`/`Time`/`DateRange` never appear in
  `@victframework/ui`; they exist only inside the Svelte-side adapters.

### 6.2 Dates and times: typed markers + adapter conversions (proposed)

- `isoDate`: string `'YYYY-MM-DD'` (calendar-date, no timezone); `isoTime`:
  string `'HH:MM:SS'` (optionally `'HH:MM'` per granularity — validator
  accepts exactly what `@internationalized/date` `parseDate`/`parseTime`
  accept; adapters use those parsers so validation and conversion cannot
  drift).
- Conversions are explicit and one-directional at the adapter boundary:
  `isoDate ⇄ CalendarDate` (`parseDate`/`toString()`), `isoTime ⇄ Time`
  (`parseTime`/`toString()`). The recorded discipline
  ("serializes a calendar date without timezone conversion",
  `catalog.test.ts:47`) is the required behavior; the adapter must preserve
  it and the batch test must re-assert it.
- **Date ranges are NOT structured state**: a range component binds TWO
  scalar `isoDate` state keys (start, end). The adapter assembles
  `{ start, end }` for the component and splits `onValueChange` back into
  the two `setState` writes; partial ranges (start set, end empty) are
  first-class (`''` empty convention, §6.5). No nested object ever persists.

### 6.3 Item/panel content authoring (documentation rule + fixtures)

- List-control **options are authored content**: a select/combobox/menu
  instance's items are child nodes composed through the instance slot fill
  mechanism (frozen §3.7) — e.g. `options` slot children carrying
  `value` + label; display labels are the content's text/expression.
  Dynamic options stay the array-view-field binding (frozen §6 select row).
  Fixtures pin both shapes.
- **Nested menus**: `Sub` composition nests slot-filled item groups;
  item activation is an output (`itemActivate` payload `string` carrying
  the item's value) or a per-item `click → invokeAction` interaction —
  the same declared-action authority as any node. Menu `CheckboxItem`
  binds `checked` to boolean state (S-1 mechanics); `RadioItem` groups
  bind scalar string (S-2). No new runtime mechanism; §3.7's required-slot
  validation extends with per-family required-part descriptors.

### 6.4 Tri-state presentation (rule)

`indeterminate` is a **prop binding** (boolean expression, typically a
computed `selectAll`-style state or an application op result), never a
third persisted value of `checked`. Persisted checked values are `true`/
`false` only; `''`/null are not valid `boolean` states.

### 6.5 Empty-value conventions (rule + validation)

| Type | Empty representation | Validator/adapter rule |
| --- | --- | --- |
| string / isoDate / isoTime | `''` | legal everywhere; adapters map `'' → undefined` for library props (e.g. unset select value, cleared date field) |
| number | no empty — initial required; a cleared numeric input is an authoring error (new diagnostic `UI_DOC_INVALID_LITERAL`) | no NaN/Infinity (JSON-hostile) |
| boolean | no empty | — |
| stringList / numberList | `[]` initial | legal; no null elements (validator rejects `null` array members) |
| unset state at render | n/a | state keys always have declared initials; `$output` never writes undeclared keys (frozen rule) |

Progress `value: null` (indeterminate bar) is presentation-only: the
adapter maps a missing/empty bound number to the library's null — the
document never stores null.

### 6.6 Compatibility gate check against every extension (required by the owner)

- All proposed extensions are **additive optional fields / widened value
  unions inside `vict.ui-document@1` and `vict.ui-render-plan@1`** — the
  frozen §4.3 matrix rows apply verbatim: old compiler drops the new
  instance fields → descriptor ABI marker still rejects at the legacy
  resolver (probe C2); new renderer rejects marker-less artifacts. The
  gate is family-agnostic: **every new wrapper descriptor** (each batch's
  families) MUST carry `events: ['vict.ui-component-abi@1']` + `abi` +
  declared `outputs` — no new gate logic is introduced by any batch.
- List payloads ride the same `io.emit(output, payload)` channel (payload
  is JSON-serializable); stale-drop, occurrence isolation, generation
  fencing, and two-phase save are payload-type-agnostic (no code path
  inspects payload shape beyond the declared-type check — verified by
  reading the frozen bridge contract §3.4/§5.3: drops compare declared
  payload types, never shapes).
- New failure-model rows needed (validator): list payload/list state
  mismatch, `null` array member, malformed `isoDate`/`isoTime` literal,
  range start>end (validator-level sanity check; runtime still owns
  library-level validation). These extend
  `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID` / `UI_COMPONENT_BINDING_INCOMPATIBLE`
  / `UI_EXPR_TYPE_MISMATCH` scope — same diagnostics, widened trigger
  conditions (the frozen §5.1 table gains trigger text, not new codes,
  except ONE NEW code for date/time literal formats:
  `UI_DOC_INVALID_LITERAL` — new, introduced by this extension; today's
  validator has no such code — verified against
  `packages/ui/src/diagnostics.ts`).

### 6.7 What stays frozen and untouched

Declared-action authority (outputs ride setState/dispatch only); exact
identity/revision resolution and the pin rule; the ABI marker gate and
compatibility rejections; occurrence isolation; generation-gated stale
drop; transactional editing and two-phase save; the seven U4 criteria;
packaging repair and packed-artifact consumer isolation;
preview/production parity; bundle separation; the unfamiliar-agent
exercise; the founder checkpoint; the approved Inspector as experience
baseline (new editors extend it: list-state multi-picker, ISO date/time
editor, range-pair editor — all descriptor-driven, same patterns).

## 7. Delivery recalibration — dependency-based batches

Batch order follows the dependency spine: value vocabulary → selection
modes → numeric/dates → menu composition → display/composition. Each batch
is a separate authorized implementation effort with its own gate; **a batch
PASS proves only its rows** — never full-catalog support.

Proof patterns (distinct interaction classes; each proof informs every
family listed and families outside the list need their own checks):

| Pattern | Class | Informs |
| --- | --- | --- |
| P-scalar | one scalar value + change output + declared action | checkbox, switch, toggle, radio-group, select single, tabs, collapsible, dialog open |
| P-multi | list value + change output + list state inspector editing | select multiple, toggle-group multiple, combobox multiple, accordion multiple |
| P-range-date | numeric pair or typed date/time scalars + conversions + empty handling | slider range, date/date-range/time fields, calendar/range-calendar, date pickers |
| P-nested | composed item content + nested activation outputs | dropdown/context/menubar/command, navigation-menu, tabs/accordion panels |
| P-overlay | portal + focus scope + open loop + escape/outside-close | dialog, alert-dialog, popover, tooltip, link-preview |
| P-structured | repeated/record data (document repeat + application-surface comparison) | repeat nodes vs RecordsTable/DataView/List/Detail (boundary demonstration) |

### Batch B1 — scalar foundation (RECOMMENDED FIRST)

- **Scope**: the frozen five-family contract (button, catalog checkbox,
  catalog select single, catalog dialog, app-shell) **plus** the §6.1/6.5
  value-vocabulary and empty-value rules as landed contract (they are
  prerequisites for every later batch and are exercised by B1 rows), plus
  switch/toggle/radio-group wrappers (same S-scalar mechanics, trivial
  descriptor deltas).
- **Implementation**: ui model/compiler validation widening; ui-svelte
  bridge + 8 wrappers (button, checkbox, select, dialog, app-shell,
  switch, toggle, radio-group); Inspector scalar editors + output-binding
  editor (frozen §3.6); packaging repair (F3) — unchanged U4 obligation.
- **Founder can author, after B1**: working controls with declared-action
  wiring — press buttons with pending/feedback, tick checkboxes and flip
  switches bound to real state, pick one option from a select, open/confirm
  a dialog, navigate inside an authored app shell; all of it edited in the
  Inspector, undone/redone, saved, reloaded, and replayed in the finished
  app.
- **Still unavailable after B1**: every multi-value control, dates/times,
  numeric ranges, menus, and the deferred three — stated per-family in the
  coverage ledger.
- **Acceptance**: the frozen §6 proof for its five families + scalar
  wrappers; fixtures execute in the consumer test-suite form; negative
  fixtures (unknown output, payload mismatch, incompatible binding,
  revision/ABI failures) demonstrate the failure model at runtime; P-scalar
  + P-overlay patterns recorded.

### Batch B2 — selection modes and lists (P-multi)

- **Scope**: `stringList` state/props/payloads live: select multiple,
  toggle-group (single+multiple), combobox (single first; multiple where
  the adapter needs no new mechanism), accordion (single/multiple);
  item-content authoring rule (§6.3) with option slot fixtures; tri-state
  presentation binding (§6.4); tabs/accordion panel composition rule.
- **Founder gains**: multi-select pickers, segmented toggles, accordion
  sections — with list state visible and editable in the Inspector.
- **Acceptance**: P-multi recorded end-to-end (edit → undo → save → reload
  → app); item-content and list-mismatch negative fixtures at runtime;
  per-family ledger rows updated to authoring-supported **only** for
  demonstrated modes.

### Batch B3 — numeric ranges and dates/times (P-range-date)

- **Scope**: `numberList` (slider single + range), meter, progress,
  pagination; `isoDate`/`isoTime` markers: date-field, date-picker,
  calendar, time-field; dual-scalar range pattern: date-range-field,
  date-range-picker, range-calendar; empty-value handling per §6.5.
- **Founder gains**: quantity inputs with ranges, real date/time entry
  with validation and locale discipline, delivery-window style ranges.
- **Acceptance**: P-range-date recorded; timezone-conversion regression
  test (the `catalog.test.ts:47` discipline) re-asserted through the
  adapter; malformed-literal negatives rejected at authoring time.

### Batch B4 — menus and nested composition (P-nested)

- **Scope**: dropdown-menu, context-menu, menubar, command; nested item
  composition, per-item activation outputs/actions, CheckboxItem/RadioItem
  bindings; navigation-menu.
- **Founder gains**: real menus and command palettes authored as content,
  wired to declared actions.
- **Acceptance**: P-nested recorded; nested-slot fixtures; keyboard
  roving-focus behavior demonstrated (library-provided, adapter-revealed).

### Batch B5 — display and composition chrome

- **Scope**: avatar, aspect-ratio, separator, label, scroll-area, toolbar,
  link-preview, tooltip, popover, alert-dialog (overlay rows), tabs
  document-composition row, **collapsible** (reconciliation repair F3:
  the family had inventory presence but no ledger row or batch).
- **Collapsible assignment** (meaningful properties, controlled open,
  content composition, acceptance): wrapper descriptor
  `vict.catalog.collapsible` with props `open` (boolean — controlled via
  state binding, the S-1 scalar loop), `disabled` (boolean); content via
  the trigger + content slot fills (§3.7 mechanics); output
  `openChange` (payload `boolean`) bound `setState` — the same
  open-loop pattern as the dialog row. Acceptance evidence: the P-scalar
  open loop (bind boolean state → toggle → `openChange` → setState →
  undo/redo → save → reload → replay) plus composition evidence for
  authored content; ledger row added in matrix §6.
- **Founder gains**: polished composition chrome and contextual helpers.
- **Acceptance**: P-overlay/P-nested rows as applicable; display families
  need composition evidence only (no value mechanics); collapsible per
  its row above.

### Exclusions and boundaries

- **X deferred (unchanged)**: pin-input, rating-group, time-range-field —
  no VICT module exists; status changes only with new evidence + owner
  authority.
- **Application-plan surfaces** (RecordsTable, Chart, Conversation,
  DataView, List, Detail, Form/FormSurface, VitApp): plan contracts are
  the canonical configuration source; document-NODE authoring is not
  planned. This is NOT a permanent exclusion from founder editing of
  configuration: Studio inspect/edit surfaces for these components are
  recorded as PENDING work awaiting owner authorization (§4.0 roadmap).
  The display components (StatusBadge, Feedback, Button, Text, Count)
  already have or are candidates for the extension mount route (§4.0
  evidence); they are exercised as the P-structured comparison where
  relevant, not as batch authoring targets.
- **Editor ergonomics out of scope (unchanged from frozen §8)**: visual
  binding-mapping canvas, per-option authoring UIs beyond descriptor-driven
  editors, grid editors for record-valued props.

### Coverage ledger obligation (new standing rule)

Every family claimed as authoring-supported must have a ledger row in
[U4-COMPONENT-REUSE-MATRIX](U4-COMPONENT-REUSE-MATRIX.md) §6 naming: modes
supported, batch, proof pattern, evidence artifact, and — for partial
support — exactly which modes remain unproven. A batch report that claims
beyond its ledger rows is a finding.

**Programmatic reconciliation (repair F3, standing rule):** the coverage
manifest (`catalog-coverage.json`) is reconciled against the ledger by
script — every AVAILABLE family must appear in an assignable row (C →
B-n / B-n), the three DEFERRED families only in the named-exclusion row.
The repair-cycle run found exactly one gap (collapsible — now assigned,
B5) and no misplaced exclusions; the script + output are preserved at
`reviews/u4/ledger-reconciliation/`. Re-run the reconciliation at every
batch gate.

## 8. Package ownership and allowed paths (per batch)

| Package | Owns | Allowed change classes |
| --- | --- | --- |
| `@victframework/ui` | model/compiler/validation/edit | additive value-type union; state/prop/payload type widening; validator triggers; **no schema-string change, no library types** |
| `@victframework/application` | application compiler plumbing | the frozen §3.5 action-input catalog derivation (`deriveActionInputCatalog` → `compileUiDocument` catalogs option at the existing `ui-attach.ts` call site); **no dispatch/identity change** |
| `@victframework/ui-svelte` | bridge + catalog wrappers + diagnostics | per-batch wrapper descriptors/implementations (each carrying the ABI marker); adapter conversions (§6.2); generation/stale mechanics unchanged |
| `@victframework/ui-editor` | Inspector editors | descriptor-driven editors for the new value types; output-binding editor extension; **approved Inspector patterns are the baseline** |
| `examples/u4-consumer` | packed-artifact consumer | per-batch proofs, fixtures-executed-as-tests, walkthrough recordings |
| docs/ui-foundation | ledger, handoff, records | per-batch coverage updates; no frozen-byte rewrites |

## 9. Evidence limits (honest)

- This recalibration is **contract-stage**: every proposed behavior above
  is unimplemented. Source inspection + pinned upstream declarations + the
  recorded showcase/tests are the evidence base for the inventory; the
  repair cycle added two disposable probes, both recorded with limits:
  the VALIDATOR probe (`reviews/u4/validator-probe/` — legacy validation
  of widened declarations, validator-level only, no renderer/browser run)
  and the LEDGER reconciliation
  (`reviews/u4/ledger-reconciliation/` — manifest↔ledger script, doc
  bytes only).
- bits-ui value shapes are cited from the installed `bits-ui@2.19.3`
  typings (pinned by `catalog-coverage.json`); a dependency upgrade would
  require re-verification before relying on any cited shape.
- Library-level keyboard/focus/portal behaviors are upstream-provided and
  adapter-revealed; batches must demonstrate them, not assume them.
- The 3 deferred families and the application-plan boundary are
  decisions recorded here; the display components' document-mount route
  is recorded U3 evidence (§4.0); Studio config editing for any
  higher-level component is PENDING owner authorization, not claimed
  here. Both boundary groups are revisitable only with new evidence and
  owner authority.
