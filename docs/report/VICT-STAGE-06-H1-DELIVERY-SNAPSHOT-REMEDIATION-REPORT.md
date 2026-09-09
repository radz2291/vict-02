# VICT Stage 06 — H-1 Delivery-Snapshot Remediation Report

> **Class:** focused remediation of Stage 06 finding H-1 (durable completion before safe Mastra result delivery). This is NOT formal Stage 06 closure and NOT Stage 07 work.
> **Starting state:** `d146dae1fd27f665ed9d8c297d40436046a860fb` (`origin/main == HEAD` at start; the audit commit that added only `docs/report/VICT-STAGE-06-POST-AUDIT-INDEPENDENT-CLOSURE-RE-AUDIT.md`).
> **Finding remediated:** H-1 (High) from the post-audit independent closure re-audit.
> **Preserved evidence (byte-for-byte, untouched):** `docs/report/VICT-STAGE-06-INDEPENDENT-EXIT-AUDIT.md`, `docs/report/VICT-STAGE-06-POST-AUDIT-INDEPENDENT-CLOSURE-RE-AUDIT.md`, `docs/VICT-SYSTEM-REFERENCE.md`.
> **Status:** Stage 06 remains In Progress. Stage 07 has not begun. No API key and no real provider/model was used (offline deterministic fixture only).

---

## 1. The defect (recap)

A contract-valid capability output containing a delivery-hostile nested value (a Proxy whose property traps throw) passed every existing bridge check — the top-level structural capture read only the outer container's descriptors — was settled durably `completed`, and was then delivered to Mastra **by reference**. Downstream serialization touched the hostile nested value, threw, and the occurrence normalized as `tool.failed(VICT_TOOL_FAILED)` with ZERO `tool.completed` while the durable record stayed `completed`. For an approved `write` capability the delivered value provably failed downstream delivery, making the effectful result contradictory (durable success, model-visible failure).

## 2. Negative-control reproduction (before correction)

Reproduced at the starting state through the REAL pinned Mastra pipeline (real `Agent` loop + deterministic offline model `offline-fixture/deterministic-1` + governed bridge + durable control stores) with a permissive author output contract accepting `{ saved: true, detail: <Proxy> }`, where the nested Proxy throws a unique canary from its `get`, `has`, `getOwnPropertyDescriptor`, `ownKeys`, and `getPrototypeOf` traps. Observed in ALL FOUR combinations (read/write × in-memory/SQLite):

```text
capability/effect executes once          → effectCount = 1
output contract accepts the result       → permissive contract: ok
invocation settles durably as completed  → durable status = "completed",
                                           resultSummary = "object(2 fields)", no errorCode
downstream delivery/serialization throws → raw canary (GET-TRAP) escapes on
                                           JSON.stringify of the delivered value
normalized event                         → tool.failed, code "VICT_TOOL_FAILED"
tool.completed count                     → 0
durable status remains                   → completed
turn outcome                             → completed (model told the tool failed)
```

Bridge-level probe (fresh stores, read capability, in-memory and SQLite): the tool delivered `{ saved, detail }` where `JSON.stringify(delivered)` THREW the raw canary while the durable row read `completed` — the exact delivery-hostile contradiction.

## 3. The delivery-safe domain and bounds (framework-owned)

One explicit, bounded, model-facing delivery domain (`packages/mastra/src/delivery-snapshot.ts`, exported as `captureDeliverySafeSnapshot` / `DELIVERY_SNAPSHOT_BOUNDS`):

```text
null
boolean
string            (≤ 8192 UTF-16 code units)
finite number     (NaN / ±Infinity rejected)
dense arrays of delivery-safe values
                  (own string keys are exactly the contiguous indices 0..k-1
                  plus the intrinsic non-enumerable `length`; length ≤ 1024;
                  no extra properties; no symbol keys)
plain objects containing own enumerable string-keyed data properties
                  (prototype Object.prototype or null; ≤ 128 fields)
```

Global bounds: container nesting depth ≤ 16; total captured nodes (containers AND scalars) ≤ 4096.

Capture properties:

