# VICT Stage 09 — G1 Independent Fresh-Context Verification (2026-09-29)

> **Document type:** independent verifier verdict record. The verifier did not build the
> audited candidate, used a fresh clone and separate checkout, and repaired nothing.
> **Audited candidate:** `codex/stage9-g1-foundation` @ EXACT SHA
> `f68c2bbc7426b0ffd4faa947dffdc81dd91f87bb`. **Report branch:** this branch
> (`review/stage9-g1-verification-20260929`).
> **Verdict: PASS WITH NON-BLOCKING FINDINGS** (findings F-1–F-4 below; no blockers).

## 0. Identity checks

| Check | Result |
| --- | --- |
| `git ls-remote origin codex/stage9-g1-foundation` | ✅ `f68c2bbc7426b0ffd4faa947dffdc81dd91f87bb` — remote == audited SHA, byte-exact |
| Base `fd675d9083a32f282820d9e0135c191d691c943c` present in history | ✅ commit object verified |
| Fresh clone + `npm ci` + full `npm run build` | ✅ exit 0 (all workspace builds incl. `tsc -p tsconfig.json` per package) |

Lineage SHAs cited by the evidence record all exist on the candidate branch:
`801ecee0…`, `1249ca87…`, `fd2f57d1…`, `614f82c7…`, `534ac8ae…`, `acc6cbb6…`, `686175df…` — all verified `commit` objects (✅).

## 1. Criterion (a)-GOVERNANCE — SATISFIED

- `git show 5c680d51a0622013cac5349853659a74c1584a98:<file> | sha256sum` for the four frozen
  files, recomputed fresh:
  - `AGENTS.md` → `7b79bd43a7285201deda0412f0f570cdb9844016925ad459b3b92b47085b3e22` ✅ matches record
  - `docs/architecture/STAGE-09-STUDIO-AND-RECOVERY.md` → `1ebb85b06114b3d618d071efaced4f06b7daf26c97294c1f891cb12e5d309b96` ✅
  - `docs/governance/VICT-STAGE-09-STATE.md` → `faaaede40e6a27fd3d5080bcc9bc6e4e285d390dbe3ab646ab806f56f64985e9` ✅
  - `docs/handoff/VICT-STAGE-09-STUDIO-HANDOFF.md` → `50387444566f6ad1348bd94255faad7d5aadb6822024d4e39bd12f8bc1c438df` ✅ (record value byte-compared)
- Amendment `docs/governance/VICT-STAGE-09-G1-PROCESS-AMENDMENT-2026-09-29.md` exists; §2 names EXACTLY the two superseded paragraphs (`AGENTS.md` per-gate owner-report clause; handoff §"Gate protocol" step 6), scope = G1 only, G1 product scope and exclusions declared UNCHANGED.
- Frozen-file diff freeze→candidate: only `docs/governance/VICT-STAGE-09-STATE.md` changed (3 insertions, 1 modification: a dated G1 status block + the G1 gate row becoming IN PROGRESS). `AGENTS.md`, the architecture, the handoff: ZERO diff. No silent frozen-contract rewrite.
- STATE documents the `801ecee0…` checkpoint (explicitly labeled "builder candidate, not a gate verdict; self-reported") and the amendment. Lineage chain in STATE matches the commit chain above.

## 2. Criterion (b)-COMMAND SURFACE — SATISFIED

- `npm run verify:stage9-inventory` → `INVENTORY OK — G1 reads on all three surfaces; divergences classified.` exit 0. Classification counts: pre-existing 18, legacy-mutation 4 (`release.publish`, `release.select`, `release.rollback`, `run.cancel` — all four classified "G2 receipt migration pending; classified"), stage9-g1-read 11, shared 1.
- Independent grep of `packages/server/src/commands.ts` for `run.resolve` / `run.signal`: zero occurrences (exit 1); they appear ONLY as negative assertions in `scripts/verify-stage9-inventory.mjs` (`G2_PENDING = ['run.resolve','run.signal']` — asserted absent). G2 exclusions hold.
- `app.data.action` classified: present in the registry as a legacy mutation with the new `mutation` envelope field; inventory classifies it (pre-existing divergence), consistent with D-4+D-10 (migration gated to G2, not removed in G1).

## 3. Criterion (c)-MECHANICAL GATES at f68c2bb — SATISFIED

