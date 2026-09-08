# VICT Stage 06 — Post-Audit Envelope Remediation Report

> **Class:** focused post-audit remediation (unsafe control-envelope inspection and post-invocation settlement truthfulness). This is NOT an audit, NOT a formal closure, and NOT Stage 07 work.
> **Starting state:** remote/audit commit `eb8d458a3718562f61e60d844dfa31ffb9cbf356` (HEAD == origin/main at start); audited implementation/docs tip `712752a3ebe8053d1a846e840925d87f98e4f0c3`; tool-state implementation `57ca502915d8f4a1a179a5cb38e86d452c2a9c40`; Stage 06A formal closure `b491ededed32a796aa035befe77946e8b107338b` — all four verified in ancestry at start.
> **Status of this document:** remediation record. It does NOT close Stage 06, does NOT mark any requirement Verified, and does not begin Stage 07.

---

## 1. Why this remediation exists

The independent exit audit at `eb8d458` recorded no Critical/High/Medium findings. A post-audit check then reproduced a **High boundary defect at the audited implementation itself** (`712752a`, the code the audit verified): a hostile capability result escaped the bridge as a raw exception AFTER the capability had already run, bypassing the fenced settlement path and leaving the durable invocation incorrectly `running`. The same probes showed the public envelope parsers throwing raw exceptions and accepting arbitrary canary strings as event codes — contradicting the audit's hostile-envelope claims. Per the remediation charter, the audit verdict stands as historical evidence; this document records the defect reproduction, root causes, correction, and evidence.

## 2. Exact reproduction (negative controls at `eb8d458` / emitted code of `712752a`)

### 2.1 Pure replay/failure-envelope parser/normalizer (22 probes; 12 threw, 4 accepted canaries)

| Probe (against emitted `dist` at the audited implementation) | Observed at `eb8d458` |
| --- | --- |
| outer `victCapabilityReplay` getter throwing `CANARY-OUTER-REPLAY` | `THREW Error: CANARY-OUTER-REPLAY-THREW` |
| same, `parseCapabilityReplayEnvelope` | `THREW Error: CANARY-OUTER-REPLAY-THREW` |
| inner `disposition` getter throwing | `THREW Error: CANARY-INNER-DISPOSITION-THREW` |
| inner `invocationId` getter throwing | `THREW Error: CANARY-INNER-INVOCATION-THREW` |
| failure-marker getter throwing | `THREW Error: CANARY-FAILURE-MARKER-THREW` |
| revoked Proxy as the outer result | `THREW TypeError: Cannot perform 'IsArray' on a proxy that has been revoked` (normalizer and parser) |
| inner `getPrototypeOf` trap throwing | `THREW Error: CANARY-GET-PROTO-THREW` |
| inner `ownKeys` trap throwing | `THREW Error: CANARY-OWN-KEYS-THREW` |
| inner `getOwnPropertyDescriptor` trap throwing | `THREW Error: CANARY-DESCRIPTOR-THREW` |
| outer `has` trap throwing | `THREW Error: CANARY-HAS-TRAP-THREW` |
| enumerable accessor failure marker (getter throws) | `THREW Error: CANARY-ACCESSOR-READ-THREW` |
| enumerable accessor `disposition` (getter returns `'completed'`) | `{"kind":"completed"}` — getter INVOKED and its value trusted |
| non-enumerable failure marker `CANARY-NONENUMERABLE-CODE` | accepted as the event code |
| inherited failure marker `CANARY-INHERITED-CODE` | accepted as the event code |
| `{ victCapabilityFailure: 'CANARY-ARBITRARY-CODE' }` | `{"kind":"failed","code":"CANARY-ARBITRARY-CODE"}` — arbitrary string became an event code |

Also reproduced: `{ victCapabilityReplay: <valid>, victCapabilityFailure: 42 }` could normalize as **completed** (non-string contradictory marker fell through the old guard), and the old `'marker' in record` checks trusted inherited/non-enumerable marker presence.

### 2.2 Governed capability bridge (post-invocation)

Fixture: capability whose output contract accepts its returned value; implementation returns a `Proxy` with a throwing `has` trap. At the audited implementation:

