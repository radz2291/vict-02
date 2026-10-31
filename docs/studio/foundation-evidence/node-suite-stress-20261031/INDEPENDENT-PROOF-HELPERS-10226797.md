# Independent proof-helper review

31 October2026. Exact integrated candidate `102267977e783898905d6aa846fd16e158b37ee1`, including preview helper6a1fa872ece18546469ce0a0d3fb20f445791230 and roundtrip/export preparationeccfa73f/d696c1e5. Isolated review branch codex/independent-proof-helper-20261031 preserves all earlier verifier branches. **Focused synthetic preview-helper PASS; roundtrip/preparation light source review qualified as below. No whole application-suite verdict.**

Independently ran on Node22.13.1:

```text
node --test scripts/serve-export-device-preview.test.mjs
```

Result10/10 PASS, no skipped/cancelled cases. Exact log retained as independent-proof-helper-tests.log. Positive cases exercise262 sealed files, two65MiB files, three45MiB files totaling135MiB, paths beyond2048 characters,40 headers and exact HEAD metadata. Tests use synthetic uniquely named owned temporary fixtures and new child helpers on OS-selected loopback ports; cleanup checks the resolved owned-temp prefix and terminates only the created child. No existing Studio/5630/5631 service, provider or browser was contacted or changed.

Reviewed removal of256-file,512-character inventory path,64MiB per-file,128MiB aggregate and2048-character request path quotas, plus custom HTTP timeout/header-count settings. No larger local ceiling replaces them. Running Node HTTP parser/transaction defaults and real OS/path/Buffer/memory/I/O limits remain; the helper does not promise unbounded hardware or unlimited transport.

Protections remain and pass negatives: exact SHA256-bound preparation report/status/root, every output-file hash, original source-export hash, nonempty inventory/index, duplicate exclusion, MIME allowlist, realpath containment and regular-file admission. Explicit private/loopback IPv4, assigned private interface, dedicated nonprivileged non-Studio port, exact Host and GET/HEAD only remain. Both raw and decoded traversal/separator/query/hidden-path/invalid encoding refusals remain. Missing files/hashes/unsafe inventory/junction escape fail before listening. Verified Buffers are retained in memory; subsequent disk mutation cannot change served bytes. The complete inventory is admitted before any listener is created, so failure is not represented as a successful partial inventory.

The96MiB preparation change is exactly one artificial input-size guard deletion. It preserves supported single-screen application/envelope attachment checks, absent/empty managed-media/source-asset scope, fresh output destination, exact input/export copies, package artifact identity/installed-byte comparison, public registry compilation/renderer validation and static production build. This review did not prepare a new actual-device preview or claim a new package/device pass.

The generic roundtrip helper now resolves Flow through its actual installed public package entry, rather than attempting bare resolution from an unrelated temporary directory. It uses existing Studio importer/export attachment code, exact actual saved/exported source equality, two complete importer passes, full application/envelope equality, and comparisons of recognized serialized graph strings/revisions/families/parameters/values/positions/edges. It deliberately refuses managed assets without separate byte-preservation proof. Private Studio imports here implement the explicitly scoped actual Studio importer check; this is not a public-consumer proof, and its report states that distinction.

Important limit of that proof: graphSnapshots recognizes strings tagged vict.flow-graph@2 in local state and family string parameters. Its two-nested-snapshot threshold establishes serialized graph data/paths, not that those data are mounted, bound through the controlled source resolver, independently owned in native interaction, or editable in rendered nested Flow. Native ownership/state/persistence checks remain separately required. The helper's assertion wording about independently owned nested occurrences cannot be used alone as that verdict.

Inspected the retained actualr1.r2 roundtrip failure: it reaches the explicit missing-two-nested-graphs assertion after the earlier import/envelope assertions. That remains expected RED for the incomplete app, not a roundtrip-suite PASS. The initial temporary bare-package-resolution error is retained separately. No temporary partial application was rewritten or substituted by this review, and no fresh actual roundtrip run is claimed.

Production paths apps/studio/src and packages have no changes between4fca and10226797; these helper changes do not change the already serving Studio artifact. Root's later actualr1.r3 continuation is outside this synthetic/helper verdict. Actual native UI, completed complex suite, nested editing, save/reopen/export, device/browser/provider and owner acceptance remain held until their own completed evidence. No product repair, activation, push, merge or publication occurred here.
