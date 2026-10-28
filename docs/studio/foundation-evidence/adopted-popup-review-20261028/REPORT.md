# Adopted popup source repair

Role: builder candidate, not an independent or native-browser gate verdict.
Starting committed baseline: `59212b031d49163f7e1ebc40088f6a8ab2ae1b1e`. Concurrent viewport/Studio/media work was preserved. Only `packages/ui-svelte/src/owned-popup.ts` and its new `test/owned-popup-adopted.test.ts` were changed by this builder.

## Reproduction

The actual authored owner-matrix dropdown remained closed in the root agent's iframe observation. Inspection found destination-realm `instanceof` checks in both visibility/source admission, event-target routing and referenced popup lookup. Native DOM adoption changes `ownerDocument` while retaining the creation prototype, so those tests can reject real parent-created HTML mounted into a child document.

Offline reproduction uses actual parent-created DOM nodes adopted into an iframe document. Happy DOM shares constructors between windows, unlike the browser distinction involved in this failure; the fixture explicitly supplies distinct destination constructors after adoption to model that invariant. This limitation is documented in the test. It is not presented as independent browser evidence.

The first test command failed before collection with a temporary-cache rename EPERM (`red.log`). With a writable temporary cache, all five new cases failed against the untouched source (`red-writable-cache.log`): valid adopted HTML was rejected, visibility/eligibility fences could not admit it, event routing stayed unavailable and exact referenced popup lookup returned no branch. A non-element probe also exposed an incidental null-ownerDocument throw; the new guard returns false for it.

## Bounded shared repair

`owned-popup.ts` now borrows the destination document's DOM `Element.prototype.matches` method to perform the cross-realm Element brand check. Actual HTML surfaces additionally require the XHTML namespace, excluding SVG and non-elements. Generic event targets remain Elements so clicks on SVG icons inside an owned HTML trigger can reach the same owner hub.

This removes the creation/destination prototype assumption at the four affected code locations. The existing shared owner adapter, source lifetime observers, same-document containment, canonical/nested owner fences, disabled/hidden/inert/disclosure checks, registered branch pairing and public Floating UI positioning remain. `owned-menu.ts` was not changed; no per-app workaround or dependency internals were introduced.

## Scoped validation

- Four targeted files pass **30/30**: adoption, shared popup core, owned menu and owned tooltip (`green-targeted.log`).
- The adoption file with an additional SVG-icon event assertion passes **5/5** (`green-adopted-icon.log`). This overlaps the 30-case set and is not an additive total.
- Targeted TypeScript checking of the source and new test passes exit 0 (`types-targeted.log`). Two earlier CLI configuration failures are retained: unquoted PowerShell comma arguments (`types.log`) and the current compiler requiring `--ignoreConfig` for explicit files (`types-recheck.log`). Neither was a source type failure.
- `git diff --check` passes for the assigned source/test paths. Exact working-source/test SHA-256 hashes and result limits are in `builder-result.json`.

No native browser, provider, server, build or dist operation occurred in this subtask. The stage manager must seal the combined candidate, obtain independent challenge and re-observe the real authored dropdown/focus/keyboard behavior after the supported build/relaunch path. Existing failure evidence and owner acceptance remain separate.
