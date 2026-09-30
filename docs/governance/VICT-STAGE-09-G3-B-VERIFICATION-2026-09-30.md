# VICT Stage 9 — G3-B VERIFICATION REPORT (2026-09-30)

**Role:** fresh gate verifier B (S9-02 run-list → run-detail). Build-independent; this report is produced at the triple-integrated candidate only. Run restarted once after an external process kill of the verifier harness; all verification evidence below was re-derived from scratch in this run (no prior unverifiable captures are relied on).

## Candidate identity

| check | evidence | result |
| --- | --- | --- |
| branch | `git ls-remote origin codex/stage9-g3-proposal` | `2c6d52e54ab4a9f6974efbd2f350190ce72852b7` — matches the frozen G3-B candidate PIN |
| HEAD | `git rev-parse HEAD` after checkout of origin/codex/stage9-g3-proposal | `2c6d52e54ab4a9f6974efbd2f350190ce72852b7` (branch NOT moved) |
| B head contained | `git merge-base --is-ancestor 574bb0e HEAD` | YES — linear `d014d62 → b9a948f → e0532d2 → 574bb0e → 2c6d52e` |

## Criterion table

| # | Frozen G3-B criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| (a) | Dedicated `/runs/[runId]` route reached from the run list by row links | PASS | apps/studio/src/routes/runs/[runId]/+page.svelte:1-10, run-detail-reads.ts:1-30 |
| (b) | Reads verbatim from the frozen G1 read surface; truthful failure banners; honest dual-read version compare | PASS | see §2, §3 |
| (c) | (G3-A carry-over) real-browser list → detail navigation | PASS | §4 — verifier-run live journey, real `<a href>` + real CLICK |
| (d) | D-5 protected detail: redacted default, single reveal action under the distinct credential, per-access audit, truthful retention | PASS | §5 |
| (e) | Negatives: empty list, missing run, actor denial, pagination | PASS | §6 |
| — | Scope audit `d014d62..2c6d52e` | PASS | §7 |
| — | Suites + static | PASS (one environmental flake class, §8) |

**VERDICT: G3-B gate PASS WITH NON-BLOCKING** (findings F1–F3, severity LOW, in §9).

## 1. Stack (verifier-owned fixture, fresh ports)

Verifier ran the REAL stack from its own checkout (fresh ports; none of the reserved ports are touched, and they were left untouched):

- Full fixture target: `apps/studio/scripts/demo-target-s902.mjs`, `DEMO_PORT=4322` running in this browser journey. The builder's default 4312 and the reserved ports were not used by the verifier.

- Empty-variant fixture target: `DEMO_S902_VARIANT=empty`, `DEMO_PORT=4323` running the same composition with no run seeds. Both are the target's own composition — the verifier built no other fixture.
- Studio dev (full): port **5188**, provisioned via `VICT_STUDIO_TARGETS`/`VICT_STUDIO_CREDENTIALS` → `{"id":"local","endpoint":"http://127.0.0.1:4322","credentialRef":"studio-operator-detail"}`, with `studio-operator-detail` (operator token, run.read/activation.read/audit.read/agent.stream.read) and the distinct `studio-operator-detail-detail` (detail token, + `run.detail`) — exactly the separate `${credentialRef}-detail` pattern the added targets entry provisions.
- Studio dev (empty fixture): port **5189** → endpoint 4323.

The real browser was driven by `apps/studio/scripts/s902-journey.mjs` (S902_STUDIO=5188, S902_TARGET_API=4322) — the builder's journey driver, pointed at the verifier's own ports — **and by an additional verifier-owned click script** (§4).

## 2. (b) Reads verbatim — code audit + live answers

Every rendered field traces to a GET of the frozen G1 paths, all fetched from the target's server-held credentials (`apps/studio/src/routes/runs/[runId]/run-detail-reads.ts`):

- read A `GET /vict/v1/runs/:runId` → `readRunRecord` (the redacted generic projection; line ~118);
- read events `GET /vict/v1/runs/:runId/events?afterSeq=&limit=` → `readRunEvents`;
- `GET /vict/v1/runs/:runId/waits` → `readRunWaits`;
- audit `GET /vict/v1/audit?subjectType=run&subjectId=:runId&limit=` → `readRunAudit`;
- protected `GET /vict/v1/runs/:runId/detail` → `readProtectedDetail` (only from the `reveal` ACTION; see §5);
- bounded list reader `GET /vict/v1/runs?limit=&offset=` → `readRunsListPage` (negative-set/pagination evidence only; the list page stays on the definition host).