- recursively captures the contract-validated result into a FRESH VICT-owned structure; no caller reference or alias survives at any nesting level;
- passive: values are read ONLY from own enumerable data-property descriptors through the shared guarded control-envelope capture — no getter, setter, iterator, `toJSON`, proxy `get`/`has`, or thenable hook is invoked during structural capture; `JSON.stringify`, `structuredClone`, and user serialization hooks are never used for validation;
- every reflective operation is guarded (`Object.getPrototypeOf`, `Reflect.ownKeys`, each `Object.getOwnPropertyDescriptor`); any throw or descriptor/own-key disagreement collapses to ONE stable `uninspectable` rejection;
- cycles rejected; sparse arrays rejected; accessor fields, non-enumerable fields, and symbol keys rejected UNREAD; extra array properties rejected;
- functions, BigInt, Symbol, `undefined`, non-finite numbers, and every non-plain instance rejected — nothing is silently stringified or coerced;
- all bounds fail closed; rejection reasons come from ONE closed, stable, non-echoing vocabulary; rejected keys/values are never retained.

This boundary governs the MODEL-FACING Mastra delivery path only; richer values inside unrelated local VICT capability use are unaffected.

## 4. Corrected settlement ordering

`executeOwnedAttempt` now enforces exactly:

```text
capability invocation
→ authoritative output-contract validation exactly once
→ reserved-marker validation (top-level, unchanged)
→ recursive delivery-safe snapshot            [NEW]
→ safe summary derived FROM the snapshot      [moved after snapshot]
→ fenced durable completed settlement
→ return ONLY the captured VICT-owned snapshot to Mastra
```

A value that cannot be safely captured for downstream delivery follows the effectful-ambiguity rule:

```text
capability may already have acted
→ fenced outcome_unknown settlement (stable durable code
  VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE)
→ stable VICT_CAPABILITY_OUTCOME_UNKNOWN result
→ no normal output, no tool.completed
→ retry performs no second effect (the record is terminal)
```

Never is `completed` settled before the exact value returned to Mastra is proven safe to deliver. Validation never calls `JSON.stringify`, `structuredClone`, `toJSON`, user iterators, or user-provided serialization hooks.

## 5. Before/after (durable status and events)

| Scenario (real pinned Mastra path) | Before | After |
| --- | --- | --- |
| Hostile nested value, read, memory+SQLite | durable `completed`; `tool.failed(VICT_TOOL_FAILED)`; 0 × `tool.completed`; raw canary escape | durable `outcome_unknown` (`VICT_CAPABILITY_UNSAFE_OUTPUT_STRUCTURE`); exactly one `tool.failed(VICT_CAPABILITY_OUTCOME_UNKNOWN)`; 0 × `tool.completed`; effect exactly once; retry: no second effect; canary absent from rows, ledger payloads, and raw DB/WAL/SHM bytes |
| Hostile nested value, approved write, memory+SQLite | same contradiction (effectful result: durable success, model-visible failure) | same safe containment as read; effect executed exactly once, never contradicted |
| Safe nested value, read/write | `completed` + 1 × `tool.completed` | `completed` + 1 × `tool.completed` (unchanged; delivered value is now the VICT-owned snapshot) |

## 6. Compatibility decisions (explicit dispositions)

