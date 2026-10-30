# Intermediate host@2 viewport-boundary failure

This is a retained excerpt transcribed from the actual tool output in this repair conversation, not a newly executed run or an independently pinned candidate. It tested the uncommitted host@2 repair before GraphViewport gained its nearest-viewport/readOnly keyboard boundary. Source predecessor was46d20c3; final repaired production source is3e2c7b9e4a52721e398afb23d3fa140efe31f689.

Run:2026-10-30 18:03:03 MYT. Command in apps/studio:

node node_modules/vitest/vitest.mjs run tests/graph-history-source-policy.test.ts tests/graph-scoped-bridge.test.ts tests/graph-runtime-refusal.test.ts tests/graph-scoped-ownership.test.ts

Captured result excerpt:

    tests/graph-history-source-policy.test.ts (3 tests) PASS
    tests/graph-runtime-refusal.test.ts (1 test) PASS
    tests/graph-scoped-ownership.test.ts (9 tests) PASS
    tests/graph-scoped-bridge.test.ts (4 tests | 1 failed)
      PASS persists nested manual and agent changes through Studio history, save/reopen and portable import
      PASS keeps repeated private graph occurrences temporary with local undo and no canonical or save promotion
      FAIL refuses nested source Undo and editing when a controlled declaration has no actual parent parameter
      PASS keeps canonical graph ownership and persistence beyond64 ordinary source wrappers

    Expected: "5b90c277f5567927334e009ace06c5d51db33ca9121c3e08f5a87cf8629f511a"
    Received: "2ae2186ce081ca4385c66e0c9a87239cd55802ad3a0594a4391a9098f2300b91"
    Assertion: canonicalUiDocument(view.bridge.document).contentDigest equals retained before digest

    Test Files 1 failed | 3 passed (4)
    Tests 1 failed | 16 passed (17)
    Duration61.25s
    Exit1

The host correctly returned refused and rendered the error. The nested readOnly viewport returned early, allowing its Ctrl+Z event to reach the enclosing writable graph. That outer graph invoked global history and changed the unrelated canonical label. The final shared viewport boundary blocks this ancestor command path while preserving native editable-control defaults. Subsequent scoped7/7 and expanded18/18 runs pass; the green log is stored separately and does not replace this failed observation.

Actual final ordinary-control coverage: the missing-parent-parameter test asserts the app-owned Name primary source button is disabled through the content frame's readOnly prop. It synthetically dispatches Ctrl+Z at the ordinary Evidence URL input and asserts defaultPrevented remains false, while the graph-node Ctrl+Z path leaves the unrelated source label and digest unchanged. Happy-dom does not execute a browser's native text-undo stack; this assertion proves no default cancellation, not native browser editing history behavior. The repeated-private test independently asserts the same native-input default preservation in a runtime graph.
