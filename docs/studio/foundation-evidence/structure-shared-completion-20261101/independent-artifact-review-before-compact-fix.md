# Independent technical artifact review

**PASS**, candidate `3dfdde4ecb5567bc03130426482076d5344e3530`.
Seal SHA256: `c8b940751d9c8be44ddc7aeec7339f41eae133517fa80a7817d2a0c88df36fc0`.

The independent checker recomputed343 copied build inputs against their manifest
and committed source, allowing only Windows line-ending normalization. Runtime
source paths show no drift. It matched all398 staged outputs, all398 previously
serving files, all93 retained public proof routes and296 compiled dependency files.

All nine public archives were independently hashed, validated for safe regular
members, extracted into a fresh temporary directory and compared with the report.
All645 nonmanifest archive members and645 separately installed nonmanifest files
match. Public manifests retain name/version/type/exports/dependency semantics.
The isolated consumer is separate from the source checkout and uses no Studio
imports or source aliases. Its eight fixture files, six output files and exact
four-case DOM/production-build logs match their recorded hashes.

Eight unchanged package builds/artifacts were reused from the earlier successful
package-build portion; the changed Structure package was freshly checked and
packed. This is not a claim of nine fresh dependency builds. The earlier report
continued after the reuse snapshot and its live path now has a different digest.
The exact digest recorded by reuse survives in
`vict-structure-consumer-hXcQQT-build-reuse-snapshot.json`; this review explicitly
associates that preserved snapshot. Earlier failed consumer observations remain.

The activation helper pins source/stage/build/backup paths, refuses product drift,
checks copied inputs, compiled bytes, lock/report identities, sealed outputs and
existing serving bytes, then verifies current listener/launcher ownership before
stopping only that process and preserving the entire old build. It does not change
provider credentials, origin, account state, network permissions or publication.

After the integrator's local activation, a separate independent check matched all
398 installed files, all398 old files in the preserved backup, and296 unchanged
compiled files. The fresh listener has the expected normal build/launcher commands
at `127.0.0.25:5626`. See `independent-post-activation.json`.

This is technical association and preservation evidence. Native browser behavior,
actual-agent adoption, saved-source history and physical-device observations remain
separate. Test-only and harness-only cleanup outside runtime source does not change
the frozen build; the integrator must commit their final delivery identities.

Machine-readable results and reproducible checkers:
`independent-activation-review.json`, `independent-artifact-check.mjs`,
`independent-post-activation.json`, `independent-post-activation-check.mjs`.
