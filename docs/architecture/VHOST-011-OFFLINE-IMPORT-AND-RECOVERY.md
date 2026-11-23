# VHOST-011 offline PostgreSQL import and recovery rehearsal

23 November 2026 · Builder evidence for Radzi’s review

The operator tool captures a synthetic legacy PostgreSQL namespace, validates its exact tagged Runtime envelopes, stages the 126-operation indexed layout in a dormant namespace, and checks every target table against a deterministic manifest. It starts from VHOST-010 commit `01648f8af820aed5893d38ca99ae86527d62883d`. [VHOST-010 baseline](VHOST-010-READ-RESULT-IMMUTABILITY.md) · [VHOST-002 import contract](VHOST-002-INDEXED-POSTGRES-OPERATIONAL-STORE.md#versioned-import-cutover-and-rollback)

## Capture, plan and verify

A PostgreSQL role with only source reads captures the source system identifier, database, schema version, operator continuity marker, namespace epoch, snapshot revision, coordination and effects in one repeatable-read, read-only transaction. A separate fixture connection commits a revision and coordination change after that transaction starts. The old capture sees neither change and the following capture sees both. The fixture distinguishes a populated envelope, an explicitly empty tagged envelope, a SQL NULL envelope and an absent operational row. [PostgreSQL repeatable read](https://www.postgresql.org/docs/18/transaction-iso.html#XACT-REPEATABLE-READ)

The mapper verifies each pinned envelope digest and tagged round trip, typed identities, redundant indexes and denormalized references. It projects source records into the actual indexed schema and preserves UTF-16 key bytes, insertion order, separate execution streams, private checkpoints, branch outputs, deletion evidence, and stream clock gaps. The embedded orchestration envelope has its own digest and inactive archive. Only standalone orchestration populates the live indexed orchestration tables. The manifest includes exact snapshot and table hashes, row counts, sequence and fence ranges, and held records. Surrogate foreign keys are compared using durable table ordinals, so a failed insert can consume database sequence numbers without changing the approved manifest.

Staging locks the target namespace and verifies the complete relational read-back in the same transaction. The staged namespace has no callback admission row. A repeat checks the existing rows instead of inserting them again. The rehearsal refuses bad envelope digests, a contradictory invocation index, mismatched identity, a different manifest, and a tampered target. Injecting an interruption after control rows are inserted leaves the target namespace and all mapped relations empty. The installed legacy adapter and the staged inspection path agree on representative reads. The pinned effect read takes a row lock, so the persisted uncertain receipt is compared through SQL while staged inspection stays read-only. [Operator](vhost-003-candidate/operator-migration.mjs) · [Mapper](vhost-003-candidate/migration-map.mjs) · [Synthetic fixture](vhost-003-candidate/migration-fixture.mjs)

## Authority and recovery

The legacy snapshot retains the active command fence, and the fixture’s retired fence is absent after legacy release. The imported namespace keeps the recorded active fence, uncertain effect, incomplete deletion, pending receipts and recoverable run evidence. It stays dormant for reconciliation. Legacy PostgreSQL text only records the identifiers stored on the wire, so earlier text aliases cannot be reconstructed. The manifest records both compatibility limits.

The pre-write rehearsal confirms that staging has no writer and the frozen source still matches its manifest. The authority exercise uses a separate SQL NULL fixture with no unresolved effect. The target advances from epoch 7 to 8, retires the old lease, furnishes a higher fence to a new owner, preserves the historical applied receipt fence, and retains a sticky tombstone. A post-admission write is visible on the indexed target and absent in legacy. This establishes the point after which recovery uses indexed history.

The rehearsal copies the actual pinned C12 memory schema and synthetic product watermark while their source is quiescent. Its C12 schema and namespace marker are preserved and re-verified against the indexed binding. It also creates a logical backup of the indexed recovery point and restores it into a separate PostgreSQL database. Full read-back verifies staged and active operational data, the indexed-only write, the C12 and product table fingerprints, and held scopes. [PostgreSQL pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) · [PostgreSQL pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html)

Preflights caught an invalid synthetic stream ID, a lease duration above the pinned limit and the row-locking effect read. An offline CLI probe also refused a digest after the manifest code changed between commands. One successful migration rehearsal exposed the prior regression suite's 120 ms connection bootstrap limit when run immediately afterward. The final runner starts the earlier regressions first. [Retained observations](vhost-003-candidate/evidence/vhost011-migration/preflights.json)

The populated manifest covers 35 mapped tables and 85 rows, and the harness matched 29 representative public reads. The logical backup took 872.72 ms and the restore took 1498.13 ms. The 43 pinned tests and 126-operation regressions passed, with zero legacy namespace snapshot statements across 15,833 traced indexed regression statements.

## Reproduce

From the fixture directory, use Node 22.23.5, the PostgreSQL 18.6 utilities and the exact consumer closure from VHOST-010.

~~~powershell
./run-local.ps1 -PgBin $PgBin -Node $Node -Consumer $ScratchQuellight -Source $VictGitCheckout -Output $NewEvidenceDirectory -CheckOnly
~~~

The local runner creates a loopback cluster and shuts it down after the rehearsal. While an owned cluster is running, the standalone command takes `capture`, `plan`, `stage` or `verify` followed by a JSON configuration file. The configuration carries the loopback port and owned data directory, expected source identity, namespace, file paths, and independent approval digest for stage and verify. `plan` emits the digest for review and writes the canonical manifest. Source capture and target verification use fixed disposable database names. [CLI commands and configuration](vhost-003-candidate/README.md) · [Raw results](vhost-003-candidate/evidence/vhost011-migration/result.json)

The backup is a logical recovery-point rehearsal in one disposable cluster. Managed physical backups, WAL/PITR, independently hosted product and memory recovery, role revocation and scheduler quiescence remain for later Gate A/B qualification. The fixture evidence leaves the populated namespace on hold.
