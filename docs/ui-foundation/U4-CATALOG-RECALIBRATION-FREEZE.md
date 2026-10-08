# U4 catalog recalibration freeze record — SUPERSEDING (owner decision 8)

Status: **SUPERSEDES the scope of
[U4-AMENDMENT-FREEZE-02](U4-AMENDMENT-FREEZE-02.md) — FROZEN, VERIFIED**
(payload `52684696…`; independent freeze-check
`U4 CATALOG RECALIBRATION FREEZE CHECK 03: VERIFIED`, §6 below). Runtime/U4
implementation remains UNAUTHORIZED; this record freezes the **contract**
(the recalibrated authoring contract and its batch plan) only.

## 1. Why this record supersedes the second freeze's scope

The owner clarified (decision 8,
[DECISIONS-AND-EVIDENCE](DECISIONS-AND-EVIDENCE.md)) that the UI library
is much richer than the amendment's five compositions and required a
full-catalog architecture and delivery plan: all 41 recorded families
reconciled with the 38 exported recipe modules, the higher-level public
components inventoried, capability described at family-and-mode level,
the authoring contract challenged against that inventory, and delivery
recalibrated into explicit batches. The outcome:

- [U4-CATALOG-RECALIBRATION](U4-CATALOG-RECALIBRATION.md) — the
  inventory (value shapes cited from the pinned `bits-ui@2.19.3`
  typings, the recorded showcase, and `catalog.test.ts`), the
  capability-by-capability contract trace with the five-way status
  (expressible / implemented / demonstrated / missing / deferred), the
  smallest-coherent design (one additive `UiValueType` union), the
  batch plan B1–B5 with B1 recommended first, package ownership, and
  evidence limits.
- Amendment §10 — the contract extension: `UiValueType`
  (`stringList`/`numberList`/`isoDate`/`isoTime`), dual-scalar date
  ranges, empty-value conventions, the item/panel content authoring
  rule, and the compatibility gate re-checked family-agnostically (no
  new gate logic; schema strings unchanged; one new diagnostic code,
  `UI_DOC_INVALID_LITERAL`).
- Four new contract fixtures (three positive, six negative cases) —
  §4 below.
- The standing per-family-and-mode ledger (reuse matrix §6) with the
  honesty rules: a batch PASS proves only its rows.

What is NOT superseded: the frozen contract mechanics (ABI marker gate,
output binding path, identity/revision pinning, failure model,
preserved guarantees, the seven U4 criteria) — all restated as governing
in recalibration §6.7 and amendment §10. The application-surface
boundary (RecordsTable, Chart, Conversation, Form, … remain
application-plan governed; P3 their in-document route) and the three
deferred families (pin-input, rating-group, time-range-field) are
recorded decisions, revisitable only with new evidence and owner
authority.

## 2. Superseded payloads — preserved, not erased

- Second freeze: payload `460d9632eeb6e1eb7eb57c10458562158236baa9`
  (amendment WITHOUT §10 + the original nine fixtures) — unchanged,
  pins in [U4-AMENDMENT-FREEZE-02](U4-AMENDMENT-FREEZE-02.md) continue
  to reproduce there; its verdict line remains valid for the bytes it
  froze.
- First freeze: payload `68e166f3eeb27657ff5b28e21c255960256ccdc6` —
  unchanged, preserved.
- Superseded authority chain: `cfbd6d3…` → first-freeze lineage →
  `24347a0…` → repair cycle `0ad3a2a…`/`9f5acdd…`/`10f2cbc…` → payload
  `460d963…` → `08cfe28…`/`7a9477f…`.

## 3. Frozen payload (current authority for the recalibrated contract)

Payload commit (tree-exact, immutable candidate): **`52684696aaeee03324e37c4c19da5de696fd32bc`**
on `codex/ui-foundation-u4-catalog-recalibration` (empty marker commit;
the payload paths above it are byte-exact as pinned).

| Path | SHA-256 (at `52684696…`) |
| --- | --- |
| `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` | `b3e68055fb15313043aa60e1fd80790226aed98cb7990407c30b243092372e80` |
| `docs/ui-foundation/U4-CATALOG-RECALIBRATION.md` | `ca0bc6e4f2574b82614f28dfa7c7ff96c9e150604a2bcf4934f996d8049c5cb5` |
| `docs/ui-foundation/fixtures/component-contract/README.md` | `ff07540e4c8e8d892e0046aa5bc53854f668361ab04c5e9968911621bbcea4a8` |
| `docs/ui-foundation/fixtures/component-contract/multiselect-binding.json` | `cf8268daece4186f29bb1c226fd4bb2d60475ab938b941d3cb356d4b52e050bb` |
| `docs/ui-foundation/fixtures/component-contract/date-field-binding.json` | `04ea8cbf3f8b46041c551980ba04a58499c541c41bc6749c03ec083e6285c70b` |
| `docs/ui-foundation/fixtures/component-contract/slider-range-binding.json` | `6951c8e3fd9880178bda48bdbab6ef33c7739ddf859e68570ee56a7e5903ce02` |
| `docs/ui-foundation/fixtures/component-contract/invalid-cases-recal.json` | `d6d552f77f2724d0b3bc9a5d81dcfab54ac1b944c46ebe592403934f08e4cc96` |

