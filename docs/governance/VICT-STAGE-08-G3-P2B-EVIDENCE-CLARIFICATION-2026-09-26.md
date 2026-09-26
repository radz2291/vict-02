# Stage 8 G3 — P2B Evidence Clarification: Raw-Boundary Refusal (F5) and Scaffold Ownership (F6) (2026-09-26)

> **Document type:** owner-directed evidence clarification, filed BEFORE any
> G3 disposition. Two evidence points were resolved on the single final P2B
> commit by (1) a raw action-boundary probe protocol and (2) a scaffold
> ownership / component-registration audit. The first probe **failed** on
> the then-final commit `d53a152`; the owner's rule was applied (F5 failed),
> a disclosed bounded correction was run in the ORIGINAL builder session,
> and the full final-commit evaluation was repeated on the new final commit
> `d4feedb`. All raw requests, responses, and before/after states are
> recorded below. Earlier governance records remain untouched.

## 1. Evidence point 1 — raw completion request with an undeclared field

### 1.1 Protocol (as directed)

Send a raw completion request carrying a valid open task ID **and an
undeclared field** directly to the declared action boundary (`POST /api/act`,
no UI, no normalization), record the exact response and the run ledger
before and after. Requirement: refuse with a structured error and create no
durable run or state change; then verify a valid request still succeeds.
If the invalid request succeeds after silently stripping the field, F5
fails.

### 1.2 Result on the then-final commit `d53a152` — **FAILED**

Evidence: `eval-p2bc-artifacts/f5-raw-probe/` (raw response + ledger
snapshots).

- Before (task table 21 rows, digest `d06e02aa…`; ledger 4 runs
  `4da12083…` / 16 events `f843cb75…` / 1 activation `ba521317…`).
- Raw request:
  `POST /api/act {"actionId":"act.completeTask","input":{"id":"e1dc430c-af73-4916-ba33-05d2ffadd1d7","escalate":true,"operatorNote":"bypass-ui-probe"}}`
- Exact response: `HTTP/1.1 200 OK` —
  `{"ok":true,"value":{"found":true,"id":"e1dc430c-…","status":"done","completedAt":"2026-09-26T10:14:26.569Z","completedDay":"2026-09-26","alreadyDone":false}}`
- **The invalid request SUCCEEDED after silently stripping the undeclared
  fields**: task table digest changed (`d06e02aa…` → `52aac200…`) and a new
  durable run appeared (`run_2b857fc0…`; 4→5 runs, 16→20 events). The
  control valid request (`{"id"}` only) also succeeded.
