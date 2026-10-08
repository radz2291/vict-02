# U4 CATALOG RECALIBRATION — INDEPENDENT VERIFIER REVIEW R1

- Reviewer role: fresh independent verifier (did not author the candidate; judgments derived from bytes)
- Tested SHA: `087d41e2cface5dad8dc98b4fcec89cc3d5c1d94` (branch `codex/ui-foundation-u4-catalog-recalibration`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u4-catalog-recal`)
- Working tree: clean (`git status --porcelain` empty). Repo untouched; all checks read-only; this report lives in a temp dir.
- Candidate = `git diff 7a9477f..087d41e` (base `7a9477f934b1f30f9f603775b163c0e8a3a1e385` = recalibration entry base per lineage table).

## Verdict summary per attack

| Attack | Result | Key evidence |
| --- | --- | --- |
| A. Inventory | PASS (2 minor findings F-1, F-3) | see A below |
| B. Trace/ceiling | PASS (1 finding F-2: stale line cites; claims true) | see B |
| C. Design coherence | PASS (1 clarity finding F-6) | see C |
| D. Fixtures | PASS | all 4 parse; markers present; shapes end-to-end |
| E. Batches/ledger | PASS (findings F-4, F-7, F-9) | order sane; honesty rules everywhere |
| F. Scope/preservation | PASS | docs-only diff; freeze bytes re-hashed and match |
| G. Handoff coherence | PASS (1 finding F-5) | §13.1 self-consistent; §12.2 note accurate |
| H. New-claim scan | PASS | no unlabeled capability claims found |

## A. INVENTORY — PASS

1. **41 families, 30/8/3** — PASS. `packages/ui-svelte/catalog-coverage.json` has `bitsVersion: 2.19.3`, `families` with exactly 41 entries; status counts: `styled and usable` = 30, `supported direct composition` = 8, `deferred` = 3 (verified by programmatic count).
2. **38 modules; deferred three absent** — PASS. `ls packages/ui-svelte/src/catalog/ | wc -l` = 38. No file or symbol for pin-input / rating-group / time-range-field anywhere in `packages/ui-svelte/src/` (grep for `PinInput|RatingGroup|TimeRangeField` = 0 hits). 38 + 3 = 41 arithmetic holds.
3. **bits-ui 2.19.3 value-shape spot-checks** — PASS (one wording nit F-3).
   - select single `value?: string` / multiple `value?: string[]`, `type:"single"|"multiple"`: `node_modules/bits-ui/dist/bits/select/types.d.ts:93–135` ✓ (doc cites 95–135).
   - toggle-group single string / multiple string[]: `toggle-group/types.d.ts:33–41` ✓.
   - slider `step?: number | number[]` :85 ✓; `value?: number[]` :160 ✓. **F-3 (minor):** single-thumb slider is `type:"single"` with `value?: number` (:137), so recalibration §3.1's "value: number[] — one thumb (scalar)" misstates the single-mode shape; §5 S-3/L-2 assign scalar→number and range→numberList correctly, so the design is unaffected.
   - checkbox `checked: boolean; indeterminate: boolean` :4–5 ✓.
   - date-field `value?: DateValue` :12, `onValueChange?: OnChangeFn<DateValue | undefined>` :17 ✓ (doc cites 1, 12–17).
   - date-range-field `value?: DateRange` :7–17 ✓; `DateRange = { start: DateValue | undefined; end: DateValue | undefined }` at `shared/date/types.d.ts:37–40` ✓.
   - pagination `page?: number` :33 ✓ (doc cites 17–33).
   - progress `value?: number | null` :10 ✓; meter `value?: number` :9 ✓.
   - combobox single/multiple union :14–18 ✓ (re-uses select props).
   - accordion single `value?: string` :33, multiple `value?: string[]` :61–65 ✓.
   - time-field `Time` :1, `TimeValue` :6, `hourCycle?: 12 | 24` :76, `granularity` :95 ✓.
4. **Higher-level classification** — PASS. `packages/ui/src/index.ts:132` = `UiFieldWidget = 'text' | 'number' | 'boolean' | 'date' | 'json' | 'select'`; `UiFormField` with `widget: UiFieldWidget` at :139–145 (doc cites 132–149) ✓. `RecordsTable.svelte:9` `intent: UiTableIntent` ✓; `Chart.svelte:7` `kind: 'bar' | 'line'`, :10 `UiChartPoint[]` ✓; `Conversation.svelte:6` `UiConversationMessage[]` ✓. Exported-name list matches `packages/ui-svelte/src/index.ts` (Button, Select, Popover, Tooltip, Tabs, AppShell, ActionFeedback, Feedback, StatusBadge, Text, Count, Overlay, RecordsTable, Chart, Conversation, DataView, List, Detail, Form, FormField, VitApp, DocumentHost, DocumentRenderNode, ComponentSlot); ActionButton.svelte / FormSurface.svelte exist but are not exported — matching the doc's "internal" labels.
5. **Tabs.svelte drives bits-ui Tabs.Root** — PASS. `src/Tabs.svelte:2` `import { Tabs } from 'bits-ui'`; `:11` `<Tabs.Root class="vict-tabs" … bind:value>`.

**F-1 (minor, factual prose error in candidate):** recalibration §3.2 "Styled and usable (30):" lists **33 slugs**, including `label`, `scroll-area`, `toolbar`, which `catalog-coverage.json` records as `supported direct composition` (the direct 8 = AspectRatio, Collapsible, Label, LinkPreview, Menubar, ScrollArea, Separator, Toolbar). The same paragraph names the coverage file as "the recorded authority" and all totals (30/8/3; 38+3=41) are correct; matrix §6 and the batch plan do not depend on the styled/direct split. Not material to any gate — recorded as a doc correction for the candidate owner.

## B. TRACE/CEILING — PASS (claims true; cites stale)

- `packages/ui/src/document.ts:25` `UiPrimitiveType = 'string' | 'number' | 'boolean'` ✓.
- `UiLocalStateDecl` :136–140: `type: UiPrimitiveType`, `initial: string | number | boolean` — no null, no arrays ✓. **F-2a:** recalibration §5 L-1 (line 210) cites `document.ts:99–102` — actual :136–140.
- `UiPropDecl` :148–151: `type: UiPrimitiveType` ✓. **F-2b:** doc cites `document.ts:139–143` — actual :148–151.
- `UiExpression` literal :30–31 `string | number | boolean | null` — no array literal ✓. **F-2c:** doc §6.1 (line 267) cites `document.ts:37` — actual :31.
- `packages/ui/src/expressions.ts` `case 'op'` :120 walks args and `return 'unknown'` :133 — op expressions are type-unknown ✓ (checked because the trace depends on expressions not granting array types).
- Frozen §3.2 payload: `git show 460d963:docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` :166–167 `readonly payload: 'void' | UiPrimitiveType;` ✓ — exactly the ceiling the recalibration claims for L-1/L-2.
- E/M classifications follow from the bytes: S-1/S-2/S-3 E (scalar state/prop/payload all within frozen vocabulary) ✓; L-1/L-2 M (string[]/number[] expressible nowhere: state type, prop type, payload union all primitive-only) ✓; T-1/T-2 M (DateValue/Time/DateRange are library objects; contract has only primitives) ✓; X-2 M (`initial` has no null; expression literal null ≠ state type) ✓; N-2/R-1 E consistent with `UiFieldType = UiPrimitiveType | 'array'` :27 and the frozen slot/§6 select row ✓.
- `UiOutputDecl` exists only as frozen amendment spec (not yet code) — consistent with "U4 runtime implementation remains unauthorized"; the recalibration claims it as the frozen contract, not as shipped code.

## C. DESIGN — PASS

Amendment diff = status-header note + appended §10 only (`git diff 7a9477f..087d41e -- U4-COMPONENT-AMENDMENT.md`). Checks:

- **No schema-string change**: §10.1 "one additive union; schema strings unchanged"; header lines "Document schema: unchanged (`vict.ui-document@1`, additive optional fields only)" ✓; frozen §4.3 matrix invoked verbatim in §10.3 ✓.
- **Additive optional**: §10.1 widening of existing decls; old-compiler drop + fail-close marker semantics preserved ✓.
- **Gate unchanged / family-agnostic**: §10.3 "Every new wrapper descriptor MUST carry the ABI marker … the gate is family-agnostic and no batch introduces new gate logic" — identical obligation in recalibration §6.6 and handoff §13 ✓.
- **Diagnostics widening vs new codes**: §10.3 "no new codes except the date/time literal format rule … extends the `UI_DOC_INVALID_LITERAL`-class scope"; recalibration §6.6 same. **F-6 (minor, clarity):** no `UI_DOC_INVALID_LITERAL` code exists in today's validator (actual `UI_DOC_*` codes: CYCLE, DUPLICATE_NODE_ID, REFERENCE_DANGLING, REQUIRED_SLOT_MISSING, REVISION_COLLISION, STALE_REVISION, UNKNOWN_*, UNSUPPORTED_FEATURE). The README conventions ("Codes marked 'compile, built by the amendment' do not exist in today's validator") and fixture R2 make the contract-level intent clear, but the phrase "scope extension" could be misread as extending an existing code.
- **Dual-scalar range vs DateRange**: §10.1 "Date RANGES persist as TWO `isoDate` scalar state keys (start, end); the adapter assembles/splits `{ start, end }`" — coherent with `DateRange {start,end}` (both `DateValue | undefined`) and with partial ranges via `''` ✓. No nested object persists; adapter-only conversion keeps library types out of `@victframework/ui` (frozen non-goal restated) ✓.
- **Empty values vs bits-ui**: `''` for string/isoDate/isoTime; `[]` lists; numbers/booleans no empty; "Progress's `value: null` (indeterminate) is presentation-only, mapped by the adapter, never persisted" — coherent with `progress/types.d.ts:10` `value?: number | null` ✓.
- **Tri-state rule vs checkbox types**: `indeterminate` as prop binding, never a third persisted `checked` value — coherent with checkbox `checked: boolean` + separate `indeterminate: boolean` prop ✓.
- **Superseded vs preserved**: §10 explicitly supersedes only the §8 scope sentence and five-family coverage claim; §8 honesty rules and §9 non-goals restated as governing ✓. §8/§9 bytes themselves untouched by the diff ✓.

## D. FIXTURES — PASS

- All four files parse (`python json.load` OK): multiselect-binding.json, date-field-binding.json, slider-range-binding.json, invalid-cases-recal.json.
- Descriptors each carry `abi: "vict.ui-component-abi@1"` + `events: ["vict.ui-component-abi@1"]` + declared `outputs` ✓ (all three positive fixtures).
- multiselect: stringList end-to-end — prop `value: stringList` default `[]`, payload `stringList`, state `teams` type stringList initial `[]`, `$output` ref, options as slot content (`vict.catalog.option` children with value+label) ✓.
- date-field: `isoDate` prop/payload/state, `''` initial, "clearing writes ''", adapter maps `'' → undefined` ✓.
- slider: `numberList` end-to-end, initial `[20, 80]`, expected `[35, 70]` ascending, single-thumb = one-entry list ✓.
- invalid-cases-recal negatives consistent with §10.3: R1 stringList→string = `UI_COMPONENT_BINDING_INCOMPATIBLE` ✓; R5 numberList→number same ✓; R4 range start>end = validator-level sanity under `UI_COMPONENT_BINDING_INCOMPATIBLE` ✓; R2/R6 malformed literals and R3 null array member = `UI_DOC_INVALID_LITERAL` (the "-class" vehicle; see F-6) — plausible and consistent with §6.5's validator rule.
- README manifest rows match file contents 1:1 (descriptions verified against fixture bodies); README header explicitly says "contract examples — NOT runtime evidence … execute nowhere and authorize nothing" — no runtime support implied ✓.

## E. BATCHES/LEDGER — PASS

- B1→B5 dependency order sane: value vocabulary (B1) → list modes (B2) → numeric/dates (B3, needs vocabulary from B1) → nested menus (B4, uses scalar mechanics + content rule) → chrome (B5). No batch depends on a later one's mechanism.
- B1 scope vs handoff §13.1: families match (five frozen + switch/toggle/radio-group), vocabulary-as-landed-contract matches, F3 + Inspector + packing + proofs match. **F-7 (minor):** §13.1 item (1) lands "item-content rules" in B1; recalibration §7 B1 names only §6.1/§6.5 (item content §6.3 is B2 scope). Harmless documentation-rule drift; prompt remains self-consistent.
- Ledger rows (matrix §6) match recalibration §7 batches/modes family-by-family (B1: button/checkbox/select-single/dialog/appshell/switch/toggle/radio-group; B2: select-multi/toggle-group/combobox/accordion/tabs-composition; B3: slider/meter/progress/pagination/date+time+range families; B4: menus+command+navigation; B5: chrome+overlays; X row; P3 application-surface row) ✓.
- **F-4 (minor):** matrix Checkbox row lists modes "boolean + indeterminate presentation binding" under `C → B1` / proof `B1 · P-scalar`, while recalibration §5 X-1 and §7 B2 assign the indeterminate presentation binding to B2. The Select row's per-mode style (`single → B1; multiple → B2`) is the correct pattern; the checkbox row should split modes. No capability is claimed (row is C), so non-blocking.
- **F-9 (nit):** matrix Accordion proof pattern says `B2 · P-nested` while recalibration §7 P-multi pattern includes accordion multiple — same batch, no consequence.
- Honesty rules forbid batch-PASS → full-catalog claims in all four places: recal §7 ("a batch PASS proves only its rows — never full-catalog support" + ledger obligation "a batch report that claims beyond its ledger rows is a finding"), matrix §6 ("B-n requires that batch's direct evidence … a batch PASS proves only its ledger rows"), amendment §10.4, handoff §13 + §13.1 ("a B1 report claiming them is a finding") ✓.
- Deferred three stay X in recal §3/§5/§7, matrix §6, amendment §10.4, handoff §13/§13.1 ✓.
- Application-surface boundary consistent: recal §4(b)/§5 A-rows/§7 exclusions = matrix §6 P3 row = handoff §13 = amendment §10.4 (plan-governed; P3/P4 route preserved; document-node authoring a recorded non-goal) ✓. **F-8 (nit):** recalibration text references "§4b"/"§4b rows" but the document has §4 with subsections (a)/(b), no literal §4b heading.

## F. SCOPE/PRESERVATION — PASS

- `git diff 7a9477f..087d41e --name-only`: 11 paths, all under `docs/ui-foundation/` (6 docs + fixtures README + 4 new fixtures). No code, no packages, no other tracks.
- Frozen payload commits exist and are immutable: `460d963` (tree `eb1b4e2e…`) and `68e166f` (tree `d4a5a551…`). Re-hashed payload bytes at `460d963` against the FREEZE-02 SHA-256 table: amendment `b0b782ba3ace5321…`, README `acde98701a108d01…`, abi-compat-probe `cbaea2095a8e2738…`, invalid-cases `902f99a3d70dcda5…`, checkbox-valid `69240cfd84f2e78f…` — all match `U4-AMENDMENT-FREEZE-02.md` exactly. `U4-AMENDMENT-FREEZE-02.md` itself untouched by the diff.
- The worktree copies of the amendment/README changed (extension), and the candidate does not claim otherwise: amendment §10.5 "the superseding freeze re-pins the set"; no "live bytes = freeze" claim anywhere (grep verified).
- STATE.md diff = one added paragraph: decision-8 work IN PROGRESS, PROPOSED, implementation NOT authorized — consistent with recalibration header and handoff §13; no contradictory current-status claim.
- DECISIONS-AND-EVIDENCE.md diff = decision 8 only: records the owner clarification, outputs, the P3 boundary, the deferred three, B1-first, "Runtime implementation remains unauthorized; supersedes the amendment §8 five-family limit … (both preserved in frozen bytes at `460d963…`)" — accurate.

## G. HANDOFF COHERENCE — PASS

- §13.1 self-consistent: pins (handoff §13 at recorded tip; freeze-02 payload SHA; recalibration + §10 supersede-for-scope), in-scope items (1)–(7), out-of-scope list (B2–B5 families, deferred three, application-surface), ledger-update restriction ("B1 families ONLY"), stop-at-founder-checkpoint and no-publish/merge/integration constraints. **F-5 (minor):** item (3) says F3 "as specified in §10 carry-forwards" — amendment §10 contains no F3 mention (frozen §9 line 80 and handoff §12/§13 + recalibration §7 B1/§8 carry F3; the operative instruction is consistent everywhere else).
- §12.2 overlap note accurate: §13.1 = §12.2's five-family scope + value-vocabulary extension + three additional wrappers (switch/toggle/radio-group); "Do not authorize both" is coherent; header marks §12.2 "SUPERSEDED IN PART by §13.1" ✓.
- No operative text still claims the five-family scope is the full requirement: remaining "five" mentions in the handoff are all qualified (superseded header, B1's "frozen five-family contract", §13.1's "five frozen contract families") — grep-verified.

## H. NEW-CLAIM SCAN — PASS

- Recalibration header: "PROPOSED — UNDER INDEPENDENT REVIEW (implementation NOT authorized)… Everything labelled 'proposed' here is unimplemented"; §6.1 heading "(proposed, unimplemented)"; §6.2 "(proposed)"; §9 "every proposed behavior above is unimplemented. Source inspection + pinned upstream declarations + the recorded showcase/tests are the entire evidence base; no new runtime probe was run."
- Matrix §6 legend: C = contract defined, unimplemented; B-n requires batch evidence; all rows are C/X/P3 — no B-n claims.
- README: "NOT runtime evidence… execute nowhere and authorize nothing"; conventions state amendment-built codes are contract-level only.
- Every existing-library claim I sampled verified against bytes: catalog.test.ts:29 ("keeps checkbox and immediate switch values independently bound"), :38 ("keeps multiple toggle values and ignores a disabled option"), :47 ("serializes a calendar date without timezone conversion"); SelectionExamples.svelte:126–138 (slider multiple, two labelled thumbs), :155–161 (toggle-group single+multiple), :38–41 (checked/indeterminate/disabled), :89/:102 ("Teams to notify · multiple" / "Priority · single"); DateExamples.svelte:10–17, 108–110 (parseDate('2026-10-08'), range {start,end}, DateRangeField); Select.svelte = 11 lines; Feedback.svelte kinds `empty|status|error|denied` (:4, rendering :7–27); ActionButton pending/aria-busy (:11, :33); Tabs.svelte:1–10; RecordsTable.svelte:9–33; AppShell brand/breadcrumbs present.
- No sentence was found claiming existing runtime support for the extension, and no authoring-support claim is made without batch evidence (all authoring statuses are C/X/P3 pending batches).
- `deriveActionInputCatalog` correctly presented as B1 work per frozen §3.5 ("a small pure helper…"), not as existing code.

## Findings register (all non-blocking)

| ID | Severity | Location | Finding | User effect |
| --- | --- | --- | --- | --- |
| F-1 | Minor | U4-CATALOG-RECALIBRATION.md §3.2 | "Styled and usable (30)" lists 33 slugs; label/scroll-area/toolbar are `supported direct composition` in catalog-coverage.json (the named authority). Totals and arithmetic correct. | A reader trusting the prose list could mis-bucket three families; coverage file and ledger are correct. |
| F-2 | Minor | recalibration line 210 (L-1), line 267 (§6.1) | Line cites `document.ts:99–102`, `:139–143`, `:37` point ~5–105 lines off (actual :136–140, :148–151, :31). All claims verified TRUE against current bytes. | Slower independent re-verification; no wrong conclusion. |
| F-3 | Minor | recalibration §3.1 Slider row (line 109) | Single-thumb slider is `value?: number` (slider/types.d.ts:137), not `number[]`; range/multiple is `number[]` (:160). §5 assignments are correct. | None on design; wording precision only. |
| F-4 | Minor | U4-COMPONENT-REUSE-MATRIX.md §6 Checkbox row | Indeterminate presentation binding listed under B1/P-scalar; recalibration assigns it to B2 (§6.4). Row is status C so nothing is claimed. | Potential future ledger-row mismatch at B1 time if not split per-mode. |
| F-5 | Minor | U4-HANDOFF.md §13.1 item (3) | F3 cited "as specified in §10 carry-forwards"; §10 has no F3 text (F3 lives in handoff §12/§13 and recalibration §7/§8). | Authorization-prompt pointer chase; substance correct. |
| F-6 | Minor | amendment §10.3 / recalibration §6.6 / fixture R2 | `UI_DOC_INVALID_LITERAL` framed as "scope extension"/"-class" but no such code exists today; it is a new code in the UI_DOC_* family. README conventions mitigate. | A reader may think an existing diagnostic is extended. |
| F-7 | Minor | handoff §13.1(1) vs recalibration §7 B1 | §13.1 lands item-content rules in B1; recalibration B1 names §6.1/§6.5 only (§6.3 is B2). | Slight batch-scope text drift between the two B1 statements. |
| F-8 | Nit | recalibration §5/§7 | "§4b" references resolve to §4(b); no literal §4b heading. | Cosmetic. |
| F-9 | Nit | matrix §6 Accordion row | Proof pattern `B2 · P-nested` vs recalibration P-multi also informing accordion multiple. Same batch. | Cosmetic. |

No blocker found: no false source claim material to a gate, no contract incoherence, no scope/preservation violation, no new unsupported claim.

## Verdict

**PASS WITH NON-BLOCKING FINDINGS** — the candidate's inventory arithmetic, source claims, contract-ceiling trace, extension coherence, fixtures, batch/ledger honesty rules, scope preservation, and handoff coherence all verified against bytes at `087d41e2cface5dad8dc98b4fcec89cc3d5c1d94`; findings F-1…F-9 are documentation-precision items to fold into the candidate before any superseding freeze re-pins the set.

U4 CATALOG RECALIBRATION REVIEW R1: PASS WITH NON-BLOCKING FINDINGS

## R1 Round 2 (affected recheck)

- Recheck scope: affected spots only, read-only, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u4-catalog-recal`.
- Tested SHA: `cf2edd3b91197166ec2f8529eeab6200bfa1d7f7` (same branch; tree clean). Delta = `git diff 087d41e..cf2edd3`: 4 candidate docs + review report import + `.gitattributes` (6 files).
- Import integrity: `docs/ui-foundation/reviews/u4/U4-RECALIBRATION-REVIEW-01.md` sha256 = `8a6bc5627e2fb95f5807869ef710af161a8c2a18e990c7fdc5fa50ad5f357d84` — matches the claimed hash; content is this report verbatim; `.gitattributes` pins `U4-RECALIBRATION-REVIEW-01.md -text`.

| Item | R1 finding | Round-2 result |
| --- | --- | --- |
| 1. F-1 | §3.2 slug misbucketing | **REPAIRED.** §3.2 now enumerates no slugs; counts 30/8/3 + coverage-file-as-authority + 38+3=41 retained; the new sentence ("the 38 covered families comprise the 30 styled-and-usable plus the 8 direct-composition families") is TRUE per catalog-coverage.json. |
| 2. F-2 | Stale document.ts cites | **REPAIRED.** L-1 row now cites `document.ts:135–139` — verified: line 135 JSDoc, 136 `export interface UiLocalStateDecl`, 138 `type: UiPrimitiveType`, 139 `initial: string \| number \| boolean`; and `:148–152` — verified: 148 `export interface UiPropDecl`, 150 `type: UiPrimitiveType`. Cites hit the exact declarations. |
| 3. F-3 | Slider single-mode wording | **REPAIRED.** §3.1 Slider row now splits single `value?: number` (`slider/types.d.ts:137`) vs multi/range `value?: number[]` (`:160`) — both verified against the typings in round 1 (`type:"single"` :130/value :137; `type:"multiple"` :155/value :160). |
| 4. F-4 | Checkbox ledger tension | **REPAIRED.** Matrix §6 Checkbox row now per-mode: "boolean checked → B1; indeterminate presentation binding → B2 (recalibration X-1/B2)", proof column "B1 · P-scalar; B2 · presentation binding" — matches recalibration §5 X-1 and §7 B2; no tension remains. |
| 5. F-5 | §13.1(3) F3 pointer | **NOT REPAIRED (F-5′).** The pointer now reads "the §10 carry-forwards table's first row: emitting build + the four declaration fixes, origin F3" — but amendment §10 contains NO carry-forwards table (grep: zero "carry-forward" occurrences in U4-COMPONENT-AMENDMENT.md; §10.1–§10.5 have no table; the delta added none). The parenthetical content itself is accurate and matches the HANDOFF's own carry-forwards (U4-HANDOFF.md lines 47, 288, 319, 360: emitting build + the four TS2307 declaration fixes). Correct target: the handoff §12 carry-forwards, not "§10". Same minor severity as R1 F-5: wrong cross-reference in the authorization prompt; substance (F3 in B1 scope) consistent in recalibration §7 B1/§8 and handoff §13 preamble; no scope or capability effect. Cosmetic sub-nit: the new recalibration §6.6 code span `` `packages/ui/src/` + newline + `diagnostics.ts` `` breaks across lines (renders with a space). |
| 6. F-6 | UI_DOC_INVALID_LITERAL framing | **REPAIRED.** Both docs now say ONE NEW code ("new, introduced by this extension; today's validator has no such code"). Verified: `packages/ui/src/diagnostics.ts` exists and contains 0 occurrences of `UI_DOC_INVALID_LITERAL` (UI_DOC_* list: UNKNOWN_SCHEMA, DUPLICATE_NODE_ID, UNKNOWN_NODE, CYCLE, REFERENCE_DANGLING, REVISION_COLLISION, UNKNOWN_COMPONENT, UNKNOWN_PROP, REQUIRED_SLOT_MISSING, UNKNOWN_PRODUCT_REFERENCE, UNKNOWN_ELEMENT, UNKNOWN_ATTRIBUTE, UNSUPPORTED_FEATURE, STALE_REVISION). Claim accurate. |
| 7. F-7 | B1 item-content scope drift | **REPAIRED.** §13.1(1) now lands "the vocabulary/empty-value parts of fixtures …" for B1 and states "item-content AUTHORING is a B2/B4 obligation per recalibration §7 — B1 pins its contract shape only" — consistent with recalibration §7 B1 (§6.1/§6.5) and B2 (§6.3 rule + option slot fixtures)/B4 (composition rule). |
| 8. F-8/F-9 | §4b label; accordion pattern | **REPAIRED.** All former "§4b" references now "§4(b)" (R-1, X-3, A-1…A-9 rows, §5.1 item 5; no bare "4b" remains outside a SHA hex). Accordion ledger row now "B2 · P-multi (sections composition: P-nested informs too)" — reconciled with recalibration §7. |
| 9. Delta scan | — | **CLEAN.** Delta introduces no new unsupported claims: §3.2's 30+8=38 composition statement verified against coverage JSON; the "new code" claim verified against diagnostics.ts; matrix rows stay status C (no capability claimed); §13.1 scope only narrows. No regression to R1 passes: fixtures, freeze files, STATE.md, DECISIONS untouched by the delta; STATE's "PROPOSED — under independent review" remains accurate (this recheck is part of that review). |

**Round-2 verdict:** 8 of 9 affected spots repaired and verified; F-5 persists in altered form (F-5′: §13.1(3) points at a "§10 carry-forwards table" that does not exist in amendment §10; content and scope otherwise correct). Same non-blocking severity class as R1; recommend fixing the pointer to the handoff's own carry-forwards (or adding the table to §10) before the superseding freeze re-pins the set.

U4 CATALOG RECALIBRATION REVIEW R1 ROUND 2: PASS WITH NON-BLOCKING FINDINGS
