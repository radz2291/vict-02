# U4 ROUND-5 INDEPENDENT COMBINED GATE — TECHNICAL FALSIFICATION (fresh reviewer)

- Reviewer: independent fresh verifier (vict-verifier); authored NO part of this candidate.
- Date of review run: 2026-10-13 (single session).
- **Candidate under review (pinned): `fe800369968489390428d3be7808b0799f9d944d`** on `codex/ui-foundation-u4-combined-verify-05`, worktree `C:/Users/RZ1/Desktop/RZ/vict-02-u4-combined-verify-05`.
- Evidence tip stated by the task: `60b95e6ed222684a8720f5ec59def960a5c4c583`.
- Owner-UI parents: `954f93ffa70b34abe7f72c4bee04474bdd751aea`, `e1ab78a`; verification parent `143ffc431f1f88b74795a91d9ed5bd031758c4cc`; common base `32d8465aa9c810e4285995549a562957c85d2e36`.

## Environment caveat (read first)

The worktree is SHARED. During my run:
- HEAD moved `60b95e6` → `ea6c6e2` ("Round 5 records", committed 04:39:46 +0800, mid-session; docs + 2 PNGs only — no code).
- A concurrent cold-start reviewer left uncommitted artifacts (6 modified `browser-r5/*.png`, modified `examples/u4-consumer/pack-manifest.json`, untracked `U4-R5-COMBINED-COLDSTART-GATE.md`). Those artifacts are NOT my evidence and I did not use them.
- I created five temporary adversarial probe files inside the repo, ran them, and DELETED them; `git status` before my probe insertion and after my cleanup showed only the concurrent reviewer's files. I repaired nothing.

All code-review sections (1–3) were performed against content that is identical for the candidate: `60b95e6` and `ea6c6e2` touch no `packages/` or `examples/` code EXCEPT the one exception proved in section 3-A (`StateValuesPanel.svelte` + its test in `60b95e6`, which is precisely the finding).

---

## 1. LINEAGE — VERIFIED

- `git merge-base --is-ancestor`: `954f93f` IS ancestor of `fe80036`; `143ffc4` IS ancestor of `fe80036`; `32d8465` IS ancestor of both parents and `merge-base(954f93f, 143ffc4) = 32d8465`. Integration merge `4e2e4fe` preserves both parents.
- No rewrites: `fe80036` and `60b95e6` are ancestors of remote tip `ea6c6e2` (fast-forward only); `954f93f` is the tip of `origin/codex/ui-foundation-u4-full-catalog-repair-03`; both source commits reachable from their published branches.
- Corrected tests + historical oracles survive at `fe80036` (verified by `git cat-file -e`): `historical/state-values-panel-numeric-list-v1.historical.ts`, `inspector-slot-owned-label.svelte.test.ts`, `probe-accordion-label.test.ts`, `probe-command-label-search.test.ts`, `probe-host-isolation.test.ts`, extended `state-values-panel-numeric-list.svelte.test.ts`.

## 2. OWNER-UI DIFF (32d8465a → 954f93f) — VERIFIED TRUTHFUL

Exactly 13 files; mapping against report section 23b checks out file-by-file:
1. Combobox placement: `.vict-combobox-control` wrapper, arrow in `aria-hidden` span, `padding-inline-end: 52px` (B2Combobox.svelte + catalog.css). ✔
2. Decision-area layout: `decision-actions` flex row gap 12px moved into the corrections panel (operations.ts). ✔
3. Popover layout: `vict-catalog-overlay-header` (title + ✕) and `vict-catalog-popover-body` (B5Popover.svelte). ✔
4. Dialog layout: header wrapper; overlay/content z-indexes via `calc(var(--vict-catalog-layer,…))` (CatalogDialog.svelte + catalog.css). ✔
5. Stable buttons: `.vict-action-control` flex-column wrapper; feedback beside button; per-view/global feedback de-duplicated (`globalFeedback=false` for schedule) (CatalogButton/B5ToolbarButton + operations.ts). ✔
6. Portal layering: new `portal-layer.ts` (Svelte-context Symbol), `CatalogPortal` stamps `--vict-catalog-layer: layer*100` (CatalogPortal.svelte). ✔
7. Page-position preservation: `strategy="fixed"` on menu contents (B4MenuSub, B4MenubarMenu), `catalogMenuOpenFocus` (preventScroll) + `catalogFocusReturn` (focus-return.ts). ✔
Plus selection-outline scoping and mobile responsive rules in catalog.css/styles.css as claimed. No silent substitution found.

## 3. VERIFIER-MADE REPAIRS (4e2e4fe → fe80036) — reviewed for falsification

### 3-A) F17 Add-refusal — **FALSIFIED AT THE CANDIDATE (blocker-class finding)**

