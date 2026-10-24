# Cycle 1.3 — Context menus and shared Document Inspector

2026-10-24. Owner authorized implementation: “OK pls do those update”, accepting the preceding contextual right-click and shared Inspector proposals. This amends the prior focused inspection placement; previous evidence remains historical within its scope.

## Entry and scope

Clean existing isolated branch `codex/studio-cycle-1-3-completion`, local and remote delivery `0877fe5df7f1d4c6ecd41fce07b5c6130d12f0d2`; prior independently verified product `a36793df0f62c002332d66db181310554aaabb05`. Local and remote main remain `d7401bef6e48330796c74ec00c86db9622d48cdf`. No baseline drift observed.

Allowed paths: `apps/studio/src/lib/designer/`, affected `apps/studio/tests/`, scoped documentation/evidence and current-state handoff pointers. Reuse existing VICT ContextMenu, Inspector, canonical commands and transaction validation; no component ABI, package/runtime, backend, provider or agent-tool changes. Preserve owner preview/source/chat. No main merge, publication, deployment or Stage 9 closure.

## Accepted behavior and gate

- Contextual menus for canvas objects, empty canvas and Structure nodes. Reuse existing commands; select the actual context target first. Preserve native editing menus and Interact page behavior. Provide keyboard invocation and predictable dismissal/focus.
- One shared Inspector below Layers and Structure; deliberately opened, follows selection, resizable/collapsible with remembered in-session geometry. Existing property/style/behavior editors remain the editing authority. Keep graph/layers and canvas visible with useful minimum space; explicit expanded inspection for small windows.
- Draft protection, canonical identity, Undo, runtime and graph/canvas context survive navigation. Showcase all new surfaces using the same components.
- Affected behavioral tests, TypeScript/Svelte checks, production build, actual browser verification on desktop and small windows; commit/push candidate and verify remote SHA, then fresh independent challenge of exact product. Preserve failures and repair/reverify affected scope. Next action after scoped PASS is owner hands-on review; other agent/platform findings remain open/report-only.

Status: implementation authorized; no new gate verdict yet.