| Command | Result | Exit |
| --- | --- | --- |
| `npm run build` (full) | all workspaces build | ✅ 0 |
| `npm run check -w vict-studio` | tsc, no errors | ✅ 0 |
| `npm run test -w vict-studio` | **39/39 across exactly 5 files** (targets 5, boundary 13, adapter 9, app-definition 6, ui/render 6) — matches claim | ✅ 0 |
| `npm run lint` | clean | ✅ 0 |
| `npm run format:check` | all files use Prettier style | ✅ 0 |
| `node scripts/verify-stage9-inventory.mjs` | INVENTORY OK | ✅ 0 |
| `npx vitest run --project unit packages/server` | **174/174, 12 files** — matches claim | ✅ 0 |
| `npx vitest run --project unit` (full) | **2355/2355, 119/119** | ✅ 0 |

FT-4: in THIS verifier's full-suite run the timeout did **not** reproduce (2355/2355 green,
same behavior as the builder's final integrated run). I did not reproduce the timeout, but I
verified the classification document directly against the candidate and reviewed it: it
records three reproducible observations (full-suite timeout at `801ecee` 2354/2355 with no
assertion failure; isolated 65/65 at default and at 30s; 263/263 under moderate parallel
load), classifies it as test-infrastructure resource starvation on Windows, pre-existing
since Stage 8 G4, unchanged by G1, remedied by a per-file timeout/serialization rather than
silently absorbed — and retains it in the follow-up register. **The classification is
truthful and visible. Not reproduced this run is not an inconsistency: the failure is
declared load-sensitive on both sides.**

## 4. Criterion (d)-STUDIO BOUNDARY + APP — SATISFIED

Code reads (exact candidate):
- `session.ts`: cookie = `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`; sessions in-memory, expiry-enforced; CSRF token session-bound, surfaced only through `locals`; credential secrets never returned.
- `hooks.server.ts` enforcement order confirmed by reading the handler: (1) cookie→session, (2) Origin/Host same-origin for all non-GET/HEAD (403 `VICT_STUDIO_ORIGIN`, non-echoing) — BEFORE the login exemption and CSRF check, (3) JSON→session + `x-vict-csrf` (403 `VICT_STUDIO_CSRF` / 401), (4) unauthenticated navigation → 303 `/login`, others 401, (5) exactly `/login` GET+POST, `/logout` POST, static assets exempt.
- Adapter is fetch-only: `grep 'VictStores'` over `adapter.ts` + `vict-client.ts` → only a comment stating NO VictStores import; zero actual store imports (import list verified by hand: only SDK/contract types + `callTarget`). `mutate()` returns `DATA_MUTATION_NOT_DECLARED` unconditionally.
- `vict-client.ts` path policy: path must be EXACTLY a `RESOURCE_BINDINGS` listPath/getPath instance, every param validated against the bounded ID grammar pre-fetch, missing params rejected, query params allowlisted by binding `listQuery`, hostile values dropped, 4s timeout, token never in results/logs.
- Custom component `cmp.target-connection-status@1` registered via `createComponentRegistry('registry.studio','1')` in `apps/studio/src/lib/components/registry.ts` with a named justification comment (component + TargetConnectionStatus.svelte).

Definition ↔ contract exactness: all 9 resources (`runs, runEvents, runWaits, activations, selectedActivations, releases, releaseSelections, auditEntries, targetStatus`) in `definition.ts` match `RESOURCE_BINDINGS` in `src/lib/shared/contract.ts` field-for-field (side-by-side compared; identity keys `runId/seq/waitId/activationVersion/graphId/releaseId/releaseId/auditId/id` all match). Every resource `mutations: []`; `actions: []`; six routes exactly (`/, /runs, /runs/:runId, /activations, /releases, /audit`); `run-detail` param `:runId` == runs `identityField: 'runId'`; no list screen declares any navigation surface (FT-1 note text ships instead); FT-1 guard test present and passing (`tests/ui/render.test.ts`: asserts `[data-surface] a[href]` and `tr a[href]` are zero on the runs list and re-asserts no anchors elsewhere).

## 5. Live journey (verifier-booted stack: demo target :4310, dev :5173)

