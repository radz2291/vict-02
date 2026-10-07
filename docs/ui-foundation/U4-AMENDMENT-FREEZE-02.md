# U4 component-amendment freeze record — SUPERSEDING (repair cycle)

Status: **SUPERSEDES [U4-AMENDMENT-FREEZE](U4-AMENDMENT-FREEZE.md) — FROZEN,
VERIFIED** (payload `460d963…`; independent freeze-check
`U4 AMENDMENT FREEZE CHECK 02: VERIFIED`, §6 below). Runtime/U4
implementation remains UNAUTHORIZED; this record freezes the **contract**
only.

## 1. Why this record supersedes the first freeze

The first freeze (payload `68e166f3eeb27657ff5b28e21c255960256ccdc6`,
preserved byte-exact together with its record) claimed the compatibility
matrix row "New document → old renderer" was fail-closed via the
descriptor `abi` field. That claim was **false**: the owner-directed probe
(reviews/u4/abi-probe/, resolver-level, disposable external harness,
production files unmodified) reproduced against the exact
`952d92da5131d6ab595b45b3bf18bc7ce3b3466d` resolver bytes that
`resolveSvelteExtension` reads only `id`/`revision`/`events`/`slots`/
`rendererImplementationId` — the frozen fixture descriptor (`abi` +
`outputs`, no `events`/`slots`) is **ACCEPTED** with a matching
implementation, no diagnostic (probe case C1, 5/5 expectations met; the
committed harness is verbatim-rerunnable). The gate was therefore rebuilt
from verified legacy behavior: the ABI marker declared in `events` (the
field legacy consumers already fail close on), plus the compile-artifact
marker (`outputDecls` always emitted for abi@1 descriptors) and the
implementation `abi` field. Two adjacent specification defects were
repaired in the same cycle: the compiled-instruction `outputDecls` type
(corrected to the array type) and the action-input catalog ownership
(`deriveActionInputCatalog` + `compileUiDocument` catalogs option
`actionInputs` at the existing `packages/application/src/ui-attach.ts`
call site — explicitly part of the later U4 allowed scope).

## 2. Superseded payload — preserved, not erased

- Superseded payload commit: `68e166f3eeb27657ff5b28e21c255960256ccdc6`
  (unchanged; its bytes remain reproducible from that commit forever).
- Superseded freeze record: [U4-AMENDMENT-FREEZE](U4-AMENDMENT-FREEZE.md)
  — byte-preserved; its verdict line and history remain valid for the
  payload it froze, which this record withdraws as current authority.
- Superseded authority chain: prepared handoff `cfbd6d3…` → first
  candidate `9c31fae…` → `d84035a…` → `8cc0a97…`/`d78a309…` → `a765352…`
  → payload `68e166f…` → records `62ce2c8…`/`24347a0…`.

## 3. Frozen payload (current authority)

Payload commit (tree-exact, immutable candidate): **`460d9632eeb6e1eb7eb57c10458562158236baa9`**
on `codex/ui-foundation-u4-component-amendment` (empty marker commit; the
payload paths above it are byte-exact as pinned).

| Path | SHA-256 (at `460d963…`) |
| --- | --- |
| `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` | `b0b782ba3ace5321a0ca1b7cc17b6d80fe0d417e3f82b12d2d498df194a8b004` |
| `docs/ui-foundation/fixtures/component-contract/README.md` | `acde98701a108d01e46514be89de4cf5ab41d7b0ee007bc35edb8eae5783cd00` |
| `docs/ui-foundation/fixtures/component-contract/abi-compat-probe.json` | `cbaea2095a8e273844d909ff90f8c17a9379dda674780131350b590ae278aed1` |
| `docs/ui-foundation/fixtures/component-contract/checkbox-valid.json` | `69240cfd84f2e78fa4b3d3a31fc468ea1c5f069ac6b2663dca37a198b899dcc1` |
| `docs/ui-foundation/fixtures/component-contract/select-valid.json` | `892f4b8de426ef3737ea00094585aab361787213a162dc3c86ace210f0628594` |
| `docs/ui-foundation/fixtures/component-contract/button-action.json` | `7f7899edf90b585a68da410e6fdf7890fb9be3a8d629845627710c00411c20ac` |
| `docs/ui-foundation/fixtures/component-contract/dialog-slot.json` | `798b14dd210b3f2b3a1edafa08c51e90b8be6e757a64edf3136689163c2302ae` |
| `docs/ui-foundation/fixtures/component-contract/appshell-content.json` | `4446fb09abd09259cca0da2cf1cd159ad352cab37783c04f0e063650f7bc6638` |
| `docs/ui-foundation/fixtures/component-contract/invalid-cases.json` | `902f99a3d70dcda59f54634dcfd3c6f968221ab2a3b4262a1a9d8d288708b3d3` |
| `docs/ui-foundation/fixtures/component-contract/render-failures.json` | `2551588f3eda122bf0759eed6aeddcee8840e2601189f9110fafb0e52f884fcc` |

