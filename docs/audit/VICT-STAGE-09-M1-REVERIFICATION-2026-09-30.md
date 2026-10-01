# STAGE 9 EXIT-AUDIT FINDING M-1 — INDEPENDENT FOCUSED RE-VERIFICATION (2026-10-01)

## Verdict: **M-1 RESOLVED**

The repair `a7c8d6c9d4712fc087908649270746dafa606a55` (branch `codex/stage9-g3-m1-repair`,
remote-verified byte-equal via `git ls-remote` at re-verification time) resolves the
Studio act-ingress `content-type` defect. The same-turn Read 2 act-ingress POST now
succeeds (HTTP 200) under **production serving** of BOTH sides (Studio adapter-node and
Quellight adapter-node), and the two regression surfaces (agent-identity refusal,
anti-newer version probe) still behave truthfully at the repaired head. This record
supersedes the earlier focused check that ruled M-1 RESOLVED but preserved no
reviewable record.

- Repaired code SHA verified: `a7c8d6c9d4712fc087908649270746dafa606a55`
- Repair diff scope verified: `git diff a7c8d6c~1 a7c8d6c --stat` = exactly 2 files
  (`apps/studio/src/lib/server/quellight-transport.ts` +7 lines incl. the
  `content-type: application/json` header fix;
  `apps/studio/tests/quellight-transport.test.ts` +63 lines incl. the
  'M-1 REPAIR' test).
- Studio suite at the repaired head (fresh `npm ci`, packages
  runtime/control/sdk/application/contracts/ui/ui-svelte (+ kernel) built first):
  **98/98 passed** (11 files). The 'M-1 REPAIR — every POST carries content-type
  application/json (production CSRF survival)' test passes individually
  (`tests/quellight-transport.test.ts`: 10/10).

## The ORIGINAL RED M-1 (quoted verbatim from the Stage 9 exit audit)

Source: `docs/audit/VICT-STAGE-09-EXIT-AUDIT-2026-09-30.md` at
`b240932dcefb1b0f08edf00c07d24b2fafbecccb` (branch `review/stage9-exit-audit-20260930`):

> - **M-1 (Major, non-blocking for the accepted dev-mode evidence; MUST be
>   repaired before any production-serving/activation claim):** the Studio
>   Quellight transport's act-ingress POST
>   (`apps/studio/src/lib/server/quellight-transport.ts`, `callTargetCommand` →
>   `/api/act`) sends **no `content-type` header**. SvelteKit's production
>   CSRF guard rejects it with **403**, so the same-turn panel's Read 2 fails
>   (`HTTP_CONNECTION_UNAVAILABLE`) whenever the Quellight app is served in
>   production mode (`vite preview` / adapter-node). Empirically: no-ct=403,
>   with-ct=200, no-ct+matching-Origin=200, dev server no-ct=200. All accepted
>   G3-C Studio-side evidence was captured in dev mode. The auditor did NOT
>   repair. Retain and fix in a bounded, separately verified increment.

## Reproduction method (independent, this machine, 2026-10-01)

Fresh clones; no repo mutation other than this record. Full wire-level transcript
(tokens REDACTED): `evidence/m1-reverification-2026-09-30-read2-curl-proof.log`.

1. **Quellight** fresh clone at origin/main `40b6c35cfb74588b8aee835f92a6214f55cc6621`
   (byte-pure across `npm install --package-lock=false`: porcelain empty, HEAD
   unchanged). Dev server on port 4739 (`--strictPort`) with the two actor tokens
   provisioned via env (values REDACTED here; recorded in the run environment only).
   The dev server binds `[::1]:4739`; the embedded raw vict boundary is
   **lazy-composed** and was discovered by `netstat` on the dev-server PID:
   `127.0.0.1:57921`. `GET /vict/v1/actor/whoami` → 200 for both tokens.
2. **Real turn via product admission on the app port (:4739):**
   `POST /api/act {"actionId":"act.createThread"}` → threadId
   `qlt-c9b5b0afd115302c87bc41e4`;
   `POST /api/threads/qlt-c9b5b0afd115302c87bc41e4/turns {"input":"Hello"}` →
   turnId `turn-6b6b5e46-b557-41eb-a7d1-6de5ef4f7d2c`, terminal status **completed**
   (confirmed via `GET /vict/v1/turns/<turnId>` on the boundary → 200).
3. **Studio PRODUCTION:** `npm run build` (adapter-node), `node build` on port 4741
   with `ORIGIN=http://localhost:4741` and the deployment env
   (`VICT_STUDIO_TARGETS` pointing at `http://127.0.0.1:57921`, `VICT_STUDIO_CREDENTIALS`,
   `VICT_STUDIO_QUELLIGHT_TURN={threadId,turnId}` above,
   `VICT_STUDIO_QUELLIGHT_PROVENANCE={"quellightRef":"Quellight main 40b6c35 (integrated)","declaredReleaseIdentity":"vict-release-set@1/0.3.1"}`,
   `VICT_STUDIO_QUELLIGHT_APP_ORIGIN=http://localhost:4739`).
