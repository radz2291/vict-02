# VICT STAGE 09 — G3-C FRESH GATE RE-VERIFICATION, ROUND 2 (incremented Quellight, criteria (d)/(e) re-ruling)

- Date: 2026-09-30
- Verifier: fresh-gate verifier (independent of the builder; run restarted ONCE after an external process kill — every live datum below was re-derived after the restart; see §6 interruption disclosure)
- Integrated candidate audited: `codex/stage9-g3-proposal` @ `2c6d52e54ab4a9f6974efbd2f350190ce72852b7` (verified via `git ls-remote`; not moved)
- Incremented target audited: fresh clone of https://github.com/radz2291/Quellight.git, `origin/main` = `5f709a5` (ls-remote confirmed unchanged), checked out at `codex/stage9-g3-c2-boundary-actors` @ `1f7dcdcbbffdd58901c1eb478f6492aa106f4ba7` (the independently VERIFIED increment tip; its verification = `review/stage9-g3-c2-verification-20260930` @ `57ebabb`, ls-remote confirmed).
- Verification branch: `review/stage9-g3-c-reverification-20260930` (this report + verifier-c2/ screenshots + transcripts only).

## 1. VERDICT

**PASS. G3-C RE-VERIFICATION ACCEPTED — criterion (d) AGENT-IDENTITY REFUSAL and criterion (e) UNDERPRIVILEGED DENIAL each flip from NOT DEMONSTRATED (round 1, 381905c-era) to DEMONSTRATED on the verifier's own live evidence against the incremented target.**

The Quellight C2 increment (second boundary actor `agent-quellight-agent-context` + actor-derived `qlt.inspection.read` grant) is REAL end-to-end: the distinct agent identity is resolved through the target's own boundary authenticator and refused on the operator inspection surface by the target's OWN authorization, exactly per the C2 entry contract. Quellight's tree stayed byte-clean throughout. No blocker. Non-blocking findings in §7 (including an honest correction of the round-2 expectation about WHICH refusal code the page renders).

## 2. LIVE STACK (verifier's own, re-derived after the restart)

```
Quellight: fresh clone, HEAD pinned 1f7dcdcbbffdd58901c1eb478f6492aa106f4ba7 before ANY use
           its own scripts: npm run dev -- --host 127.0.0.1 --port 6059 --strictPort
           env: QUELLIGHT_ACTOR_TOKEN=<redacted>  QUELLIGHT_AGENT_ACTOR_TOKEN=<redacted>  (distinct values, generated in-process)
           data dir: gitignored/untracked absolute dir OUTSIDE the repository
           offline deterministic mode confirmed at journey time (GET /api/health:
           {"modelMode":"offline-fixture","releaseVersion":"quellight-local-1"} — no live provider)
Boundary port discovery (documented method — runtime.ts: "The loopback VICT boundary is bound
           on an ephemeral 127.0.0.1 port"): netstat -ano scan of the PID that owns the dev
           server's :6059 listener → the SAME PID owns a second 127.0.0.1 listener = the DIRECT
           loopback boundary port, EPHEMERAL: 64829 (post-restart value; recorded below).
APP ORIGIN: http://127.0.0.1:6059 (serves the declared act ingress POST /api/act; its /vict
           proxy re-injects ONLY the operator token — the agent identities are exercised on the
           DIRECT boundary port, exactly per C2 S3).
Studio:    fresh VICT checkout @ 2c6d52e; vite dev, port 6101; provisioned per targets.ts:
           VICT_STUDIO_TARGETS=[quellight entry @ http://127.0.0.1:64829, credentialRef quellight-operator]
           VICT_STUDIO_CREDENTIALS={quellight-operator:<op>, quellight-agent:<agent>} (BOTH quellight credentials)
           VICT_STUDIO_QUELLIGHT_TURN={threadId, turnId from the LIVE turn}
           VICT_STUDIO_QUELLIGHT_PROVENANCE={quellightRef:"commit 1f7dcdcbbffdd58901c1eb478f6492aa106f4ba7 (Quellight branch codex/stage9-g3-c2-boundary-actors)", declaredReleaseIdentity:"vict-release-set@1/0.3.1"}
           VICT_STUDIO_QUELLIGHT_APP_ORIGIN=http://127.0.0.1:6059
           VICT_STUDIO_HUMAN_CREDENTIALS={verifier}
Real product turn: created through Quellight's OWN product admission (POST /api/act
           act.createThread → POST /api/threads/<id>/turns), terminal status `completed`.
```

