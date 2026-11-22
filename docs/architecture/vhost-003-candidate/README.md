# Indexed PostgreSQL operational-store test fixture

## VHOST-007 control, activation and governance

The current fixture uses schema version 4 and exposes 103 of 126 qualified operations. The [VHOST-007 report](../VHOST-007-INDEXED-CONTROL-AND-GOVERNANCE.md), [coverage matrix](PORT-COVERAGE.md) and [raw correctness run](evidence/vhost007-control/result.json) describe the new ports and reproduction. The [receipt behavior matrix](RECEIPT-TEST-MATRIX.md) and [VHOST-005 command fence proof](../VHOST-004-COMMAND-FENCE-REPAIR.md) describe prior work.

## VHOST-006 dispatcher proof

Use the same command below with `-CheckOnly`. The harness verifies and compiles the original and repaired dispatcher Git objects, then runs both against the guarded store. See the [candidate report](../VHOST-006-DISPATCHER-CLAIM-IDENTITY.md) and [raw evidence](evidence/vhost006-dispatcher/matched.json).

## Reproduce

The candidate is a private test fixture. Its only entry point is `createIndexedHotPathForTests` in [indexed-hot-path.mjs](indexed-hot-path.mjs). It takes the exact installed-package oracle and fixture database options. The schema name, loopback host, fixture role and database name are fixed. It exposes actors, turns, stream ledger, invocations, approvals, both command receipt ports, control, the activation catalog, agent governance, coordination and the leased facade/lifecycle methods. The runner provisions [the base DDL](schema.sql), [the receipt extension](receipts-schema.sql) and [the control extension](control-schema.sql) on a separate operator connection before opening the adapter.

Use Windows PowerShell, Node 22.23.5 and PostgreSQL 18.6 client/server binaries. Prepare a scratch Quellight checkout at `8f8ec2d24180e4a9520be0689aa6afb711553fc9`. Use npm 11.21.2 to install the lock with `npm ci --ignore-scripts --no-audit --no-fund`. The runner verifies all installed files against their 14 framework archives. Provide a VICT Git checkout containing the exact source objects `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5`, `0761e1865258b23e2f04652f4301736155be06c5` and `a22615b014aa69f7501dc1504da5f9daad639786`. On the builder workstation they are in the separate `261116-VICT-Vercel` checkout. The runner reads Git objects directly and transpiles three SQLite source files and the pinned shared dispatcher in scratch storage. No new dependency installation is required for the fixture itself.

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -Samples 24
~~~

Use `-CheckOnly` for the correctness and fault cases without the matched benchmark. The runner checks the owned PostgreSQL data path, numeric loopback address, port, role and TLS before it issues fixture SQL. It stops the postmaster it created. The output directory must be new. The disposable database directory and logs are retained for investigation.

## Raw evidence

- [VHOST-004 final run](evidence/vhost004/matched.json)
- [VHOST-004 PostgreSQL log](evidence/vhost004/postgres.log), [binary digests](evidence/vhost004/binaries.json), [installed closure](evidence/vhost004/closure.log) and [runner log](evidence/vhost004/runner.log)

VHOST-003 retained results

- [Matched run with provenance, correctness cases, SQL and sample measurements](evidence/matched.json)
- [Earlier full matched iteration](evidence/earlier-matched.json) before actor normalization and the expanded C12/epoch checks.
- [Matched PostgreSQL server log](evidence/postgres.log) and [binary digests](evidence/postgres-binaries.json)
- [Installed closure verification](evidence/closure.log)
- [Preflight refusal when an earlier manifest was selected](evidence/trial-manifest.json)

The measurement alternates legacy and candidate per fixture and pool/client profile. Each original hot-path cell gets one warmup followed by 24 operations. The new receipt traffic cells use 24 timed calls with four pool connections and eight simulated clients across the smallest and largest matched history fixtures. The same-numbered profile and fixture have matching synthetic stream and turn history. Sequential cells add the same stream history in both stores. The largest legacy fixture uses a 300,000-node test cap after verifying the default cap refusal. Candidate keeps the default 100,000-node per-record guard.

Latency includes pool checkout, network, codec and instrumentation. Per-statement socket deltas include protocol framing and exclude connection setup. Returned and bound value sizes are separate projections. Legacy JSONB introspection and driver parsing can contribute to measured client CPU. Process CPU includes the sampler, while buffer, WAL, database-size and execution-plan records describe PostgreSQL resource usage. PostgreSQL process CPU and RSS, deployed paths, real queues, remote RTT, TLS, poolers and provider egress are outside the measurement. Lock observations come from sampled backend wait events and server lock logging. Percentiles use nearest rank, making p99 the maximum of 24 observations. A plan records a small fixture's actual planner choices as observed, including scans where cheaper than an index. Candidate SQL identifies the hot entity by namespace and projected key. The fixture retains the raw query plans and sampled waits to distinguish local observations from latency targets.