| Step | Observed (re-derived) |
| --- | --- |
| (a) wrong secret / unknown label (Origin present) | identical non-echoing 401 failure bodies; no echo of input ✅ |
| (b) correct login `operator/studio-local-pass` | 303 `/`; `Set-Cookie: vict_studio_session=…; Max-Age=28800; Path=/; HttpOnly; SameSite=Lax` — flags confirmed byte-for-byte ✅ |
| (c) GET `/` with cookie | 200 HTML; contains "TARGET CONNECTION"/"Target connection" (2×), "Selected activations", `g.studio-demo` + `v1_ab66cb…` activation ✅ |
| (d) GET `/runs` | no `<a href>` inside data surfaces (only shell nav links, which the FT-1 test scope excludes); truthful FT-1 text present ✅ |
| (e) GET `/runs/run-demo-blocked` | 200; durable wait `wait-demo-signal` (kind signal, `demo.resume`, status `"open"`) visible in render + hydration ✅ |
| (f) D-5 direct | operator token → **403 `VICT_ACTOR_SCOPE_DENIED`**; detail token → **200** `protectedAvailable:true` with real protected output bytes; `run-demo-failed` → **200** `protectedAvailable:false`, `protectedOutput:null`, `retention:"summary"`; audit `?subjectType=run&subjectId=run-demo-completed` → `run.detail.accessed` attributed to `actor-studio-detail` ✅ |
| (g) negatives | POST `/runs` session+JSON+same Origin **no** `x-vict-csrf` → 403 `VICT_STUDIO_CSRF` ✅; Origin `http://evil.example` → 403 `VICT_STUDIO_ORIGIN` ✅; unauthenticated browser-like GET `/` → **303 /login** ✅ |
| (h) leak canary | all Studio routes fetched with the session into one buffer; grep for `vict-studio-demo-operator`, `vict-studio-demo-detail`, `vict-studio-WRONG-token`, `studio-local-pass`: **0 hits** ✅ |

Note: POSTs without an Origin header are rejected with `VICT_STUDIO_ORIGIN` before the login
step (hooks order (b) before (e)) — verified, consistent with the fail-closed order.

## 6. Evidence-record cross-check (item 7)

Reproduced: test counts (39/39, 174/174, 2355/2355), D-5 outcomes (403/200+protected/retention-truthful), audit entry, CSRF/Origin negatives, 303, cookie flags, FT-1 zero anchors, durable wait. Screenshots `02…08` exist at HEAD. NOT REPRODUCED / artifact gaps:

- **F-1 (NON-BLOCKING, record accuracy):** the evidence record (§5, line 61) claims screenshot `01-login-failed-nonechoing.png` "(saved)". That file is absent from `qa-artifacts/stage9-g1/shots/` and never appears anywhere in the branch or its history. Unverifiable claim in the record.
- **F-2 (NON-BLOCKING, reference integrity):** `VICT-STAGE-09-STATE.md` (G1 gate row) and the evidence record §2 cite builder reports `qa-artifacts/stage9-g1/studio-server-report.md` and `studio-app-report.md`; no such files exist on the branch or in its history. The substantive claims they would support were nevertheless independently re-derived by this verifier (§4–§5), so nothing in scope depends on them.
- **F-3 (NON-BLOCKING, artifact hygiene):** `07-responsive-390px.png` and `07b-responsive-390-nav.png` are byte-identical (same blob hash `2f5393a4…`), so the "nav" screenshot is a duplicate of the full-page one.
- **F-4 (NON-BLOCKING, classification):** FT-4 did not reproduce in this verifier's full-suite run (green 2355/2355). Consistent with the documented load-sensitive classification; noted so the record's "failure reproduced at checkpoint / green at final SHA" narrative is understood as machine-load-dependent, not as a fix.

All other evidence-record claims checked in §1–§5 reproduced exactly.

## 7. Exclusions re-checked at f68c2bb

- No `run.resolve` / `run.signal` commands anywhere (source + inventory negative assertion) ✅
- No FT-1 implementation, no S9-02 drill-down claim: no row links, truthful FT-1 text, guard test ✅
- No Quellight edits (branch diff vs base contains zero Quellight paths) ✅
- No publication, no production activation (no publish/activate flows introduced; `release.publish` remains G2-classified) ✅
- Adapter strictly read-only; `mutate()` never successful ✅

## 8. Commands actually run (all exit-true)