(The nine original fixture files are NOT re-pinned here — their bytes are
unchanged from `460d963…` and remain governed by FREEZE-02's pins; the
checker verifies that preservation.)

## 4. Review lineage (independent reviewer; authored none of the payload)

| Round | Candidate | Verdict | Repairs |
| --- | --- | --- | --- |
| R1 | `087d41e…` | **PASS WITH NON-BLOCKING FINDINGS** (9 findings: F-1 prose bucket list; F-2 stale cites; F-3 slider single/multi value shapes; F-4 checkbox ledger tension; F-5 F3 pointer; F-6 new-code naming; F-7 item-content scope drift; F-8/F-9 nits) | `cf2edd3…` (all nine) |
| R1 round 2 (affected recheck) | `cf2edd3…` | **PASS WITH NON-BLOCKING FINDINGS** (8/9 verified; F-5′ ambiguous pointer persisted; delta clean, no regressions) | `7829411…` (F-5′ pointer named its document; cosmetic span) |

Report imported verbatim (R1 rounds 1–2):
[reviews/u4/U4-RECALIBRATION-REVIEW-01.md](reviews/u4/U4-RECALIBRATION-REVIEW-01.md)
— round-1 sha256
`8a6bc5627e2fb95f5807869ef710af161a8c2a18e990c7fdc5fa50ad5f357d84`.
The two post-recheck changes (pointer wording + line-break in a code
span) are applied in the frozen bytes; the freeze check below explicitly
covers them.

## 5. Coverage obligations and evidence limits (binding for every batch)

- The ledger (reuse matrix §6) is the only place a family/mode may be
  claimed authoring-supported; claims require that batch's recorded
  end-to-end evidence (edit → Inspector → undo/redo → save → reload →
  finished app, same control). A batch report claiming beyond its rows
  is a finding.
- Everything in the recalibration document and amendment §10 is
  contract-stage: unimplemented. Value-shape evidence is
  declarations/showcase/tests, never runtime authoring proof. Batches
  must demonstrate library-level keyboard/focus/portal behaviors, not
  assume them. A `bits-ui` upgrade voids cited shapes until
  re-verified.
- Deferred (X): pin-input, rating-group, time-range-field.
  Application-surface components: application-plan governed (P3).

## 6. Freeze check (separate fresh checker) — VERIFIED

Checker independent of the payload authors and the R1 reviewer, all
evidence byte-derived. Full report imported verbatim:
[reviews/u4/FREEZE-CHECK-03.md](reviews/u4/FREEZE-CHECK-03.md) (sha256
`b60a6041c03ac2f25a9bb1763935c48f1d32718a1949d46fd300d5953dd5ed3e`),
ending **`U4 CATALOG RECALIBRATION FREEZE CHECK 03: VERIFIED`** at pinned
HEAD `3da34cd…`. All ten steps passed: (1–2) all seven SHA-256 pins
reproduce from the payload commit AND live bytes (14/14, both methods);
(3) `52684696…` is an empty marker whose parent carries the pinned bytes;
(4) preservation — FREEZE-02's ten pins all reproduce from `460d963…`
(amendment pin `b0b782ba…` there, `b3e68055…` here: supersession as
claimed), `68e166f…` reachable, the eight original fixtures byte-identical
`460d963…→HEAD`, and all preservation artifacts blob-identical from last
touch through HEAD (import-blob deltas are the recorded pre-base lineage,
all ancestors of the branch base); (5–6) spine ancestry in record order;
diff `7a9477f…→3da34cd…` = 14 paths, all docs/ui-foundation; (7) R1
report prefix hashes to `8a6bc562…` and the file ends with the round-2
verdict, `-text` confirmed; (8) both post-recheck changes present; (9)
static contract checks — schema strings unchanged, ABI marker present in
the frozen amendment bytes, four fixtures parse with abi + marker +
non-empty outputs, six negative cases with diagnostics, and 0 occurrences
of `UI_DOC_INVALID_LITERAL` in `packages/ui/src/diagnostics.ts` (the
new-code claim); (10) STATE/DECISIONS consistent, no contradictory
status.