Claims (report 23c; DECISIONS-AND-EVIDENCE round-5 bullets): "Add refuses while the visible draft is invalid (a stale valid prefix cannot commit behind the user's back)" and "All results below were produced from the exact committed tree fe80036".

Facts:
- At `fe80036`, `StateValuesPanel.svelte` contains **no `invalidDraft` state** (0 occurrences) and `addListItem` has **no refusal** — it reads `listDraft` directly.
- The refusal mechanism (+6 lines) AND the oracle strengthening that pins it (+8/−4: typed valid `1` first, then badInput, then Add) were committed AFTER the candidate, inside the evidence-labeled commit `60b95e6` ("Round 5 evidence: focused checks 10/10, journeys 50/50, records reconciled") — which does not disclose a code repair.
- Independent demonstration (reviewer-authored probe `R5ADV-badinput.svelte.test.ts`, stale-prefix attack):
  - **At `fe80036` (temp worktree at the exact SHA, junctioned node_modules): FAIL** — `AssertionError: stale valid prefix must NOT commit: expected [ { key: 'weights', value: [ 1, 3 ] } ] to have a length of +0 but got 1`. Add committed the stale `3` while the visible draft showed the invalid-input error.
  - At `60b95e6` (worktree tree): PASS — refusal works.
- The other two legs of F17 (scalar badInput never seeds/clears; deliberate empty clears) ARE present at `fe80036` and pass my probes.
- The battery count 3119/0/3 at `fe80036` remains plausible: the test version AT `fe80036` does not exercise the stale-prefix path (that strengthening is also post-candidate), so it passes without the refusal. The falsified artifact is the CONTRACT CLAIM, not the count.

Severity: BLOCKER for the gate as presented — a claimed repair behavior is absent from the pinned candidate and the missing piece is hidden in an "evidence" commit, undisclosed. User effect: an operator who types a valid number, then invalid text (or a paste that Chrome rejects), sees "Enter a valid number.", presses Add, and the stale valid number is silently committed — exactly the class of behind-the-back commit the record claims is impossible.

