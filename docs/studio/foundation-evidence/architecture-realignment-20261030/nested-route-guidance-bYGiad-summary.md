# Nested route guidance: independent bYGiad artifact audit

PASS: read-only recomputation of the retained successful public-consumer receipt
for source `8d8be402893a8942b985ad920b32b31807e2ad47`.

`nested-route-guidance-bYGiad-audit.mjs` independently matched:

- Seven packed tar SHA-256 values.
- 510 installed nonmanifest artifact SHA-256 values, inside the isolated consumer.
- Eight consumer fixture and two production asset SHA-256 values.
- The retained DOM test log SHA-256.

The tar member and installed `src/composition/knowledge.ts` are byte-identical to
`git show 8d8be402...:packages/ui-flow-svelte/src/composition/knowledge.ts`, SHA-256
`4042f4398a8c8ab48213d62d56d50990d5fbee15487999cd9dabb6c845c20c5d`.
This verifies the packed consumer contains the updated public guidance, including
the reviewed clarification, rather than the earlier ambiguous knowledge body.

The tar members, installed files and current committed versions of
`src/composition/GraphWorkspace.svelte` and `src/editor/GraphSurface.svelte` are
byte-identical to the repaired runtime at
`ab3296e6503a63b2587ed36a1e1a121179082396`. Their hashes remain respectively
`620bb6f704d8856432fc152aa6d13c17664bda3a5ed673fcef860e501e499315` and
`dda4470be506a3c2b583c1ebde94ecd5c6e07ab9b654f3ff42e12782bedbc61f`.
This confirms guidance packaging did not replace those runtime repairs.

The complete per-file comparisons, receipt identity and explicit reused/fresh
package build modes are retained in
`nested-route-guidance-bYGiad-independent-audit.json`. The audit script passed
syntax and scoped whitespace checks. Prior receipts were not overwritten.

No package/Studio build, preparation, DOM rerun, browser, provider, server or
activation was performed. No product files were edited or committed. This
artifact audit does not establish actual-agent route discovery, native behavior,
physical-device results or owner acceptance.