The page renders each read either verbatim (tables) or a truthful banner: failed read → `Run record unavailable: the target refused the read with its own code <code>`; absent record → `Run record absent…`. Live answers captured: missing run banner shows `VICT_RUN_MISSING` (s902-missing-run-banner.png; direct API `404 {"ok":false,"code":"VICT_RUN_MISSING"}` at verifier-s902-negatives.json).

**The `+page.svelte` renders NO fabricated constants.** All cells come from `Object.entries(record)` (whole projection), the events/waits/audit rows' named columns, the compare `fields`, and the `reveal` outcome. `(not reported)` / `(absent)` are the only synthesised literals and are labeled absence markers.

**The version-compare is falsified as an honest DUAL READ.** `run-detail-reads.ts` documentation and `compareRunRecords` implement exactly two sequential `run.get` reads with no revision-time read; `+page.server.ts` load() issues `readRunRecord` twice; `+page.svelte` renders read A and read B columns side by side and states "no movement is claimed" when both agree or "the record moved between the two reads — both reads stay visible; no merged state is claimed" when they differ. Both snapshots are always visible; nothing merges them. The movement path is unit-proven (§6 "dual-read compare" tests, 3 tests in apps/studio/tests/run-detail.test.ts) against an induced change; live, the load()'s two reads ran against an unmoving record and truthfully rendered "Both reads returned the same record — no movement is claimed" (s902-detail-version-compare.png). Honest dual read is documented verbatim on the page: "the G1 run.get surface has no revision-time read, so the honest version compare is TWO sequential generic reads of the same run."

## 3. (d) D-5 protected detail

