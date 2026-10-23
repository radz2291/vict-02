# Actual browser handoff: Structure

Builder's browser surface is unavailable: fresh cua.getState twice returned
apps[]/browsers[]; createBrowserTab('iab',...) refused “Browser is not available:
iab”; root-created dedicated browser 2/tab 3 also refused “Browser is not
available: 2”. No tab/input action succeeded in this agent. Root must execute
and record the actual browser observations below against its sealed candidate.
This document and the fixture are preparation, not browser evidence.

Use only root's dedicated Structure tab 3, after root launches the exact
candidate at http://127.0.0.3:5596/design. Do not reuse verifier/owner tabs or
existing saved screens. Create a unique fresh screen named **Completion
Structure independent** using the public File menu. In Document → Source, read
the textarea's current JSON. Load browser-fixture.json, replace its placeholder
id and revision with that fresh screen's id/revision, paste through the Source
textarea and Apply source. The fixture has 15 authored nodes and independently
declared text/checkbox state. The generating script runs the actual UI compiler
with default semantic elements and declared demo.submit input types; it passes.
Save this unique fixture once. Keep a copy of the Source textarea JSON and
footer application identity as the baseline.

## Small integrated journey

1. Hide chat and close Document so the graph gets the available width. Enter
   Interact, type **Structure runtime retained** into the textbox **Structure
   name**, blur it, and check **Structure preference**. Open Structure and then
   use **Return to Interact** without changing preview mode. Verify the entered
   value and checked state remain. Re-open Structure. Record the source JSON
   before/after separately: runtime values must not replace nameField's initial
   string or preferenceField's false initial value.
2. Inspect the initial graph. The Customer settings container has six children
   and should initially be collapsed. There are no persistent state/catalog
   hubs in the default containment view. If root/selection is outside the
   initial viewport, record that usability finding rather than silently fixing
   the candidate. Use **Fit visible**, then select **Customer settings** in
   **Structure source selection**, **Expand group**, and **Focus selection**.
   Record the visible item counts and screenshot.
3. Search **name-field**. Verify the named input and its ancestor path are
   visible, select it, then open **Declared properties and bindings**. Exact
   facts include attributes.value.path = state.nameField and
   interactions.0.key = nameField. Related source must show the read and write
   locations separately. Turn on **State / actions** or select state nameField
   in the inspect selector; its neighborhood must reveal the actual field.
   The UI labels this declared source, not observed runtime behavior.
4. Use **Open Data** from nameField: Document should show that exact declaration
   and its authored initial value. Close the drawer; use the inspect selector
   to select **submit**, then its related **Submit (simulated)** action and
   **Open Actions**. Verify the Actions section opens. Select name-field again
   and use **Edit properties / bindings**: Design and its selected editor must
   open for that source. Re-open Structure and use **Reveal in Layers**;
   Layers and the shared selection must agree.
5. Establish a graph presentation state: close Document, clear search, **Show
   screen**, **Expand all**, choose **Top to bottom**, **Arrange**, select
   **move-paragraph**, and focus it. Record graph transform, direction, search,
   inspected option, and every node's DOM position. Switch Structure → Design
   → Structure using the view buttons without source edits. All those values
   must remain, except for any explicitly changed shared selection. Repeat with
   a non-empty search to prove it remains. A real pan/zoom or a presentation-only
   card drag followed by a view round trip is stronger viewport/layout evidence.
6. Clear search/focus and expand the needed groups. Enable **Move containment**.
   Using keyboard focus/native selectors, choose **move-paragraph** under
   Content and **destination** under Valid container; activate **Move inside**.
   Source must now have customer.children without move-paragraph and
   destination.children including it. Undo must restore exactly the original
   source containment, Redo must reapply it. Save/reopen this unique screen if
   needed; do not activate a destructive-looking owner screen or another tab.
   Invalid/self/root/descendant targets must be absent or refused.

## Geometry and responsive checks

Read only DOM-backed geometry; do not inspect hidden component stores or mutate
page state through evaluate. After Arrange has completed, collect every rendered
.svelte-flow__node/.vict-source-node bounding rectangle, its readable aria-label,
and the canvas viewport rectangle/transform. Compute pairwise card overlaps;
expect zero. Report clipped/offscreen cards separately from overlaps. Record
actual measured card widths/heights; synthetic benchmark dimensions are not a
substitute. Check both left-to-right and top-to-bottom handle orientation.

For a few actual edge paths, compare path start/end screen coordinates
(getPointAtLength + getScreenCTM) with the corresponding handle centers obtained
from DOM rectangles. Small differences should be limited to stroke/handle size;
an edge ending at an unrelated side is a failure. ELK routes should be present
for this small fixture. Manually moved nodes may intentionally use the smooth
step fallback until Arrange.

Use the browser's documented viewport API if available to test 390px and 768px,
then restore the original viewport. Otherwise record that browser resizing was
unavailable; changing the canvas-only phone preview does not prove Structure's
mobile layout. Verify no horizontal document overflow, usable wrapped controls,
visible focus, a keyboard path to search/select/details/move, and meaningful
names for nodes/edges. Read-only relationship handles should be aria-hidden;
supported edit handles become named only in Move containment mode.

Finally re-read Source via the public textarea and compare it with the saved
baseline after undoing the one intentional move. Layout/search/orientation/
selection alone must not change source bytes, application identity or authored
history. Record exact candidate SHA, browser tab identity, viewport, assertions,
failures and screenshots in a separate actual-browser evidence file. Do not
upgrade HELD criteria from this preparation alone.
