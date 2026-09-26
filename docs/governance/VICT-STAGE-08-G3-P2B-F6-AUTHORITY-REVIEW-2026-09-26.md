# Stage 8 G3 — P2B F6 Authority Review Against the Literal Frozen Criteria (2026-09-26)

> **Document type:** owner-directed bounded authority review of P2B commit
> `d4feedb` against the literal frozen F1/F6 criteria (architecture §5.4,
> bytes pinned `ba3fde1b…`) and the handoff's byte-unchanged
> generated-host requirement (handoff WP-7/TEST-10, bytes pinned
> `4aa83c15…`; both pins re-verified this review). Earlier records are
> untouched. **G3 disposition is HELD**; this note returns a finding and
> the decision options — it does not amend the contract and does not pass
> G3. Stage 8 remains NOT Verified; no G4.

## 1. Method

- Reference scaffold regenerated twice from the pinned published inputs
  (`@victframework/scaffolder@0.3.1` shipped in the frozen kit artifact
  `c3df869f…`, app name `taskledger-p2b-20260926`): the two generations
  are **byte-identical to each other** (scaffolder determinism proven),
  and every generated file was byte-compared against the final app at
  `d4feedb`.
- Per-file git archaeology over the builder repository (first commit
  `e82928b` = pristine scaffold + `init-app` bootstrap; all later commits
  are builder edits).
- Component trace: definition source (`definition.ts`), registry,
  island sources, and the published `renderer-svelte@0.3.1` /
  `application@0.3.1` / `sdk@0.3.1` package sources (shipped `src`/`dist`
  read directly from the pinned release tarballs).

## 2. Literal frozen texts applied

- **F1 (architecture §5.4):** "the app builds and runs from the empty
  project with no manual route/page-shell construction (APP-001 path via
  the scaffolder + renderer)".
- **F6 (architecture §5.4):** "the priority badge is a versioned
  custom-component code island; **everything else is definition-driven**;
  the scaffolder's one-time, non-destructive contract is visibly
  respected (**generated host files are not edited by hand**)".
- **Handoff TEST-10 (P2-specific):** "scaffolder one-time contract
  respected (**generated host files byte-unchanged** after the custom
  component lands)".

## 3. Generated host files edited after scaffolding (file-by-file)

| File (scaffold-generated) | When changed (builder commits) | Why (observed content) | Supported no-edit path on 0.3.1? |
| --- | --- | --- | --- |
| `src/lib/server/application-server.ts` | `8ae942a`, `b6fb360`, `a19181e`, `d4feedb` | rewire starter `items` resource/permissions to `tasks`/`task_completions` + declared contracts + governed runtime; durable `.data` creation; 14-day projection derivation (`MM-DD` labels); **d4feedb raw-input pre-validation** (the owner-directed F5 refusal) | **No.** The scaffold hardcodes the starter `items` domain; 0.3.1 documents no server extension API (no capability hook, no dispatch interceptor). Note: the scaffold's embedded README itself labels this file "author-owned" |
| `src/routes/[...vict]/+page.server.ts` | `8ae942a`, `b6fb360` | view-data composition for `v.tasks` (list + record get) and the derived `v.completions` projection; parameterized `/tasks/:id` route resolution fix | **No.** Scaffold composes only the starter `v.items`; 0.3.1 has no view-resolver/data-provider hook |
| `src/routes/api/act/+server.ts` | `8ae942a` | `await` the now-async app factory (follows from the governed runtime's async creation) | **No** — direct consequence of the application-server wiring |
| `package.json` | `8ae942a`, `b6fb360` | platform deps set to the pinned `0.3.1` release set; kit as recorded local tool artifact; scripts | **No.** The scaffold ships placeholder `0.1.0` versions; the release-set pin and `verify --app`'s installed-version check cannot be satisfied without editing it |
| `.gitignore` | `b6fb360`, `d53a152`, `d4feedb` | data dir, transient build log, quarantine dir entries | No behavioral content; still a byte change to a generated file |

Byte-identical to scaffold (unchanged): `svelte.config.js`, `tsconfig.json`,
`vite.config.ts`, `vitest.config.ts`, `src/app.html`, `src/app.d.ts`,
`src/routes/[...vict]/+page.svelte`, `README.md`,
`src/lib/components/README.md`. Author-owned-by-designation files
(`definition.ts`, `registry.ts`, `src/lib/components/*`) are edited as
intended and are not host files.

## 4. Component trace — definition-driven vs additional islands

Definition evidence: `definition.ts` declares resources with
`queries.list` (filters `status`, sort `title|priorityRank|createdAt`,
`pagination: true`), contract-bound mutations (`task.create.input@1`,
`task.record.input@1`), the capability action `act.completeTask`
(`task.complete.input@1` → `task.complete.output@1`), views
(`v.tasks`, `v.completions`), and screens whose dashboard surfaces use
renderer built-ins (`role:'text'`, `role:'chart'` with
`viewId/xField/yField`).

Implementation evidence (published renderer sources, 0.3.1 tarballs):

- `renderer-svelte` ships **built-in definition-driven surfaces**:
  `role:'table'` → `RecordsTable.svelte` ("searchable, sortable,
  paginated"; with a declared `queryActionId` it dispatches the DECLARED
  query action through the dispatcher on every search/sort/page change;
  surface fields `viewId`, `columns`, `searchFields`, `filterFields`,
  `pageSize`), `role:'form'` → `FormSurface.svelte` ("contract-validated
  create/edit form"; driven by a declared form — the SDK schema declares
  `forms` (`application.d.ts`: `readonly forms?: readonly FormBinding[]`)
  with fields/required/`submitActionId` and edit prefill via
  `identity`/`values`) — plus `list`, `detail`, `status`, `chart`, `text`.
- The delivered `TaskTable.svelte` (539 lines) takes **no props** and
  self-fetches everything through its own `act()` helper: local
  search/sort/pagination/status-filter state, per-row governed complete,
  its own rendering of `PriorityBadge`. `TaskForm.svelte` (283 lines)
  carries its own client-side validation mirror of the server contracts
  and self-fetches `act.getTask`/`act.createTask`/`act.updateTask`.
  `OpenTasksCount.svelte` self-fetches `act.queryTasks` and extracts
  `total`.
- The dashboard chart and text surfaces ARE renderer-rendered from the
  definition.

**Finding:** the application's DATA LAYER is genuinely definition-declared
(resources, queries, contracts, capability), but the INTERACTIVE SURFACES
for brief wants (1) and (2) are implemented as additional custom Svelte
code islands with client-side self-driving behavior, bypassing the
published 0.3.1 renderer's own definition-driven `table`/`form` machinery
that exists precisely for those behaviors.

**The badge, distinguished:** `PriorityBadge.svelte` (74 lines) is the only
component matching the island contract F6 contemplates — declared props
only (`priority`, `label`), no data access, no boundary calls, purely
presentational; registered as `app.priority-badge@1` in `registry.ts` and
allowlisted in the definition's `components`. Note its mounting is
island-internal (imported by TaskTable), not via a host surface. TaskTable,
TaskForm, and OpenTasksCount are behavior-carrying islands — categorically
different from the badge.

## 5. Verdicts against the literal criteria

- **F1: PASS (literal).** The app builds and runs from the scaffolded
  empty project; the route/page-shell set is exactly the scaffold's (no
  manual shells constructed); rendering reaches the UI through the
  generated host + renderer (with the §4 caveat noted for F6, not F1).
