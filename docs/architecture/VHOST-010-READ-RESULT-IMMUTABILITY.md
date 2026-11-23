# VHOST-010 read-result immutability

23 November 2026 · Builder evidence for Radzi’s review

The isolated 126-operation PostgreSQL fixture matches the pinned legacy read-result freeze boundaries for the activation catalog and orchestration recovery claims. The repair starts from VHOST-009 commit `e6714c20a8628b7dfe2f1b5a65b255da2187412d`. [VHOST-009 baseline](VHOST-009-INDEXED-EXECUTION-AND-ORCHESTRATION.md) · [Coverage matrix](vhost-003-candidate/PORT-COVERAGE.md)

| Read-result boundary | VHOST-009 | Pinned legacy and VHOST-010 |
| --- | --- | --- |
| `catalog.get`, `catalog.getSelection` and `catalog.getSelected` records | Mutable copies | Frozen snapshots. Missing records return `undefined`. |
| `catalog.list` | Mutable array and entries | Mutable array of frozen entries in publication order |
| `orchestration.findRecoverableClaims` | Mutable array of frozen claim records | Mutable array of detached mutable claim records in recovery order |
| Recovery token and attempt | Frozen | Frozen snapshots. The claim and token expose no checkpoint. |

The catalog reads apply the pinned Runtime’s `immutableSnapshot` to each record after decoding it. Recovery reads apply it to the token and attempt, with the outer claim left writable. The raw probe uses `Object.isFrozen`, attempts writes to records and arrays, and repeats the reads to verify stored values are unchanged. It separately verifies that the successful Ready-token claim can return its synthetic private checkpoint. Assigned catalog timestamps are retained in the evidence and normalized for the cross-adapter value comparison. [Catalog projection](vhost-003-candidate/indexed-control.mjs) · [Recovery projection](vhost-003-candidate/indexed-runs.mjs) · [Direct probe](vhost-003-candidate/immutability-checks.mjs)

## Verification

The runner loads the exact baseline fixture files from Git, then exercises them, the pinned legacy package, and the repaired fixture in distinct disposable namespaces. The retained first run reproduces both deviations and fails the repaired-parity assertion before the repair is applied. All 43 registered cases passed, comprising 26 pinned store cases, eight orchestration cases and nine join cases. The store suite includes every catalog case. It also repeats the 126-operation checks, ordered appends, D5, D6, command fencing, dispatcher retries and four same-client C12 transactions. Across 15,811 traced candidate statements, zero queried or wrote legacy namespace snapshots. [Raw results and suite names](vhost-003-candidate/evidence/vhost010-immutability/result.json) · [Retained pre-repair refusal](vhost-003-candidate/evidence/vhost010-immutability/pre-repair.json)

## Reproduce

Use the pinned Quellight closure `8f8ec2d24180e4a9520be0689aa6afb711553fc9`, Node 22.23.5 and PostgreSQL 18.6. The runner verifies the legacy source `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5`, the C12 source `a22615b014aa69f7501dc1504da5f9daad639786`, the F4 manifest source `0761e1865258b23e2f04652f4301736155be06c5`, the SQLite tree `3cd52c2bc0187ce1c03e1f22e26190845bf6b189` and the same VHOST-006 dispatcher. The raw run includes candidate, baseline, source and installed artifact hashes. [Full fixture setup](vhost-003-candidate/README.md) · [PostgreSQL binary hashes](vhost-003-candidate/evidence/vhost010-immutability/binaries.json)

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -CheckOnly
~~~

The run uses synthetic data on disposable loopback PostgreSQL. Independent review and Gate A remain pending.
