# Stage 8 G3 — Supplemental Fresh P2 Proof Against the Published `0.4.0-rc.1` Release (2026-09-29)

> **Document type:** fresh-proof evidence record per the fresh-proof handoff
> (task 5 of the release-execution handoff) and the owner's directive.
> Companion records: `docs/RELEASE-EXEC-R2/R3-2026-09-28.md`,
> `VICT-STAGE-08-G3-P2-FRESH-PROOF-HANDOFF-2026-09-28.md` (corrected in this
> workstream — see §2). The frozen Stage 8 architecture (bytes
> `ba3fde1b…`), the frozen handoff (`4aa83c15…`), and ALL `0.3.1` P2
> evidence remain byte-for-byte untouched. **G3 remains HELD**; this record
> PROPOSES a separate owner disposition (§7) and makes no Verified claim.
> No publication was performed; no tags moved; no G4 start.

## 1. Independent release verification (evaluator, not trusting the run)

Workflow run [`36427806906`](https://github.com/radz2291/vict-02/actions/runs/36427806906),
artifact `release-evidence` (artifact id 10971793723), downloaded and
verified: **zip SHA-256 `40fb2ff6…` matches the R3-recorded digest
exactly.**

`release-results.json` contents verified: `sourceSha =
d7bd003047a648738a4d1d824b0c4e4a442c0da3`; release-set identity
`vict-release-set@1/0.4.0-rc.1`; contentId
`v1_2a70a29af12fa887d18e7099b027a11f86bd2f6a70a756446fb43844e41d9399` —
**independently recomputed** from the 14 `name@version` pairs ==
recorded; 14 members all `version 0.4.0-rc.1`, all `status: published`,
each with a sha512 `integrity`.

Independent registry sweep (fresh `npm view --prefer-online` + tarball
downloads): **14/14 present at `0.4.0-rc.1`; `vict-0.4.0-rc → 0.4.0-rc.1`
on all 14; every downloaded tarball's sha512 == the registry
`dist.integrity` == the artifact-recorded integrity; all internal
`@victframework/*` dependency pins exact `0.4.0-rc.1`.** `latest` states:
12 historical members at `0.3.1`; `ui`/`ui-svelte` at
`latest = 0.0.0-bootstrap.1` — **neither unoccupied, neither the
candidate** (corrects the fresh-proof handoff, §2).

External registry consumer: `npm run verify:release-consumer --
--registry` from a clean checkout of this workstream — **ALL CHECKS
PASSED** (consumer bundles the shipped renderer; ui-svelte exports the
full former-facade surface directly).

**Workflow conclusion, recorded accurately:** all 14 publish steps
succeeded ("ALL 14 PACKAGES PUBLISHED under `vict-0.4.0-rc`"); the run's
LATER read-only `verify-registry` step timed out on npm CDN propagation
(fail-closed), so the run's overall verdict is `failure` even though the
publication itself is complete and correct — subsequently confirmed by
the independent sweep above and R3.

## 2. Fresh-proof handoff corrections (made in this workstream only)

- §2 "Post-publication verification" — `latest` for `ui`/`ui-svelte` is
  `0.0.0-bootstrap.1` (the R2-recorded platform-forced bootstrap marker),
  **not "unoccupied"**; the candidate is reachable only via
  `vict-0.4.0-rc`.
- §5 gate table — the three `BLOCKED` rows (registry writes, trust
  relationships, coordinated publication) are marked **DONE/PUBLISHED**
  with dated corrections and the run-36427806906 caveat.
- The frozen Stage 8 handoff, architecture, and all `0.3.1` evidence are
  NOT modified (byte pins re-verified in this worktree).

## 3. Builder Kit artifact — incompatibility found, bounded correction disclosed

The kit was packed from the specified release source
`d7bd003047a648738a4d1d824b0c4e4a442c0da3` (detached worktree, `npm ci`,
build, `verify:builder-kit` **18/18** at that SHA). Result:

- **Pristine artifact from `d7bd0030`: SHA-256
  `c3df869f54f07da9996274ea114d9ded3f9c2f5003918ed4d6795bed62e78018` —
  byte-identical to the `0.3.1` kit artifact** (the kit did not change
  between the two releases).
- **Incompatibility (exact):** `src/verify/app-verify.ts` extracts the
  recorded set version with `/^vict-release-set@1\/(\d+\.\d+\.\d+)$/`. A
  prerelease id (`…0.4.0-rc.1`) does not match, so `recordedVersion` is
  `null` and **every correctly-installed platform package is flagged
  `release-identity-drift`** — empirically demonstrated: bootstrap
  succeeds (the `init-app` check is prefix-only), then `verify --app`
  FAILS against installed `0.4.0-rc.1` packages. The pristine kit can
  never verify a prerelease-set app green.
- **Bounded correction (disclosed, not passed off):** one line — the
  regex now accepts a prerelease suffix
  (`(\d+\.\d+\.\d+[-0-9A-Za-z.]*)`) — committed as
  `a9bc53b454f7597ce836e5c19c32ea51ddb4e891` on local branch
  `pi/kit-rc1-release-id-fix` (based on `d7bd0030`; 1 file changed).
  Rebuilt + repacked: **corrected kit artifact SHA-256
  `9d20e1c74ad9c8448cd01bc7ef412166f12e485f6d30222fc18d94db7407cd0e`**,
  verified: `verify --app` **5/5** against installed `0.4.0-rc.1`
  packages with the recorded rc set; `verify:builder-kit` 18/18 at the
  corrected HEAD. The corrected artifact is labeled everywhere as
  `d7bd0030 + a9bc53b4`; the pristine hash is recorded above. The
  correction is a kit-tool fix only; it touches no platform package and
  no published artifact.

## 4. Fresh builder session (genuinely fresh, isolated)

- New empty external directory `C:/Users/RZ1/Desktop/taskledger-rc1-20260928`
  (emptiness recorded), supplied ONLY: the verbatim pinned brief (bytes
  `046558c9…` — same as the frozen proof), the integrity-pinned corrected
  kit, the release-set id `vict-release-set@1/0.4.0-rc.1`, and generic
  package documentation. Rubric (bytes `b7531d5b…`, recovered byte-exact
  from frozen architecture §5.4), handoff, prior TaskLedger
  implementations, and evaluator findings stayed outside its context.
- Session isolation flags `-p -nc -ns -ne -np`; separate session
  directory; full transcript preserved (297 records; SHA-256
  `0fd7b872…`).
- **Deviations (disclosed):** the builder process died twice with external
  process exits (23:05:43, 00:08:52 — machine resource pressure; no
  builder fault observed); the SAME session was resumed twice with a
  neutral "Continue" prompt and ran to completion. Resume stitching is
  fully visible in the transcript.
- **Isolation audit:** transcript scanned — zero references to the rubric,
  the handoff, prior implementations, or evaluator findings; the only
  hits are the kit's own shipped documentation and tool output (CLI help,
  `npm ls` output, doc-comment examples). CLEAN.

