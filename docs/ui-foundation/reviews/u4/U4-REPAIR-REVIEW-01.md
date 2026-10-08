# U4 CATALOG RECALIBRATION — BOUNDED REPAIR: INDEPENDENT REVIEW R1

Reviewer: fresh independent verifier (authored none of the candidate; repo left read-only).
Date: 2026-10-07 (review cycle R1).
Mode: falsification. Every attack below was executed against bytes, not adopted from the builder's reasoning. Nothing was repaired.

## 0. Identity and pin

| Item | Value | Result |
| --- | --- | --- |
| Worktree | `C:/Users/RZ1/Desktop/RZ/vict-02-u4-catalog-repair` | confirmed |
| Branch | `codex/ui-foundation-u4-catalog-repair` | confirmed |
| Candidate | `009befe2bf653a079d25b43d0f17ae6815ce0d12` | `git rev-parse HEAD` matches |
| Base | `b05d016d9e48bf301d5a5a4109936e6bf32fa690` | = `origin/codex/ui-foundation-u4-catalog-recalibration` tip |
| Working tree | clean (`git status --porcelain` empty) | confirmed |
| Diff scope | 13 paths; 12 under `docs/ui-foundation/` + root `.prettierignore` (+2 lines, ignoring the two new evidence dirs) | see F-7 |
| Pinned-legacy identity | `git diff 952d92d b05d016 -- packages/ui/src/` EMPTY | confirmed (probe's "imports the pinned legacy validator bytes" premise holds) |

Probe-directory scripts (`C:/Users/RZ1/Desktop/RZ/u4-f2-probe/`) are byte-identical to the committed evidence (`probe.mjs` ≡ `u4-f2-validator-probe.mjs`, `f1-signatures.ts`, `reconcile-ledger.mjs` all verified identical).

## 1. Mechanical reruns (all executed by this reviewer)

| Check | Command | Result |
| --- | --- | --- |
| F1 signatures compile strict | `tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler f1-signatures.ts` (worktree toolchain) | EXIT 0, clean |
| F1 negative `[null]` | same on `f1-neg.ts` (line uncommented) | EXIT 2, `error TS2322` |
| F1 all six negatives, each separately uncommented | synthesized variants negfull-1..6, same tsc invocation | 6/6 EXIT 2 with type errors (see F-6 rationale nuance) |
| F2 validator probe verbatim | `npx tsx u4-f2-validator-probe.mjs` | EXIT 0; output **byte-identical** to `reviews/u4/validator-probe/output.txt` |
| F3 reconciliation verbatim | `node reconcile-ledger.mjs` | EXIT 0, `RECONCILIATION OK`; output **byte-identical** to `output-after-repair.txt` |
| Frozen bytes | `git diff b05d016..009befe` over U4-AMENDMENT-FREEZE.md, U4-AMENDMENT-FREEZE-02.md, U4-CATALOG-RECALIBRATION-FREEZE.md, reviews/u4/FREEZE-CHECK-03.md, reviews/u4/U4-RECALIBRATION-REVIEW-01.md, reviews/u4/abi-probe/* | all EMPTY; blobs exist and are identical at both commits |

## 2. Attack verdicts

### A. F1 public emit signature + value path

- **A1 — every affected boundary specified: PASS.** §10.1a boundary table has 8 rows: (1) `io.emit` payload §3.4; (2) state initials `document.ts:135–139`; (3) prop defaults `document.ts:148–152`; (4) host `stateValues` `DocumentHost.svelte:29` + editor forwarding `EditorCanvas.svelte:27`; (5) render-side validation `DocumentHost.svelte:69,95`; (6) author-time validation `validate.ts:383–385`; (7) compiled `UiOutputDecl.payload`/`outputDecls`/`actionInputs` (+ ui-attach call site); (8) preview parity. **Every source cite verified against real bytes**: DocumentHost.svelte:29 is the narrow `stateValues` type; :69 is the seeding loop, :95 the merge `typeof` check; EditorCanvas.svelte:27 the editor forwarding type; validate.ts:383–385 is exactly the three-way `typeof` conjunction (diagnostic `expected`/`actual` at :394–395); document.ts:135–139 and :148–152 exact.
- **A2 — UiValue serializable-only: PASS.** `string | number | boolean | readonly string[] | readonly number[]` (§10.1 + §6.1 identical). No Svelte/Bits/library types; `DateValue`/`Time`/`DateRange` explicitly barred to adapter boundaries; guard adds finite-number and no-null-member rules (closes JSON-hostile members).
- **A3 — ownership/copy discipline: PASS.** Four bullets close the aliasing holes: bridge copies array payloads before delivery/`$output`/snapshot capture; host copies on seeding and every merge, `stateBag` owns; wrappers replace-whole; save/canonicalization JSON-serializes (persisted snapshots structurally copied). All four named holes from the finding are covered.
- **A4 — agreement, no contradictions: PASS.** §3.2 `UiOutputDecl.payload` → `'void' | UiValueType`; §3.4 emit → `payload?: UiValue`; §10.1/§10.1a; recalibration §6.1 (adds `UiValue`, defers boundary detail to §10.1a — no duplication drift); frozen fixtures use payload strings `stringList`/`numberList`/`isoDate` (subset of the widened union — agree). Greps: the only unescaped `string | number | boolean` left is inside the `UiValue` definition itself; all other occurrences are escaped "today (primitive-only)" comparisons in tables; no stale `UiPrimitiveType` payload blocks (remaining hits are the preserved §3.2 array-prop rule, the union definition, and comparative statements).
- **A5 — signatures compile strict without `any`, negatives fail: PASS.** Strict compile clean; no `any`, no escape hatches. All six documented negative lines individually break tsc (verified 6/6, not just the sample). The contract's claim ("typechecked under `--strict` with the negative cases failing") is true.
- **A6 — reference-only array props preserved and compatible: PASS.** §3.2's `UiPrimitiveType | 'array'` reference-only rule untouched (line 217); §10.1a states list-typed state keys are a NEW referenceable source alongside it; §13.1(1) explicitly instructs "keep array-typed props reference-only and add list-state keys as legal reference sources". No contradiction with the expression-binding rules.

### B. F2 legacy validator

- **B1 — probe rerun: PASS.** Byte-identical output, exit 0.
- **B2 — pinned-legacy identity: PASS.** `git diff 952d92d b05d016 -- packages/ui/src/` empty (verified directly).
- **B3 — code matches probe verdict/diagnostic shape: PASS.** Read `validate.ts:378–400` myself: the three-way `typeof` conjunction produces `UI_EXPR_TYPE_MISMATCH`, `expected: String(type)` (= `stringList`), `actual: typeof initial` (= `object` for `[]`, `string` for iso literals) — exactly the probe's captured diagnostics; C0 string/string control passes the conjunction and is accepted.
- **B4 — §4.3 matrix distinguishes all five pairs: PASS.** Rows: old→new compiler (byte-identical); output-enabled primitive-state docs → old validator (accepted, additive optional fields); widened-vocabulary docs → old validator (**REJECTED at the VALIDATION gate, probe-verified — explicitly NOT the descriptor marker**); old instructions → new renderer (fail-closed ABI); new instructions → legacy renderer (marker; noted "normally unreachable" upstream of the validator row). The old universal "New document → old validator: Accepted" row is removed. Residual universal-acceptance greps: clean — the two surviving "tolerates" statements are scoped to additive optional fields/primitive state only.
- **B5 — marker gates preserved untouched: PASS.** The amendment diff has 7 hunks (§3.2, §3.4, §4.3, §10.1, §10.1a, §10.3, §10.4); zero hunks in §5.x — events-marker gate, outputDecls compile marker, and implementation `abi` requirements byte-unchanged (occurrences in the diff are unchanged context lines).
- **B6 — evidence limits honest: PASS.** Probe output ends "validator-level only (no renderer/browser run); render-side host check … cited, not executed here"; recalibration §9 records both probes with the same limits; new-side acceptance is labeled a CONTRACT REQUIREMENT until B1 lands it, not a behavior claim.

### C. F3 Collapsible + ledger

- **C1 — collapsible assignment: PASS.** Recalibration §7 B5: descriptor `vict.catalog.collapsible`, props `open` (controlled via state binding — explicitly the S-1 scalar loop) + `disabled`, content via trigger/content slot fills (§3.7 mechanics), output `openChange` (payload boolean) bound `setState`; acceptance = the P-scalar open loop (bind → toggle → openChange → setState → undo/redo → save → reload → replay) PLUS composition evidence. Matrix row added (`C → B5 | B5 · P-scalar open loop + composition`), consistent with §7. §7's blanket "display families need composition evidence only" is explicitly carved out ("collapsible per its row above"). S-1 coherence: coherent under the authoritative reading — S-1 is a capability trace (E: needs batch evidence); the loop pattern is proven at B1 by B1's own families, and collapsible's B5 row re-runs that loop for the family. See F-3 for the residual trace-wording imprecision (pre-existing).
- **C2 — reconciliation + independent spot check: PASS.** Rerun RECONCILIATION OK, byte-identical. I independently mapped 5 families slug→ledger row: Combobox→B2/P-multi, Pagination→B3/P-range-date, Tooltip→B5/P-overlay, Toggle→B1/P-scalar, Accordion→B2/P-multi — all real assignable rows matching live coverage statuses (styled-and-usable / supported-direct-composition). `PinInput/RatingGroup/TimeRangeField` appear ONLY in the X row (single grep hit, matrix line 263).
- **C3 — counterexample hunt: NO COUNTEREXAMPLE FOUND.** No value-state family is assigned composition-only (collapsible's value loop is explicitly required; Toggle→B1 P-scalar; slider/meter/pagination→B3). No family is claimed by two batches contradictorily (Tabs `C → B2/B5` is an explicit dual-mode split; Toggle vs ToggleGroup are distinct rows). Pre-existing trace-cell tensions recorded as F-3.

### D. F4 ownership vs founder authoring

- **D1 — U3 evidence claims true: PASS.** Read the actual bytes: `StatusExtension.svelte` imports **`StatusBadge` from `@victframework/ui-svelte`** (public export, index.ts:18) and wraps it; `FeedbackExtension.svelte` wraps public **`Feedback`** (index.ts:19); `ButtonExtension.svelte` wraps public **`Button`** (index.ts:17). `extensions.ts` registers `ext.status` rev1/`impl.vict.status`, `ext.feedback` rev1/`impl.vict.feedback`, `ext.button` rev1/`impl.vict.button.submit` — exactly as §4.0 claims. Authored instances verified: `documents.ts:523–531` = `ext('n.cardSeverity','ext.status',…)` with nested conditional `tone` expressions; `documents.ts:666` = `ext('n.feedback','ext.feedback',…)`.
- **D2 — roadmap completeness: PASS.** §4.0 table (StatusBadge/Feedback/Button) gives extension route + what-works evidence + not-yet-editable + proposed surface per component; bullets cover RecordsTable (config `UiTableIntent`, `RecordsTable.svelte:9–33`), Chart, Conversation, DataView/List/Detail, Form family, AppShell, Text/Count. Everything is **PENDING** (owner decision / pending investigation / pending owner authorization); the ownership statement says "an agent-selected boundary is not owner acceptance".
- **D3 — residual blanket overclaims: PASS.** Greps for "by boundary decision"/"permanent non-goal"/"recorded non-goal": the only hit is §4.0's own sentence explaining the correction. No residual overclaim anywhere.
- **D4 — matrix A-row split: PASS.** Intent row keeps application-plan ownership (plan config canonical, P3, Studio edit = PENDING owner decision); display row records the evidenced extension route for StatusBadge/Feedback, Text/Count pending investigation, editor depth explicitly "not a batch claim". Consistent with amendment §10.4 (VitApp in the intent list, display-three mount note) and recalibration A-1…A-9 row.
- **D5 — apps/studio untouched and not authorized: PASS.** Diff contains no apps/studio paths; §4.0 ends "`apps/studio` work remains outside this task"; §13.1 prompt ends "No … apps/studio integration".

### E. Cross-cutting

- **E1 — §13.1 post-repair prompt: PASS WITH FINDINGS (F-1, F-2).** Internally consistent with §10.1a (all eight boundaries + the one guard + values.ts + reference-only rule enumerated as B1 obligations), §10.4 (B1 lands vocabulary+plumbing; founder proofs limited to B1 rows), recalibration §7 (SCOPE LIMIT paragraph names collapsible and all B2–B5 rows as retaining later obligations). The seven frozen U4 criteria (U4-01…07, handoff §2 mapping untouched) plus packaging repair F3, packed-artifact isolation, preview/production parity, bundle separation, unfamiliar-agent exercise, walkthrough, and founder checkpoint are all present in the prompt; DECISIONS' preservation claim is true. §12.2 is retitled "SUPERSEDED … retained visibly; the CURRENT prompt is §13.1" and §13.1 declares itself to supersede every earlier B1 wording — single current prompt achieved.
- **E2 — STATE/DECISIONS coherence: PASS.** STATE honestly records the repair as in-progress with "Superseding freeze to follow review"; DECISIONS adds a dated F1–F4 entry matching the actual diffs. No contradictory status. Minor notes: F-5, F-9.
- **E3 — frozen bytes: PASS.** All five freeze/review documents + abi-probe/* blob-identical between b05d016 and 009befe (paths verified to exist in both commits).
- **E4 — new-claim scan: PASS.** Every checkable claim in the diff was probed: source cites (7/7 exact), U3 evidence (exact lines), probe outputs (byte-identical), fixture payloads (agree), matrix/ledger coherence (script + manual), coverage↔ledger (independent spot check). The unsupported-as-of-today item is the freeze pin in §13.1 — recorded as F-1.

## 3. Findings

| # | Severity | Finding | User effect |
| --- | --- | --- | --- |
| F-1 | **MINOR** | §13.1's authority pin — "the payload SHA recorded in docs/ui-foundation/U4-CATALOG-RECALIBRATION-FREEZE.md" — is stale the moment the candidate lands: the freeze still records pre-repair hashes (recalibration `ca0bc6e4…`, amendment `b3e68055…`), while the worktree files now hash `776ae661…` / `2909a235…` (verified by sha256sum). The candidate's STATE sequences the superseding freeze before any authorization, and the repo convention is a NEW file per freeze (FREEZE → FREEZE-02 → RECALIBRATION-FREEZE), so if the next freeze is a new record the prompt's pointer will name a stale one. | Fail-closed confusion only: authorizing B1 before the re-freeze fails the pin check; no silent hazard. Action: update the §13.1 pointer (or re-pin in place) during the announced superseding freeze. |
| F-2 | **MINOR** | §13.1(6) requires runtime negatives "now including … mixed members", but the frozen `invalid-cases-recal.json` has six cases and mixed array members is NOT among them (stringList payload→string state, isoDate non-ISO, null member, date-range start>end, numberList payload→number state, isoTime out-of-range). B1 must either extend the fixture (frozen bytes → needs re-pin at the superseding freeze) or carry it as batch-test evidence; the prompt doesn't say which. | Possible gate-time dispute about where the mixed-members negative must live; resolvable at re-freeze. |
| F-3 | **MINOR (pre-existing)** | Trace tail-cells not reconciled with the ledger: S-1's "E — B1 proves" lists "collapsible open" among instances while collapsible's ledger row is B5 (coherent via the capability-vs-family reading + §7's explicit re-run of the S-1 loop, but imprecise); D-1's "rows authored in B1/B4" vs AlertDialog/Popover/Tooltip/LinkPreview assigned B5. Both rows pre-date the repair (untouched by this diff); the reconciliation script checks coverage↔ledger only, not trace↔ledger. | A reader could mis-assign family proof timing; ledger + honesty rules remain authoritative, so no claim is enabled early. |
| F-4 | **MINOR** | In reuse-matrix §6, the inserted reconciliation prose splits the ledger table: the two P3/display rows (lines 273–274) now follow a paragraph with no header/separator and will not render as a table (GitHub requires a delimiter row). Content stays machine-reconcilable (script passes) and readable as text. | Cosmetic/rendering only. |
| F-5 | INFO | Handoff §13 intro (~line 408) still lists "Feedback family" in the application-plan-governed enumeration without §4.0's already-document-mounted nuance. Reconcilable (governed AND extension-mountable; the matrix itself equates P3 with the extension route), but the summary wasn't refreshed. | None; authoritative docs agree. |
| F-6 | INFO | Two of the six negative-compile annotations don't match the error TS actually reports: `[null]` fails against the `number[]` union member (`Type 'null' is not assignable to type 'number'`) though annotated as string[]; `stateDecl.initial = null` fails first via `readonly`. All six DO fail strict compilation, so the contract's claim stands. | None; annotation precision only. |
| F-7 | INFO | The diff contains one path outside docs/ui-foundation: root `.prettierignore` (+2 lines ignoring the two new evidence dirs — same pattern as the pre-existing u3-experience/abi-probe ignores). The "13 paths all docs/ui-foundation" framing is therefore imprecise; the change itself is mechanical support for verbatim evidence import. | None. |
| F-8 | INFO | VitApp (the plan renderer) has no §4.0 roadmap bullet; it is consistently covered as plan-governed in A-1…A-9, §7, and the matrix, and as a renderer rather than a config surface its omission is defensible. | None. |
| F-9 | INFO | STATE retains the pre-repair "Next authorized action: owner decision on batch B1 (handoff §13.1 prompt)" line directly above the repair paragraph that re-sequences to "Superseding freeze to follow review"; chronological reading resolves it. | None. |

## 4. Evidence index

- Reruns: F2 probe output byte-identical to `docs/ui-foundation/reviews/u4/validator-probe/output.txt`; F3 reconcile output byte-identical to `docs/ui-foundation/reviews/u4/ledger-reconciliation/output-after-repair.txt`; strict tsc clean on `f1-signatures.ts`; 6/6 negative variants fail tsc.
- Source cites verified: `packages/ui/src/validate.ts:378–400`, `packages/ui/src/document.ts:135–152`, `packages/ui-svelte/src/document/DocumentHost.svelte:29/69/95`, `packages/ui-editor/src/EditorCanvas.svelte:27`, `packages/ui-svelte/src/index.ts:17–19`, `examples/ui-authoring-proof/src/lib/product/extensions.ts`, `extensions/{Status,Feedback,Button}Extension.svelte`, `documents.ts:523–531,666`.
- Frozen-byte verification and hash comparison commands recorded in §1 and F-1.
- No repo bytes were modified; all review scratch files live outside the repository.

## 5. Verdict

All four repair findings (F1–F4) are genuinely repaired with accurate cites, reproducible evidence, and no residual contradictions; the negative cases I constructed did not break any claim. Remaining findings are two process-timing MINORs that resolve at the already-sequenced superseding freeze, plus cosmetic/imprecision notes.

U4 CATALOG REPAIR REVIEW R1: PASS WITH NON-BLOCKING FINDINGS
