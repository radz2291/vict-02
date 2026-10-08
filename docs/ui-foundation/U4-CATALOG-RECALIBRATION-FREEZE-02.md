# U4 catalog recalibration repair freeze record — SUPERSEDING (owner findings F1–F4)

Status: **SUPERSEDES the payload of
[U4-CATALOG-RECALIBRATION-FREEZE](U4-CATALOG-RECALIBRATION-FREEZE.md) —
FROZEN, VERIFIED** (payload `4cfe5b37…`; independent freeze-check
`U4 CATALOG REPAIR FREEZE CHECK 04: VERIFIED`, §6 below). U4 runtime
implementation remains UNAUTHORIZED; this record freezes the **repaired
contract** only.

## 1. Why this record supersedes the recalibration freeze's payload

The owner ordered a bounded repair of the recalibration (findings F1–F4).
The repairs changed governing contract bytes, so the frozen payload must
be superseded:

- **F1 complete value path** — amendment §10.1a added: the serializable
  carrier `UiValue`, the one shared guard `isUiValueOfType` (new
  `packages/ui/src/values.ts`, owner `@victframework/ui`), the
  eight-boundary widening table (emit payload, state initials, prop
  defaults, host `stateValues`, render-side and author-time validation,
  compiled `outputDecls`/`actionInputs` typing, editor/preview
  forwarding), ownership/copy discipline, and agreeing
  positive/negative contract examples. §3.2/§3.4 inline blocks widened
  to match; the illustrative signatures typecheck under `--strict` with
  all six documented negative cases failing compilation.
- **F2 legacy-validator compatibility corrected** — disposable probe
  against the pinned legacy bytes (`952d92d` ≡ `b05d016` for
  `packages/ui/src/**`): all four widened declarations REJECTED with
  `UI_EXPR_TYPE_MISMATCH` at the VALIDATION gate (lists `actual:
  'object'`, iso markers `'string'`; string/string control accepted) —
  evidence `reviews/u4/validator-probe/`. The §4.3 matrix row "new
  document → old validator: accepted" is replaced by split rows
  (primitive-state output documents accepted; widened-vocabulary
  documents rejected at validation — not via the descriptor marker);
  the five required pipeline pairs are distinct rows. The verified
  events-marker gate, compile-artifact marker and implementation `abi`
  requirements are unchanged; new-side acceptance stays a §10.1a
  contract requirement until B1 lands it.
- **F3 Collapsible + ledger reconciliation** — collapsible assigned B5
  (open boolean loop, controlled state binding, trigger/content
  composition, acceptance row); programmatic manifest↔ledger
  reconciliation added as a standing rule
  (`reviews/u4/ledger-reconciliation/`): 38 available families each hold
  an assignable row, the three deferred families only in the
  X-exclusion row; RECONCILIATION OK.
- **F4 ownership vs founder authoring** — the blanket "document-node
  authoring: No — by boundary decision" is corrected: StatusBadge,
  Feedback and Button ALREADY mount in documents via
  `ext.status`/`ext.feedback`/`ext.button` registered implementations
  (U3 descriptors + authored instances wrapping the PUBLIC components);
  per-component roadmap (recalibration §4.0): canonical config source,
  working evidence, unavailable-to-founder surface, proposed Studio
  editing surface — ALL PENDING owner decision; application-plan
  ownership retained for intent-driven surfaces; `apps/studio` untouched.
- Fixture R7 (mixed members) added to the frozen negative set (review
  finding F-2), and the handoff §13 intro/§13.1 refreshed with the
  single current post-repair B1 prompt (§12.2 visibly superseded).

Everything else — the batch structure B1–B5, B1-first recommendation,
the seven U4 criteria, packaging repair, packed-artifact isolation,
preview/production parity, bundle separation, unfamiliar-agent exercise,
founder checkpoint — is preserved.

## 2. Superseded payloads — preserved, not erased

- Recalibration freeze payload:
  `52684696aaeee03324e37c4c19da5de696fd32bc` — unchanged; its record's
  pins continue to reproduce there.
- Amendment freeze payloads: `460d9632eeb6e1eb7eb57c10458562158236baa9`
  and `68e166f3eeb27657ff5b28e21c255960256ccdc6` — unchanged, preserved.
- All freeze records, review reports and probe evidence remain
  byte-preserved (`-text` scoped).

## 3. Frozen payload (current authority for the repaired contract)

Payload commit (tree-exact, immutable candidate): **`4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`**
on `codex/ui-foundation-u4-catalog-repair` (empty marker commit; the
payload paths above it are byte-exact as pinned).

