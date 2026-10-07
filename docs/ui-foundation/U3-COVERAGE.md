# U3 coverage and scenario matrix

Status: implementation record (2026-10-07). Independent verification pending —
this matrix is the manager's implementation-side account; the verifier's
per-criterion verdicts land in `reviews/u3/`.

## Scenario matrix (frozen PROOF-DESIGN §2) — declared implementation modes

Every scenario is a `vict.ui-scenario@1` declaration
(`src/lib/product/scenarios.ts`) run through the existing preview
orchestration (`packages/ui-preview` PreviewSession) with data operations
dispatching through the conforming inspection adapter (shared rule core).
Coverage is DECLARED per operation; the console at `/scenarios` renders the
truthful matrix from `session.coverage` — it cannot drift from the
declaration.

| # | Scenario | Seed | Decision probe | Observable (frozen) | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | normal submitted inspections | 3 submitted, findings + evidence | approve (simulated) | status → approved; queue/detail/activity refresh; deterministic | journey probe; scenario-matrix tests; browser 14/14 |
| 2 | empty queue | zero inspections | list (simulated) | explicit empty state; no error | queue `.queue-empty`; probe 12/14 |
| 3 | long content / many findings | 1 inspection, 40 findings, unbroken strings | list + get (simulated) | readable wrapping/scroll; no clipped controls | probe (40 findings rendered); console screenshots 390/480 |
| 4 | latency | normal seed | approve (simulated, 800 ms declared delay) | pending state; duplicate-submit prevented; late result fenced after reset | unit test + console fencing demo (SESSION_STALE) |
| 5 | operation failure | normal seed | approve (declared failure outcome) | settled failure; domain state unchanged; actionable error | SIMULATED_FAILURE; state unchanged (tests + console) |
| 6 | missing implementation | normal seed | approve (`unavailable`) | SCENARIO_COVERAGE_MISSING denial; NO handler runs; explicit UI state | zero adapter calls asserted; console button disabled |
| 7 | insufficient permissions | normal seed, technician actor | approve (declared denied + adapter grant) | OPERATION_DENIED / DATA_UNAUTHORIZED; state unchanged | tests + console + browser journey |
| 8 | conflicting / stale decision | normal seed | approve with stale expectedDomainRevision | DOMAIN_CONFLICT; state unchanged; recovery guidance | message carries expected/actual; tests + console |

## Implementation-mode truthfulness (U3-07)

Per-operation modes are DECLARED in the scenario definitions and rendered
verbatim:

| Operation | Mode in the scenario console | Mode in the product |
| --- | --- | --- |
| inspection:list / get | simulated | simulated (in-memory adapter) |
| inspection:submit | simulated | simulated |
| inspection:approve | simulated; `unavailable` in scenario 6; **durable-local after the U3-05 mode switch** | simulated (default) or **durable-local** (SQLite file via the queue's implementation switch) |
| inspection:reject / revise | simulated | simulated |
| finding:add / evidence:add | simulated | simulated |

No operation is labeled production-ready. The queue's decision-implementation
strip names the active implementation explicitly (simulated in-memory vs
durable-local SQLite file); the console prints the same disclaimer.

## Criterion coverage (U3-01…U3-08) — implementation side

| Criterion | Implementation | Tests / probes |
| --- | --- | --- |
| U3-01 journey | queue (`/`), detail (`/inspection/[id]`), submit/reject/revise/findings/evidence through ONE server boundary; rejection loop complete (reason quoted in trail; fields cleared on revise; fresh decision against the new revision) | domain-u3 tests; product-server tests; browser probe 14/14 |
| U3-02 scenarios | 8 declared scenarios; deterministic reseed; new session identity on reset | scenario-matrix tests; product-server determinism test; console probe 16/16 |
| U3-03 domain correctness | shared rule core at the adapter boundary: permissions, status transitions, assigned-technician revise, mandatory reason, expectedDomainRevision, DOMAIN_CONFLICT, DATA_IDEMPOTENT_REPLAY / DATA_IDEMPOTENCY_CONFLICT; no partial mutation on any failure | domain-u3 tests (permission matrix, stale payload, replay/conflict, ledger discipline); runtime probes via dispatch (node) AND browser surfaces |
| U3-04 identity/fencing | generation fencing on the product boundary; SESSION_STALE fencing in PreviewSession (pre- and post-await); capability snapshot immutability at session creation | product-server fencing test; latency unit test + console demo |
| U3-05 durable replacement | InspectionDurableAdapter (SQLite via appdata-sqlite, WAL + synchronous=FULL); same action id, same contracts; UI source/binding digests unchanged (the compiled plan is implementation-independent; asserted) | durable-adapter tests (contract equality, restart, seed-once); real restart proof (force-killed process, fresh process + fresh browser) |
| U3-06 conformance | runApplicationDataAdapterSuite over the SAME fixture (evidence resource) against BOTH implementations; hostile-container + closed-schema + filter/search discipline in the shared query engine | durable-adapter tests (both suites green) |
| U3-07 honest coverage | declared modes rendered verbatim; missing = SCENARIO_COVERAGE_MISSING with zero handler invocation; durable mode labeled on the queue | console probe; coverage table from session.coverage |
| U3-08 experience | `/scenarios` console + queue/detail journey readable without technical knowledge; founder walkthrough (U3-WALKTHROUGH.md); negative states coherent | walkthrough targets; console screenshots 1440/1024/390/480 |

## Known limitations (retained honestly)

- The durable proof is LOCAL: one SQLite file, one process at a time. It
  demonstrates a compatible replacement, not production readiness.
- The preview console always runs simulated adapters (its labels say so);
  the durable mode is demonstrated on the real product journey.
- Literal browser-process restart is demonstrated for the durable flow (the
  U2 NOT-DEMONSTRATED carry); the same evidence covers scenario 4's fencing
  only at the unit/console level (800 ms declared), not under production load.
- `finding.add` is not exercised by the generic conformance suite (its
  inspection-existence rule is domain-specific); it is covered by the domain
  tests and the shared rule core that the suite DOES exercise.
