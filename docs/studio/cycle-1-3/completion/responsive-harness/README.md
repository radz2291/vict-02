# Bounded responsive component harness

The parent and child are same-origin at `http://127.0.0.5:5599/`. The browser
sandbox did not expose frame.contentDocument, so the child reports rendered DOM
measurements using ResizeObserver, MutationObserver and animation frames. It
posts metrics to the parent, which verifies both origin and event source and
shows JSON in a visible measurement panel. No hidden Flow stores are read. The
390/768 buttons change the iframe viewport, triggering real component CSS media
queries and Flow ResizeObservers. The child imports the actual unchanged Studio
StructureView plus production Flow stylesheet; it does not copy the UI.

This is a synthetic **component width simulation**, not mobile-device emulation
or proof of the complete Studio application at narrow widths. Local selection
works for presentation. Move callbacks refuse and editor handoff callbacks only
display their request; actual authoring/navigation evidence belongs to Studio.

Launch from the repository root, after confirming port 5599 is free:

```
node node_modules/vite/bin/vite.js --config docs/studio/cycle-1-3/completion/responsive-harness/vite.config.mjs
```

Root should open the parent in its own background review tab, observe the
rendered child, then read the visible measurement panel to report iframe innerWidth,
document scrollWidth/clientWidth, component/tool/control rectangles, overflow,
wrapping and graph-card overlaps at both widths. Browser screenshots verify the
appearance. If child focus/input targeting is unavailable in the CUA surface,
record that limit; do not present DOM reads as a narrow keyboard journey.

No production source, server, dependency or saved document is changed. The
fixture reuses completion/structure/browser-fixture.json with an isolated ID.

## Retained fixture failures and diagnostics

An initial actual browser run reported no horizontal overflow at 390/768, but
Structure's layout status was unavailable. That initial result is not proof of
successful ELK layout. Visible diagnostics then reproduced the exact error:
`TypeError: Constructor is not a constructor` at the dynamic ELK import. The
generic Vite dev harness had disabled automatic dependency discovery and failed
to prebundle ELK's UMD/CommonJS distribution. Studio's production Rollup build
does convert it and had separate successful desktop layout evidence.

The harness config now explicitly prebundles both layout engines. This is a
test setup repair; no production layout adapter was changed. Actual browser
reverification must show the routed-ELK status and geometry before accepting
the corrected fixture result.

Earlier console output also contained a MutationObserver invalid-target error
without a stack. The fixture's UI document variable was renamed, mount is
deferred until DOM readiness, and observer targets are guarded as native nodes.
Those defensive repairs do not prove the original error's cause. Before any
Svelte imports, test-only diagnostics now wrap native MutationObserver.observe:
native validation still runs and failures are rethrown, while target facts and
the exact call stack appear in the parent's separate visible diagnostics panel.
Runtime errors preserve the component DOM rather than replacing it. A separate
test-only layout invocation can expose the exact error using actual DOM-measured
node geometry; it never replaces the component's layout result.

The verifier retains the initial diagnostics and corrected browser observations
under completion-independent; read their exact result rather than inferring
success from transformed HTTP responses.

The subsequent independent actual-browser result passed at both 390 and 768 px:
six visible items, routed ELK status, zero card overlaps, document client width
equal to scroll width, no horizontal overflow, all measured controls inside the
width, and no reported diagnostics. A real 390px keyboard journey searched
name-field (six visible items became three), tabbed to Fit visible, activated it
with Return, retained focus and changed the actual viewport transform. Clearing
the query and switching to 768px returned six items. The verifier retained the
fixed metrics/screens, Fit metrics and narrow keyboard trace separately from
the initial failures. These are actual component fixture observations; they do
not establish the entire Studio application at a narrow viewport or emulate a
native mobile device.