- **Default is redacted**: `+page.server.ts` `load()` never calls `readProtectedDetail` — only read actions do (grep-verified: `readProtectedDetail` appears only in `actions.reveal`). The generic read carries no `output` member. Journey check "generic detail defaults REDACTED (canary absent before reveal)" PASS (s902-detail-redacted-default.png).
- **Only action = `Reveal protected detail`** form → `?/reveal` issuing `readProtectedDetail` with `${credentialRef}-detail`. The direct-API cross-check: `GET /runs/run-demo-completed/detail` with the operator token (no run.detail scope) → `403 {"ok":false,"code":"VICT_ACTOR_SCOPE_DENIED"}`; with the `-detail` credential token → `200 protectedAvailable:true, retention:'full'`, verbatim `protectedOutput: {"items":["alpha","beta","gamma"],"summary":"demo capability output committed under full retention"}` (the canary prong, bytes byte-identical to the target's seeded output).
- **Per-access audit**: after accesses, `GET /vict/v1/audit?subjectType=run&subjectId=run-demo-completed` returned `run.detail.accessed` rows (`auditId:"audit-run-detail-run-demo-completed-…", actorId:"actor-studio-detail"`); the page reads these back and renders them in "Per-access audit evidence (run.detail.accessed)" (s902-detail-audit-rows.png); each reveal surfaces its audit rows.
- **Retention semantics truthful**: the blocked run (retention full but no execution-store output ever produced) reveals with `protectedOutput:null` rendered as `(not reported)` — never synthesized (journey PASS + s902-protected-revealed.png); the summary-retention run truthfully answers "Protected detail NOT available: … nothing is retained here" with `protectedAvailable:false` surfaced (s902-protected-retention-denied.png); the completed run reveals the verbatim bytes (s902-protected-bytes-revealed.png).

## 4. (c) The jointly-proven navigation — REAL browser, REAL click

Two independent live proofs at the verifier's own ports (screenshots in `qa-artifacts/stage9-g3/verifier-b/` on this branch):

**Builder's journey driver (Puppeteer real Chromium), 21/21 checks PASS** at S902_STUDIO=http://127.0.0.1:5188 (empty variant at 5189): studio login → `/runs`; the run list contains genuine anchor links, e.g. verbatim `{"href":"/runs/run-demo-completed","text":"Open run"}, {"href":"/runs/run-demo-blocked","text":"Open run"}, {"href":"/runs/run-demo-failed","text":"Open run"}` (s902-run-list.png); the detail page for the clicked run renders the dedicated `/runs/run-demo-blocked` route.

**Verifier's OWN click script (real click, no goto for landing)** — `document.querySelector('a[href="/runs/run-demo-blocked"]')` found, `.click()` invoked, `location.pathname` transitioned from `/runs` to `/runs/run-demo-blocked`; landing body contains the run id and the sole `Reveal protected detail` button. Captured: `verifier-s902-run-list.png` (list with genuine anchors: 50 `Open run` anchors on page 1 — the seeded + pagination rows), `verifier-s902-opened-run-detail.png` (the landed detail page after a REAL CLICK, not a programmatic navigation). Full console + run list: `verifier-journey-console-s902-studio-5188-target-4322.log`, `s902-journey-results-verifier.json` (21/21 ok).

## 5. Negatives (unit + live)

- **Unit suite** `apps/studio/tests/run-detail.test.ts` vs the real canned-G1 target over a real loopback socket: individually run — `tests/run-detail.test.ts` 12/12 PASSED, including: distinct detail credential used (only the `token-detail-grant` token passes the /detail endpoint; operator-scope token → 403 scope denial surfaced truthfully), absence of a provisioned detail grant → truthful `unavailable` with no silent downgrade, invalid ids fail closed BEFORE any fetch, pagination reader honors total/hasMore, unreachable target → unreachable outcome; dual-read movement/no-merged-state tests.
- **Empty list** (its own empty fixture target+studio, live): `GET /vict/v1/runs?limit=10&offset=0` → `total:0, runs:[], hasMore:false`, and the surface renders the truthful empty state (s902-empty-list.png).
- **Missing run** (live): `GET /vict/v1/runs/run-does-not-exist` → `404 VICT_RUN_MISSING`; the page renders the truthfully refused banner (s902-missing-run-banner.png); no fabricated content.
- **Actor denial — reproduced and verdict**: the fixture (`apps/studio/scripts/demo-target-s902.mjs:165-180`) upserts `actor-studio-noread` as `status:'disabled'` with `roles:['operator']`. The machinery (`packages/runtime/src/control-types.ts:215-241 authoritativeScopes`) derives scopes per ROLE_SCOPES — every closed role there (incl. `operator`) carries `run.read` (control-types.ts:143-…; viewer too) — so a scope-[] active actor would NOT be a run-read denial and would be dishonest; the builder's derivation is exactly right: a DISABLED actor is the target's own authority derivation (`authoritativeScopes` short-circuits to `[]` for any non-active actor at control-types.ts:220-222) and the target's auth refuses its read — direct live evidence: `GET /vict/v1/runs/run-demo-blocked` with the disabled-actor credential → `403 {"ok":false,"code":"VICT_ACTOR_UNAUTHENTICATED"}`, no state change. **Verdict: YES — the disabled-actor refusal IS an honest target-side demonstration of actor denial** (`default denial` by the target's own closed-vocabulary derivation; no client-side simulated refusal). Residual gap is only the code label (F1, LOW).
- **Pagination** (live, direct API): `?limit=10&offset=0` → total `59`, 10 rows; `?limit=10&offset=50` → first row `run-demo-page-47`, `hasMore:false`; `?limit=50&offset=0` → `hasMore:true`. Builder's journey check PASS; verifier's own check over the distinct p1/p6 offsets PASS (verifier-s902-negatives.json).

## 6. Protected detail under the added targets.ts credential

The only runtime lane touch outside `src/routes/runs/**` and the builder script is `apps/studio/src/lib/server/targets.ts` — an **additive only** entry `studio-operator-detail` (actorLabel `operator-detail`, scopes `{run.read, activation.read, audit.read, agent.stream.read, run.detail}`). Verified at 2c6d52e `targets.ts:69-79`: no existing entry changed (diff shows one inserted block only). The detail credential is resolved strictly as `${target.credentialRef}-detail`; if unprovisioned it truthfully reports `unavailable` (no silent credential downgrade). The verifier's studio deployment provisioned exactly this pair and the detail read worked under only the `-detail` token; the same token family as the fixture actors (`vict-studio-demo-operator`/`-detail`) matches the fixture's `DEMO_*_TOKEN` constants.

## 7. Scope audit `git diff d014d62..2c6d52e` — every hunk classified

20 files, 2578 insertions, 0 deletions. Classification:

