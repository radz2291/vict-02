# VHOST-004 receipt port differential matrix

The comparator is the installed PostgreSQL adapter from the pinned Quellight closure, running in a separate schema in the same disposable PostgreSQL instance. The direct suite compares success values or error name, code and message for every listed port against that reference. Assertions also check selected independent invariants. This is builder evidence for the implemented slice. The original [port coverage](PORT-COVERAGE.md) includes the 61 deferred operations.

| Port | Direct cases and compatibility boundary |
| --- | --- |
| `invocations.allocateTurnToolSlot` | First allocation, exact replay and increasing per-turn slot even without an invocation. Twelve concurrent identical requests return slot 1. Twelve distinct requests allocate slots 2–13. Backend termination before COMMIT rolls back both the slot and head. |
| `invocations.recordInvocationIntent` | Only intent inserts. Same request key and digest replays the durable invocation ID. Changed digest returns `VICT_CONTROL_INVOCATION_KEY_COLLISION`. Same ID under a different key requires exact content or returns `VICT_CONTROL_INVOCATION_COLLISION`. Competing intent requests share one row, and a conflicting request writes neither an ID nor a key. |
| `invocations.getInvocation` | Missing returns undefined. Point lookup distinguishes embedded NUL, surrogate/replacement code units, non-BMP and long common-prefix IDs. |
| `invocations.getInvocationByIdempotencyKey` | Missing, valid and conflict-created key absence. Measured indexed lookup. |
| `invocations.updateInvocationStatus` | Missing, forward approval and backward `VICT_CONTROL_INVOCATION_REGRESSION`. This is the existing status port. Owners report results via the fenced settlement port. |
| `invocations.listInvocationsForTurn` | Exact turn, none for an unrelated turn, UTF-16 order including two IDs sharing a prefix longer than the B-tree limit. |
| `invocations.claimInvocationRun` | Only a live claim gets its owner/fence and incremented generation. Eleven concurrent losers return `VICT_CONTROL_INVOCATION_OWNER_ACTIVE`. Unknown terminal state refuses redispatch. |
| `invocations.settleInvocationRun` | Current fence settles, exact repeated terminal disposition replays the original timestamp, different disposition returns terminal conflict, stale fence returns `VICT_CONTROL_INVOCATION_FENCE_MISMATCH`. |
| `invocations.settleInvocationPending` | Pending cancellation and exact replay. Other terminal disposition and trying to cancel a live owner fail with the reference errors. |
| `invocations.reconcileAbandonedRun` | Wrong observed fence refused. Correct observed running fence increments generation and records durable `outcome_unknown`, blocking blind retry after reconnect. |
| `approvals.createPendingApproval` | New record must be pending. Same-ID differing content conflicts before considering invocation replay. Multiple competing pending requests return one ID. A terminal predecessor allows a new current request. |
| `approvals.getApproval` | Missing and historical lookup by ID after replacement. |
| `approvals.listOpenApprovals` | Only pending, in binary UTF-16 ID order. This port relies on explicit expiration. |
| `approvals.listApprovalsForInvocation` | Missing gives empty list. Replacement exposes only the latest request and keeps earlier records readable by ID. |
| `approvals.decideApproval` | Pending decision, same disposition replay keeps the first approver, opposite disposition conflicts, recorded expiry refuses a decision. As in the reference, wall-clock eligibility belongs to service logic. |
| `approvals.expireApproval` | Explicit pending expiry persists its timestamp, repeated expiry replays, decided approval refuses expiry. Concurrent decide/expire observes one durable winner. |
| `commandIdempotency.claimReceipt` | One claim per exact legacy key. Duplicates report `exists`, including direct duplicate against a different digest, with original digest untouched. The dispatcher turns a changed digest into a stable conflict. |
| `commandIdempotency.getReceipt` | Missing, pending, completed, failed, and released reads. Result is recoverable after a committed response is lost. |
| `commandIdempotency.findReceiptByActorKey` | Earliest surviving insert across command kinds, no other actor, release/reinsert moves a row behind surviving entries. The dispatcher's cross-command policy composes a lookup and a separate claim. |
| `commandIdempotency.completeReceipt` | Winning fence persists completion. Old or terminal fence fails with `VICT_IDEMPOTENCY_FENCE_CONFLICT`. Replayed results are served from the durable receipt by the service. |
| `commandIdempotency.failReceipt` | Deterministic failure persists, missing key has its own error, stale owner leaves current row byte-identical. |
| `commandIdempotency.releaseReceipt` | Current owner deletes a retryable claim and removes it from both lookups. Stale takeover fence refuses. Same-owner recreation can reissue the same legacy token. |
| `commandIdempotency.takeOverExpiredLease` | Missing, not yet expired, and exact expiration equality. Twelve competing callers yield one takeover and generation 2. |
| `commandConfirmationReceipts.createReceipt` | One winner by ID. Duplicate returns `exists` and preserves the original payload digest. |
| `commandConfirmationReceipts.getReceipt` | Missing, exact prepare binding, terminal expired/consumed/spent evidence. |
| `commandConfirmationReceipts.listReceiptsByPrepare` | Exact actor/command/prepare key, replacement number then UTF-16 ID ties, 144 matching rows across cursor batches and 16 filtered out. |
| `commandConfirmationReceipts.listReceiptsByActorCommand` | Exact actor and command across prepare keys, bounded results including fractional and zero limits, no other actor. |
| `commandConfirmationReceipts.startConsumption` | Missing, prepared claim, in-progress, equality at prepare expiry gives durable expired, and consumed/spent gives settled. Twelve concurrent requests yield one owner. |
| `commandConfirmationReceipts.takeOverExpiredConsumptionLease` | In-progress before claim expiry. At equality one new generation wins. Same classifier as `startConsumption`. |
| `commandConfirmationReceipts.settleConsumption` | Stale generation refuses, winning fence durably consumes or spends, old state survives a conflicting write. Reconnect after COMMIT response loss finds the recorded terminal state. |
| `commandConfirmationReceipts.releaseConsumption` | Current fence clears ownership and keeps attempt count. Next claim advances the generation. Stale or missing receipt returns the exact reference error. |

The source-pinned dispatcher checks scope and actor ownership outside the storage ports. The service test uses synthetic domain and audit collaborators. It covers changed prepare and confirmation digests, cross-command reuse, one effect under concurrent same-key requests, stable replay with no additional effect, and convergence when the command result committed but confirmation settlement was interrupted. The storage faults separately exercise ambiguity after actual COMMIT and termination of an owned PostgreSQL backend before COMMIT.
