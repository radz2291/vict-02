# P5 implementation proof — architectural closure of the Svelte UI stack

Branch: `pi/ui-foundation-p5` (worktree `vict-02-pi-ui-p5`), base `cc132c6b98ebe3322d6b5e3c76c7c62ac4ef0afd` (`qa/ui-foundation-p4`).

## What this pass changed (summary)

The permanent Svelte renderer implementation moved from
`@victframework/renderer-svelte` into `@victframework/ui-svelte`;
`renderer-svelte` is now a pure compatibility facade (re-exports only).
This is the implementation pass only — the extended P5 QA loop follows
after review.

## Bounded packed-consumer proof (`p5-consumer-proof.mjs`)

Run from the implementation worktree:

```
node qa-artifacts/p5-implementation/p5-consumer-proof.mjs
```

Result: **30/30 checks passed** (see `p5-consumer-results.json`).

The driver:

1. packs the six 0.3.1 packages from the worktree into `packed/`
   (contracts, sdk, application, ui, ui-svelte, renderer-svelte);
2. copies the consumer app + tarballs into a fresh temp dir OUTSIDE the
   repository (no workspace resolution possible) and npm-installs;
3. asserts installed versions exactly 0.3.1, and that the lockfile has NO
   `workspace:` protocol, NO `link:` specifiers, NO monorepo paths, and
   `file:` only as the packed-tarball install specifiers themselves;
4. asserts the packed manifests declare no `workspace:` protocol, the
   installed `renderer-svelte/theme.css` is only a compatibility entry
   importing `ui-svelte/styles.css`, and the installed `renderer-svelte`
   is the facade (re-exports, no own implementation);
5. vite-builds a consumer that imports BOTH public paths — DIRECT
   `@victframework/ui-svelte` (+ `styles.css`) and COMPAT
   `@victframework/renderer-svelte` (+ `theme.css`) — and asserts the
   built bundle contains EXACTLY ONE renderer implementation (the
   `renderer.svelte-kit` identity string and the `vict-host` marker each
   occur once in the JS; inline style copies are byte-identical);
6. runs the built bundle under happy-dom (real mounts, no browser) and
   requires every in-page check to pass:

   - frozen renderer identity through both paths
     (`RENDERER_ID === 'renderer.svelte-kit'`,
     `RENDERER_REVISION === '5.0.0'`);
   - single implementation: `createVictRenderer` / `renderVictApplication`
     / `VitApp` are the SAME bindings through the compat and direct paths;
   - renderer factory: identical id/revision/supported roles;
   - both paths mount the application and render IDENTICAL host markup;
   - theme tokens applied through BOTH style entry points;
   - reactive path updates render the new screen on the SAME host node
     (no remount) through both paths;
   - idempotent unmount through both paths.

## Other verification performed in this pass

- `npm run typecheck` (root, source-level): PASS
- `npm run build` (full workspace build): PASS
- `npm test` (all vitest projects): PASS except the two KNOWN, pre-existing
  `scripts/test/trusted-publishing.test.mjs` release-set failures
  (frozen 13-package contract vs. the current 15-package set) — verified
  failing identically at the base commit; intentionally untouched.
- `eslint` on all changed paths: clean
- `prettier --check` on changed paths: clean (two pre-existing
  ui-svelte manifest/tsconfig format warnings at base are untouched)
- reference app (`examples/reference-app`, the in-repo compat consumer)
  `vite build` + adapter-node: PASS

## Packed tarballs

`packed/` holds the exact tarballs the 30-check proof installed (same
convention as `qa-artifacts/qa4/packed`).