Required remedy (for the owner to choose): re-pin the candidate to include the refusal (e.g. fold `60b95e6`'s `StateValuesPanel.svelte` + test delta into a new candidate commit), OR correct sections 23c/23d and the round-5 decisions to state that Add-refusal ships only at the evidence tip. Either way the "exact committed tree fe80036" provenance sentence must be corrected.

### 3-B) F14 (root build adds ui-editor + ui-preview) — VERIFIED
Root `package.json` build chain ends `… && build -w @victframework/ui-editor && build -w @victframework/ui-preview`. Matches claim; no other script semantics changed.

### 3-C) F15 (Inspector slot-owned annotation, 16 ids) — VERIFIED
`SLOT_OWNED_LABEL` table = exactly 16 descriptor ids; note rendered only when the owning slot exists and has `children.length > 0`; text matches the record. Non-label props never annotated. Two adjacent undisclosed-but-harmless type-guard edits rode along in Inspector.svelte (`originLabel`/`display` null-guards) — non-blocking, noted for disclosure hygiene.

### 3-D) F16 (B2Accordion aria-label) — VERIFIED
Both single and multiple `Accordion.Root` get `aria-label={groupLabel}`; `groupLabel` is `undefined` for empty/non-string labels → attribute omitted (Svelte drops undefined attrs).

### 3-E) README rewrite — VERIFIED
Stale round-1 FAIL status removed; five hard requirements documented incl. fresh-checkout build (F14). Matches claims.

### 3-F) Undisclosed edit bundled in the repair commit — NON-BLOCKING FINDING
`Layers.svelte` changed beyond F14–F17 disclosure: `rowKeys[index] ?? `${index}`` fallback (behavior change for repeat rows whose key resolves to `undefined` — now keyed by index instead of "undefined") and an `out[start]` guard. Likely typecheck hardening; should have been listed in 23e.

### 3-G) Historical preservation — VERIFIED
`historical/state-values-panel-numeric-list-v1.historical.ts` reproduces the round-4 test body verbatim (mechanical diff: only header/comment lines differ) plus two appended round-5 simulated-badInput tests. No test was weakened; superseded assertions survive.

## 4. BATTERY — OBSERVED (at tree `60b95e6`, worktree)

- Full `npm test`: **3118 passed / 1 failed / 3 skipped (3122)** in 415.5s.
- The 1 failure: `scripts/test/release-authority.test.mjs` › "oidc-release publish refuses an unauthorized source before the pack-dir check" — **timeout at 5000ms** (file total 279s under parallel load; real-child-process git-fixture class).
- Isolated re-run of that file: **65/65 PASS** in 228.5s.
- Both facts reported as instructed. Classification: load-flake consistent with the flake class the record itself documents for real-child-process fixtures; not evidence against the candidate. Expected 3119/0/3 is consistent with an uncontended run (the +1 vs my count is precisely the flaked file).

## 5. ADVERSARIAL PROBES (reviewer-authored; run at tree `60b95e6`, deleted after)

| # | Probe | Result |
| --- | --- | --- |
| 1 | Portal depth: select-in-dialog strictly deeper than dialog; layer = depth×100 | **PASS** (select 200 > dialog 100; listbox lives in the deepest layered portal) |
| 1b | Portal depth: dialog vs page-level popover | **FINDING (non-blocking)**: both depth 100 — sibling page-level portals share depth; ordering between them falls to DOM append order. Not a claimed behavior (owner issue 6 concerns dropdowns *inside* dialogs, which holds). Worth an owner note: a page popover opened while a modal dialog is open would paint above it. |
| 2 | Accordion aria-label: set / empty / unset / non-string (single + multiple) | **PASS** (6/6 assertions; empty ⇒ no attribute, no `aria-label=""`) |
| 3 | Inspector slot-note: filled → annotation naming the slot; unfilled → none; non-label prop → none; id outside the 16-table → none | **PASS** (4/4; exercised on `vict.catalog.select-item` — a different id than the committed oracle's `command.item` — plus `vict.catalog.button` control) |
| 4 | badInput scalar: error + no onChange + stored value kept | **PASS** |
| 4b | badInput list stale-prefix attack | **PASS at 60b95e6; FAIL at fe80036** → see section 3-A |
| 4c | Deliberate empty (badInput false) clears scalar | **PASS** |
| 5 | Undo/redo across an authored component label (bridge+session): undo restores, redo re-applies, digest round-trips | **PASS** |

Totals: 12 probes; 12/12 pass at the evidence tip; 11/12 pass at the pinned candidate (the stale-prefix probe is the falsifier). Logs: temp session logs (`/tmp` session dir): `adv-svelte.log`, `adv-editor.log`, `adv-portal.log`, `adv-badinput-at-candidate.log`.

## 6. PACKED CLOSURE — INCOMPLETE EVIDENCE (environment)

- `node scripts/pack-u4-consumer.mjs` attempted TWICE; both failed at step 1 with `EBUSY: resource busy or locked, rmdir 'C:\Users\RZ1\Desktop\RZ\u4-consumer-isolated\u4-consumer'` (exit 1).
- Cause: the concurrent cold-start reviewer's vite preview server holds the isolated dir (port `5460 LISTENING`, PID 64628 at time of both attempts; 5450 free).
- I did NOT kill the foreign process and did NOT adopt the concurrent reviewer's `pack-manifest.json` as evidence. Verdict for my run: **INCOMPLETE (timeout/environment)** — not a pass, not a fail. An uncontended re-run is required to close this leg.

---

## Per-section verdicts

| Section | Verdict |
| --- | --- |
| 1. Lineage | VERIFIED |
| 2. Owner-UI 13-file diff vs 23b | VERIFIED (truthful) |
| 3. Repairs F14/F15/F16 + README | VERIFIED |
| 3-A. F17 Add-refusal at candidate | **FALSIFIED** (blocker-class) |
| 3-F/G. Disclosure hygiene / historical | NON-BLOCKING FINDINGS / VERIFIED |
| 4. Battery | 3118/1/3 observed; failed file 65/65 isolated (load-flake) |
| 5. Adversarial probes | 12/12 pass at evidence tip; 11/12 at candidate (the falsifier) |
| 6. Packed closure | INCOMPLETE (EBUSY, concurrent reviewer holds port 5460 / isolated dir) |

## GATE VERDICT: **FAIL**

Scope of the FAIL: exactly one claim — "Add refuses while the visible draft is invalid / a stale valid prefix cannot commit behind the user's back" as an F17 repair property of candidate `fe80036` (report 23c; round-5 decisions; and the 23d provenance sentence "produced from the exact committed tree fe80036" insofar as it presents that behavior as candidate behavior). Everything else I could test verified, and the missing behavior demonstrably exists one commit later in an evidence-labeled commit. This is a candidate-boundary/record-truthfulness defect, not a defect in the repair itself. The packed-closure leg remains INCOMPLETE on my side (environment) and must be re-run uncontended; a corrected re-pinned candidate should clear both in one round.

Reviewer integrity notes: I repaired nothing; the only repo file I created is this report; my five probe files were created, executed, and deleted (pre/post `git status` clean of my artifacts); no pushes; no real orders; no secrets. The concurrent reviewer's uncommitted files were left untouched.
