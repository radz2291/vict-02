# VHOST-008 ordered PostgreSQL appends

22 November 2026 · Builder evidence for Radzi’s review

The isolated PostgreSQL candidate keeps a stable visible append order for ChangeSet approvals, audit events and activation publications. The starting point was verified VHOST-007 commit `06b3d36c0f570a859a0dd8be344717f615858011`. The fixture still implements 103 of 126 qualified operations. [VHOST-007 baseline](VHOST-007-INDEXED-CONTROL-AND-GOVERNANCE.md) · [Coverage matrix](vhost-003-candidate/PORT-COVERAGE.md)

## Concurrent observations

The harness uses independent PostgreSQL backends for two writers and a reader. It holds each writer after successful SQL writes and before commit. The exact VHOST-007 modules load from Git into scratch and run in separate fixture namespaces. The legacy comparator is the pinned installed PostgreSQL package. The audit probe checks unfiltered, subject-filtered and subject-and-type-filtered lists. The catalog probe checks the list and both graph selections as competing `publishAndSelect` calls publish distinct versions.

| Adapter | While the first writer is held | Next visible list | Final list |
| --- | --- | --- | --- |
| VHOST-007 | Both writers reach the commit gates. A reader sees `[seed]` before either commits. | After the second writer commits first, the reader sees `[seed, second]`. | After the first writer commits, the reader sees `[seed, first, second]`. |
| Pinned legacy PostgreSQL | The competing writer and reader wait on the namespace write path. | The waiting reader resumes when it can acquire the namespace row. | `[seed, first, second]` |
| VHOST-008 | The second writer waits before writing. The reader sees `[seed]`. | The reader sees `[seed, first]` while the second writer is held before commit. | `[seed, first, second]` |

The raw results contain backend IDs, PostgreSQL blocker and waiter observations, allocated row IDs from the exact baseline, committed list prefixes, and the corresponding catalog selection heads. [Raw before-and-after results](vhost-003-candidate/evidence/vhost008-ordering/result.json)

## Lock scope and replay

A transaction takes the append advisory lock just before inserting a new ordered record. Approval writes share this lock within a namespace and ChangeSet. Audit appends and catalog publications each have a separate namespace-wide lock because each exposes an unfiltered namespace list. The existing sorted entity-lock phase comes first. PostgreSQL’s single-bigint advisory lock uses a separate key space from the existing two-integer entity locks. The fixture verifies all three identity sequences are ascending, noncycling and use `CACHE 1`. A competing insert into the same ordered collection can allocate its identity only after the prior transaction commits or rolls back. The existing ordered indexes and schema version 4 remain in use. [Implementation](vhost-003-candidate/indexed-control.mjs) · [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS) · [PostgreSQL sequence caching](https://www.postgresql.org/docs/18/sql-createsequence.html)

A rollback proceeds without exposing the held first item. The competing second item commits, and a retry of the first item appends behind it. A duplicate keeps the same history and catalog selection revision. The catalog rollback leaves both the attempted version and graph selection absent. During a held append, the checks also complete an approval for another ChangeSet, an audit-unrelated control write, a selection of an existing catalog version on another graph, and writes in other namespaces. Fresh audit writes for distinct subjects still queue within the audit collection.

## Reproduce and review

The runner uses Node 22.23.5, PostgreSQL 18.6, the pinned Quellight closure at `8f8ec2d24180e4a9520be0689aa6afb711553fc9`, legacy source `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5`, F4 manifest commit `0761e1865258b23e2f04652f4301736155be06c5`, SQLite tree `3cd52c2bc0187ce1c03e1f22e26190845bf6b189`, and C12 source `a22615b014aa69f7501dc1504da5f9daad639786`. It verifies and compiles the same VHOST-006 dispatcher sources. Candidate and baseline file hashes and installed artifacts are in the raw result. [Setup](vhost-003-candidate/README.md) · [Binary hashes](vhost-003-candidate/evidence/vhost008-ordering/binaries.json) · [Installed closure](vhost-003-candidate/evidence/vhost008-ordering/closure.log)

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -CheckOnly
~~~

The full VHOST-007 regression run passed, including 117 comparisons across the most recent 38 ports, the previous storage and receipt comparisons, D5 digest rejection and atomic apply, command fence retirement, three dispatcher retry paths, and four pinned same-client C12 transactions. Across 7,292 traced candidate statements, PostgreSQL saw zero legacy snapshot reads or writes. The initial probe retained the three baseline reversals and then timed out because the legacy reader queued behind the competing writer. The final probe accepts either directly observed blocker in that verified wait chain. A later preflight uncovered an audit expectation helper mismatch while strengthening the two-writer catalog test. An added lock diagnostic also lost its SQL parameter during a shell edit. The expanded ordering suite passed on the next run, which then failed while opening the existing short-timeout regression pool. The final runner starts the existing regressions before the ordering probes. The retained preflight records these observations. [Failed probe](vhost-003-candidate/evidence/vhost008-ordering/preflight.json) · [PostgreSQL log](vhost-003-candidate/evidence/vhost008-ordering/postgres.log)

The 23 execution and orchestration operations remain deferred. The ordering proof uses one writer implementation per fixture namespace. Independent review, serving qualification and Gate A remain pending.