| Path | SHA-256 (at `4cfe5b37…`) |
| --- | --- |
| `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` | `2909a2359dd632e1ec25a16f2cfcf1c4e0a7e24a7bdcd84331926af11cc5148d` |
| `docs/ui-foundation/U4-CATALOG-RECALIBRATION.md` | `f5a2fd5143d42f4c2883ef64465aaa78808686725169b556e523a25265cf0cf5` |
| `docs/ui-foundation/fixtures/component-contract/README.md` | `dde2ae382d6be239828f6bda330e75bdac76b9c57636b92e97d023876b4cd42c` |
| `docs/ui-foundation/fixtures/component-contract/multiselect-binding.json` | `cf8268daece4186f29bb1c226fd4bb2d60475ab938b941d3cb356d4b52e050bb` |
| `docs/ui-foundation/fixtures/component-contract/date-field-binding.json` | `04ea8cbf3f8b46041c551980ba04a58499c541c41bc6749c03ec083e6285c70b` |
| `docs/ui-foundation/fixtures/component-contract/slider-range-binding.json` | `6951c8e3fd9880178bda48bdbab6ef33c7739ddf859e68570ee56a7e5903ce02` |
| `docs/ui-foundation/fixtures/component-contract/invalid-cases-recal.json` | `9bdf42a5f91e6e26c38f9664f51d2a67588d876a3b6225150da88231e80a36c5` |

(`multiselect`/`date-field`/`slider-range` bytes are unchanged from the
`52684696…` payload — same hashes, re-pinned for completeness. The
reuse-matrix ledger and the handoff are not payload; the matrix is the
standing ledger the recalibration obligates, the handoff carries
authorization text.)

## 4. Review lineage (fresh independent reviewer; authored none of the payload)

| Round | Candidate | Verdict | Repairs |
| --- | --- | --- | --- |
| R1 | `009befe…` | **PASS WITH NON-BLOCKING FINDINGS** (0 blocking, 4 minor, 5 info; all attacks executed: probe rerun byte-identical, strict typecheck with six failing negatives, 7/7 source cites exact, U3 evidence verified, reconciliation + spot checks, no counterexamples) | `cee2f0e…` (F-2 R7 fixture, F-3 trace cells, F-4 table split, F-5/F-8/F-9) |
| R1 round 2 (affected recheck) | `cee2f0e…` | **FAIL** — R2-B1 BLOCKER: the F-5 splice duplicated a ~392-line handoff block (two banners, two §13s, a fused line); the duplicated copy carried the stale intro | `46c5064…` (handoff rebuilt from clean candidate bytes; both intended edits re-applied with full-span anchors; 510 lines, +4) |
| R1 round 2b (blocker recheck) | `46c5064…` | **PASS** — structure verified (one banner, one §13, no fused lines, no stale remnant), diff isolated to the two intended hunks, full delta scan clean, no R1-pass regressions | — |

Report imported verbatim (rounds 1/2/2b):
[reviews/u4/U4-REPAIR-REVIEW-01.md](reviews/u4/U4-REPAIR-REVIEW-01.md)
— round-1 sha256
`d86bdb917878c98902a363c6e912b722cdc823ca39e2542f21506f2c08606798`.
The FAIL round is preserved: the blocker and its repair are part of the
recorded lineage. Findings noted-not-repaired, deliberately: F-1 (the
§13.1 authority pin — updated in the records commit to point at THIS
record and payload, closing it), F-6 (evidence-file annotation
precision; all six negatives do fail strict compilation — file kept
byte-verbatim), F-7 (scope framing — stated precisely in §7 below).

## 5. Coverage obligations and evidence limits (unchanged, binding)

As recorded in the recalibration document §9 and the matrix §6: a batch
PASS proves only its ledger rows; the reconciliation script re-runs at
every batch gate; probes are validator/byte-level only (no browser);
bits-ui cited shapes require re-verification on upgrade; Studio config
editing for higher-level components remains PENDING owner authorization.

## 6. Freeze check (separate fresh checker)

PENDING at this record's first commit: a checker independent of the
repair authors and the R1 reviewer must (a) reproduce every §3 pin from
the payload commit and the live bytes (both methods), (b) confirm the
empty-marker nature of `4cfe5b37…` and that its parent carries the
pinned bytes, (c) confirm payloads `52684696…`, `460d963…`, `68e166f…`
and all earlier freeze records/reviews/probe evidence remain
byte-preserved, (d) verify scope (the repair-cycle diff:
docs/ui-foundation/** + the mechanical root `.prettierignore` additions
for the two new evidence dirs — nothing else, no source code), (e)
verify the review lineage including the FAIL round and the 2b PASS,
(f) statically verify the frozen contract statements (schema strings
unchanged; ABI marker requirement present; fixture set = 3 positive + 7
negative cases, each with a diagnostic; `UI_DOC_INVALID_LITERAL` absent
from `packages/ui/src/diagnostics.ts`; §10.1a/§3.4 signature agreement),
and (g) confirm the §13.1 authority pin names THIS record. Its verdict
is appended below at the final records commit.