- **F6 clause A (badge = versioned code island): PASS.**
- **F6 clause B ("everything else is definition-driven"): FAIL.** Wants
  (1) and (2) are island-implemented although the same published release
  provides definition-driven `form`/`table` surfaces for them.
- **F6 clause C + handoff TEST-10 (generated host files byte-unchanged):
  FAIL.** Five scaffold-generated files were hand-edited (§3), verified by
  byte-diff against a deterministic fresh scaffold from the pinned
  inputs.
- **F6 overall (literal): FAIL.** Prior records scored F6 "PASS (with
  caveat)"/"PASS" under a looser reading (edits disclosed as the
  one-time-tool contract); under the owner-directed literal reading the
  score is FAIL. Earlier records remain untouched; this note supersedes
  the score, not the observations.

## 6. Can the published 0.3.1 path satisfy the literal criteria? — **No.**

Three concrete platform limitations (all verified in the 0.3.1 artifacts):

1. **Scaffold `package.json` pins placeholder `0.1.0` platform versions** —
   byte-unchanged host files are impossible while consuming the frozen
   `0.3.1` release set (`verify --app` checks installed versions against
   the recorded set).
2. **The scaffold hardcodes the starter `items` domain** in
   `application-server.ts` and `+page.server.ts` (resource wiring, view
   composition) and 0.3.1 documents **no extension API** (no view-data
   resolver, no dispatch hook) — every real definition requires hand
   edits. This includes the owner-directed F5 refusal: guaranteed no-run
   pre-validation at the boundary is only reachable by editing
   `application-server.ts` on 0.3.1. (The scaffold's embedded README
   calling `application-server.ts` "author-owned" directly contradicts the
   frozen F6 text — the contract and the shipped platform disagree.)
3. **`RecordsTable` has no code-island cell support** (verified: no
   component/island rendering in table cells) and there is **no aggregate
   surface role** for a live count. The brief's want (5) — badge shown in
   the table — therefore REQUIRES a custom table island on 0.3.1, which
   clause B forbids; want (3)'s open count has no definition-driven
   surface either. Clause B as written is unsatisfiable together with the
   brief on this release.

A maximal bounded correction on 0.3.1 (built-in `table`/`form` surfaces
via declared views/forms+`queryActionId`; islands reduced to badge/count)
could satisfy clause B for wants (1)+(2) but cannot satisfy clause B for
want (5), nor clause C at all. **The literal criteria are unsatisfiable on
the published 0.3.1 path for this brief. No bounded correction can change
that; no correction is proposed as if it could.**

## 7. Decision required from the owner (smallest set; not executed)

- **Option A — rubric clarification by owner decision (new dated record):**
  adopt the shipped platform's own ownership semantics for P2 scoring —
  author-owned = `definition.ts` + `src/lib/components/` +
  `application-server.ts` (as the scaffold's README designates); generic
  host-route plumbing edits disclosed per-file with reasons; islands
  permitted where the built-ins lack capability (island-cell tables,
  aggregates). Under Option A a bounded correction could still be ordered
  to move wants (1)+(2) onto the built-in definition-driven surfaces, and
  the full ladder re-run.
- **Option B — literal enforcement:** record F6 = FAIL for P2 on 0.3.1
  (as this review finds), hold G3 open, and route the three limitations
  (§6) to a platform follow-up release whose scaffold ships app-neutral
  wiring (release-set-correct `package.json`, no starter domain hardcodes,
  a documented view-data/server extension API) and whose renderer supports
  code-island table cells.

Either way, **G3 disposition remains HELD** pending the owner's choice;
nothing here amends the frozen contract, marks G3 passed, starts G4, or
marks anything Verified.

**Stop point: F6 authority review filed — owner decision required.**