- **Score: F5 = FAIL** (failure of the refusal requirement, per the
  owner's explicit rule). Note this reverses the earlier "normalizing
  contract recorded as design difference" treatment — the owner has ruled
  silent strip-and-succeed on a governed action is a failure.

### 1.3 Disclosed bounded correction (original builder session)

The original isolated session (`01a0dc4a…`, same transcript, same
isolation flags, provider `zai/glm-5.3-flash` as operator-approved in the
prior round) was resumed with ONLY the owner's requirement text verbatim
(the probe protocol sentences above); no rubric, no diagnosis, no
implementation hints. The builder produced commit `d4feedb`
("QA round: governed completion refuses undeclared fields with no durable
run"): `task.complete.input@1` is now closed-vocabulary (structured
`unknown_field` issues; field names only, sorted, capped) and the action
boundary pre-validates raw capability input before the runtime is touched
(refusal = structured `CONTRACT_REJECTED`, no run/event/attempt, no state
change; runtime re-validates independently). Its own live QA round is
recorded in `RESULT.md` §5c and `browser-evidence/qa-round/`.

### 1.4 Result on the new final commit `d4feedb` — **PASS**

Full evaluation repeated on this single commit (nothing combined with
other commits). Pins: 13 platform deps exact `0.3.1`; kit bytes
`c3df869f…`; brief `046558c9…`. Build exit 0; tests 4 files / **23
passed**; `verify --app` **5/5**; VICT gates `verify:builder-kit`
**18/18** and `verify:release-set` frozen set unchanged (`v1_1c695280…`).

Raw probe (evidence `eval-p2bd-artifacts/f5d-*`):

- Before (task table 40 rows, digest `07d1cef6…`; ledger 9 runs
  `93cae2ae…` / 36 events `12be86ce…` / 1 activation `ba521317…`).
- Raw request:
  `POST /api/act {"actionId":"act.completeTask","input":{"id":"e245bc2e-aef5-4d6b-ac41-83b2e6cffd7f","escalate":true,"operatorNote":"bypass-ui-probe-2"}}`
- Exact response: `HTTP/1.1 200 OK` —
  `{"ok":false,"code":"CONTRACT_REJECTED","message":"The governed action input was rejected by contract 'task.complete.input@1'; only the field 'id' is accepted."}`
- After: **task table + full run ledger byte-identical** to the before
  snapshot (digests unchanged: `07d1cef6…`, `93cae2ae…`, `12be86ce…`,
  `ba521317…`). No durable run, no events, no state change; target task
  still open until the control ran.
- Valid control `{"id":"e245bc2e-…"}` → `{"ok":true,…,"status":"done",
  "completedAt":"2026-09-26T10:32:55.027Z",…}` — durable success.
- Boundary re-checks on this commit: 240-char title update →
  `DATA_CONTRACT_REJECTED`; invalid priority → `DATA_CONTRACT_REJECTED`.
- **Score: F5 = PASS** (refusal + zero durable effect + valid control, all
  on raw boundary traffic).

## 2. Evidence point 2 — scaffold host files and badge registration

### 2.1 Method

A reference scaffold was regenerated from the pinned inputs (kit tarball
`c3df869f…` via its `@victframework/scaffolder@0.3.1`, app name
`taskledger-p2b-20260926`) into a clean directory and every generated file
was byte-compared against the final application (`d4feedb`). Full diff:
`eval-p2bc-artifacts/f5-raw-probe/scaffold-host-diff.txt`.

The scaffolder's own generated README states the ownership rule:
`definition.ts`, `src/lib/components/`, and
`src/lib/server/application-server.ts` are **author-owned** ("YOUR …");
"Everything else is the generic Vict host: the scaffolder owns its initial
form; Vict renders your definition dynamically and never regenerates
code."

### 2.2 Findings (identical classification on `d53a152` and `d4feedb`)

- **Identical to scaffold:** `README.md`, `src/app.d.ts`, `src/app.html`,
  `src/lib/components/README.md`, `src/routes/[...vict]/+page.svelte`,
  `svelte.config.js`, `tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts`.
- **Author-owned files edited (the supported path, by design):**
  `definition.ts` (application definition), `registry.ts` + new
  components under `src/lib/components/` (code islands),
  `application-server.ts` (explicitly documented "YOUR application
  server — author-owned"; the scaffold's starter wiring hardcodes the
  example `items` resource and cannot serve a real definition unmodified).
- **Generic-host files edited (recorded):** `+page.server.ts` (view-data
  composition specialized from the starter `items` view to the app's
  declared views, including the derived 14-day projection — the scaffold
  provides no other supported hook for view composition),
  `api/act/+server.ts` (one-line `await` following the author-owned
  server's async factory), `package.json` (release-set versions `0.3.1`,
  name/description, kit as local tool artifact), `.gitignore` (local log
  and quarantine entries). These are template-wiring specializations the
  scaffold's starter bytes require; the scaffolder never regenerates them,
  and the app-level gate (`verify --app`) is green on every run. Recorded
  as expected specialization — **not an ownership violation**.
- **Badge registration:** `PriorityBadge.svelte` is registered through the
  documented supported custom-component path —
  `registry.register({ componentId: 'app.priority-badge', revision: '1',
  implementation: PriorityBadge })` in `src/lib/components/registry.ts`,
  referenced with the same id/revision pair from the Application
  Definition (component allowlist line 81 and its surfaces). Same pattern
  for `app.task-table`, `app.task-form`, `app.open-count` (4 registrations).
  Registered components receive only their declared props.
- **Score: F6 = PASS** (supported registration path confirmed; ownership
  classification recorded; no violation found, so no correction was
  needed).

## 3. Full re-evaluation of the single final commit `d4feedb`

| ID | Criterion | Result |
| --- | --- | --- |
| F1 | builds/runs | **PASS** (build exit 0 twice; app live) |
| F2 | create/edit validates against declared contract | **PASS** (create form live; native required on empty; keyboard create persisted; edit prefilled→persisted; over-length rejected at boundary; invalid priority `DATA_CONTRACT_REJECTED`) |
| F3 | search / sort / pagination, both widths | **PASS** (mounted rows; server-side search; title asc+desc verified + toggled; semantic priority sort; zero-overlap pagination roundtrip; narrow-screen sort controls live at 390 px) |
| F4 | dashboard reflects persisted completions | **PASS** (live open count; MM-DD chart + per-day table) |
| F5 | governed completion incl. raw-boundary refusal | **PASS** (row Complete live + durable; **raw invalid request refused `CONTRACT_REJECTED` with byte-identical ledger**; valid control durable; replay idempotent) |
| F6 | badge code island, visibly rendered, supported path | **PASS** (3 distinct palettes on mounted rows; registry path confirmed; ownership audit recorded) |
| F7 | kill/restart preserves tasks + durable effects | **PASS** (hard kill + restart; tasks `62b740f9…`, 10 runs `227532b7…`, 40 events `6e36668f…`, 1 activation — all identical) |
| F8 | identity stable across content-identical rebuild | **PASS** (`v1_59b3a3df…` unchanged; definition untouched by the contract tightening) |

Negative controls on `d4feedb`: content drift → red `[content-drift]` →
restore → pack tamper → red `[pack-tamper]` → restore → **5/5 green**.
No regressions relative to the prior evaluation: every criterion that
passed on `d53a152` still passes on `d4feedb` in its own browser session
(16 screenshots + 2 interaction logs in
`eval-p2bd-artifacts/browser-record/`).

### Evidence hygiene deviation (recorded)

The laptop-phase screenshots of the superseded `d53a152` evaluation were
overwritten on disk when the `d4feedb` laptop driver reused the same
output filenames (driver path bug). The superseded state itself remains
fully preserved (`taskledger-p2b-corrected.bundle` `ca4a7725…`), the
overwritten files' SHA-256 hashes were recorded in the prior correction
note before the overwrite, and the superseded raw-probe evidence
(`f5-raw-probe/`) is intact. No governance text was altered.

## 4. State lineage and preservation

- Attempt 1 bundle `6d353b9c…` · Attempt 2 bundle `36a6e94a…` ·
  pre-clarification corrected state bundle `ca4a7725…` · current final
  state bundle `taskledger-p2b-corrected2.bundle`
  `ebd24c0e95e7f97ef4548b7b91eb5931850b1ff335af3c7f364899d9e5ce2e79`
  (builder RESULT for it: SHA-256 `eb2484da…`). Session transcript
  (all rounds, including the 429-interrupted resumes) SHA-256
  `d75f2fd7…`. All earlier commits, bundles, failed results, governance
  records, and the file-once implementation report untouched.
- Builder commits in the correction: `d4feedb` (single commit; tree
  clean). Its fix layers: closed-vocabulary completion contract +
  boundary pre-validation; 5 new tests (23 total); live QA evidence in
  its repo.

## 5. Resulting scores and disposition

- **F5 after correction: PASS** (§1.4). **F6: PASS** (§2.2). All other
  criteria re-verified on `d4feedb`: F1 F2 F3 F4 F7 F8 PASS (§3). No open
  defects.
- **G3 evidence-complete is RETURNED for owner ratification** — both
  directed evidence points are resolved, the full ladder passes on the
  single final commit `d4feedb`, and every intermediate failure
  (`d53a152` F5 refusal failure) is preserved and disclosed. The gate
  decision remains the owner's together with the independent audit.
- Standing non-claims unchanged: Stage 8 NOT Verified; no publication; no
  production activation; no Quellight access; **no G4 start**.

**Stop point: evidence clarification filed — G3 returned for owner
ratification.**