The builder stopped at **5 commits, tree clean, HEAD `c6bb365`**:
bootstrap → scaffold → application (`e10ba9c`: 2 resources, 6 contracts,
governed complete-task capability with author-owned fail-closed effect
hook, 3 screens / 3 views / 2 declared forms / 4 actions, 3 component
islands; 26 tests) → hygiene (preview.log untracked via repo-local
exclude, generated `.gitignore` left byte-identical) → result document.

## 5. Independent evaluation of the single final commit `c6bb365`

Pins: all 14 `dependencies` exact `0.4.0-rc.1` (registry URLs + sha512 in
the lockfile; `ui`/`ui-svelte` first-class; **the retired
`renderer-svelte` facade is referenced nowhere**); the kit is a
devDependencies tool artifact (`file:tools/…`, excluded from the set
check by design). `npm run build` exit 0; tests **26/26**;
`verify --app` **5/5** (14/14 installed members match the recorded rc
set). Preservation: repo bundle
`taskledger-rc1.bundle` (`0d44135c…`), builder RESULT (`faeb0471…`).

**F6 host-file byte-compare:** a reference scaffold was regenerated from
the PUBLISHED `@victframework/scaffolder@0.4.0-rc.1` with an explicit
release-set file (14 × exact `0.4.0-rc.1`) — two generations are
byte-identical (determinism proven). Byte-compare against the app:

- **Functional host files byte-IDENTICAL:** `application-server.ts`,
  `src/routes/[...vict]/+page.server.ts`, `src/routes/[...vict]/+page.svelte`
  except one line (below), `src/routes/api/act/+server.ts`, `.gitignore`,
  `svelte.config.js`, `tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts`, `src/app.html`, `src/app.d.ts`,
  `src/lib/components/README.md`.
