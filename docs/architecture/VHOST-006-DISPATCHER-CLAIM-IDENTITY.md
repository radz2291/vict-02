# VHOST-006 dispatcher command claim identity

22 November 2026 · Builder evidence for Radzi’s review

The isolated dispatcher allocates a fresh fence on each new command claim. The same service instance can retry an ordinary command, a confirmed command or confirmation preparation after a valid release. The dispatcher keeps the winning token through settlement or release. Claims, authorization, digest matching, replay and confirmation behavior keep their existing interfaces. [Dispatcher-only commit](https://github.com/radz2291/vict-02/commit/8f23c02c4b8a91e3315f4b73bf64a4ca6a89fc2c)

## Exact source and implementation

The guarded storage baseline is VHOST-005 commit `f0f2133c6b57d2b610ace0864a812eb31200ac1c`. Its `packages/server/src/commands.ts` blob, `354e394978edfd192982d0677a01253e14d80fb8`, is byte-identical to the framework source `1b11d4a5f4298310c7ab16e0808b8bfbed551ee5` and C12 source `a22615b014aa69f7501dc1504da5f9daad639786`. The dispatcher commit directly extends the guarded baseline and changes only the actual dispatcher source. The fixture branch extends that dispatcher commit. This keeps the exact source base while avoiding unrelated source history.

Each prospective initial claim gets a cryptographically random 256-bit token in the existing opaque string format. VHOST-005’s guarded store atomically reserves and enforces token non-reuse. The service-instance owner, command identity, attempt count, expiry predicates, and separate confirmation-consumption fence keep their existing roles. A current receipt still follows the existing lookup and replay path. Expired takeover still settles using the token returned by the store. [Dispatcher source](../../packages/server/src/commands.ts) · [Guarded store](VHOST-004-COMMAND-FENCE-REPAIR.md)

## Disposable PostgreSQL evidence

| Normal entry point | Pinned dispatcher on retry after release | Repaired dispatcher on retry and replay |
| --- | --- | --- |
| Ordinary `dispatch` | Fence conflict before a second domain-boundary call | Same instance acquired and settled with a different token. One successful synthetic mutation across retry and replay. |
| Confirmed `dispatch` | Fence conflict before a second cancellation-boundary call | Same instance acquired and settled. One cancellation, and the confirmation became consumed on its second attempt. |
| `prepareConfirmation` | Fence conflict before a second issuance-boundary call | Same instance acquired and settled. One prepared receipt was issued and replay returned that receipt. |

In all three repaired paths, six competing calls during the current claim returned in-progress, changed digests conflicted and the retired fence failed across complete, fail and release with the live receipt left unchanged. Repaired expiry testing left an abandoned pending claim, returned in-progress just before expiry, acquired generation 2 at exact expiry and settled with the takeover token. One synthetic effect occurred across recovery and replay.

The repaired dispatcher matched the pinned dispatcher’s authorization, confirmation ownership, digest and replay transcript. In the retained gap test, a durable command result with an interrupted confirmation settlement converged on replay without another cancellation. The final run also passed all 113 receipt-family and 79 prior storage differential calls, VHOST-005’s six byte-identical stale-fence refusals, guarded reservation rollback and four pinned installed C12 same-connection journal transactions.

The proof uses synthetic app-data, run cancellation, audit and execution collaborators. It covers retry after an interruption before the effect and recovery after a durable command result. An effect that finishes before any recoverable evidence exists still relies on the domain’s own idempotency or durable effect protocol.

## Reproduce and review

The harness checks the exact dispatcher Git object, parent and blob plus the pinned Quellight closure. The installed consumer checkout is `8f8ec2d24180e4a9520be0689aa6afb711553fc9`. The harness also verifies the F4 manifest commit `0761e1865258b23e2f04652f4301736155be06c5` and all relevant Runtime, Mastra, hosted and PostgreSQL archive hashes. The consumer closure has no server package. The harness compiles the original and repaired dispatcher directly from their exact Git objects against the same installed Runtime, and type-checks the repaired dispatcher plus its pinned auth type source under the repository’s strict options. Exact identities are in the run output. On this workstation, the VICT source objects are in `C:/Users/RZ1/Desktop/RZ/261116-VICT-Vercel` and the verified installed consumer is in `$env:TEMP/vhost001-quellight-npm11212`. An external verifier needs authorized access to the same source objects. [Fixture commands](vhost-003-candidate/README.md) · [Pinned consumer](https://github.com/radz2291/VICT-Quellight-02/tree/8f8ec2d24180e4a9520be0689aa6afb711553fc9) · [Raw run and source hashes](vhost-003-candidate/evidence/vhost006-dispatcher/matched.json)

The first strict type-check preflight looked for Node types in the repository’s current working directory. It failed before the SQL suite. The final harness points TypeScript at the verified consumer’s installed type roots. [Retained preflight failure](vhost-003-candidate/evidence/vhost006-dispatcher/typecheck-preflight-failure.json)

The fixture still exposes 65 of 126 qualified storage operations. Independent Gate A, complete packed-package conformance, simultaneous different-command idempotency-key reuse, coordination text-key compatibility, full import and recovery rehearsal, and release authorization remain prerequisites for serving. The D5 prepared-digest rule stays with the authorized control-plane work. The dispatcher proof is a correctness run and does not change the earlier benchmark or qualify live usage.