- `apps/studio/src/routes/runs/[runId]/+page.server.ts` (+184) — runs-route (G3-B lane).
- `apps/studio/src/routes/runs/[runId]/+page.svelte` (+285) — runs-route.
- `apps/studio/src/routes/runs/[runId]/run-detail-reads.ts` (+442) — runs-route.
- `apps/studio/tests/run-detail.test.ts` (+324) — tests.
- `apps/studio/src/lib/server/targets.ts` (+10) — the additive credential entry (§6).
- `apps/studio/scripts/demo-target-s902.mjs` (+901) — builder's fixture script.
- `apps/studio/scripts/s902-journey.mjs` (+275) — builder's journey script.
- `qa-artifacts/stage9-g3/*.png,*.json` (11 files) — builder artifacts.

**NO `packages/**` touches, NO `definition.ts` change (verified: the FT-1 row-detail binding is the pre-existing platform mechanism; the diff does not alter apps/studio/src/lib/application/definition.ts or any package), NO quellight lane touch, NO product/confirmations/changesets lane touch.**

## 8. Suites + static (this checkout at 2c6d52e)

| command | result |
| --- | --- |
| `npm ci` + full workspace build (`npm run build`; runtime/contracts/ui/sdk/control/application/ui-svelte incl.) | exit 0 |
| full unit suite `npx vitest run --project unit` | run #1 (pre-restart): 2413 passed/1 failed (orchestration-conformance flake); run #2: hook timeout in `packages/builder-kit/test/app-bootstrap.test.ts`; run #3 (final): **122 files, 2414/2414 PASSED** — counts recorded |
| classification of the two flake classes vs baseline 57cc938 | `packages/runtime/test/orchestration-conformance.test.ts` individual run PASSED (48/48) at BOTH 57cc938 (baseline tree) and 2c6d52e; `packages/builder-kit/test/app-bootstrap.test.ts` individual run PASSED (5/5) at BOTH. Both are the known Windows fresh-checkout environmental flake class (heavy temp-dir hooks / timing-dependent flake), REPRODUCED-AT-BASELINE-ONLY noise, non-blocking. |
| apps/studio tests | **97/97** (11 files) PASS |
| apps/studio `npm run check` (svelte-kit sync + tsc --noEmit) | exit 0 |
| root `npm run lint` | exit 0 |
| root `npm run format:check` | "All matched files use Prettier code style!" |
| `node scripts/verify-stage9-inventory.mjs` | **INVENTORY OK — G1 reads on all three surfaces UNAMENDED; G2 confirmation surface accounted** (classification counts recorded by the script) |

## 9. Findings

| id | severity | finding | disposition |
| --- | --- | --- | --- |
| F1 | LOW | The disabled-actor denial surfaces code `VICT_ACTOR_UNAUTHENTICATED` (the disabled actor fails the target's authority derivation before a scope check could name a denial), while S9-02's phrase is "actor denial is clear". The demonstration is still a target-side refusal of the actor's read under its real derived authority (`authoritativeScopes` → `[]` for non-active actors), not a simulated client-side refusal — verdict: honest. The code label is less precise than "actor denied by derivation"; a deployment could tighten the label or the check wording in a later lane. | non-blocking |
| F2 | LOW | The live dual-read renders both snapshots truthfully, but in the verifier's live runs the two sequential reads landed on an unmoving record, so live movement ("CHANGED between reads") was exercised at unit level (`apps/studio/tests/run-detail.test.ts` move/not-move/no-merged-state tests) rather than observed live in one paint. The design (no revision-time read, both snapshots kept visible) is documented verbatim on the page and implemented as specified. | non-blocking |
| F3 | LOW | The verbatim-bytes canary prong is proven live for the completed run and the `(not reported)` prong for the blocked run; both flows' banner texts are fixed strings in `+page.server.ts` (truthfulness by construction, verified by grep and by the negative canaries — blocked-run canary text never appears in another run's detail). No fix needed; recorded for the S9-02 acceptance file only. | non-blocking |

## Interruption recording

Per the revival instruction, recorded honestly: the verifier harness process was killed externally once mid-run (after builds/suites/first journey prep); this run re-derived the journey, click navigation, negatives, unit/total counts (final clean 2414/2414, run #3), and artifacts from scratch. All evidence in this report is from this restarted run unless explicitly marked from the pre-restart phase (only: lint/format/check/inventory exit-0 outputs and the 97/97 and 12/12 runs — all re-verified post-restart as shown in §8).

## Artifacts on this branch

`qa-artifacts/stage9-g3/verifier-b/`: `verifier-s902-run-list.png`, `verifier-s902-opened-run-detail.png`, `verifier-s902-negatives.json`, `s902-journey-results-verifier.json`, `s902-negatives-verifier.json`, `verifier-journey-console-s902-studio-5188-target-4322.log`.