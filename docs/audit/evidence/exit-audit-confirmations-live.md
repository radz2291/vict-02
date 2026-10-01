# Live confirmations journey transcripts (exit audit, 2026-10-01, ports 4731/4733)

## REQUIRED negative (missing Idempotency-Key)
banner: "A bounded Idempotency-Key is required to prepare."

## STALE negative
HTTP 409 banner: "The target changed since the receipt was prepared (VICT_CONFIRMATION_STALE). Nothing was changed. Re-read the subject and prepare again."

## FIELD_INVALID truthfulness
HTTP 409 banner: "The target answered VICT_COMMAND_FIELD_INVALID. No effect is claimed here: judge the outcome from the target's own code and the audit view."

## SPENT negative
HTTP 409 banner: "This receipt was already consumed by a different request (VICT_CONFIRMATION_SPENT). No second effect was created. Prepare again for a new intent."

## Happy path prepare (receipt, token-free fields)
receiptId cr-272cc64e... payloadDigest fc8aa06a... createdBy actor-studio-operator status prepared

## Confirm -> resulting-effect panel (verbatim fields from the rendered page data)
executorResult: {"runId":"run-demo-blocked","requestId":"audit-final-1","status":"accepted","cancelled":true,"runStatus":"cancelled","runRecordRevision":4}
before: status blocked recordRevision 2; after: status cancelled recordRevision 4; wait wait-demo-signal open->cancelled resolvedBy audit-final-1
audit rows: confirmation.prepared (digest=fc8aa06a...) + confirmation.consumed (actor=actor-studio-operator outcome=consumed)

## Idempotent replay (same key audit-final-1)
success, same recorded outcome, resolvedBy audit-final-1, no second effect