| Value shape | Disposition |
| --- | --- |
| Nested safe objects and arrays | ACCEPTED — captured as fresh plain snapshots; round-trip without semantic change |
| Null-prototype objects | ACCEPTED — delivered as fresh plain (`Object.prototype`) snapshots |
| Class instances | REJECTED before durable completion (`exotic-prototype`) — previously delivered as-is; deliberate tightening |
| Date, Map, Set (and RegExp, boxed primitives, all non-plain instances) | REJECTED before durable completion (`exotic-prototype`) — never coerced |
| Top-level callable thenable | Resolves at the capability-author await (JS semantics, capability-author domain, unchanged); the RESOLVED value is then snapshot-captured |
| Nested callable thenable | REJECTED before durable completion — the own-`then` rule fires first (`then-field`); a callable thenable is also a function value |
| Own `then` in any form (data/accessor/hidden), any depth | REJECTED before durable completion (`then-field`) |
| Inherited `then` | REJECTED — inherited members only exist via a non-plain prototype, which is rejected as `exotic-prototype` (previously delivered as-is; deliberate tightening) |
| Nested functions, Symbols, BigInts | REJECTED before durable completion (`function-value` / `symbol-value` / `bigint-value`) |
| `undefined` (top-level or nested) | REJECTED (`undefined-value`) — not in the delivery domain |
| Non-finite numbers (NaN, ±Infinity) | REJECTED (`non-finite-number`) |
| Cyclic structures | REJECTED (`cycle`) — path-based ancestor detection; shared (non-cyclic) substructures are snapshotted independently (zero aliasing) |
| Sparse arrays | REJECTED (`sparse-array`); an array whose length exceeds its contiguous data is delivered as its DENSE VICT-owned prefix — the sparse shape is never delivered |
| Nested accessors | REJECTED UNREAD (`accessor-field`) — getter/setter invoked ZERO times across capture, summary, settlement, and delivery |
| Hostile nested proxies (any reflection trap throws or lies) | REJECTED UNREAD (`uninspectable`) — canary never invoked, never echoed |
| Nested proxies fully transparent to descriptor reflection | Contribute descriptor DATA only; the delivered value is a trap-free plain VICT-owned rebuild (documented policy boundary, mirroring the existing top-level limitation) |
| Post-return caller mutation | NO effect on the delivered value, summary, events, or durable record (zero aliasing) |
| Array with extra properties | REJECTED (`extra-array-property`) |

No `vict.agent-stream@2`; no application/agent identity markers changed (no identity input changed).

## 7. Permanent regression tests

New suites (registered in `scripts/verify-stage6b.mjs` as an aggregate gate):

