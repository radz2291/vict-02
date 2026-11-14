# VICT-004 builder qualification

Candidate `96798ab5dcd526af2868692fd156e360189f0434`, source tree `badf94efb265765f168d7a4c89ffb1146488adfc`.
Local builder commit `80b90c72083c573bd760d64653a1530e913d8c01` has the identical tree.
The GitHub connector created the review branch after the direct Git push
could not obtain credentials. The remote tree identity was verified.
Baseline `6b420a3e9eada6f694cc2550debda7753316b5b3`; unchanged lock blob
`66c10fa33529f34eff4008f3c3be2193a067f020`.
Mastra core 1.64.0. Linux Node 24.22.1 with npm 11.9.0.

- Built the eight coordinated packages. `scripts/pack-agent-exchange-proof.mjs`
  created their npm tarballs, installed the VICT packages from those archives
  in an isolated consumer, and ran the end-to-end proof through public exports.
  The consumer seeded the pinned transitive dependencies from the build checkout.
- The 12 scenarios passed: last step, zero step, exact duplicate during and
  after execution, altered duplicate, both Stops, each deadline, denied answer,
  revoked actor, denied question and killed process. Each ordinary scenario
  also checked missing wiring and an altered activation object.
- The successful asker's two model steps and 10 monotonic strict events used its
  original turn and stream. The answer was charged one reserved step and one
  observed provider attempt. The answerer's next ordinary dispatch was refused.
  Zero remaining steps made no answer call. SQLite reopen returned the original
  receipt and rejected cross-actor reads and altered receipt settlement.
- Existing Mastra, Runtime, SQLite and Control regression suites passed
  **953/953** across **84 files** against the same source tree.
- [Archive hashes and scenario counts](VICT-004-AGENT-EXCHANGE-BUILDER.json).

During development, an initial duplicate fixture conflated two model message
occurrences with a retry. The final fixture retries the exact public composed
tool call during its original turn, before and after settlement. A changed
payload exposed that ordinary invocation keys include the argument digest.
The exchange now binds the framework tool-call identity to its first operation,
and rejects a second payload without a new exchange reservation. The first
process-loss replay correctly refused until the fixture restored its server-side
actor directory. The first offline npm resolution hit an uncached transitive
package; the package proof now extracts VICT archives into the isolated consumer
over the already pinned dependencies, with no workspace package links.

**Gate:** Builder evidence only. Independent Windows Node 22.13.1 proof on the
exact candidate remains required before TORI binding. The fixture uses no live
provider. The cap remains an owner policy decision. A host must restore its
actor authority and run reconciliation after confirming prior-owner loss.
The candidate uses only the held-tool/one-step Mastra mechanism. The exchange
profile requires bounded turn policy and a concrete streaming model.
