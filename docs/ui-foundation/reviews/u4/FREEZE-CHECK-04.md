# U4 catalog recalibration REPAIR freeze check 04 (fresh independent verifier)

- **Role.** Independent fresh verifier. Not a repair author, not the R1/R2 reviewer. All
  conclusions derived from bytes and commands executed in this session; no prior review
  conclusion adopted.
- **Tested snapshot.** Worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u4-catalog-repair`,
  branch `codex/ui-foundation-u4-catalog-repair`, HEAD
  `75542949372463315b65676f67b88fa5fbe7e982` (verified via `git rev-parse`), working tree
  clean (`git status --porcelain` empty, re-confirmed after all checks). Repository left
  read-only: no file in the repo or worktree was modified; all rerun outputs went to temp
  paths.
- **Record under check.** `docs/ui-foundation/U4-CATALOG-RECALIBRATION-FREEZE-02.md`
  (pins payload `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`, seven per-file SHA-256 pins).
- **Method.** Bounded mechanical reproduction, per step, with negative attempts recorded.
  Environment: Windows, Git Bash, `sha256sum` + Python `hashlib` (byte-level), Node
  `JSON.parse`, git plumbing (`git show`/`diff`/`log --first-parent`/`ls-remote`/
  `check-attr`), `npx tsx`, `tsc --strict`.

## Step results

### Step 1 — Record read, pins extracted — PASS
Record at HEAD read in full. §3 pins exactly seven paths (amendment, recalibration,
README, multiselect/date-field/slider-range/invalid-cases-recal fixtures) at payload
`4cfe5b37…`. §6 enumerates the freeze-check obligations; this report discharges them.

### Step 2 — 14/14 pin reproductions — PASS
For each of the 7 paths: `git show 4cfe5b37:<path> | sha256sum` and `sha256sum` on the
live worktree bytes. All 14 digests equal the record's pins (amendment `2909a235…`,
recalibration `f5a2fd51…`, README `dde2ae38…`, multiselect `cf8268da…`, date-field
`04ea8cbf…`, slider-range `6951c8e3…`, invalid-cases-recal `9bdf42a5…`). Bonus: live
`HEAD` bytes also match all seven pins (no post-freeze drift).

### Step 3 — Empty marker commit — PASS
`git rev-parse 4cfe5b37^{tree}` = `6864063c905b9f48d7c3c41cb42a0d976fd0d3b8` =
`git rev-parse 4cfe5b37^^{tree}`; `git diff 46c5064..4cfe5b37` empty. Parent
`46c506400d67291634fc64c0d59ac515239dc8f1` carries the pinned bytes (spot-reproduced
amendment, invalid-cases-recal, README pins from the parent — identical).

### Step 4 — Preservation — PASS
- (a) All SEVEN pins from `U4-CATALOG-RECALIBRATION-FREEZE.md` reproduce from
  `52684696…` (amendment `b3e68055…`, recalibration `ca0bc6e4…`, README `ff07540e…`,
  multiselect/date-field/slider-range unchanged `cf82…/04ea…/6951…`, invalid-cases-recal
  `d6d552f7…`). The amendment pin `b3e68055…` reproduces from `52684696` and does NOT
  reproduce at `4cfe5b37` (bytes differ — expected supersession).
- (b) `460d9632…` and `68e166f3…` exist (`git cat-file -t` = commit), on
  `codex/ui-foundation-u4-component-amendment`, ancestors of HEAD.
- (c) multiselect/date-field/slider-range hashes IDENTICAL at `52684696` and
  `4cfe5b37`; amendment/recalibration/README/invalid-cases-recal hashes DIFFER.
  `invalid-cases-recal.json` structure = object with `cases` array: 6 cases at
  `52684696`, 7 at `4cfe5b37` (R7 mixed members added).
- (d) `U4-AMENDMENT-FREEZE.md`, `U4-AMENDMENT-FREEZE-02.md`,
  `U4-CATALOG-RECALIBRATION-FREEZE.md`, `reviews/u4/FREEZE-CHECK-01.md`,
  `FREEZE-CHECK-02.md`, `U4-AMENDMENT-REVIEW-01.md`, `U4-AMENDMENT-REVIEW-02.md`,
  `U4-RECALIBRATION-REVIEW-01.md` all blob-identical between `b05d016` and HEAD
  (`git rev-parse <commit>:<path>` equality); `reviews/u4/abi-probe/` trees identical
  (3 blobs). `git ls-remote origin codex/ui-foundation-u4-catalog-recalibration` =
  `b05d016d9e48bf301d5a5a4109936e6bf32fa690` = local `b05d016` exactly.

### Step 5 — Lineage — PASS
`git log --first-parent b05d016..HEAD` gives exactly:
`b05d016` → `009befe2bf65…` (candidate) → `cee2f0eb76b7…` (R1 repairs) →
`46c506400d67…` (R2-B1 blocker repair) → `4cfe5b373481…` (payload) →
`75542949372…` (records). Each commit's first parent is the previous one (checked
per-edge). All exist.

### Step 6 — Scope — PASS
`git diff --name-only b05d016..7554294` = 17 paths: 16 under `docs/ui-foundation/**`
(incl. the new `reviews/u4/validator-probe/` and `reviews/u4/ledger-reconciliation/`
evidence) + root `.prettierignore`. No source code. `.prettierignore` delta = exactly
two added lines: `docs/ui-foundation/reviews/u4/validator-probe/` and
`docs/ui-foundation/reviews/u4/ledger-reconciliation/` (matches record §7 / F-7
framing).

### Step 7 — Report integrity — PASS
- Full file `reviews/u4/U4-REPAIR-REVIEW-01.md` at HEAD sha256 =
  `4fb82541665e22533801e0baac893089f66f95f91546b1881a32943f0d08b0b4` (exact match).
- Round-1 byte prefix through the verdict line INCLUDING its terminating newline hashes
  to `d86bdb917878c98902a363c6e912b722cdc823ca39e2542f21506f2c08606798` (exact match).
  Falsification note: hashing WITHOUT the trailing newline gives `f0b1c353…` (mismatch);
  the pin is over "through the line" inclusive of `\n`. The verdict line occurs exactly
  once in the file.
- Round-2 section ends `U4 CATALOG REPAIR REVIEW R1 ROUND 2: FAIL` (preserved FAIL
  round; marker present, immediately followed by the "## R1 Round 2b" heading).
- File ends `U4 CATALOG REPAIR REVIEW R1 ROUND 2B: PASS` (rstrip-verified).
- `-text` attribute: `git check-attr -a` → `text: unset, eol: lf`; `reviews/u4/.gitattributes`
  at HEAD contains the explicit line `U4-REPAIR-REVIEW-01.md -text` — the `-text`
  declaration is present and effective (byte preservation without eol rewriting).
  Interp note: `check-attr` reports `text: unset` for an explicit `-text`; this is the
  correct manifestation, not an unspecified attribute.

### Step 8 — Probe evidence rerun — PASS
Rerun from `C:/Users/RZ1/Desktop/RZ/u4-f2-probe` (disposable harness; it imports the
worktree source, whose `packages/ui/src/**` is byte-identical to pinned legacy
`952d92d` ≡ `b05d016` — independently re-verified: `git diff --stat 952d92d b05d016 --
packages/ui/src/` empty).
- `npx tsx u4-f2-validator-probe.mjs` → exit 0; output BYTE-IDENTICAL to
  `reviews/u4/validator-probe/output.txt` (5 verdict lines: C0 string/string ACCEPTED;
  C1 stringList / C2 numberList / C3 isoDate / C4 isoTime all REJECTED with
  `UI_EXPR_TYPE_MISMATCH`, `actual: 'object'` / `'string'`; final `PROBE OK` line). No
  absolute paths appear in the output, so no normalization was needed.
- `node reconcile-ledger.mjs` → exit 0; output BYTE-IDENTICAL to
  `reviews/u4/ledger-reconciliation/output-after-repair.txt`; ends
  `RECONCILIATION OK: every available family has an explicit ledger assignment; the
  three deferred families remain named exclusions only`.
- Strict typecheck
  `../vict-02-u4-catalog-repair/node_modules/.bin/tsc --strict --noEmit --target es2022
  --module esnext --moduleResolution bundler f1-signatures.ts` → exit 0. Bounded extra
  falsification of the record's six-negative-cases claim: all six `negfull-*.ts`
  compile attempts FAIL (exit 2) — consistent with "each fails strict compilation".

### Step 9 — Static contract checks on frozen bytes (at `4cfe5b37`) — PASS
- (a) Amendment §10.1a present: `UiValue` union (l.744–745), `isUiValueOfType` guard
  (l.806), eight-boundary table (l.830–837, rows 1–8), ownership/copy discipline block
  (l.846–857: bridge copies at emit, host copies on seed/merge, replace-whole list
  state, JSON persistence) + agreeing positive/negative examples. §3.2
  `readonly payload: 'void' | UiValueType;` (l.172). §3.4
  `emit: (output: string, payload?: UiValue)` (l.295–298). §4.3: widened-vocabulary row
  `REJECTED, probe-verified` locating rejection at the VALIDATION gate (l.550, "before
  compile and before any descriptor resolution — NOT via the ABI descriptor marker");
  five distinct pipeline pairs as distinct rows (new output-enabled docs → old
  compiler; primitive-only new doc → old validator; widened-vocabulary new doc → old
  validator; new compiled instructions → old renderer; old compiled instructions → new
  renderer).
- (b) Schema-unchanged statements present (l.8–9, l.517–520) and match source constants
  exactly: `packages/ui/src/document.ts:11 UI_DOCUMENT_SCHEMA='vict.ui-document@1'`,
  `:12 UI_RENDER_PLAN_SCHEMA='vict.ui-render-plan@1'`.
- (c) ABI marker requirement present in frozen amendment bytes:
  `events: ['vict.ui-component-abi@1']` (l.193; also l.209, l.279, l.897).
- (d) Fixtures parse: 3 positive descriptors each with `abi: 'vict.ui-component-abi@1'`,
  `events: ['vict.ui-component-abi@1']`, non-empty outputs with widened payloads
  (`stringList`/`isoDate`/`numberList`). `invalid-cases-recal.json` = 7 cases R1–R7,
  each carrying a diagnostic (`UI_COMPONENT_BINDING_INCOMPATIBLE`,
  `UI_DOC_INVALID_LITERAL` ×3, `UI_COMPONENT_OUTPUT_PAYLOAD_INVALID`).
- (e) `packages/ui/src/diagnostics.ts`: 0 occurrences of `UI_DOC_INVALID_LITERAL`
  (grep count 0). Contract mentions are illustrative future-diagnostic names only.
- (f) Recalibration §6.1 references `UiValue` + `isUiValueOfType` (l.303–344); B5
  collapsible assignment present (recal l.538–552; matrix l.258 `C → B5`); matrix §6
  Collapsible row sits inside the contiguous ledger table (between DropdownMenu and
  Command rows, with the F3 annotation) and the programmatic-reconciliation prose
  ("standing rule … RECONCILIATION OK. Re-run at every batch gate.") follows AFTER the
  table.

### Step 10 — STATE / DECISIONS / §13.1 — PASS
- STATE: full verdict lineage recorded — "fresh R1 **PASS WNF** … -> round 2 **FAIL**
  (R2-B1 … preserved in the record) -> repairs -> round 2b **PASS**. FROZEN — VERIFIED
  (SUPERSEDING): repaired-contract payload `4cfe5b37…`, pins in
  U4-CATALOG-RECALIBRATION-FREEZE-02".
- DECISIONS-AND-EVIDENCE matches the same lineage and pins (`4cfe5b37…`, FREEZE-02,
  report sha `4fb82541…`, F-1 closure note).
- Handoff §13.1 (current authority prompt) names
  `docs/ui-foundation/U4-CATALOG-RECALIBRATION-FREEZE-02.md` + payload
  `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c` (l.448–449) — F-1 closed.
- §12.2 visibly SUPERSEDED ("retained visibly; the CURRENT prompt is §13.1"; "Do not
  authorize both"), §12.1 also superseded.
- Runtime: "U4 is NOT authorized and NOT started" (STATE l.9); freeze record: "U4
  runtime implementation remains UNAUTHORIZED". No contradictory current-authority
  claim found: no document presents `52684696` as current authority; the only "in
  progress" wording is inside the chronological narrative block that concludes with the
  FROZEN — VERIFIED status (see finding N-3).

## Falsification attempts (negative checks) and outcomes
1. Hashed the round-1 prefix WITHOUT the terminating newline → mismatch (`f0b1c353…`);
   resolved in the record's favor: the pin includes the line's `\n`. Documented to
   prevent future false-FAIL.
2. Searched for additional occurrences of the round-1 verdict line that could make the
   prefix ambiguous → exactly one occurrence.
3. Parsed `invalid-cases-recal.json` as a flat array → misleading count 3; correct
   structure is an object with a `cases` array (6 → 7 across payloads). Count claim
   verified against the real structure.
4. Tried to reproduce the OLD amendment pin `b3e68055…` at the NEW payload → absent
   (correct supersession; the bytes changed).
5. Checked `git diff` payload-vs-parent for hidden content → empty; tree hashes equal.
6. Compared live worktree bytes to payload pins for post-freeze drift → none.
7. Ran all six documented negative signature files under the strict typecheck → all
   fail (exit 2), as the record claims.
8. Ran `git ls-remote` for the repair branch → not present on origin (see N-1; not a
   step requirement).

## Findings
- **N-1 (note, no user effect now):** branch `codex/ui-foundation-u4-catalog-repair`
  (HEAD `7554294…`) is not yet on `origin`; only the base branch
  `codex/ui-foundation-u4-catalog-recalibration` (= `b05d016…`) is remote-verified.
  The step list required only the base identity. Per program rules the manager should
  commit/push the records + this imported evidence and remote-verify the resulting SHA
  before the gate is treated as pushed.
- **N-2 (note):** `git check-attr` renders the explicit `-text` declaration as
  `text: unset`; future checkers must read the `.gitattributes` line, not just the
  attr verb, to avoid a false negative on "‑text attr set". No defect.
- **N-3 (note):** STATE's repair block opens with "…in progress" (chronological
  append-log narrative) and concludes in the same block with "FROZEN — VERIFIED
  (SUPERSEDING)"; the terminal status is authoritative and no document contradicts it.
  No action required.
- **N-4 (note):** the validator-probe output contains no absolute paths, so the
  "paths may differ" caveat never triggered; comparison was byte-exact.

## Verdict
All ten steps PASS on independently reproduced evidence. No blocking or major finding.
Tested snapshot: `codex/ui-foundation-u4-catalog-repair` @
`75542949372463315b65676f67b88fa5fbe7e982`; payload `4cfe5b373481e29cff7d9bd02d9c473064a8aa9c`.

U4 CATALOG REPAIR FREEZE CHECK 04: VERIFIED
