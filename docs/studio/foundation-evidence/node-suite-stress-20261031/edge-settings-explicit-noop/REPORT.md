# Explicit appearance duplicate-write guard — builder repair

Base `cc0840e3eed80d7c5be3e5c4ed7840fefb1a041c` (nested auto-pan repair),
branch `codex/flow-nested-connect-autopan-20261101`.

Root's native Canvas route select advanced the canonical graph twice for one
bezier→straight edit. First Undo retained straight; a second Undo restored bezier.
Root retains the three actual source captures. A separate later observation of
non-writing controls after reload was resolved by root as intentional Design
mode behavior and is not classified as this defect or repaired here.

An independent coding fixture reproduces the real registered component path:
UiDocument with an ordinary native select, compileUiDocument, DocumentHost and
public flow authoring implementations. Input followed by change is delivered
through refreshed scoped frames. Before this repair the native-select case
advances two revisions and one Undo still leaves straight. A selected-edge
partial-override case also records an extra revision for a repeated value.
Baseline **2 FAIL / 4 PASS** is retained in `edge-settings-noop-baseline.log`.

The production change is only a three-line guard/comment in
GraphEdgeSettings.write. After existing active/lifetime/readonly admission, it
returns when the current explicit appearance owns the key and Object.is matches
the incoming primitive value. It does not compare effective/resolved appearance:
an inherited value may still be deliberately pinned explicitly. Partial override
ownership, field-wise inheritance, reset, validation, host source ownership and
canonical graph/session APIs are unchanged. No Studio workaround, coercion,
stale-frame weakening or new bound is introduced.

```text
node node_modules/vitest/vitest.mjs run --config packages/ui-flow-svelte/vitest.authoring.config.ts packages/ui-flow-svelte/test/edge-settings.svelte.test.ts packages/ui-flow-svelte/test/authoring.svelte.test.ts packages/ui-flow-svelte/test/composition.svelte.test.ts packages/ui-flow-svelte/test/nested-connect-autopan.svelte.test.ts packages/ui-flow-svelte/test/connection-gesture.svelte.test.ts
npm run build -w @victframework/ui-flow-svelte
node node_modules/eslint/bin/eslint.js packages/ui-flow-svelte/test/edge-settings.svelte.test.ts
git diff --check
```

Final **42/42 PASS**, including all six edge-settings cases; Svelte **0 errors /
5 inherited warnings**, changed test lint and diff check exit0. Final logs are
`edge-settings-noop-final.log`, `edge-settings-noop-types.log`,
`edge-settings-noop-lint.log`. The select now commits one revision and one Undo
restores the original field and displayed value. A value equal to inherited
bezier is still pinned on an edge that already owns only color; repeating it is
a no-op; later canvas straight does not override that pin; Reset removes the
partial override and restores inheritance. Existing selected ownership, stale
controls, nested repeated-edge isolation, typed values and reset/history tests
remain green.

This is builder evidence. The test uses the existing UI source alias and
controlled DOM events, not an installed-artifact or native gesture claim. Fresh
independent review, packed-byte association and the native one-edit/one-Undo
check remain required. The earlier installed leaf proof predates this new guard
and must not be treated as independent verification of these changed bytes by
this same reviewer. No root worktree/dist, browser, actual app source, provider,
activation, push or publication was changed.
