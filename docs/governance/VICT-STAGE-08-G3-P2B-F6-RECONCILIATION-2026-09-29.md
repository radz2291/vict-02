# Stage 8 G3 — Bounded F6 Reconciliation Against the Published `0.4.0-rc.1` Interfaces (2026-09-29)

> **Document type:** reconciliation evidence record (owner directive,
> 2026-09-29) + precise limitation + proposed contract amendment for owner
> decision. Companion: `VICT-STAGE-08-G3-VERSION-DISPOSITION-2026-09-29.md`
> (owner's version selection), `VICT-STAGE-08-G3-P2B-RC1-FRESH-PROOF-2026-09-29.md`.
> **G3 remains HELD. No Verified claim. The literal F6 clause B outcome
> below is FAIL — not passed by any redefinition of "everything else."**

## 1. Builder Kit prerelease-version fix — durable mainline + regression test

- The fix previously disclosed as bounded correction `a9bc53b4` (on the
  `d7bd0030` snapshot) is now landed on the **mainline source**: commit
  `5a82273` ("fix(builder-kit): accept semver prerelease versions in
  recorded release-set ids") + mechanical pack-layer regeneration
  `fa8937c`; pushed to `origin/main` (`fa8937c`) and to the durable
  branch `pi/builder-kit-prerelease-release-id`.
- `extractRecordedSetVersion()` now accepts a semver prerelease suffix
  (semver §9) and fails closed (null) on partial versions/junk.
- **Regression tests** (`packages/builder-kit/test/release-set-version.test.ts`,
  4 cases): `vict-release-set@1/0.3.1 → '0.3.1'` AND
  `vict-release-set@1/0.4.0-rc.1 → '0.4.0-rc.1'`, additional prerelease
  shapes, and fail-closed rejections. All pass; `verify:builder-kit`
  **18/18** on the merged mainline.
- **Kit artifact reproduced** from the mainline source without touching
  any published platform package (the kit is not a release-set member; no
  publish performed): `victframework-builder-kit-0.1.0.tgz`, SHA-256
  `fa7cea378fe95901d3a3409ce89edcca68f144f65d29e9223e8c1bb17cb52fca`
  (source `fa8937c`). Distinct from, and superseding for future use, the
  snapshot-corrected artifact `9d20e1c7…` (`d7bd0030 + a9bc53b4`); the
  pristine `d7bd0030` artifact remains `c3df869f…` as recorded.
- Pre-existing mainline drift (not caused by, and not worsened by, this
  work) is fixed by the mechanical regeneration commit: `verify:builder-kit`
  on clean main failed `pack:regenerate-compare [content-drift]` +
  `pack:renderings [generated-artifact-drift]` because the release-exec
  commits changed `docs/RELEASE-COMPATIBILITY.md` without regenerating
  the committed pack layer; the diff is exactly that input sha + derived
  packId + the two renderings.

## 2. Bounded reconciliation of the TaskLedger app (feedback-driven, disclosed)

One evaluator-driven correction commit on top of the PRESERVED first-
session commit: **`0e6735a`** (parent `c6bb365`, first-session evidence
untouched; reconciled bundle
`taskledger-rc1-reconciled.bundle` SHA-256 `97a780d5…`).

1. **Identity re-scaffold:** the scaffold was regenerated with the
   intended app identity (`TaskLedger`) using the PUBLISHED
   `scaffolder@0.4.0-rc.1` + explicit release-set (14 × `0.4.0-rc.1`).
   README and the generated `<title>` already carried the intended
   identity in the builder's app; `package.json` now matches the
   scaffold bytes with EXACTLY ONE addition — the kit verification tool
   as a devDependency (`file:tools/…tgz`, a build tool, not a set
   member).
2. **Completions chart → built-in surface (island REMOVED).** The shipped
   grammar CAN express the chart without a custom island: the built-in
   `role:'chart'` surface aggregates view rows by `xField` and SUMS
   `yField` per bucket (`chartPoints`, ui-svelte `presentation.ts`;
   `Chart.svelte` ships the accessible data-table disclosure). The
   completion-event rows already carried the day bucket (`completedDay`);
   the reconciliation adds the per-event weight `count: 1`
   (contract-enforced exactly-1, resource field catalogue + revision 2,
   contract `event.create` revision 2) and swaps the dashboard island for
   `{ role: 'chart', viewId: 'v.completionEvents', kind: 'bar',
   xField: 'completedDay', yField: 'count' }`. The registry now registers
   exactly two components: `cmp.priority-badge@1`, `cmp.task-edit-link@1`.
   **Disclosed deltas:** the island version windowed to the last 14 days;
   the built-in chart has no windowing field in the 0.4.0 surface
   grammar, so the chart plots the whole declared view and the title
   drops "(last 14 days)". Legacy pre-`count` event rows aggregate as
   zero (data continuity note; a production migration would backfill).
3. **Compile diagnostics learned (disclosed):** the first cut was
   rejected by the runtime plan compiler (`UNKNOWN_FIELD` — `yField` and
   view fields must exist in the resource's declared field catalogue);
   fixed by declaring the `count` field. The correction commit is
   amended to a single commit; the intermediate 500 was diagnosed and
   fixed within the round, never shipped.

## 3. Re-verification of the resulting commit `0e6735a`

- `npm run build` exit 0; tests **26/26** (incl. a new `count` rejection
  case); `verify --app` **5/5**.
- **Application identity `v1_ecb2b4e7…`** — verified live AND stable
  across a content-identical rebuild and across the package.json
  normalization (F8 PASS for this commit).
- **Real-browser ladder (both widths), all green:** table mounts; search
  Smoke→2 / zzq→0 / cleared; title sort asc↔desc with `aria-sort`;
  semantic priority sort; pagination roundtrip; dialog create (invalid →
  validation; valid → persisted 58→59); prefilled edit → saved →
  persisted; row Complete through the declared surface; badge island
  styled in cells. **Built-in chart verified live:** renders with the
  accessible data-table disclosure; after governed completions it shows
  exactly `2026-09-29 | 4` (count-weighted buckets; screenshot
  `17-phone-chart-builtin.png`).
- **F5 raw probe:** undeclared-field request →
  `{"ok":false,"code":"CONTRACT_REJECTED","message":"The action input was
  rejected by contract 'task.complete@1'; no run or mutation was
  performed.","fieldErrors":{"escalate":"…"}}`; tasks/completion_events/
  runs/events/activations digests **byte-identical** before/after
  (`f5-raw-ledger-*-f6recon.txt`); valid control `ok:true`; replay fails
  closed (`ACTION_FAILED`, safe generic failure).
- **F7:** hard kill (connection-refused verified) → restart → all six
  state digests byte-identical.
- **Negative controls:** brief content drift → `[content-drift]` red →
  restore → green; base-pack tamper → `[pack-tamper]` red → restore →
  5/5 green.

## 4. Literal F6 evaluation of `0e6735a`, clause by clause

- **Clause A — the badge is a versioned registered island:** **PASS.**
  `cmp.priority-badge@1` registered, definition-allowlisted, rendered as
  an island cell in the built-in table's priority column.
- **Clause C — generated host files not hand-edited:** **PASS on
  substance, one recorded tool addition.** All 13 generated host files
  are byte-IDENTICAL to the fresh intended-identity scaffold
  (`scaffold-host-diff-f6recon.txt`); `package.json` differs by exactly
  one line — the kit verification tool devDependency (build tooling, not
  application or host content). Recorded for the owner's calibration;
  no functional host byte was touched.
- **Clause B — everything else definition-driven, with the badge as the
  ONLY custom island:** **FAIL, literally.** The completions chart was
  eliminated (§2.2) and table/forms/count/status are definition-driven
  built-ins — but **two registered islands remain**: the sanctioned
  badge AND the **edit-link cell**. No redefinition of "everything else"
  is applied: the edit-link island is a custom component inside the
  table's definition-driven cell grammar, and clause B counts islands.

## 5. Precise limitation (why clause B cannot be met with published interfaces)

In the shipped `0.4.0-rc.1` packages, the table grammar offers exactly
two cell renderings — the row field as plain text, or a registered
versioned island (`UiTableIntent.columns[].component`, `@victframework/ui`
`dist/index.d.ts`). `rowAction` is dispatch-only (`actionId`, `label`,
`input` — no navigation and no form-opening variant). Screen-level
navigation exists only in the shell menu (`UiShellLink`). Therefore a
**row-scoped link to a record-edit route — or any per-row navigation —
cannot be expressed definition-only**: reaching an individual record's
edit screen REQUIRES either an island cell (current app) or giving up
per-row navigation entirely (the F2 edit criterion requires record
editing, so the island cannot simply be dropped).

## 6. Proposed contract amendment (for owner decision; NOT implemented)

Additive, backward-compatible extension of the table surface grammar:

- **Option A (cell link):** `columns[].link: { routeId: string,
  paramField: string, label?: string }` — the plan compiler validates the
  route and field; the renderer renders a built-in anchor navigating to
  the declared route with the row field substituted for the route param.
- **Option B (row navigation):** `rowNavigation: { routeId: string,
  paramField: string }` alongside `rowAction` — the row action navigates
  instead of dispatching.

Either option removes the last non-sanctioned island from this
application class using platform-owned, definition-driven behavior. If
the owner amends the contract, the reconciliation to a literal clause-B
pass is a small definition-only change (drop the island, declare the
link/navigation) followed by the same verification ladder.

**Stop point per directive:** literal F6 clause B cannot be met with the
published `0.4.0-rc.1` interfaces; this record stops here with the
limitation and the amendment proposal for the owner's decision. The
complete G3 package (release verification, kit fix, fresh builder proof,
reconciliation, and this limitation) is ready for independent G4 audit.
G3 is not marked passed; Stage 8 is not marked Verified.