`git clone`, `git fetch`, `git ls-remote`, `git checkout f68c2bb`, `npm ci`, `npm run build`, `npm run verify:stage9-inventory`, `npm run check -w vict-studio`, `npm run test -w vict-studio`, `npm run lint`, `npm run format:check`, `node scripts/verify-stage9-inventory.mjs`, `npx vitest run --project unit packages/server`, `npx vitest run --project unit`, `git show <freeze>:<file> | sha256sum` (×4), source greps (`run.resolve|run.signal|VictStores`), `node apps/studio/scripts/demo-target.mjs`, `npm run dev -w vict-studio -- --port 5173 --host 127.0.0.1`, the curl journey in §5, `git cat-file -t` over 8 lineage SHAs, `git diff 5c680d5..HEAD`.

## 9. Verdict

**PASS WITH NON-BLOCKING FINDINGS.** Every G1 criterion at the exact candidate SHA
`f68c2bbc7426b0ffd4faa947dffdc81dd91f87bb` is independently reproduced; the four failures in
the record are documentation/artifact-hygiene items (F-1–F-4), each severity NON-BLOCKING.
No repair was made and nothing was merged by this verifier.
## 10. Addendum (2026-09-29) — post-disposition re-verification at fb63b91

The stage manager dispositioned findings F-1–F-4 and pushed a follow-up commit. This
addendum records the re-verification of the AFFECTED CLAIMS ONLY, by the same verifier,
at the new exact SHA.

- **Candidate SHA change check:** `git ls-remote origin codex/stage9-g1-foundation` →
  `fb63b910b2e330574cb9c24708125f17e66a4256` (exact match, byte-exact). `git diff --name-only
  f68c2bb..fb63b91` shows EXACTLY five paths: `docs/governance/VICT-STAGE-09-G1-EVIDENCE-2026-09-29.md`,
  `docs/governance/VICT-STAGE-09-STATE.md`, `qa-artifacts/stage9-g1/shots/07b-responsive-390-nav.png`
  (deleted), `qa-artifacts/stage9-g1/studio-app-report.md` (new), `qa-artifacts/stage9-g1/studio-server-report.md`
  (new). **NO `src/`, `packages/`, `apps/`, or production change**; frozen bytes (`AGENTS.md`,
  architecture, handoff) also diff-clean. ✅
- **R-1 (F-2):** `qa-artifacts/stage9-g1/studio-server-report.md` (101 lines) and
  `studio-app-report.md` (104 lines) now EXIST, are tracked at fb63b91, and their content
  matches the builders' reported facts (server track: 614f82c7 @ origin, exclusive path set,
  boundary/session/targets/probe deliverables, 174 server suite at integration, in-memory
  session, open integrator questions; app track: 534ac8ae, real `app.vict-studio@1` definition
  per RESOURCE_BINDINGS, `registry.studio@1` with the named component, 12 tests, FT-1
  no-row-link guard) — consistent with everything this verifier independently re-derived at
  f68c2bb (§4–§5 of this report). ✅
- **R-2 (F-3):** `07b-responsive-390-nav.png` REMOVED at fb63b91; `07-responsive-390px.png`
  retained (verified in the diff and the tree). ✅
- **R-3 (F-1):** grep over the amended evidence record and STATE for `01-login` and `(saved)`:
  **zero occurrences**; the record now truthfully states the login-failed screenshot was NOT
  captured and explains what proves the non-echoing behavior instead (boundary unit test +
  this verifier's live reproduction). ✅
- **R-4 (citation):** the evidence record §1/§7 and the STATE G1 gate row cite the verdict
  **PASS WITH NON-BLOCKING FINDINGS**, the report branch `review/stage9-g1-verification-20260929`,
  and the exact SHA `3d03d4c0c585484f1a5d4501729925fd329ea23d` — byte-exact. ✅
- **R-5 (verifier report integrity):** `git show 3d03d4c…:docs/governance/VICT-STAGE-09-G1-VERIFICATION-2026-09-29.md | sha256sum` →
  `853c5336c5283f6372faa981f1033d5bda19235dbc04198cb0bfe244cf80262a` — unchanged; original
  sections above are unmodified by this addendum. ✅

**Addendum verdict: PASS WITH NON-BLOCKING FINDINGS — unchanged.** All dispositioned items
(F-1, F-2, F-3 dispositioned as corrected truthfully/disposed; F-4 no action) now hold;
the repairs are evidence-record and artifact corrections ONLY, exactly as scoped; no new
finding from this re-verification.