## 4. Repair-cycle review lineage (independent reviewer; authored none of the payload)

| Round | Candidate | Verdict | Repairs |
| --- | --- | --- | --- |
| R2 round 1 | `0ad3a2a…` | **PASS WITH NON-BLOCKING FINDINGS** (MINOR-1 harness not verbatim-rerunnable; MINOR-2 handoff pin supersession open; INFO-1/2/3) | `9f5acdd…` (MINOR-1 + infos; MINOR-2 closed by this supersede step) |
| R2 round 2 (affected recheck) | `9f5acdd…` | **PASS WITH NON-BLOCKING FINDINGS** (MINOR-1 proven: embedded descriptor deep-equal to the frozen bytes, verbatim rerun 5/5, output byte-identical; MINOR-2 confirmed open as scoped) | `10f2cbc…` (residual plural claims scoped; recheck section imported) |

Report imported verbatim (R2 rounds 1–2):
[reviews/u4/U4-AMENDMENT-REVIEW-02.md](reviews/u4/U4-AMENDMENT-REVIEW-02.md)
— round-1 sha256
`9f0423a1540f812a42858a411ea60818c0a2edb6e99377c23e56d31a47f00ff9`.
Probe evidence (verbatim bytes, `-text`-scoped):
[reviews/u4/abi-probe/](reviews/u4/abi-probe/) — harness, legacy resolver
extraction, recorded 5/5 output. The two post-recheck wording alignments
(plural → repo-scoped legacy consumer, §4.3 + fixtures README) are applied
in the frozen bytes; the freeze check below explicitly covers them.

## 5. What stays governing (unchanged from the first freeze)

All seven frozen U4 criteria (STAGES §6 at `9ec87f3…`); packaging /
packed-tarball isolation; public-export consumption; preview/production
parity; declared-action runtime authority and preview fencing; the
unfamiliar-agent exercise; the independent final gate; the founder
checkpoint; U0–U3 closure records; the authoring requirement (same-control
catalog journeys, no registered-component workaround return). U0–U3 remain
closed. Evidence limits for the compatibility claims are stated in the
amendment §4.3: the probe is resolver-level (not a browser rendering
test); new compiler/renderer rows are contract requirements until
implemented and have NOT been runtime-tested.

## 6. Freeze check (separate fresh checker) — VERIFIED

Checker independent of both the payload authors and the R2 reviewer, all
evidence byte-derived. Full report imported verbatim:
[reviews/u4/FREEZE-CHECK-02.md](reviews/u4/FREEZE-CHECK-02.md) (sha256
`1bb615841973d22b394054e18199b65bdd8eb86d66ec3e956275e67e1704baf2`), ending
**`U4 AMENDMENT FREEZE CHECK 02: VERIFIED`** at pinned HEAD `08cfe28…`. All
eleven steps passed: (1–2) all ten SHA-256 pins reproduce from the payload
commit AND live bytes (20/20, deterministic on a second pass); (3) `460d963…`
is an empty marker whose parent carries the pinned bytes; (4) the superseded
freeze artifacts are blob-identical at `24347a0…` and HEAD, and payload
`68e166f…` remains committed and reachable; (5) all 13 lineage SHAs exist
in record order; (6) scope `24347a0…→08cfe28…` touches only docs/
ui-foundation + .prettierignore — zero source paths; (7) probe evidence
integrity: legacy extraction byte-identical to the `952d92d…` resolver
bytes, recorded 5/5, checker's own temp-dir rerun reproduced
`probe-output.txt` byte-for-byte; (8) R2 report round-1 prefix hashes
to `9f0423a1…` and the file ends with the R2 round-2 verdict; (9) MINOR-2
closed — §12.2 pins `460d963…` via this SUPERSEDING record, no operative
`68e166f…` authority references remain; (10) repo-scoped wording and
annotations present; (11) all five `-text` lines present.
