# VICT STAGE 09 — G3-C FRESH GATE VERIFICATION (existing-Quellight same-turn proof)

- Date: 2026-09-30
- Verifier: fresh-gate verifier (OD-R4 named decider per the frozen contract), independent of the builder
- Integrated candidate audited: `codex/stage9-g3-proposal` @ `d014d62a9a8cd719edc9eeb58c48a2aacdb1bdcf` (verified via `git ls-remote`; not moved)
  - containment check: `codex/stage9-g3-c-quellight` @ `941dda95` is CONTAINED in d014d62 (verified with `git branch -r --contains`).
  - diff vs `origin/main` (studio): `quellight-transport.ts` (+581), `targets.ts` (+28 additive), `routes/product/**` (+416), tests (+443 quellight/app-definition), plus the integrated G3-A FT-1 row→detail work (`application/definition.ts` +13, tests) — audited separately below.
- Verification branch: `review/stage9-g3-c-verification-20260930` (this report + qa-artifacts only).

## 1. VERDICT

**PASS WITH NON-BLOCKING FINDINGS.**

G3-C is verified at the integrated candidate d014d62 by a fully independent live reproduction (fresh Quellight clone at 5f709a5, real turn through Quellight's own product admission, real browser on the Studio /product page, real fetch-spy servers). The core (b,c,e-adjacent,k,m) is demonstrated LIVE; the agent-identity/underprivileged demonstrations are TRUTHFULLY recorded as NOT DEMONSTRATED on the existing single-actor tree, and the OD-R4 ruling below confirms that impossibility is structural (ruling X), authorizing the separately governed minimal Quellight increment as the next step.

Findings are severity-tagged in §7; none block the gate.

## 2. SUITES + STATIC GATES (run by the verifier at d014d62)

| Gate | Result | Notes |
|---|---|---|
| unit suite (root, `vitest run --project unit`) | **2414/2414** (2411 passed 1st run + 1 test-failure; the single `release-authority.test.mjs` timeout test passed green on an isolated re-run — machine-load flake, unrelated to G3-C) | PASS |
| apps/studio tests | **85/85**, 10 files | PASS; includes `tests/quellight-transport.test.ts` **9/9** run individually too |
| `npm run typecheck` | exit 0 | PASS |
| `npm run lint` | exit 0 | PASS |
| `npm run format:check` | exit 0 | PASS |
| `node scripts/verify-stage9-inventory.mjs` | **INVENTORY OK** — G1 reads on all three surfaces UNAMENDED; G2 confirmation surface accounted | PASS |

npm ci + build of contracts/ui/sdk/kernel/runtime/control/application/ui-svelte (+store-sqlite, appdata-sqlite): all exit 0.

## 3. CODE AUDIT (criterion a, f, h, security core)

- **(a) additivity** — `git diff origin/main -- apps/studio/src/lib/server/targets.ts` shows ONLY: one appended target entry `{ id:'quellight', label:'Quellight (existing target, declared 0.3.1)', endpoint:'http://127.0.0.1:4610', credentialRef:'quellight-operator' }` and two appended credential constants (`quellight-operator`, `quellight-agent` with inert loopback default tokens). No existing entry or credential's semantics changed.
- **(a) four-oracle pin — VERIFIED IN CODE, not just claimed** (`quellight-transport.ts`):
  - (i) positive reads: `agent.turn.get` on `/vict/v1/turns/:id` (operator token) and the declared `act.queryInspection` / `getTurn` query via `/api/act` (`readQuellightTurnPair`; `appDataQuery` posts `{actionId, input:{filters}}`).
  - (ii) NEGATIVE probe with FAIL-CLOSED-ON-SUCCESS: `connectQuellightIdentityPin` issues `run.get` against a bounded dummy id; `if (probe.ok === true) return { ok:false, code:'VICT_QUELLIGHT_VERSION_PIN_REFUSED', ... }` — an actual success branch that refuses the pin (code:~line 300 zone).
  - (iii) full inspect answer-record equality: `recordsEqual(PINNED_HEALTH_RECORD, health.data)` and the same for the compatibility record; deviation => `VICT_QUELLIGHT_IDENTITY_PIN_FAILED`, fail closed. The version-invariance caveat is HONESTLY recorded in the constant docs (the marker is opaque; (ii)/(iv) carry discrimination) — confirmed by my spy: identical inspect records + served run.get => `VICT_QUELLIGHT_VERSION_PIN_REFUSED`.
  - (iv) labeled provenance: `QuellightProvenance { recordedAtLabel: 'provenance' }` carried through and rendered verbatim; never claimed as a runtime oracle.
- **(f) no invented data** — `+page.svelte` is a GENERIC renderer: labeled key/value rows via `flatten()` of the server payload; the only prose is truthful banner text. No target name appears in the svelte (grep "quellight" = 0 hits); no fabricated constants. `+page.server.ts` returns only the transport/target answers (turn record, inspection row, whoami records, refusalProbe, provenance) with truthful states for every failure mode (aligned / not_retrieved / not_demonstrated / pin-failure banners).
- **(h) no target-specific UI branching** — the product svelte contains no Quellight branch; only server-rendered labels/banners (`data['targetLabel']` etc.).
- **SECURITY core**:
  - No browser-held target credential: credentials are server-held (`targets.ts` — token "never appears in any return value, log, or error message"); `+page.server.ts` returns actor LABELS but never tokens; live browser-content scan of the served page confirms the token value is ABSENT from the served HTML/hydration.
  - All calls authenticate AS the target credentials (each call carries its own `Bearer` per-credential token — the unit spy asserts whoami calls carried `Bearer ql-op-token` / `Bearer ql-agent-token`); no Studio-actor proxying.
  - No mutation verb in the transport: only GET reads + the declared POST `/api/act` query ingress (read-only action `act.queryInspection`); `attemptRefusalDemonstration` issues one `agent.turn.get` GET only.
  - CSRF/Origin machinery untouched: no change to `apps/studio/src/hooks.server.ts` or session.ts vs main (not present in the diff).
  - Cross-target isolation: `resolveQuellightCredential` rejects any other target id or credential ref BEFORE any fetch (unit-asserted `expect(calls).toEqual([])`).

## 4. LIVE REPRODUCTION (criteria b, c, d, e, j, k, m) — verifier's OWN stack

Environment (all derived by the verifier from `targets.ts`, proving the env contract is complete):

```
Quellight:   fresh clone https://github.com/radz2291/Quellight.git
             HEAD 5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6 (git ls-remote verified BEFORE install; NOT moved)
             QUELLIGHT_ACTOR_TOKEN=<verifier token> QUELLIGHT_DATA_DIR=g3c-verify-data
             npm run dev -- --port 5178 --strictPort
             -> offline deterministic model mode (composition.ts ~765-788:
                modelMode !== 'live' -> createDeterministicOfflineModel) — discovery CONFIRMED in code.
Studio:      apps/studio vite dev, port 5199 (fresh), env provisioned:
             VICT_STUDIO_TARGETS=[quellight entry @ http://127.0.0.1:5178]
             VICT_STUDIO_CREDENTIALS={quellight-operator, quellight-agent}
             VICT_STUDIO_QUELLIGHT_TURN={threadId,turnId from the live turn}
             VICT_STUDIO_QUELLIGHT_PROVENANCE={quellightRef 5f709a5..., declaredReleaseIdentity vict-release-set@1/0.3.1}
             VICT_STUDIO_HUMAN_CREDENTIALS={verifier}
             (no VICT_STUDIO_QUELLIGHT_APP_ORIGIN — same origin doubles for the act ingress)
```

- **(b) same-turn panel — PASS (LIVE).** Real turn created through Quellight's OWN product admission (`act.createThread` -> `POST /api/threads/qlt-9119516c4b7d98ba0c1782bd/turns`; raw `agent.turn.start` alone would produce no context assembly — the product wrapper installs the assembly: discovery CONFIRMED in the admission code path). Result (also server-rendered + browser-screenshot):
  - Read 1 (`agent.turn.get`): `{"turn":{"turnId":"turn-6006eaa8-2017-436b-9bea-4e9aed0fba44","status":"completed",...,"actorId":"actor-quellight-local"}}`
  - Read 2 (inspection `getTurn`): `row.details.turnId = "turn-6006eaa8-2017-436b-9bea-4e9aed0fba44"`.
  - TurnId alignment IN BOTH; page banner: "SAME-TURN alignment demonstrated: the target's own turnId appears in BOTH answers (turn-6006eaa8-2017-436b-9bea-4e9aed0fba44)."
- **(c) operator allow — PASS (LIVE).** The operator-credential `agent.turn.get` answered the turn record (rendered under "Read 1"); screenshot shows rendered fields.
- **(d) agent-identity refusal — NOT DEMONSTRATED, TRUTHFULLY RECORDED (LIVE).** The attempt with the agent-context credential SUCCEEDED on this tree: `{ "command":"agent.turn.get", "succeeded":true, "refusalCode":null }`; `whoamiDiff = []`; both whoami answers return `actorId: actor-quellight-local` with the full union scope list. The page renders the single-actor NOT-DEMONSTRATED banner verbatim; nothing is simulated client-side. The verifier's independent attempt reproduced the builder's logged outcome exactly (whoami DIFF=[]; agent-context succeeds).
- **(e) underprivileged denial — NOT DEMONSTRATED, TRUTHFULLY RECORDED (LIVE).** Verifier attempt with a bearer token unrelated to the tree's accepted credential: the app-origin proxy answers `actor.quellight-local` with the FULL union scopes for whoami AND serves the turn read. Root cause (target's own released code): Quellight's only reachable VICT ingress is `src/routes/vict/[...path]/+server.ts`, which REPLACES the presented `authorization` header with the in-process composition token; the underlying loopback boundary's authenticator is the one-entry map `[env.actorToken -> LOCAL_ACTOR_ID]` (`composition.ts:680`). No credential/scope combination lacking inspection permission therefore exists or can even be evaluated at the target's identity boundary on this tree.
- **(j) cross-target isolation — PASS (unit + transport-declared; live page isolation).** Unit: cross target id / foreign credential refs refused with `VICT_STUDIO_CROSS_TARGET_REFUSED` BEFORE any fetch; a no-credential deployment refuses with `VICT_STUDIO_CREDENTIAL_ABSENT` and never makes an authed call. Live: the /product page resolved ONLY the declared quellight entry (targetId quellight) with the two declared credential refs; my live stack provisioned only that entry.
- **(k) target/version evidence — PASS (LIVE).** Rendered verbatim oracle answers: health.inspect `{healthy:true, commandSchema:'vict.command@1', streamSchema:'vict.agent-stream@1'}`; compatibility.inspect with all four schema ids; probe outcome `{"command":"run.get","refused":true,"code":"VICT_HTTP_ROUTE_UNKNOWN"}`; provenance labeled `{quellightRef:"commit 5f709a5...", declaredReleaseIdentity:"vict-release-set@1/0.3.1", recordedAtLabel:"provenance"}`. Expected identity rendered: vict-release-set@1 / 0.3.1 / @victframework/*@0.3.1.
- **(m) capability banner differs from the demo target's — PASS (verifier's OWN fetch spies + a REAL HTTP spy server).** Two worlds driven through the PRODUCTION transport: a 0.3.1-shaped surface (run.get refused) pins ok with the rendered banner "the newer G1 operator command reads (run.get, run.list, run.detail, run.events, run.waits) are NOT available on this declared 0.3.1 target — ... was REQUIRED to be refused and was refused"; a newer-schemad surface with IDENTICAL (version-invariant) inspect records but a served run.get fails closed with `VICT_QUELLIGHT_VERSION_PIN_REFUSED` — the banner would truthfully claim nothing. The two states demonstrably differ and pin records from the live target match the 0.3.1 world (`VICT_HTTP_ROUTE_UNKNOWN` identical to the spy world).
- **WHOAMI/IDENTITY (M-2 lineage) — verified live:** per-credential `actor.whoami` answers are captured (rendered in full on the page, verbatim, for both credentials) and the identity evidence flow matches the contract (DIFF computed server-side over ALL keys; distinctness demonstrated not assumed; single-actor fact rendered, not hidden).

Screenshots + transcripts: `qa-artifacts/stage9-g3/verifier-c/shot-product-full.png` (real headless Chrome, full-page), `product-server-rendered.html`, `live-curl-transcripts.txt`, `g3c-browser-evidence.json`, verifier scripts `g3c-browser.mjs`, `g3c-spy.mjs`.

## 5. QUIELLIGHT REPO PURITY (criterion l)

Verified at every stage: fresh clone HEAD `5f709a536ab1f4d5fea0407db1b9537e0aa7c0f6`; `git status --porcelain` EMPTY and `git diff` EMPTY before and after the entire journey (dev run, real turn, reads, teardown). Byte-identical tree hash before/after. Two disclosures:
- `npm ci` fails on the COMMITTED package-lock (upstream lockfile staleness: missing `@esbuild/aix-ppc64@0.25.12` optional-dep entry). The verifier installed with `npm install --package-lock=false` — no tracked file changed (lockfile untouched); this is a LOW, preexisting upstream hygiene gap, not a G3-C finding.
- Runtime SQLite stores were written to a gitignored directory outside tracked paths and removed after the run (`g3c-verify-data/`; `*.db*` gitignored).

## 6. OD-R4 DECIDER RULING

**RULING: (X) — the existing single-actor tree CANNOT demonstrate agent-identity refusal or underprivileged denial. Impossibility CONFIRMED.** This AUTHORIZES the separately governed minimal Quellight increment as the next stage step.

Basis — logged AND live evidence only, never design intent:
1. LIVE (verifier): with provisioned operator + agent-context credentials, both `actor.whoami` answers return `actorId: actor-quellight-local` (identical full answers; `whoamiDiff = []`), and the agent-context credential's `agent.turn.get` attempt SUCCEEDS. Matches the builder's logs.
2. LIVE (verifier): a token with NO match to the tree's single accepted credential is nonetheless resolved TO the single actor by the target's own released proxy (Quellight `src/routes/vict/[...path]/+server.ts` REPLACES the presented authorization header with the in-process token; composition.ts:680 instantiates the authenticator as the ONE-entry map `{ [env.actorToken]: LOCAL_ACTOR_ID }`). So no distinct-actor or underprivileged authorization state is even REACHABLE through the target's only served ingress.
3. The target declares exactly ONE actor (`actor-quellight-local`, union roles/scopes — see its own system-reference.md). No second actor, no second token→actor mapping, no agent-* identity exists to be refused. Any "refusal" one could fabricate would be an authentication failure (unknown token at the unproxied boundary — unreachable cross-process, ephemeral port) — not an agent-IDENTITY or scope denial, and thus would not be an honest demonstration of the criteria.
4. A demonstration path without target changes (Y) would require the target to evaluate the presented credential at its identity boundary and to hold a second, restricted actor. Both require changes to the Quellight tree — out of scope of the existing-target surface.

Therefore: (d) and (e) are structurally unachievable on the existing tree; the truthful NOT-DEMONSTRATED rendering at d014d62 is correct behavior, and the OD-R4 authorization proceeds.

## 7. CRITERION TABLE (a)–(m) with evidence

| Criterion | Verdict | Evidence |
|---|---|---|
| (a) additive target entry + four-oracle pin implemented | PASS | targets.ts diff (only appended entry + 2 credentials); transport code performs (i)-(iv) incl. fail-closed-on-success probe; live pin presented on the real target |
| (b) both reads rendered; turnId alignment in both | PASS (LIVE) | live curl [6][7] + rendered banner + screenshot: same turnId `turn-6006eaa8-...` in both answers |
| (c) operator allow | PASS (LIVE) | operator `agent.turn.get` answered (turn record rendered; curl [7]) |
| (d) agent-identity refusal demonstration | CORRECTLY NOT DEMONSTRATED (truthful banner) | live: attempt succeeded, whoamiDiff=[]; single-actor banner rendered; OD-R4 ruling X |
| (e) underprivileged denial | CORRECTLY NOT DEMONSTRATED (truthful recording) | live: proxy overwrites presented credential; target has one union-scoped actor; OD-R4 ruling X |
| (f) no invented data | PASS | generic flatten() renderer; server payload only; no fabricated constants in svelte |
| (g/h) no Quellight-specific UI branching outside the declared binding | PASS | zero "quellight" references in the svelte; all labels server-rendered |
| (i) (covered by j/transport) | — | — |
| (j) cross-target isolation | PASS | unit negatives (refused pre-fetch); live page resolved only the declared entry |
| (k) target/version evidence rendered | PASS (LIVE) | health/compatibility records + probe + provenance rendered verbatim (+ screenshot) |
| (l) Quellight repo untouched | PASS | porcelain empty + diff empty at every stage; HEAD 5f709a5 before/after |
| (m) capability banner differs from demo target | PASS | verifier's real-HTTP fetch spies: 0.3.1 world pins (banner: G1 reads not available); newer world with IDENTICAL inspect records fails closed VICT_QUELLIGHT_VERSION_PIN_REFUSED |
| (M-2 identity lineage) | PASS (live capture; evidence truthful) | per-credential whoami answers captured + rendered verbatim; DIFF computed over all keys |

Criterion letters used here follow the verification task's own list; where the handoff numbering groups sub-criteria, all covered under the nearest row with explicit evidence above.

## 8. FINDINGS (severity-tagged)

1. **[LOW / upstream-hygiene]** Quellight's committed `package-lock.json` is out of sync (esbuild optional-platform entries); `npm ci` fails from a clean clone. Workaround used: `npm install --package-lock=false` (tree stayed byte-clean). Non-blocking for G3-C; recommend upstream lock refresh in the separately governed increment.
2. **[LOW / evidence-scope]** The transport doc phrase "the two server-held credentials are authenticated AS themselves against the target's own server" is only NOMINALLY true on this 0.3.1 tree: the target's app-origin proxy re-injects its own token and does not evaluate the presented one (live curl [9]). The transport's actual behavior (per-credential bearer presentation + whoami per credential) is faithful and honest; the single-actor truth IS rendered. Recommend a one-line doc caveat at the next touch.
3. **[INFO]** The unit suite's `release-authority.test.mjs` "oidc-release publish refuses an unauthorized source…" timed out under full-suite load and passed green isolated (5.6s there vs 5s timeout under load). Unrelated to G3-C; machine-load flake, no action.
4. **[INFO]** Integration diff also contains the separately-gated G3-A FT-1 work (row→detail definition binding + tests) — out of G3-C scope, audited superficially: additive, definition-declared, navigation-only, covered by tests.

## 9. OD-R4 RULING SUMMARY (repeat for the gate record)

**(X)** — confirmed with live + logged evidence (§6). Next step authorized: the separately governed minimal Quellight increment to carry a second restricted actor identity and boundary-evaluated credentials so that (d)/(e) can be demonstrated WITHOUT changing the Studio transport's frozen contract.