```text
B1 capability hostile Proxy result: execute THREW Error: CANARY-HAS-TRAP
B1 durable invocation status = running (count=1)
B1 canary in raw error/message = true
```

The capability had already run (effect executed), yet the reserved-marker inspection — an **unguarded `'victCapabilityReplay' in outputRecord`** — threw the raw canary across the tool boundary. The fenced settlement path was never reached: the durable status stayed `running`, bypassing `outcome_unknown` entirely. (A fully revoked Proxy happened to be contained only by accident: its implicit thenable read at the invoke `await` throws, landing in the invoke guard — the marker check itself remained unguarded.)

### 2.3 Helper-tool output (equivalent unsafe path)

```text
B3 helper hostile Proxy output: execute THREW Error: CANARY-HELPER-HAS-TRAP
```

The helper bridge used the same unguarded `in`-based reserved-marker check; the raw exception escaped the tool (Mastra's tool-error containment absorbed it downstream, but the raw exception still left the tool boundary).

## 3. Root causes

1. **RC-1 — non-total reflection at the envelope boundary.** `parseCapabilityReplayEnvelope` and `normalizeCapabilityToolResultEvent` used `in`, direct member reads, `Object.keys`, and `Object.getPrototypeOf` directly: every one of these can invoke a proxy trap or getter and throw. Revoked proxies throw on *any* operation (including `Array.isArray`).
2. **RC-2 — open failure-code vocabulary.** `record.victCapabilityFailure as CapabilityToolFailureCode` trusted any string: arbitrary, accessor-read, non-enumerable, and inherited values became event codes (and were echoed into `tool.failed` events by the adapter's direct reads).
3. **RC-3 — unguarded post-invocation inspection.** The reserved-marker rejection inside the owned attempt used `'…' in outputRecord` with no try/catch and no structural capture, so a hostile output container could throw past the fenced settlement path after the effect had run (durable status stuck `running`).
4. **RC-4 — leaky Standard Schema passthrough.** The contract wrapper's `validate` detected bridge envelopes with direct member reads (`typeof (value…).victCapabilityFailure === 'string'`): throwing traps escaped `validate`, and any object merely *carrying* the marker fields bypassed the capability contract without exact structural validation.
5. **RC-5 — hostile helper output reached the same unguarded check.** Helper-tools shared the `in`-based marker rejection and returned the raw (potentially proxied) output directly to Mastra.

## 4. The correction

### 4.1 One shared, total, non-throwing inspection boundary (`packages/mastra/src/control-envelope.ts`)

A single purpose-built mechanism (not a generic schema framework) now performs every untrusted-result/output inspection:

- guards `Array.isArray`, `Object.getPrototypeOf`, `Reflect.ownKeys`, and every `Object.getOwnPropertyDescriptor` read; ANY throw (revoked proxy, hostile trap, inconsistent trap results) collapses to ONE stable `unusable` classification;
- reads values ONLY from own enumerable data-property descriptors — getters, setters, proxy `get` traps, and user iterators are never invoked;
- accessor fields, non-enumerable fields, and symbol keys are represented as present-but-unreadable so callers fail closed without touching their values;
- marker-membership honesty probes (`in` for the three reserved marker names) run ONLY after safe capture, under a guard, and only for the fail-closed decision: a throwing `has` trap or membership invisible to the descriptor capture (inherited or a descriptor lie) is hostile;
- rejected keys, values, trap errors, and canaries are never echoed;
- `rebuildPlainCapturedObject` delivers verified plain outputs as structurally identical trap-free/thenable-free rebuilds (values from descriptors).

### 4.2 Closed code vocabularies

- `CAPABILITY_TOOL_FAILURE_CODES` — the exact set of ten `VICT_CAPABILITY_*` codes, enforced by `isCapabilityToolFailureCode`. Arbitrary, accessor-read, non-enumerable, inherited, and non-string failure markers all normalize to `VICT_CAPABILITY_OUTCOME_UNKNOWN`; no hostile value can become an event code.
- Replay dispositions remain the closed six-value set (`completed`, `failed`, `declined`, `cancelled`, `outcome_unknown`, `in_progress`) with the verified mapping preserved exactly (`completed` → `tool.completed`; `failed`/`declined`/`cancelled`/`outcome_unknown` → the corresponding safe invocation failures; `in_progress` → non-terminal; malformed/hostile/contradictory → safe outcome-unknown failure).
- A replay/failure envelope bypasses the Standard Schema output adapter ONLY after exact structural validation succeeds (single plain own-enumerable-data marker field, plain prototype, no symbol/hidden/accessor fields, allowlisted code or valid replay structure).

### 4.3 Post-invocation settlement guarantee

Inside the owned attempt, the entire post-invocation output arbitration is total and fenced: output-contract parsing, reserved-marker inspection (any own form), own-`then` rejection (thenable smuggle), guarded `has`-honesty probes, result summarization (`safeArgumentSummary` is now itself total), and completion persistence all funnel rejections into the exact fenced `outcome_unknown` settlement — with a belt-and-braces backstop catch so no inspection failure can bypass the fence. The capability executes exactly once; a retry of the settled record replays the disposition and never re-executes. When the settlement store itself is unavailable, the model still receives the safe outcome-unknown failure, the original exception never leaks, and persistence is never claimed to have succeeded.

### 4.4 Helper containment and adapter reads

Helper outputs get the same total capture, marker rejection (all own forms), `then` rejection, honesty probes, and plain-rebuild delivery; uninspectable or impersonating outputs become the stable `VICT_HELPER_RESERVED_MARKER_REJECTED` failure. The adapter reads helper/capability markers and the `error: true` flag exclusively through the total capture (no direct reads on untrusted results) and gates every emitted capability failure code through the closed allowlist.

## 5. Behavior after the correction (same probes, corrected emitted code)

```text
PROBE A: 22 probes, 0 threw raw exceptions — every hostile shape returns a
         stable verdict; zero canaries in any verdict; arbitrary/inherited/
         non-enumerable/accessor markers all normalize to
         VICT_CAPABILITY_OUTCOME_UNKNOWN; getter counters read 0 where
         descriptor rejection applies.
B1 capability hostile Proxy result: execute RETURNED (stable failure envelope)
B1 durable invocation status = outcome_unknown (count=1); canary absent
B2 capability revoked-Proxy result: RETURNED; outcome_unknown (now by the
   total inspection, not by accident)
B3 helper hostile Proxy output: RETURNED {"victHelperFailure":
   "VICT_HELPER_RESERVED_MARKER_REJECTED"}
```

Negative control for the permanent suites: all three new suites were run against a temporary worktree at `712752a3` — 7 tests FAILED with exactly the reproduced defects (`expected Error: CANARY-POSTAUDIT-BRIDGE-HAS-TRAP to be null`; `expected 'running' to be 'outcome_unknown'`; helper canary escaped; `validate` threw `TypeError: Cannot perform 'get' on a proxy that has been revoked`; arbitrary marker bypassed the contract; real Mastra path emitted no `OUTCOME_UNKNOWN`), and `control-envelope-containment.test.ts` could not even resolve the boundary module (it did not exist). The same suites pass after the correction.

## 6. Verification evidence

Environment: Windows (Git Bash, Node v22.13.1). `npm ci` required one preparatory step: the prior WSL installation had left dangling workspace symlinks in `node_modules` that Windows npm cannot `lstat`; `node_modules` was removed and reinstalled cleanly (exit 0). Probes ran against freshly built `dist` artifacts.

| Command | Exit |
| --- | --- |
| `npm ci` | 0 |
| `npm run typecheck` | 0 |
| `npm run build` | 0 |
| `npm run format:check` | 0 |
| `npm run lint` | 0 |
| New deterministic containment suites (`control-envelope-containment`, `tool-bridge.hostile-output`, `helper-tools.containment` — 45 tests) | 0 (fail at `712752a` as above) |
| Affected concurrency/durability suites ×3 (`tool-bridge-reliability`, `tool-bridge-ownership`, `tool-bridge.truthfulness`, `tool-state-normalization`, `tool-bridge.faults`, `tool-bridge`, `occurrence-identity-pipeline`, `invocation-fencing`) | 0, 0, 0 |
| `npm test` (once) | 0 — 111 files passed / 1 skipped, 2104 tests passed / 3 skipped |
| `npm run verify:stage6b` (once) | 0 — ALL GATES PASSED |
| `git diff --check` | 0 |
| `git status --short` | only intended changes + untracked owner-local `.pi/` |

Full stage 2–6A verifiers were not re-run (owned by the historical evidence); no clean-clone ladder was performed (owned by the focused independent re-audit). No sleeps were added, no timeouts increased, no assertions weakened; every intermediate non-zero result during setup was diagnosed (WSL symlink `EACCES`; two transient vitest worker exits on Windows that did not recur across three clean full-suite runs).

## 7. Files changed

- `packages/mastra/src/control-envelope.ts` (new) — the shared total capture boundary.
- `packages/mastra/src/tool-bridge.ts` — total parser/normalizer, closed code allowlist, exact Standard Schema passthrough, fenced post-invocation arbitration, total `safeArgumentSummary`.
- `packages/mastra/src/helper-tools.ts` — total helper output containment + rebuild delivery.
- `packages/mastra/src/adapter.ts` — total marker/milestone reads on untrusted results; allowlist-gated codes.
- `packages/mastra/src/index.ts` — public exports for the boundary and allowlist.
- `packages/mastra/test/control-envelope-containment.test.ts`, `packages/mastra/test/tool-bridge.hostile-output.test.ts`, `packages/mastra/test/helper-tools.containment.test.ts` (new) — permanent regression suites.
- `scripts/verify-stage6b.mjs` — the new suites registered as an aggregate gate.
- `docs/architecture/STAGE-06B-CONTROL-AND-GOVERNED-EXECUTION.md` — Stage 06B wording updated (envelope hardening + settlement guarantee).
- `docs/report/VICT-STAGE-06-POST-AUDIT-ENVELOPE-REMEDIATION-REPORT.md` (this file).

Preserved byte-for-byte: `docs/report/VICT-STAGE-06-INDEPENDENT-EXIT-AUDIT.md`, `docs/VICT-SYSTEM-REFERENCE.md`, all historical audits/reports and owner files. The audit commit `eb8d458` and all prior history remain untouched (normal fast-forward commits only; no force-push, rebase, or rewrite).

## 8. Remaining limitations (genuine)

1. **Descriptor-invisible proxy lies that only answer (never throw).** A Proxy whose `get` trap fabricates values while its `ownKeys`/descriptor traps stay perfectly honest can still smuggle data past descriptor-only inspection. The guarded `in`-honesty probes cover the three marker names; arbitrary non-marker key lies cannot be detected without invoking the `get` trap, which the policy forbids. Verified plain outputs are delivered as trap-free rebuilds, which contains the practical surface.
2. **Callable-thenable capability returns resolve at the invoke boundary.** A capability that returns a thenable whose `then` is callable has that function invoked by the await itself — that is capability-author code by construction (not a privilege boundary); whatever it resolves to then passes the full post-invocation arbitration. The own-`then` delivery guard additionally refuses any output still carrying an own `then` field.
3. **Non-plain verified outputs (arrays, class instances) are delivered as-is** after passing contract validation, marker rejection, and honesty probes; inherited surfaces of exotic prototypes are not (and cannot be) captured without invoking user code. This matches the pre-correction delivery contract.
4. **A `get`-trap throw at Mastra's own downstream await of a delivered non-plain result** would surface as a Mastra tool-error (normalized `tool.failed`), with the durable state already truthfully settled — the durable ledger and the model-visible failure stay consistent and truthful, but the milestone can be a failure for a record that durably completed.
5. The prior audit's recorded limitations (shared-store cross-composition liveness adjudication, cancelled-duplicate open milestone, single-process registry envelope, one child-process suite's default timeout on slow filesystems) remain unchanged by this remediation.

## 9. Status

```text
Stage 06 post-audit envelope remediation is complete and ready for focused independent closure re-audit.
Stage 06 remains In Progress.
Stage 07 has not begun.
```