**TRANSPORT PROVENANCE VERDICT (round-2 question):** `targets.ts` declares only
id/label/endpoint/credentialRef; the provenance is NOT invented by the transport —
`quellight-transport.ts` takes `QuellightProvenance { quellightRef, declaredReleaseIdentity,
recordedAtLabel:'provenance' }` verbatim from deployment provisioning
(`VICT_STUDIO_QUELLIGHT_PROVENANCE`, `+page.server.ts:87-99`) and renders it LABELED
`"recordedAtLabel": "provenance"` on the page, "never claimed to be a runtime oracle".
At the C2 tip the ref is the branch tip 1f7dcdc (not main 5f709a5) and the provisioned
ref is TRUTHFUL: it names the exact branch commit the fixture ran (pin oracle (iv)
honest-labeled path). The frozen inspect pins (`health`/`compatibility`) still match the
live target byte-for-byte (§4), so the frozen contract survives the increment exactly as its
own honesty caveat prescribes: record equality is evidence, the behavioral anti-newer probe
+ labeled provenance carry discrimination. **Recorded provenance stays TRUTHFUL at the C2 tip.**

## 3. PAGE-LIVE EVIDENCE (real headless Chrome on MY Studio; verifier-c2/shot-product-full.png + g3c-browser-evidence.json)

- (b) PASS — banner verbatim: "SAME-TURN alignment demonstrated: the target's own turnId appears in BOTH answers (turn-05042e4a-fba2-4cd8-a115-7424209cd61f)"; Read 1 (`agent.turn.get` turn record) and Read 2 (inspection `getTurn` row via `/api/act`) BOTH carry that turnId.
- (c) PASS — operator allow: turn record rendered (fields turnId/streamId/threadId/actorId/status:completed/traceId); inspection Read 2 answered under the operator credential.
- (d) PASS (see ruling §5) — refusal panel rendered: `{"command":"agent.turn.get","succeeded":false,"refusalCode":"VACT..."}` verbatim below; `singleActor` no longer true → the round-1 NOT-DEMONSTRATED single-actor banner DOES NOT RENDER (absent, `singleActorBanner: null`).
- whoami DIFF rendered: `["actorId","roles","scopes","mastraResourceId"]` with BOTH whoami answers rendered in full.
- (k) PASS — verbatim: probe `{"command":"run.get","refused":true,"code":"VICT_HTTP_ROUTE_UNKNOWN"}`; provenance record `{"quellightRef":"commit 1f7dcdc... (Quellight branch codex/stage9-g3-c2-boundary-actors)","declaredReleaseIdentity":"vict-release-set@1/0.3.1","recordedAtLabel":"provenance"}`; capability banner verbatim.
- (g) PASS — served page/hydration contains NEITHER token value (script-check: `secretLeak=false`).

## 4. PIN INTEGRITY AFTER THE INCREMENT (criterion 4 of the brief)

Live answers at journey time (both tokens, direct boundary), compared to the frozen pins in `quellight-transport.ts` (PINNED_HEALTH_RECORD / PINNED_COMPATIBILITY_RECORD):

- health.inspect (operator AND agent-context, byte-identical): `{"healthy":true,"commandSchema":"vict.command@1","streamSchema":"vict.agent-stream@1"}` — BYTE-EQUAL to the pin.
- compatibility.inspect (operator AND agent-context, byte-identical): `{"commandSchema":"vict.command@1","streamSchema":"vict.agent-stream@1","changesetSchema":"vict.changeset@1","turnSchema":"vict.agent-turn@1"}` — BYTE-EQUAL to the pin.
- run.get probe (`GET /vict/v1/runs/qlt-probe-nonexistent`): STILL REFUSED `VICT_HTTP_ROUTE_UNKNOWN` HTTP 404.

**No BLOCKER: the increment did NOT change the pinned inspect answers.**

## 5. (d) AGENT-IDENTITY REFUSAL and (e) UNDERPRIVILEGED DENIAL — RULING with the honest (d)/(e) difference

LIVE wire evidence (direct boundary 64829; operator vs the SAME request → different outcomes; tokens redacted):

- OPERATOR `GET /vict/v1/turns/turn-05042e...` → HTTP 200 turn record (allow).
- AGENT-CONTEXT `GET /vict/v1/turns/turn-05042e...` (identical request) → HTTP 404 `{"ok":false,"code":"VICT_TURN_ACTOR_MISMATCH"}` — REFUSED BY THE TARGET.
- `actor.whoami`: operator `actor-quellight-local` (roles developer+operator, 18 scopes incl. app.data.write/operator.resolve) vs agent `agent-quellight-agent-context` (roles developer only, 12 scopes, NO `app.data.write`, NO `operator.resolve`) — WHOAMI DIFF IS THE IDENTITY EVIDENCE; distinctness demonstrated, not assumed.
- (e) DIRECT: agent-context `app.data.query` on `qlt.inspection` → refused INSIDE Quellight's own read-boundary authorization: `{"ok":false,"code":"DATA_UNAUTHORIZED","message":"Access to resource 'qlt.inspection' requires permission 'qlt.inspection.read'."}` — reproduced on MY OWN run of the target's own demo machinery (scripts/demo-g3c2-boundary-actors.mjs, its own offline-deterministic composition, tokens generated in-process, REDACTED transcript in verifier-c2/) through the REAL boundary authenticator + released app.data.query machinery; operator SAME surface SUCCEEDS; health/compatibility inspect byte-identical for both tokens (S4). The agent-context whoami proves the denial is the missing permission, not an authentication failure. No mutation verb anywhere.

