# Stage 8 G3 — Final Handoff for the Independent G4 Auditor (2026-09-29)

> **Document type:** handoff record prepared for the independent G4 audit
> per the frozen contract §5.1/§22.3/§27.3. Prepared by the implementer
> workstream; **no G4 audit is performed here and no Verified claim is
> made.** Stage 8 closure belongs to the owner together with the
> independent audit.

## 1. What the G3 proof demonstrates — three-way distinction

### 1.1 Demonstrated behavior (re-derivable by the auditor)

Against the independently verified published set
`vict-release-set@1/0.4.0-rc.1` (14 members; content ID
`v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399`):

- **F1 PASS** — build/run from an empty project through the published
  scaffolder + kit; generic one-route host; no hand-written shells.
- **F2 PASS** — create/edit through DECLARED forms (`f.createTask`,
  `f.updateTask`) validated at the declared contract crossing.
- **F3 PASS** — the built-in definition-driven table surface
  (`role:'table'`, `queryActionId`, `searchFields`, pageSize 8) mounts
  and works at 390×844 and 1366×768: search (subset / empty-with-
  declared-message / cleared), sort asc↔desc with `aria-sort`, semantic
  priority ordering, pagination with zero overlap, row completion
  through the declared `rowAction`.
- **F4 PASS on the demonstrated point** — dashboard `role:'count'` +
  built-in `role:'chart'` with accessible data-table disclosure,
  reflecting persisted completions via count-weighted day buckets
  (verified live: `2026-09-29 | 4`).
- **F5 PASS** — raw `/api/act` with undeclared fields →
  `CONTRACT_REJECTED` with **byte-identical** state (tasks, completion
  events, runs, events, activations); valid control durable; replay
  fails closed.
- **F6 clause A PASS, clause C PASS** (see 1.2 for clause B) — badge is
  a versioned registered island; generated host files byte-identical to
  a fresh intended-identity scaffold except exactly one tool line.
- **F7 PASS** — hard kill + restart: all six state digests
  byte-identical.
- **F8 PASS** — application identity `v1_ecb2b4e7…` stable across
  content-identical rebuilds.
- **Negative controls** — brief drift and pack tamper both fail closed
  and restore to 5/5 green.
- **Builder-session integrity** — fresh isolated session (flags
  `-p -nc -ns -ne -np`), transcript preserved and audited clean; two
  external process kills resumed same-session (disclosed); correction
  history fully recorded, including failures.

### 1.2 Accepted exception (owner decision D-6; literal result remains FAIL)

- **F6 clause B: FAIL literally** — two registered islands exist
  (`cmp.priority-badge@1`, `cmp.task-edit-link@1`); the original wording
  allows only the badge. **Not relabeled.**
- The **edit-link island is accepted by the owner as a known exception**
  (`VICT-STAGE-08-G3-OWNER-DISPOSITION-F6-EXCEPTION-2026-09-29.md`):
  row navigation only; owns no task data; owns no governed action.
  Finding class: **deferred** to the future formal UI track.
- **Future UI track (no Stage 8 work):** a definition-driven table-cell
  link (`columns[].link` or `rowNavigation`) — amendment proposal in the
  reconciliation record §6. No UI patch, no new release in Stage 8.

### 1.3 Unresolved limitation (retained; brief NOT satisfied on this point)

- **Chart 14-day window (D-7):** the built-in chart surface has no
  windowing field; the app charts the whole declared view and drops the
  "(last 14 days)" qualifier. **The brief is not satisfied on the
  14-day-windowing point.** Related data note: legacy pre-`count` event
  rows aggregate as zero buckets (backfill would be a production
  migration; disclosed, not performed).
- Other recorded observations for the audit's attention: `/favicon.ico`
  404 (cosmetic); `ACTION_FAILED` generic replay failure vs the 0.3.1
  app's specific `ALREADY_COMPLETE` (safe-failure difference); two
  pre-existing `tsc --noEmit` strict errors in the generated host that
  no toolchain checks (builder-reported, forwardable); `verify:builder-kit`
  docs stale-drift class on the mainline was fixed mechanically in
  `fa8937c` and remains a recurring obligation on input changes.

## 2. Exact SHAs (authoritative chain)

| Item | SHA-256 / commit |
| --- | --- |
| Governance evidence-chain HEAD (main) | `fb15a6f` |
| Kit mainline fix | `5a82273` (+ mechanical regen `fa8937c`) |
| Kit durable branch | `pi/builder-kit-prerelease-release-id` |
| Kit artifact, mainline source | `fa7cea378fe95901d3a3409ce89edcca68f144f65d29e9223e8c1bb17cb52fca` |
| Kit snapshot-corrected artifact (`d7bd0030` + `a9bc53b4`) | `9d20e1c74ad9c8448cd01bc7ef412166f12e485f6d30222fc18d94db7407cd0e` |
| Kit pristine artifact (`d7bd0030`, incompatible with prerelease sets) | `c3df869f54f07da9996274ea114d9ded3f9c2f5003918ed4d6795bed62e78018` |
| Builder app, first session (preserved) | `c6bb365` (commits `474a9b2`, `9550725`, `e10ba9c`, `e4f469b`, `c6bb365`) |
| Builder app, reconciliation | `0e6735a` (branch `eval/f6-reconciliation`) |
| App bundle, first session | `taskledger-rc1.bundle` `0d44135c5652e2dc…` |
| App bundle, reconciled | `taskledger-rc1-reconciled.bundle` `97a780d57d40a5f4…` |
| Builder RESULT document | `faeb0471ba28f671…` |
| Builder transcript (297 records) | `0fd7b872f21623c0…` |
| Pinned brief | `046558c9f99a05b6…` |
| Pinned rubric (recovered byte-exact) | `b7531d5b621bc670…` |
| Release artifact zip (run 36427806906) | `40fb2ff615c5ce21d04a36efd2e692cf0898cc88ab218d4d3e0755481eaca1c5` |
| Published set content ID | `v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399` |
| Application identity | `v1_ecb2b4e7f9503639de2dd6d2ed3a5a8f36497771a28aeaa669fef12c809b0bd8` |
| Frozen entry contract | `ba3fde1b51e9…` (untouched) |
| Frozen handoff | `4aa83c1510fa…` (untouched) |

