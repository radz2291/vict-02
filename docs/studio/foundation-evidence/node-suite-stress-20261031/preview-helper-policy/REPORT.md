# Synthetic static-preview helper policy repair

Owner-authorized amendment: remove remaining artificial preview-helper quotas and defer HTTP transaction protection to Node defaults. This narrow proof-harness change starts from exact d696c1e5b3230f423df4874e6e8b403cf7479e75 on isolated codex/preview-helper-policy-20261031. Historical Stage 9 closure and earlier limits remain historical; this is a builder candidate, not an independent verdict. origin/main remained d7401bef6e48330796c74ec00c86db9622d48cdf. Root's concurrent actual application/source and old preview servers were untouched.

Removed from scripts/serve-export-device-preview.mjs: 256-file inventory quota, 512-character inventory path quota, 64 MiB/file and 128 MiB aggregate quotas, 2048-character request path quota, and custom maxHeadersCount=32 / headersTimeout=10s / requestTimeout=15s / keepAliveTimeout=2s. No larger replacement quotas. Node's own HTTP parser and transaction defaults now apply.

Preserved: exact private/loopback IPv4 binding and assigned-private-address check; dedicated nonprivileged port excluding 5626; exact Host; GET/HEAD only; MIME allowlist; encoded and decoded path grammar; realpath containment; duplicate exclusion; sealed preparation-report SHA/status/root identity, every file SHA and original source-export SHA; unchanged in-memory verified bytes even after disk mutation. Missing physical files, invalid hashes and real I/O failures remain actual failures. No package/runtime/schema changes or new storage.

The helper reads the complete inventory into immutable Buffers before listening. Available RAM, Node Buffer/process limits, OS filesystem/path/encoding capabilities and Node HTTP parser/default transaction protections remain real limits. This does not promise unlimited memory or unlimited transport; failures are not represented as successful partial inventories. The test fixture labels itself synthetic and does not establish actual app preparation, native browser behavior, agent success or suite completion.

## Checks

Run from this checkout: node --test scripts/serve-export-device-preview.test.mjs (Node v22.13.1).

- Final baseline capsule from exact d696c1e5: 4 failed quota regressions / 6 passed protections. Capsule was temporary, removed individually after execution. PREVIEW_HELPER_SOURCE points tests to that capsule; production helper was not reverted.
- Final repaired helper: 10/10 PASS.
- Positive exact-byte loopback transport: 262 sealed files; two 65 MiB files; independently three 45 MiB files totaling 135 MiB; a nested path above 2048 characters; more than 32 request headers; HEAD content length with no body.
- Negatives: wrong Host; POST; traversal/encoded separator/invalid percent/query/double slash; missing file; mismatched file/report/source SHA; duplicates; unsupported MIME; realpath junction escape; forbidden/wildcard/public/hostname binding; privileged/Studio port. Post-start disk mutation still serves original sealed bytes.
- Tests create only uniquely named temporary fixture directories and their own child helpers on OS-selected loopback ports. Every child is stopped and every owned fixture directory checked before cleanup. No existing preview server is contacted or stopped.

Initial 8-test and intermediate 9-test RED/GREEN logs remain alongside sealed 10-test logs. They show incremental coverage, not additional actual-app evidence. No production build, browser, provider, activation or push was performed. Next: parent cherry-pick and independent exact-candidate check.
