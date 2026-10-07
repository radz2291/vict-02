# U4 Amendment Freeze Check — FREEZE-CHECK-01

Checker: fresh verifier, independent of both the payload authors and the contract reviewer. READ-ONLY — no files in the repo were modified.

Worktree: `C:/Users/RZ1/Desktop/RZ/vict-02-u4-handoff`
Branch under test: `codex/ui-foundation-u4-component-amendment`
HEAD tested: `62ce2c85c87e559187f2f78b4d8031cee89136dc` (62ce2c8)
Working tree at check time: CLEAN (`git status --porcelain` empty)
Freeze record under test: `docs/ui-foundation/U4-AMENDMENT-FREEZE.md`
Payload commit pinned: `68e166f3eeb27657ff5b28e21c255960256ccdc6`

## Step results

### Step 1 — Orientation: PASS
- Branch is `codex/ui-foundation-u4-component-amendment`; HEAD is `62ce2c8`; working tree clean.

### Step 2 — Nine per-file SHA-256 pins: PASS
All nine pins reproduce from the payload commit (`git show 68e166f:<path> | sha256sum`) AND the live worktree bytes (`sha256sum <path>`) equal the same pin:

| Path | Pin reproduced at 68e166f | Live worktree |
| --- | --- | --- |
| docs/ui-foundation/U4-COMPONENT-AMENDMENT.md | c3d048d8…e3d720f | MATCH |
| docs/ui-foundation/fixtures/component-contract/README.md | ca15aea8…daebc2 | MATCH |
| docs/ui-foundation/fixtures/component-contract/checkbox-valid.json | f3e6010d…16f8fc85 | MATCH |
| docs/ui-foundation/fixtures/component-contract/select-valid.json | 4d20631c…81c47e2 | MATCH |
| docs/ui-foundation/fixtures/component-contract/button-action.json | e412f5d6…d610a94 | MATCH |
| docs/ui-foundation/fixtures/component-contract/dialog-slot.json | 56e22748…18929acb | MATCH |
| docs/ui-foundation/fixtures/component-contract/appshell-content.json | 57a86d00…833122a5 | MATCH |
| docs/ui-foundation/fixtures/component-contract/invalid-cases.json | bcd5f4d0…1bf87466 | MATCH |
| docs/ui-foundation/fixtures/component-contract/render-failures.json | d484dcad…e45f58738 | MATCH |

(Full hashes compared verbatim in the check run; all 18 comparisons exact.)

### Step 3 — Payload commit is an empty marker; parent carries the payload: PASS
- `git diff-tree --no-commit-id --name-only -r 68e166f` → EMPTY (no files changed).
- Tree hashes identical: `68e166f^{tree}` = `a765352^{tree}` = `d4a5a551ca0eed559c5a4142f41aa88dcff3f24e`.
- Parent `68e166f^` = `a7653521b08482ea50ad9e102412628ec4d832b5`; all nine payload paths at `a765352` hash to the same nine pins.

### Step 4 — Freeze lineage SHAs exist; chain order: PASS
All eight SHAs exist (`git cat-file -t` = commit): `62ce2c8`, `68e166f`, `a765352`, `d78a309`, `8cc0a97`, `d84035a`, `9c31fae`, `cfbd6d3`.
First-parent log (newest first): 62ce2c8 → 68e166f → a765352 → d78a309 → d84035a → 9c31fae → cfbd6d3 — matches the expected lineage.
Note (consistent, not a defect): `8cc0a97` is NOT in the first-parent chain — it is the round-2 candidate superseded mid-verification by `d78a309`; it exists as a commit object with the same subject, exactly as the lineage describes.

### Step 5 — Scope: PASS
`git diff --stat cfbd6d3..62ce2c8` = 17 files, ALL under `docs/ui-foundation/**` (including `docs/ui-foundation/reviews/u4/**`). Filter for paths outside `^(docs/ui-foundation/|reviews/u4/)` → NONE. No `packages/`, `examples/`, `scripts/`, or `apps/` changes in the freeze lineage.

### Step 6 — Supersedes/governing statement: PASS
- `docs/ui-foundation/U4-HANDOFF.md` §12.1 is headed "12.1 SUPERSEDED — the original prompt (kept so it can never be reused)" with an explicit callout: "SUPERSEDED by §12.2 — do not use… Any authorization quoting this text authorizes an insufficient scope."
- §12.2 is headed "12.2 CURRENT — the amended prompt (pinned to the amendment)" and pins authorization to `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` (`vict.ui-component-abi@1`) "payload commit SHA recorded in docs/ui-foundation/U4-AMENDMENT-FREEZE.md".
- Frozen U0 authority `9ec87f3e7eb8eb7793f972111258940aac635346` exists (commit) and its `docs/ui-foundation/STAGES-AND-VERIFICATION.md` contains all seven STAGES §6 criteria U4-01 (Packaging), U4-02 (Independent consumer), U4-03 (Build parity), U4-04 (Agent speed), U4-05 (Complete walkthrough), U4-06 (Handoff), U4-07 (Final gate).
- Supplementary (stronger than asked): the seven U4 criteria table rows are byte-identical between `9ec87f3` and the live HEAD worktree file.

### Step 7 — Review lineage + imported report integrity: PASS
- §3 lineage SHAs exist as commits: `9c31fae` (round 1, FAIL), `d84035a` (round-1 repairs), `8cc0a97` → `d78a309` (round 2), `d78a309` (round 3 PASS).
- `docs/ui-foundation/reviews/u4/U4-AMENDMENT-REVIEW-01.md` exists (189 lines); full-file sha256 = `34506ab95bf0ea58c77c66293ba22933e7961b9843b0fbebc7cb93a8ec4d9a01` (matches freeze record §3).
- Round-1 section = first 118 lines; `head -n 118 | sha256sum` = `9ce2267c55e3382f0865dec099b236836512c32858b2912ad10560471e83b933` (matches).
- Byte-proof beyond hash: the file as originally delivered at `d84035a` (118 added lines) hashes to the same `9ce2267…`, and `cmp` of that original against the first 118 lines at HEAD reports IDENTICAL.

### Step 8 — `.gitattributes`: PASS
`docs/ui-foundation/reviews/u4/.gitattributes` at HEAD carries BOTH `-text` lines:
- `U4-HANDOFF-REVIEW-01.md -text`
- `U4-AMENDMENT-REVIEW-01.md -text`

## Findings
- No blockers. No out-of-scope bytes. No pin mismatch. No lineage gap.
- Note N-A (non-blocking, informational): the freeze record's status line still reads "FROZEN (candidate 68e166f…, pending independent freeze-check)"; §4 states the checker's verdict is to be appended "at the final records commit". That append is a write to the repo and therefore out of scope for this read-only check; the recording builder should append this verdict to complete the freeze.

## Verdict

All eight steps PASS. The amendment freeze pins, payload emptiness, scope, lineage, supersedes markers, frozen U0 authority, review-report integrity, and `.gitattributes` preservation all reproduce exactly.

U4 AMENDMENT FREEZE CHECK: VERIFIED