4. **REAL browser (Playwright headless Chromium) on production `/product`:**
   logged in via the human session form, then the same-turn journey.

### Live results at the repaired head (production serving)

- **Same-turn panel: ALIGNED.** Banner: "SAME-TURN alignment demonstrated: the
  target's own turnId appears in BOTH answers (turn-6b6b5e46-b557-41eb-a7d1-6de5ef4f7d2c)."
  Read 1 (boundary `agent.turn.get`, GET → 200) and Read 2 (act-ingress POST
  `/api/act` `act.queryInspection`, → **200**) both carry the same turnId.
  Screenshot: `evidence/m1-reverification-2026-09-30-aligned-panel.png`
  (full page: `evidence/m1-reverification-2026-09-30-product-fullpage.png`).
- **Read 2 server-side proof:** direct curl reproduction of the SAME POST with the
  SAME headers (`content-type: application/json`, `origin` of the studio deployment)
  against **PRODUCTION-served Quellight** (adapter-node `node build`, port 4742):
  **HTTP 200** with the inspection row whose `details.turnId` equals the Read 1 turnId.
- **Negative control (the original red mechanism, reproduced):** the same POST body
  with `content-type: text/plain;charset=UTF-8` (what an undici/browser fetch POST
  with a JSON string body and NO explicit content-type sends) against
  production-served Quellight → **HTTP 403 "Cross-site POST form submissions are
  forbidden"** (SvelteKit production CSRF guard). With `application/json` → 200.
  The identical no-content-type POST against the DEV server (:4739) returns 200,
  confirming the original audit's dev-mode masking matrix.
- **Refusal regression: INTACT.** Agent-context credential against the operator
  surface: `{"command":"agent.turn.get","succeeded":false,"refusalCode":"VICT_TURN_ACTOR_MISMATCH"}`.
  whoami DIFF evidence (distinct actorIds, demonstrated not assumed):
  `["actorId","roles","scopes","mastraResourceId"]` —
  `actor-quellight-local` vs `agent-quellight-agent-context`.
  Screenshot: `evidence/m1-reverification-2026-09-30-refusal-banner.png`.
- **Version-probe regression: INTACT.** `run.get` anti-newer probe:
  `{"command":"run.get","refused":true,"code":"VICT_HTTP_ROUTE_UNKNOWN"}` (fail-closed)
  with the capability-honesty banner rendered.
  Screenshot: `evidence/m1-reverification-2026-09-30-probe-refusal-banner.png`.

## Regressions checked

| Surface | Expected | Observed |
| --- | --- | --- |
| Studio suite at repaired head | pass | 98/98 (M-1 REPAIR test passes individually, 10/10 in its file) |
| Same-turn Read 1 (boundary GET) | 200 | 200 |
| Same-turn Read 2 (act-ingress POST, production serving) | 200 | 200 (browser journey + server-side curl proof) |
| Original red mechanism (text/plain POST, production serving) | 403 | 403 |
| Agent-identity refusal on turn surface | VICT_TURN_ACTOR_MISMATCH | VICT_TURN_ACTOR_MISMATCH |
| whoami identity DIFF | distinct actorIds | distinct (`actor-quellight-local` ≠ `agent-quellight-agent-context`) |
| Anti-newer probe (run.get) | refused, fail-closed | `VICT_HTTP_ROUTE_UNKNOWN`, refused |
| Capability-honesty banner | rendered | rendered |

## Deployment notes (not defects)

1. **`ORIGIN` is REQUIRED for studio adapter-node production serving.** Without
   `ORIGIN=http://localhost:<port>` the studio login POST is CSRF-rejected by
   SvelteKit's production guard. Deployments must provision `ORIGIN` to the
   serving origin.
2. **Quellight dev server binds `[::1]`** (localhost IPv6) for its app port, while
   the embedded vict boundary binds `127.0.0.1`. App-origin provisioning
   (`VICT_STUDIO_QUELLIGHT_APP_ORIGIN`) must use the `localhost` name form;
   the boundary endpoint is discovered out-of-band (N-4 of the exit audit remains
   accurate).
3. The vict boundary of the Quellight composition is lazy-composed on first
   runtime use; port discovery must be done after the first app request.

## Scope of this record

Only this file and the five `docs/audit/evidence/m1-reverification-2026-09-30-*`
artifacts were added, on branch
`review/stage9-g3-m1-reverification-2026-09-30` rooted at origin/main
`164176abe6451742beb24aa2e83420c52a885d78`. No product code, tests, or other
records were changed. All tokens are REDACTED in this record and its evidence.
