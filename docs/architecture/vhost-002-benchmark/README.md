# VHOST-002 legacy PostgreSQL baseline

This harness times the **existing** installed store over a disposable PostgreSQL cluster. It runs no Quellight routes, hosted services, external models, or candidate storage code. Use a Windows workstation with PowerShell, PostgreSQL client/server binaries, the pinned Node and npm versions, and enough local disk for a cluster and the installed app closure.

## Reproduce

1. In a scratch checkout of Quellight at 8f8ec2d24180e4a9520be0689aa6afb711553fc9, use Node 22.23.5 with npm 11.21.2 to run npm ci --ignore-scripts --no-audit --no-fund. Run node scripts/verify-baseline.mjs --installed and verify all 14 exact framework trees. The runner independently checks the lock hash, candidate archives and C12 runtime/Mastra archive digests and lock integrity. It resolves modules inside the given consumer.
2. Use PostgreSQL 18.6 binaries from the existing VICT-Vercel local qualification. The measured executable SHA-256 values are below. Supply a directory containing initdb.exe, pg_ctl.exe and the matching postgres.exe. The harness makes a fresh temporary data directory and refuses an existing evidence directory. It binds only 127.0.0.1 on a freshly selected local port. Loopback trust and TLS-off are for these synthetic fixtures. The Node harness verifies the server's data directory, role, address, port and SSL setting before creating its schema.
3. Run from this benchmark folder. Supply verified paths from step 1 and step 2.

~~~powershell
./run-legacy-baseline.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Output $NewEvidenceDirectory -Samples 24
~~~

4. Review baseline.json, runner.log and postgres.log in the output directory. The wrapper stops only the postmaster it created and retains the disposable data for review. Every execution needs a new output directory and has its own isolated cluster. Retain raw failures even if subsequent cells pass.

| Binary | Measured SHA-256 |
| --- | --- |
| postgres.exe | af5b897cb69c9ce692a4a15ecd022b540db85db1add0f66d2b9f0697be2451a0 |
| initdb.exe | 68195f0c6f22694660ba86d914ae8c74bcd38e71eb342f98e065b1962311142e |
`$1552049183df455921657c8e498e9745e8508bf77d2c2e5cb9c21b2cbdc798822 |

## Fixture and measurement

- Seed one valid turn and stream via existing public ports. Create unrelated synthetic durable milestones using the installed in-memory stream ledger, export its validated component, and insert the assembled legacy snapshot into the fresh benchmark-owned table. This avoids timing fixture generation as workload. Each recorded seed has a measured UTF-8 byte length and generated stream count.
- One observe operation does an unleased ledger range and turn read. One Stop check uses a leased hasCancelIntent. One append uses a leased durable milestone append. These are the operational subset of Quellight's path. The fixture excludes auth, product fragments, Mastra writes, provider, TLS and a remote network.
- Use one warmup per operation in each cell with a fixed sequential cell order. Timed clients loop as soon as their prior request completes. Each fixture combines pools 1/1/4 with clients 1/8/8. Writes add a small amount of process-local fixture history across sequential cells. Query byte samples and socket counters reflect the actual transmitted sizes, and the reported seed size is the initial value. A separate short-lock test holds the exact snapshot row and confirms the expected safe refusal and post-unlock recovery.
- Latencies are wall-clock milliseconds including Node, SQL, and pool wait with lightweight instrumentation. Pool and lock peaks are samples, about every 10 ms when the event loop is free. Snapshot query duration includes wire, parser and lock exposure. Counts and timings separate pool acquisition and query time, and socket deltas include protocol framing and new connects. No billing or uninstrumented production capacity follows. Test p99 is nearest-rank and with 24 samples represents the maximum.
- A first attempt failed before any workload because the runner treated Node's directly resolved CommonJS pg namespace as having a named Client export. It stopped the owned cluster. The repaired harness loads pg from its default export. A second trial used a 120 ms lock timeout during all cells and received four HOSTED_DATABASE_UNAVAILABLE outcomes at the 0.56 MB, four-connection leased Stop cell. It then stopped at HOSTED_STATE_LIMIT on the large dense fixture. The final run used default normal-workload timeouts and treated the dense node-limit refusal as an explicit check before using 300,000 nodes for that size. The raw trial log keeps both outcomes distinct from the final sample. [Raw trial data](evidence/trial-state-limit.json)
- The final run measured 648 operations in 27 cells. Successful operations were checked at the public seam. The run records lease, lock timeout and configured limit checks separately. No candidate performance or Gate A/B verdict is included. [Raw final data](evidence/legacy-baseline.json)

## Evidence identities

| Evidence artifact | SHA-256 before Git checkout newline conversion |
| --- | --- |
| evidence/legacy-baseline.json | 6e20b9c496b5648b399aed5c2792a55dc7e58e8f86e8f167d6867d6a47a765f3 |
| evidence/trial-state-limit.json | b237c344c37c2abb29a390d889c5161cadf433115718b3dae6cf1fb32db68647 |