**HONEST (d)/(e) DIFFERENCE (the round-2 ruling, per D-8 wording):**

- **(d) agent-identity refusal — DEMONSTRATED, identity-class.** The denial turns on WHO is presenting (the distinct `agent-quellight-agent-context` identity, resolved through the target's own boundary authenticator), not on any scope the caller lacks: the agent context HOLDS `run.read` (the scope `agent.turn.get` is granted under) and is STILL refused the operator-surface turn record because the record's owner actor differs. The page renders this target refusal (succeeded:false + refusalCode) with the whoami DIFF beside it; single-actor NOT-DEMONSTRATED banner is gone.
- **(e) underprivileged denial — DEMONSTRATED, permission-class.** The denial names the missing AUTHORIZATION explicitly: `DATA_UNAUTHORIZED — requires permission 'qlt.inspection.read'` on the actor-derived inspection grant; authentication and `app.data.read` SUCCEEDED before the refusal; the operator identity on the SAME surface succeeds. Identity is not the issue; the permission grant is.
- **Honest correction to the round-2 expectation:** the page's (d) attempt renders the target's own refusal code `VICT_TURN_ACTOR_MISMATCH` (HTTP 404), not the literal code `DATA_UNAUTHORIZED`. `DATA_UNAUTHORIZED` is the target's code on the INSPECTION surface (criterion (e)), and the released `app.data.query` GET transport structurally cannot carry the bounded object filter container over the wire (direct `GET /vict/v1/app/query` answers `VICT_APPDATA_FILTER_INVALID`; `POST` is `VICT_HTTP_METHOD_UNSUPPORTED`), which is exactly why the C2 contract's own demos (and the Studio transport's inspection Read-2 via the declared `/api/act` act ingress under the operator token) cross the in-process released command boundary the browser proxy drives. Both demonstrations are the target's OWN real machinery; nothing is simulated client-side. The two codes are DIFFERENT answers to DIFFERENT surfaces and both are truthful; the D-8 identity-class/permission-class distinction holds. Severity: LOW (expectation wording, not a behavior gap).

## 6. INTERRUPTION DISCLOSURE (honesty)

The verifier's round-2 run was killed externally once mid-journey (harness-reconciled; not a failure of any audited system). Consequences and treatment: both runtimes and all listening processes died with it; the ephemeral boundary port CHANGED (pre-kill 49211 → post-restart 64829). EVERY live datum in this report ((b),(c),(d),(e), pin byte-equality, whoami DIFF, screenshots, curl transcripts, the C2 demo reproduction) was re-derived AFTER the restart against fresh turn turn-05042e4a and the post-restart boundary. Nothing in this report claims evidence captured before the kill. Both checkouts survived the kill byte-untouched at their pinned SHAs (2c6d52e / 1f7dcdc; verified HEADs; Quellight porcelain EMPTY before reuse).

## 7. QUIELLIGHT PURITY (criterion l) + FINDINGS

- Fresh clone: `origin/main` = `5f709a5...` (ls-remote, unchanged); checked out `codex/stage9-g3-c2-boundary-actors` @ `1f7dcdc...`; HEAD re-verified before and after the entire journey: `1f7dcdcbbffdd58901c1eb478f6492aa106f4ba7`; `git status --porcelain` EMPTY and `git diff` EMPTY at every check; tracked-tree hash byte-identical before/after (`8b21d1df3027eaa04b533abf54641724a409f71f`). Runtime SQLite + tsx scratch files live in untracked/ignored paths or OUTSIDE the tree.
- Findings (severity-tagged):
  - L-1 (LOW, carried by the C2 verification): Quellight's COMMITTED package-lock is stale (npm ci fails on missing esbuild optional-dep entries); verifier installed with `npm install --package-lock=false` — no tracked file changed. Pre-existing upstream hygiene gap, NOT in scope for the increment (C2 S4 forbids lockfile repair).
  - L-2 (LOW, expectation wording): the page's (d) refusal code is `VICT_TURN_ACTOR_MISMATCH` (identity-class) rather than the expected literal `DATA_UNAUTHORIZED`; `DATA_UNAUTHORIZED` is the (e) inspection-surface code. See §5; both refusals real and target-side.
  - L-3 (LOW, environment): Windows fresh-checkout unit-suite class — 9–11 failures across two runs were ALL environment-class (git-CLI fixture timeouts under load; child-process tests requiring sibling workspace `dist` builds that the round's build list does not include; scaffolder build missing `@victframework/appdata-sqlite` dist). After building the sibling dist packages, ALL affected test files re-ran GREEN (21 files / 269 tests, incl. every previously failing class). No G3-C code failed anywhere.
  - N-1 (NOTE): interruption of the verifier run — see §6.
- No HIGH/MEDIUM/BLOCKING findings.

## 8. SUITES + STATIC GATES (run by the verifier at 2c6d52e)

| Gate | Result |
|---|---|
| unit suite (root, vitest unit project) | 2414 total; full-suite Windows fresh-checkout class failures §7 L-3; affected classes re-run green after sibling dist builds — aggregate GREEN |
| apps/studio tests | **97/97** PASS |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `verify-stage9-inventory` | **INVENTORY OK** (classification counts unchanged: pre-existing 20, legacy-mutation 4, stage9-g1-read 11, shared 1, g2 6) |
| builds | runtime/control/sdk/application/ui(-svelte) per brief + contracts/appdata-sqlite/store-sqlite/kernel/server for the dist-dependent suites |

Quellight C2-side evidence consumed: increment verification already VERIFIED at `review/stage9-g3-c2-verification-20260930` @ `57ebabb`; my OWN live demos reproduced (whoami DIFF, DATA_UNAUTHORIZED, operator allow, byte-identical inspects) against my own stack — not merely re-read.

## 9. CRITERION TABLE (a)–(m) — current evidence

| Criterion | Verdict | Evidence |
|---|---|---|
| (a) version-aware transport, fail-closed identity pin | PASS | `quellight-transport.ts` at 2c6d52e: four-oracle pin, fail-closed on every step; round-1 audit carries (unchanged file); this round consumed LIVE |
| (b) same-turn pairing aligned on ONE turnId in both reads | PASS (LIVE) | banner verbatim with turn-05042e4a... in BOTH answers; screenshot |
| (c) operator allow | PASS (LIVE) | turn record + inspection row under the operator credential (page + curl) |
| (d) agent-identity refusal | **PASS — DEMONSTRATED (LIVE, flipped from round-1 NOT DEMONSTRATED)** | target refuses the distinct agent context on the operator surface (`VICT_TURN_ACTOR_MISMATCH` 404); whoami DIFF rendered; single-actor banner absent ruling §5 |
| (e) underprivileged denial via Quellight's own authorization | **PASS — DEMONSTRATED (LIVE, flipped)** | `DATA_UNAUTHORIZED` + explicit `qlt.inspection.read` permission message; operator same-surface succeeds; C2 S2 honored |
| (f) safe projections only / no invented data | PASS | generic renderer, truthful banners for every failure path (round-1 audit; failure paths exercised: pin failure, not-retrieved) |
| (g) no browser-held target credential | PASS (LIVE) | served page contains no token value (script-verified false) |
| (h) no Quellight-specific UI branching | PASS | product view holds no target-name branch (round-1 audit; file unchanged) |
| (i) direct-API negative set | PASS (LIVE) | agent turn.get 404 refusal; anti-newer run.get refused; GET app/query filter-container guard |
| (j) target isolation | PASS | cross-target/foreign-credential refusal before any fetch (round-1 audits; file unchanged); live stack resolved ONLY the quellight entry |
| (k) target/version evidence | PASS (LIVE) | inspect answers byte-equal to pins; anti-newer probe refused; provenance labeled and TRUTHFUL (branch-tip ref) — §2 verdict |
| (l) Quellight repo byte-untouched at its live ref | PASS (LIVE) | §7: HEAD 1f7dcdc before/after, porcelain empty, tree hash identical |
| (m) capability honesty banner differs from the demo target | PASS | banner verbatim (§3) requiring+confirming the run.get refusal; demo-target world differs (round-1 spy evidence; mechanism unchanged) |

## 10. ROUND-2 EXIT RULING

- (d) **DEMONSTRATED** — identity-class refusal, agent-context identity, target's own boundary authorization, rendered in the page.
- (e) **DEMONSTRATED** — permission-class denial, actor-derived `qlt.inspection.read`, `DATA_UNAUTHORIZED`, explicit permission message.
- All other (a)-(m) criteria remain verified with current live evidence at 2c6d52e × 1f7dcdc.
- Pin integrity held across the increment (no BLOCKER).
- G3-C may proceed to the exit-consumption steps recorded in the frozen contract.

Evidence artifacts committed alongside this report: `verifier-c2/shot-product-full.png`, `verifier-c2/g3c-browser-evidence.json`, `verifier-c2/live-curl-transcripts.txt`, `verifier-c2/g3c2-demo-reproduction.txt`, `verifier-c2/suites-unit-reclassified.log`, `verifier-c2/port-discovery.txt`.