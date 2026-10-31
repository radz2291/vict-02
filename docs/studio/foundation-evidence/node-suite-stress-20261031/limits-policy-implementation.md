# Explicit completion/cancellation policy and thin Studio transport

31 October 2026. Local candidate implementation; no activation, provider call, push or acceptance follows this report. Owner instruction authorizes removing artificial evidence and comparable Studio limits. This lane owns neutral turn policy, awaited event delivery, Studio server admission/provider seam/HTTP transport and matching focused tests. The evidence/archive and read/edit/Flow lanes remain separate.

## Changes and compatibility

- Add exact canonical `vict.agent-turn-policy@2`, `mode: until-completion-or-cancel`. Legacy finite policy, its bounds and manifest remain unchanged. Malformed/mixed versions refuse.
- Adapter revision5 selects public Mastra `stopWhen: () => false` without maxSteps for that exact new variant; numeric tool budgets are absent only for the opt-in. Omitting maxSteps alone would restore upstream five-step default. No numeric infinity or inflated step/tool budget substitutes for the new policy.
- Studio uses this declaration, retains maxRetries0, and no longer supplies output-token or ordinary elapsed-time ceilings. Provider-reported length/error/unfinished-tool outcomes remain failures; Stop and governed authority/identity/effects/approvals remain enforced.
- The memory artifact moves to revision2 with lastMessages:false. This disables redundant stored conversation recall, rather than claiming unlimited recall. Browser-supplied history remains explicit turn input; ordinary within-turn Mastra tool messages remain managed upstream.
- Agent admission removes source200000/node500, prompt6000 and history12x6000 checks. The HTTP host parses complete fatal-UTF8 JSON after session/content-type/CSRF checks. Canonical source compilation and captured cursor/digest validation remain required.
- Browser acknowledgement is settled by exact actual receipt or cancellation; it cannot be fabricated or expired by the former25-second timer. Normal provider calls have no30-minute/3-minute host deadline; optional deadline injection remains test-only.
- Awaited adapter and hub event sinks propagate native Web Streams writer demand. NDJSON uses TransformStream writer.ready/write; the provider seam pulls one part per demand. Remove cumulative request/stream quotas and frame constants. No eager detached stream pump or unbounded promise queue is introduced. Existing synchronous hub false/pull behavior remains.
- Launcher uses documented adapter-node BODY_SIZE_LIMIT=Infinity disabling mode, rather than reverting to the upstream512K default or monkeypatching the HTTP implementation. This is explicit upstream HTTP configuration, not an agent count policy.
- Protocol pins: read/input9, edit/input8, instructions14, profile16, start4; observer instructions6/profile10. Saved UI/graph source schemas are unchanged. Archive@2 handshake is explicit; older@1 opt-in is not silently reinterpreted as nonexpiring@2.

Public migration detail: packages/mastra/CANCELLATION-POLICY.md. New policy participates in profile identity. Old compilers reject it. Adapter4-bound activations need explicit rebinding to adapter5; compatibility mismatch still fails closed. Provider packages/model selection/configuration are unchanged.

## Focused verification

Results below exercise the working candidate before its local implementation commit; the integrator must pin the final combined candidate and independent verdict. Formatting after these checks changed layout only.

- `npm run build -w @victframework/sdk`, kernel, runtime and mastra: all exit0.
- `npx vitest run --project unit packages/kernel/test/agent-profile-identity.test.ts packages/kernel/test/agent-profile-validation.test.ts`:55/55 pass.
- Legacy identity vector independently recomputed with the compiler from git04339, then asserted under the new compiler: `v1_89b1044d009f51e012e4602c249086ff8470e03a0cd8380de70e771c2b938776`. Focused exact-vector check1pass/31unselected.
- `npx vitest run --project mastra packages/mastra/test/adapter.e2e.test.ts packages/mastra/test/adapter.compatibility.test.ts`:17/17 pass. Includes real pinned Mastra66 sequential tool calls/model steps, successful completion beyond64, awaited event-sink gate and owner cancellation. No network/provider credentials.
- Initial selected run also exercised unchanged adapter.boundary.test.ts:16/16 passed; two other fixture-only failures described below were repaired and their affected suites rerun.
- `npx vitest run --project unit packages/runtime/test/stream-subscriber-backpressure.test.ts packages/server/test/sse.test.ts`:14/14 pass, including awaited async sink, synchronous false/pull compatibility and existing real-HTTP SSE cases.
- `npm test -w vict-studio -- tests/designer-model.test.ts tests/designer-agent.test.ts tests/designer-transport-independent.test.ts tests/designer-stream-backpressure.test.ts`:20/20 pass. Includes valid source510nodes/>200000chars, longer prompt/history, UTF8 JSON>1.2MB, actual demand for a3MB NDJSON frame, no31-minute ordinary deadline, cancellation of unsettled provider promise, pull-based upstream demand and existing stale/draft/atomic edit negatives.
- Studio TypeScript check during integration reported no owned production-source errors; concurrent evidence tests and independent readonly-fixture annotations remained another lane's pending corrections. Final integrated type/build check remains integrator-owned.

## Retained failed attempts

- First selected Mastra run:31pass/2fail. One existing compatibility assertion still expected adapter4; another unrelated retention test was accidentally changed by an overbroad fixture replacement to reference unavailable compose options. Both test-only mistakes were corrected; e2e+compatibility rerun17/17 passed. Runtime assertions were not weakened.
- A test-edit helper initially failed writing UTF8 through the host default cp1252 encoding, truncating the owned transport test file. It was restored from the exact committed original and reapplied with explicit UTF8. A concurrently started suite observed this incomplete fixture and old413 assertions:12pass/2failed tests plus empty-suite collection failure. Corrected complete tests passed in the final20/20 run. No product/owner data was affected.
- Large-source admission fixture initially timed out at the runner's5-second default while dynamically importing the full Studio dependency graph. A60-second test-only collection allowance enabled the actual assertions, which passed; the final case took~32seconds including imports. No product timeout or source count limit was increased.
- One attempted runtime filter targeted nonexistent stream-hub.test.ts and collected no tests. The correct new subscriber test and existing SSE suite then ran14/14.

These are source/offline/transport proofs. They do not substitute for the actual Studio agent, loaded browser behavior, device proof, final independent challenge or owner acceptance. Existing partial CampaignFoundry source and failed actual-agent trials remain untouched.