- `packages/mastra/test/tool-bridge.delivery-snapshot.test.ts` (36 tests): deep round-trip; contract parser validates the RAW output exactly once (authoritative; the framework's delivery-boundary schema pass sees only the snapshot); fresh VICT-owned snapshot at every level; zero aliasing with post-capture mutation; deterministic repeated serialization; null-prototype acceptance; cycles/sparse/extra-props/accessors (zero getter reads)/non-enumerable/symbol keys/functions/BigInt/Symbol/undefined/non-finite/then-fields/top-level thenable resolution/nested callable thenables/hostile+revoked nested proxies/transparent-proxy data-only rebuild — all with bounds (depth/nodes/length/fields/strings) failing closed without echoes; 16 bridge-level integration cases proving rejection BEFORE durable completion with retry performing no second effect; SQLite safe completion.
- `packages/mastra/test/tool-bridge.h1-delivery.test.ts` (9 tests): the full H-1 matrix — read + approved write × in-memory + SQLite (effect exactly once; durable `outcome_unknown`, never `completed`; safe failure returned; zero `tool.completed`; exactly one safe `tool.failed` mapping; retry performs no second effect; canary absent from events, rows, and raw DB/WAL/SHM bytes) plus the real pinned Mastra path (safe nested → durable `completed` + exactly one `tool.completed`; hostile nested → durable outcome-unknown + exactly one safe `tool.failed`; no post-completion tool error; no raw provider/framework chunk exposed).

Negative control: the H-1 suite was run in a temporary worktree at `46a1ab7283364f0a3def6b03c374c3c190e0e3dc` (own `npm ci` + `npm run build`, exit 0). Result: **6 of 9 tests FAILED** there with the exact H-1 signature — raw `CANARY-H1-…-GET-TRAP` escaping the bridge, `tool.failed` code `VICT_TOOL_FAILED` instead of the safe code, and durable `completed` instead of `outcome_unknown` — while the three safe-path tests passed at both commits (safe behavior unchanged). The worktree was removed afterward (`git worktree remove` + `prune`; `git worktree list` shows only the main tree).

## 8. Verification (one pass, exact commands, Windows)

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm ci` | 0 | clean reinstall |
| 2 | `npm run typecheck` | 0 | before build |
| 3 | `npm run build` | 0 | all workspaces |
| 4 | `npm run format:check` | 0 | Prettier-clean |
| 5 | `npm run lint` | 0 | no errors, no warnings |
| 6 | new H-1 suites (`vitest run --project mastra` ×2 files) | 0 | 2 files / 45 tests |
| 7 | affected delivery suites ×3 (13 files incl. hostile-output, containment, truthfulness, ownership, reliability, faults, tool-bridge, helper containment, tool-state normalization, occurrence identity, turn executor, + the two new suites) | 0, 0, 0 | 13 files / 143 tests per run |
| 8 | SQLite invocation-fencing suite ×3 (`--project unit`) | 0, 0, 0 | 1 file / 6 tests per run |
| 9 | `npm test` (once) | 0 | 114 files / 2149 tests passed, 3 skipped (POSIX-only, as historically recorded) |
| 10 | `npm run verify:stage6b` (once) | 0 | ALL GATES PASSED (incl. the new H-1 aggregate gate) |
| 11 | `git diff --check` | 0 | no whitespace errors |
| 12 | `git status --short` | clean after commit | only intended files |

Every non-zero intermediate result during development was diagnosed: two vitest timeout/failure artifacts in the new write-path tests (approval polling needs an explicit test timeout, matching the existing suites' convention; the retry path must bypass the approval dance because a terminal replay never creates an approval), one vitest matcher artifact (assertion internals reading a Proxy — the capture itself reads zero times, proven by recording the counter before any assertion), and TS/eslint strictness fixes in the new tests. No sleeps or timeouts in production code were increased; no assertions were weakened.

## 9. Files changed

Implementation commit `fix(stage-06): snapshot tool output before durable completion`:

- `packages/mastra/src/delivery-snapshot.ts` (NEW — the recursive delivery-safe snapshot boundary)
- `packages/mastra/src/tool-bridge.ts` (settlement ordering: snapshot before fenced completion; summary from the snapshot; return only the snapshot)
- `packages/mastra/src/index.ts` (export the snapshot API)
- `packages/mastra/test/tool-bridge.delivery-snapshot.test.ts` (NEW)
- `packages/mastra/test/tool-bridge.h1-delivery.test.ts` (NEW)
- `scripts/verify-stage6b.mjs` (register the two new suites as an aggregate gate)

Documentation commit `docs(stage-06): record H-1 delivery remediation`:

- `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` (one additive subsection: DELIVERY-SAFE SNAPSHOT)
- `docs/report/VICT-STAGE-06-H1-DELIVERY-SNAPSHOT-REMEDIATION-REPORT.md` (this report)

NOT modified (preserved byte-for-byte): `docs/report/VICT-STAGE-06-INDEPENDENT-EXIT-AUDIT.md`, `docs/report/VICT-STAGE-06-POST-AUDIT-INDEPENDENT-CLOSURE-RE-AUDIT.md`, `docs/VICT-SYSTEM-REFERENCE.md`.

## 10. Remaining limitations (genuine, bounded, documented)

1. **Descriptor-transparent nested proxies:** a nested proxy whose descriptor reflection is fully transparent cannot be distinguished from a plain object by reflection alone; it contributes its descriptor DATA to the snapshot and the delivered value is a trap-free plain rebuild. No caller code can run against the delivered value, so delivery is safe; the proxy's identity never survives. (Policy boundary, mirroring the previously documented top-level limitation.)
2. **Callable top-level thenables** still resolve at the capability-author await (JavaScript semantics); the resolved value is fully subject to the snapshot boundary. Unchanged, documented.
3. **Delivery-domain strictness is intentional:** contract authors returning class instances, Dates, Maps/Sets, `undefined`, sparse arrays, or values beyond the documented bounds now receive the safe `outcome_unknown` (retried occurrences replay it without a second effect) instead of a delivery that could contradict the durable record. Contracts should declare model-facing outputs inside the documented domain.
4. The snapshot bounds (depth 16 / nodes 4096 / length 1024 / fields 128 / strings 8192) are fixed module constants, not per-capability tunables; a capability needing larger model-facing results must shape its contract output within them.

## 11. Status

```text
Stage 06 H-1 delivery remediation: COMPLETE (implementation + tests + docs).
Stage 06 remains In Progress — formal closure awaits the final focused
independent closure verification.
Stage 07 has not begun.
```