- **Byte diffs, all recorded:** `README.md` (title line),
  `+page.svelte` (**one line**: the `<title>` string),
  `package.json` (name/description identity strings + the kit tool as
  devDependency — the 0.4.0 scaffold consumes an explicit release-set
  file and emits the exact `0.4.0-rc.1` pins itself, so NO version edits
  were needed, fixing the 0.3.1 placeholder-version defect),
  `definition.ts` + `registry.ts` (author-owned by designation).

**Definition/registration trace (F6 clauses):**

- `role:'table'` surface (`viewId v.tasks`, **`queryActionId:
  act.queryTasks`**, `searchFields: ['title']`, `pageSize: 8`, declared
  columns) — searchable/sortable/paginated **through the declared
  surface**; the priority column renders `cmp.priority-badge@1` and the
  Edit column renders `cmp.task-edit-link@1` as **island cells** (a
  0.4.0 capability the 0.3.1 renderer lacked); `rowAction` binds the
  declared `act.completeTask`.
- Create: `role:'dialog'` containing `role:'form'` (`formId f.createTask`
  — a DECLARED form with contract-validated fields); Edit:
  `role:'status'` + `role:'form'` (`f.updateTask`) with prefill.
- Dashboard: `role:'count'` over `v.openTasks`; `role:'text'`; and
  `cmp.completions-chart@1` — an island receiving host-composed view
  rows (no self-fetch).
- All three islands are registered with stable ids/revisions in
  `registry.ts` and allowlisted in the definition; islands issue **no**
  boundary calls of their own (`act`/`fetch` absent from all three).
- The governed capability's persistence lives in the author-owned
  `capabilityEffects` export inside `definition.ts`, dispatched by the
  byte-identical generated host — the 0.4.0 supported extension point.

**Real-browser record** (real Chrome via CDP, real keyboard; port-isolated
preview on :47931 after a cross-workstream port collision on 4173 —
recorded; 17 screenshots + machine log):