## 3. Evidence locations

- **VICT repo `main` @ `fb15a6f`** — `docs/governance/`:
  `VICT-STAGE-08-G3-P2B-RC1-FRESH-PROOF-2026-09-29.md` (fresh proof +
  comparison + proposal), `VICT-STAGE-08-G3-VERSION-DISPOSITION-2026-09-29.md`
  (owner version selection), `VICT-STAGE-08-G3-P2B-F6-RECONCILIATION-2026-09-29.md`
  (kit fix, reconciliation, literal F6 FAIL + amendment proposal),
  `VICT-STAGE-08-G3-OWNER-DISPOSITION-F6-EXCEPTION-2026-09-29.md`
  (D-6/D-7 owner decisions), plus the preserved 0.3.1 P2/P2B chain and
  `docs/RELEASE-EXEC-R2/R3-2026-09-28.md`.
- **`C:/Users/RZ1/Desktop/RZ/rc1-proof-artifacts/`** — app bundles
  (both), builder RESULT, transcript
  (`eval-rc1-builder-session/2026-09-28T14-40-34-155Z_01a0e875-df66-75d6-a43a-c987df77dfa1.jsonl`),
  18 browser screenshots + `browser-record/interaction-log-rc1.json`,
  F5 raw artifacts (`f5-raw-ledger-*.json/txt`, both rounds),
  F7 digests (both rounds), scaffold byte-compare records
  (`scaffold-host-diff-rc1.txt`, `scaffold-host-diff-f6recon.txt`),
  kit pack directories (`dist-kit*/` under the kit worktree, see §4).
- **`C:/Users/RZ1/AppData/Local/Temp/release-evidence/release-results.json`**
  + `C:/Users/RZ1/AppData/Local/Temp/rc1-verify/sweep-results.json` —
  release verification.
- **Builder app repo** — `C:/Users/RZ1/Desktop/taskledger-rc1-20260928`
  (branches `master` @ `c6bb365`, `eval/f6-reconciliation` @ `0e6735a`;
  vendored kit tool at `tools/…tgz` is tracked).

## 4. Reproduction commands (independent auditor)

**Release verification:**

```sh
# artifact + registry sweep + consumer (see fresh-proof record §1)
gh run download 36427806906 -n release-evidence   # or the API with auth
sha256sum release-evidence.zip                    # expect 40fb2ff6…
npm view @victframework/<pkg>@0.4.0-rc.1 dist.integrity   # ×14, vs sweep-results.json
npm run verify:release-consumer -- --registry     # from a clean VICT checkout
```

**Builder Kit fix + artifacts (no platform package is touched):**

```sh
git clone <VICT-REPO> && cd vict-02 && git checkout fa8937c
npm ci
npx vitest run packages/builder-kit/test/release-set-version.test.ts   # 4 tests: 0.3.1 + 0.4.0-rc.1 + shapes + fail-closed
npm run verify:builder-kit                                             # expect ALL CHECKS PASSED (18)
npm pack -w @victframework/builder-kit
sha256sum victframework-builder-kit-0.1.0.tgz                          # expect fa7cea37…
# snapshot-corrected artifact (historical): worktree d7bd0030 + branch pi/kit-rc1-release-id-fix (a9bc53b4) → pack → 9d20e1c7…
# pristine d7bd0030 artifact: pack WITHOUT the fix → c3df869f… (demonstrates release-identity-drift on rc sets)
```

**Application proof (from the reconciled bundle):**

```sh
git clone C:/Users/RZ1/Desktop/RZ/rc1-proof-artifacts/taskledger-rc1-reconciled.bundle app && cd app
git checkout 0e6735a && git verify-commit 2>/dev/null; git log --oneline   # expect 0e6735a on c6bb365
sha256sum taskledger-brief.txt                       # expect 046558c9…
npm ci
npm test                                             # expect 26/26
npm run build                                        # exit 0
npx vict-builder-kit verify --app                    # expect ALL CHECKS PASSED (5)
npx vite preview --port 47931 --strictPort           # then browser probes per fresh-proof record §5
# F5: POST /api/act act.completeTask with an undeclared field → CONTRACT_REJECTED; state digests byte-identical
# F7: kill the server PID; restart; recompute .data/*.sqlite digests → byte-identical
# F8: rebuild → applicationVersion v1_ecb2b4e7… unchanged
# Negative controls: edit taskledger-brief.txt → verify --app FAILs [content-drift]; tamper base-pack.json → [pack-tamper]
```

**Scaffold byte-compare:**

```sh
# regenerate a reference scaffold with the published scaffolder:
node <scaffolder>/dist/cli.js <out> TaskLedger taskledger --release-set release-set-0.4.0-rc.1.json
# diff the 13 host files against app @ 0e6735a → byte-identical; package.json → +1 kit devDependency line
```

## 5. Non-claims

- G3 is **HELD** pending the independent G4 audit; the accepted exception
  (D-6) scopes clause B but its literal FAIL stands.
- Stage 8 is **not Verified**; closure is G4 + owner only.
- No publication, tag movement, or production activation occurred or is
  authorized by any of this workstream's records.
- The chart 14-day limitation (D-7) means the brief is not fully
  satisfied on that point.
