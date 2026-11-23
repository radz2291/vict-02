# Indexed PostgreSQL operational-store test fixture

## VHOST-011 offline import rehearsal

The local runner provisions the migration tables, seeds synthetic data into vhost011_source, and rehearses with the indexed fixture in postgres and a logical restore into vhost011_restore. Run the reproduction command with -CheckOnly. The [report](../VHOST-011-OFFLINE-IMPORT-AND-RECOVERY.md) links the exact Operator artefacts and raw timings.

The offline commands below can also run against a still-running owned disposable cluster prepared by the rehearsal. The source database exposes vhost011_identity.source and grants SELECT and schema usage to vhost011_reader. The target uses the fixture DDL and a separate privileged staging connection. Command output files must be new for capture and plan.

~~~powershell
& $Node ./migrate-local.mjs capture $Config
& $Node ./migrate-local.mjs plan $Config
# Record the independently reviewed plan digest in approvedManifestSHA256.
& $Node ./migrate-local.mjs stage $Config
& $Node ./migrate-local.mjs verify $Config
~~~

Config fields and example shape

~~~json
{
  "connectionPort": 54321,
  "dataDirectory": "C:/scratch/owned-pg/data",
  "namespace": "vhost011-full",
  "identity": {
    "cluster": "<system identifier from the source record>",
    "database": "vhost011_source",
    "epoch": "7",
    "marker": "synthetic-backup-boundary-v1",
    "serverVersion": "18.6",
    "sourceId": "owned-synthetic-vhost011"
  },
  "paths": {
    "consumer": "C:/scratch/frozen-quellight",
    "sourceRepo": "C:/scratch/exact-vict-source",
    "capture": "C:/scratch/capture.json",
    "manifest": "C:/scratch/manifest.json"
  },
  "approvedManifestSHA256": "<verified digest emitted by plan>",
  "targetDatabase": "postgres"
}
~~~

The restore target name vhost011_restore is available for verify. Stage and verify require the same capture and approved canonical manifest. A matching retry checks every table. Staged namespaces have no callback admission row and the installed candidate’s ordinary entry point refuses them. The CLI handles capture, staging and verification. The rehearsal alone exercises synthetic writer admission and logical restore.

## VHOST-010 read-result immutability

The correctness runner compares catalog and recovery claim freeze boundaries on the exact VHOST-009 fixture, pinned legacy PostgreSQL and the repaired fixture. It also runs every registered pinned store, orchestration and join case. [Report](../VHOST-010-READ-RESULT-IMMUTABILITY.md) · [Raw before-and-after evidence](evidence/vhost010-immutability/result.json)

## VHOST-009 execution and orchestration

The current fixture exposes all 126 qualified operations. The additional DDL provisions indexed run identities, event streams, orchestration components and timer and recovery projections. The correctness runner executes the exact pinned legacy comparisons, SQL fault and concurrency probes, and the earlier regressions. [Report](../VHOST-009-INDEXED-EXECUTION-AND-ORCHESTRATION.md) · [Coverage](PORT-COVERAGE.md) · [Raw run](evidence/vhost009-runs/result.json)

## VHOST-008 ordered appends

Run the reproduction command with -CheckOnly to compare overlapping writes on the exact VHOST-007 fixture, the pinned legacy package and the repaired fixture. The same invocation runs the full regression suite. [Ordering report](../VHOST-008-ORDERED-APPENDS.md) · [Raw before-and-after run](evidence/vhost008-ordering/result.json)

## VHOST-007 control, activation and governance

The current fixture uses schema version 4 and exposes 103 of 126 qualified operations. The [VHOST-007 report](../VHOST-007-INDEXED-CONTROL-AND-GOVERNANCE.md), [coverage matrix](PORT-COVERAGE.md) and [raw correctness run](evidence/vhost007-control/result.json) describe the new ports and reproduction. The [receipt behavior matrix](RECEIPT-TEST-MATRIX.md) and [VHOST-005 command fence proof](../VHOST-004-COMMAND-FENCE-REPAIR.md) describe prior work.

## VHOST-006 dispatcher proof

Use the same command below with `-CheckOnly`. The harness verifies and compiles the original and repaired dispatcher Git objects, then runs both against the guarded store. See the [candidate report](../VHOST-006-DISPATCHER-CLAIM-IDENTITY.md) and [raw evidence](evidence/vhost006-dispatcher/matched.json).

## Reproduce

The candidate is a private test fixture. Its only entry point is `createIndexedHotPathForTests` in [indexed-hot-path.mjs](indexed-hot-path.mjs). It takes the exact installed-package oracle and fixture database options. The schema name, loopback host, fixture role and database name are fixed. It exposes actors, turns, stream ledger, invocations, approvals, both command receipt ports, control, the activation catalog, agent governance, execution, orchestration, coordination and the leased facade/lifecycle methods. The runner provisions [the base DDL](schema.sql), [the receipt extension](receipts-schema.sql) [the control extension](control-schema.sql) and [the execution extension](execution-schema.sql) on a separate operator connection before opening the adapter.

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