- **F3 surface (the frozen proof's failure point) mounts and works at
  BOTH widths:** phone 390×844 rows render (8/page of 30–49 records),
  laptop 1366×768 rows render.
- Search through the declared surface: "Smoke" → 2 rows; "zzq-none" →
  0 rows with the declared empty message; cleared → full list.
- Sort: title toggle asc/desc with `aria-sort` ascending/descending
  transitions; semantic priority sort (all `High` first — the `p1-`
  encoding makes lexicographic = semantic).
- Pagination: page 1 ↔ 2 with zero overlap and round-trip `true`
  (pageSize 8).
- Create: dialog form; empty submit → visible validation; keyboard fill
  (title + priority select) → persisted (record count increments,
  task visible).
- Edit: row link → prefilled `/tasks/:id` form; keyboard edit → "Changes
  saved." → persisted on the list.
- Row **Complete** → governed durable action; dashboard count and 14-day
  chart reflect it (3 → 4 completions observed live).
- Badge island visibly rendered in table cells: `priority-badge` class,
  999px radius pill, distinct palettes (High = `rgb(254,226,226)` /
  `rgb(153,27,27)`).

**F5 raw-boundary probe** (bypassing all UI):

- Before: tasks 49 rows `19b31e3d…`; completion_events 4 `f37016f6…`;
  runs 5 `fe81a506…`; events 20 `68e5d1a6…`; activations 1; attempts 0.
- Raw request: `POST /api/act
  {"actionId":"act.completeTask","input":{"id":"b7027950-…","escalate":true,"operatorNote":"bypass-ui-probe-rc1"}}`
- Exact response: `{"ok":false,"code":"CONTRACT_REJECTED","message":"The
  action input was rejected by contract 'task.complete@1'; no run or
  mutation was performed.","fieldErrors":{"escalate":"This field was
  rejected by the declared contract."}}`
- After: **byte-identical state** (all six digests unchanged) — no task
  change, no run, no events.
- Valid control `{"id"}` → `ok:true`, durable completion; replay of the
  completed task → fail-closed `ACTION_FAILED` with no state change
  (note: the 0.3.1 app returned a specific `ALREADY_COMPLETE` code; the
  0.4.0 result is a generic safe failure — recorded as a difference).

**F7:** hard kill (PID of the listener; connection-refused verified) →
restart → tasks/completion_events/runs/events/activations digests all
byte-identical (`19b31e3d…`, `f37016f6…`, `fe81a506…`, `68e5d1a6…`,
`d81b87fb…`). **F8:** content-identical rebuild →
`applicationVersion v1_33edadd3…` unchanged.

**Negative controls:** brief content drift → `FAIL inputs:app-pack
[content-drift]` → restore (digest re-verified) → green; base-pack
schema-valid value tamper → `FAIL identity:app-pack [pack-tamper]` →
restore → **5/5 green**.

Cosmetic observation (recorded): `/favicon.ico` 404s in the console;
no functional impact.

## 6. Criterion-by-criterion comparison — `0.4.0-rc.1` fresh proof vs the frozen `0.3.1` result

| ID | Criterion (literal) | 0.3.1 frozen proof | 0.4.0-rc.1 fresh proof (commit `c6bb365`) |
| --- | --- | --- | --- |
| F1 | builds/runs from empty project, no manual route/page shells, scaffolder+renderer path | PASS (16-file scaffold; host plumbing edited) | **PASS** (scaffold+init-app path; route/shell set exactly the scaffold's; one cosmetic `<title>` string edit recorded) |
| F2 | create/edit validates against a declared contract | PASS (custom islands mirrored contracts client-side) | **PASS** (declared forms + role:'form'; validation at the declared contract crossing; dialog + prefilled edit) |
| F3 | table: search/sort/pagination over app-domain data | PASS (custom island; ≤640px gap fixed in a correction round) | **PASS** (built-in definition-driven table surface; works at 390×844 and 1366×768; search/sort/pagination verified live; island cells for badge + edit link) |
| F4 | dashboard chart reflects persisted completions | PASS (custom projection + island chart) | **PASS** (role:'count' + 14-day chart island over the declared completion-events view; accessible table equivalent) |
| F5 | complete crosses governed boundary; refuses undeclared input raw; durable | PASS after a correction round (0.3.1 first silently stripped; corrected to refuse) | **PASS first-time** (raw undeclared-field request → `CONTRACT_REJECTED` with byte-identical state; valid control durable; replay fails closed) |
| F6 | badge = versioned island; everything else definition-driven; generated host not hand-edited | FAIL under the literal authority review (3 behavior islands; 5 host files functionally edited) | **PASS on substance; three identity-string byte diffs recorded** — badge is the only *interactive-domain* island (plus a link cell and a derived-chart island inside definition-driven surfaces — the 0.4.0 supported island-cell path); table/forms/count/status are definition-driven built-ins; functional host files byte-identical; README/+page.svelte-title/package.json identity strings edited (recorded for the owner's literal-vs-intent calibration) |
| F7 | kill/restart preserves everything exactly | PASS | **PASS** (byte-identical six-digest state) |
| F8 | identity stable across content-identical rebuild | PASS | **PASS** (`v1_33edadd3…` unchanged) |

Session-quality comparison: the 0.3.1 proof needed one corrected scoring,
one reattempt, two feedback-driven correction rounds, and one authority
review; the 0.4.0-rc.1 fresh proof passed first-time on every functional
criterion with a genuinely fresh builder session (two external process
interruptions resumed per policy). Platform improvements material to this
outcome: exact-version release-set scaffold input; app-neutral generated
host with generic view composition and capability-effect dispatch;
definition-driven `table`/`form`/`count` surfaces with island cells.

Builder-reported platform observations (forwarded for the platform team,
not silently worked around): SDK `CapabilityDefinition.description`
rejected by the runtime's closed registry schema; `appdata-sqlite`
accepts only create/update/delete verbs (completion persistence routed
through `update` under an exact two-field contract); host double-validates
contract output; the generated `application-server.ts` carries two
pre-existing `tsc --noEmit` strict errors the toolchain never checks.

## 7. Proposed owner disposition (separate, explicit; NOT self-executed)

- The frozen D-1′ pin (`vict-release-set@1/0.3.1` for the original P2
  proof) **does not change** — the 0.3.1 record stands as history,
  byte-untouched.
- **Decision for the owner:** which release version G3's criterion set is
  judged against going forward. Options: (a) judge G3 against the
  published `0.4.0-rc.1` set on the basis of THIS fresh proof (with the
  §5 F6 identity-string diffs accepted as compliant or waived explicitly);
  (b) require a further bounded correction on 0.4.0-rc.1 first (e.g.,
  re-scaffold with appName "TaskLedger" so the title/name edits vanish,
  and re-run the ladder); (c) hold G3 for the `0.4.0` stable release and
  re-proof against it. In every option the gate decision remains the
  owner's together with the independent audit.
- **No Verified claim is made. No G4 start. No publication. The 0.3.1
  evidence is preserved byte-for-byte.**

**Stop point: fresh 0.4.0-rc.1 proof filed — owner disposition requested.**
