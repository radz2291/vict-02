# VHOST-009 indexed execution and orchestration

23 November 2026 · Builder evidence for Radzi’s review

The isolated PostgreSQL fixture exposes all 126 qualified operations. This ticket adds six sequential execution ports and 17 standalone orchestration ports to VHOST-008 commit `dd4528c371bb61900dad5a1fabff2659a4156782`. The coverage check counts methods on the leased facade and verifies the coordination and lifecycle methods. [Coverage matrix](vhost-003-candidate/PORT-COVERAGE.md) · [Reviewed base](VHOST-008-ORDERED-APPENDS.md)

## Storage and transactions

Sequential execution and orchestration use separate indexed run identities and separate event relations. A sequential run references its published catalog activation through a same-namespace foreign key. A sequential transition passes historical sequence numbers to the pinned Runtime’s dense-history check and only writes its new events. Orchestration passes the selected run’s relational components and event-sequence tail to the pinned Runtime. Tokens, attempts, waits, branch data, timers and receipts are persisted as independent rows. A transition writes its changed state, recovery projection and new events in one transaction. Public event reads return the original rows. The pinned Runtime continues to strip private token checkpoints from snapshot projections. A successful claim returns its own checkpoint, and the driver-facing snapshot retains its authorized branch-output projection. [DDL](vhost-003-candidate/execution-schema.sql) · [Implementation](vhost-003-candidate/indexed-runs.mjs)

A point mutation takes shared admission for its namespace and run family, then an exact run-key lock. New run publication and family-wide batches take exclusive admission for the same family. This preserves equal-timestamp insertion ties and gives interrupted-run recovery or a cross-run timer claim a stable competing-writer boundary. Scoped timer claims take the ordinary point locks. The timer batch reads indexed scheduled and expired entries in due-time, exact UTF-16 timer ID, then durable run and timer insertion order. The existing expiry boundary remains inclusive. The recovery projection retains the pinned raw listing of started claims with a recorded lease, including claims which have yet to expire at the caller’s supplied time.

The extension is provisioned into a disposable version 4 fixture. It uses separate namespaces when comparing with the older indexed candidate and never queries a legacy namespace snapshot. Runtime transition state is scoped to the affected run, and some long runs can still require large sequence-number or component reads. Throughput, migration and cutover remain separate work.

## Verification

- All 23 new ports passed 66 direct comparisons against the exact installed legacy PostgreSQL adapter. The cases include stale revisions and fences, equal-timestamp listing, independent identities, signal/cancellation/resolution replay and timer reclamation at exact expiry.
- Independent PostgreSQL backends produced one winning sequential transition, one Ready-token claimant and exactly one join-ready token across competing branch completions. The join claim returned the canonical checkpoint while the public token projection omitted it.
- SQL triggers rejected the event append after earlier state writes and rejected the second update in a two-run timer batch. Each fault left its affected records and events unchanged. Retries succeeded, competing batch callers claimed each timer once, and reopening preserved both event streams. Interrupted sequential recovery appended exactly one blocking event.
- The installed Runtime’s execution, orchestration and join suites passed all 33 selected cases. The prior 103-port checks, VHOST-008 ordering, D5, D6, command fencing, three dispatcher retry paths and four installed C12 transactions passed in the same run. Across 15,294 traced candidate statements, zero queried or wrote legacy namespace snapshots.

[Raw run, plans and provenance](vhost-003-candidate/evidence/vhost009-runs/result.json) · [PostgreSQL log](vhost-003-candidate/evidence/vhost009-runs/postgres.log) · [Test harness](vhost-003-candidate/run-checks.mjs)

The first conformance preflight called the pinned sequential suite with the wrong argument signature. The next run surfaced an existing catalog discrepancy. The indexed `catalog.get` copies the record but returns an unfrozen object, whereas the pinned legacy read returns a frozen object. The catalog implementation in this branch is byte-identical to the VHOST-008 base. The execution conformance run uses the execution-focused store cases and records the freeze observation separately. The prior catalog regression and ordering suites still run. [Retained preflights](vhost-003-candidate/evidence/vhost009-runs/preflights.json)

## Reproduce

Run from the fixture directory with Node 22.23.5, PostgreSQL 18.6 and the frozen Quellight package closure at `8f8ec2d24180e4a9520be0689aa6afb711553fc9`. The runner verifies the original framework source `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5`, C12 source `a22615b014aa69f7501dc1504da5f9daad639786`, F4 manifest source `0761e1865258b23e2f04652f4301736155be06c5`, SQLite tree `3cd52c2bc0187ce1c03e1f22e26190845bf6b189` and the VHOST-006 dispatcher. File hashes and the exact installed archive identities are in the raw run. [Full fixture setup](vhost-003-candidate/README.md) · [PostgreSQL binary hashes](vhost-003-candidate/evidence/vhost009-runs/binaries.json)

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -CheckOnly
~~~

The runner creates and stops its own loopback PostgreSQL cluster with synthetic data. The candidate stays in the local test fixture. Independent conformance review, package qualification, production migration and Gate A/B decisions remain pending.
