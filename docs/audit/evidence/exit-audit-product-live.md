# Live product page (G3-C) transcript at the integrated heads

- identity pin OK: health/compat inspect byte pins, whoamiOperator actorId actor-quellight-local, whoamiAgent agent-quellight-agent-context, singleActor false
- refusal probe: run.get refused VICT_HTTP_ROUTE_UNKNOWN (version-pin discriminator, live)
- same-turn Read 1 (agent.turn.get): turn-093fe8d8-6a98-4875-87e9-0c91ae4d92ff completed (live)
- same-turn Read 2 (act ingress): failureCodes.inspection = HTTP_CONNECTION_UNAVAILABLE in PRODUCTION serving mode (see finding M-1); the underlying POST without content-type: application/json is 403-refused by the SvelteKit production CSRF guard (verified: no-ct=403, with-ct=200, no-ct+matching-Origin=200)
- same-turn Read 2 DOES succeed against the vite DEV server (dev-no-ct=200) and the verifier screenshot qa-artifacts/stage9-g3/s905-same-turn-panel.png (reverification branch, byte-identical to main) shows the ALIGNED panel from a dev-mode run
- agent-identity refusal on the turn surface, live: agent token GET /vict/v1/turns/<id> -> VICT_TURN_ACTOR_MISMATCH
- underprivileged denial, live (Quellight's own demo script at the integrated head, offline deterministic): DATA_UNAUTHORIZED on qlt.inspection under the agent-context token; operator token succeeds (see exit-audit-g3c2-demo-live.log)
- capability-honesty banner rendered, live, and differs per target
- cross-target isolation, live: quellight boundary refuses run routes (VICT_HTTP_ROUTE_UNKNOWN); demo target refuses quellight turns (VICT_TURN_EXECUTOR_UNAVAILABLE); no target token in any page HTML (grep clean)
