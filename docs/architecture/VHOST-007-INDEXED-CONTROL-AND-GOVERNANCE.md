# VHOST-007 indexed control, activation and governance

22 November 2026 · Builder evidence for Radzi’s review

The private PostgreSQL fixture now implements 103 of 126 qualified operations. This batch adds 23 control-plane methods, seven activation-catalog methods and eight agent-governance methods to the candidate at `0cf1b413cfd3cca84b62566342840237cff080ba`. The fixture retains the VHOST-005 command fence and the VHOST-006 dispatcher at `8f23c02c4b8a91e3315f4b73bf64a4ca6a89fc2c`. The 23 execution and orchestration methods remain deferred. [Coverage matrix](vhost-003-candidate/PORT-COVERAGE.md) · [Reviewed baseline](VHOST-006-DISPATCHER-CLAIM-IDENTITY.md)

## Storage and transactions

The version 4 schema extends the disposable fixture. It stores ChangeSets, decision lineage, governance runs, operation receipts, releases, release selection history, audit events, catalog versions and graph selection heads, agent activation records, deletion intents, and deletion receipts in indexed, namespace-qualified relations. PostgreSQL compares digest buckets and full UTF-16 key bytes. The range indexes support operation-index order, selection revisions, append order and bounded lexical prefixes. Selected-object reads use a single statement and same-namespace foreign keys. Deletion-intent reads retrieve the intent and its two possible receipts in one query snapshot. A version 3 fixture requires fresh provisioning for this proof. This ticket includes no migration or write cutover. [DDL](vhost-003-candidate/control-schema.sql) · [Port implementation](vhost-003-candidate/indexed-control.mjs)

Point mutations pass only their relevant rows to the pinned Runtime transition, then persist the changed records. Release selection uses a subject lock and queries the latest revision and exact operation replay entry. Publish, select and receipt advancement share one transaction. Composite mutations take advisory keys in a single sorted order. Leased calls retain the existing per-scope checks before and after the operation, writer-epoch admission, and D6 callback mutex and same-client assertions.

D5 compares the exact stored prepared digest before publishing or selecting. A mismatch returns `VICT_CONTROL_OPERATION_IDENTITY_CONFLICT`. The sequential refusal and the refusal after exact-digest replay both leave the durable SQL rows byte-identical. Exact competing calls return the original selection revision and retain a single history row and the first applied timestamp. An independent race on the same subject base gives one winner. PostgreSQL rolls back the losing release and leaves its receipt prepared. The earlier pinned PostgreSQL behavior still accepts the mismatch, while the resolved candidate behavior matches the pinned SQLite guard.

The fixture preserves the pinned catalog order of checks. A graph-head CAS guards `publishAndSelect` before publication, including when a previous call used the same operation ID. A matching current operation ID replays the current `select` result. Agent governance retains the pinned PostgreSQL driver’s error sanitization. Malformed activation or initial deletion records surface as `HOSTED_DATABASE_UNAVAILABLE` at that public seam, while stable collision and receipt-order errors keep their original messages.

## Disposable PostgreSQL results

- All 38 added ports passed 117 comparisons against the pinned legacy public ports. The raw results preserve the catalog timestamps, with the comparison checking that assigned timestamps fall within the harness run.
- Competing ChangeSet revisions and status transitions selected one winner. Competing release and catalog selections preserved the winning head and rejected the stale base. A retired conversation lease could no longer write through its leased facade. Competing deletion receipts deduplicated, completion required both receipts, and the coordination tombstone remained effective after release and reopening.
- PostgreSQL triggers refused the final receipt update and final graph-selection insert after earlier writes in those transactions. A separate connection observed complete rollback for both paths, and each request succeeded after the trigger was removed.
- The candidate trace recorded 6,459 statements with zero legacy namespace snapshot reads or writes. Seven raw query plans record PostgreSQL defaults and index eligibility. PostgreSQL preferred sequential scans for two small point-query fixtures, and index paths were confirmed with sequential scans disabled. The 161-row deletion-intent list crossed the 128-row cursor fetch boundary and retained exact order.
- Earlier checks cover 79 original storage comparisons, 113 receipt comparisons, stale-fence refusal and rollback, all three same-instance dispatcher retries, and four pinned C12 same-client transactions.

[Raw run with exact observations, statement counts and PostgreSQL plans](vhost-003-candidate/evidence/vhost007-control/result.json) · [PostgreSQL log](vhost-003-candidate/evidence/vhost007-control/postgres.log) · [Correctness harness](vhost-003-candidate/control-checks.mjs)

Two early assertions expected different error codes from the ones both adapters returned. The harness was corrected to assert the observed reference codes. A later trace preflight used the callback overload of the PostgreSQL pool and aborted after the differential tests. The final harness checks the two backend identities through explicit client checkouts. [Retained test iterations](vhost-003-candidate/evidence/vhost007-control/retained-test-iterations.json)

## Reproduce

Use the exact consumer checkout `8f8ec2d24180e4a9520be0689aa6afb711553fc9`, installed with npm 11.21.2 and its frozen lock. The runner verifies the lock and full 14-package closure. It verifies the legacy framework source `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5`, F4 manifest commit `0761e1865258b23e2f04652f4301736155be06c5`, C12 source `a22615b014aa69f7501dc1504da5f9daad639786`, SQLite tree `3cd52c2bc0187ce1c03e1f22e26190845bf6b189`, and immutable VHOST-006 dispatcher. The raw run records source, archive, fixture and binary identities. An independent verifier needs authorized access to the pinned Git objects and archives. [Installed closure](vhost-003-candidate/evidence/vhost007-control/closure.log) · [Binary hashes](vhost-003-candidate/evidence/vhost007-control/binaries.json)

From the fixture directory, using Node 22.23.5 and PostgreSQL 18.6 binaries:

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -CheckOnly
~~~

The runner creates, verifies and stops its own loopback PostgreSQL cluster. All data is synthetic. This is a correctness and query-plan run. Throughput, hosted egress and release eligibility were outside the ticket. Simultaneous cross-command idempotency-key reuse and coordination text-key compatibility remain open for Gate A. Independent review, package qualification, import and recovery rehearsal, and release authorization remain pending. [Full setup](vhost-003-candidate/README.md)
