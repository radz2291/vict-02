# Cycle 1.4 — node connection rows and optional tracing

2026-10-26 owner approved a reversible trial: always-visible one-word connection rows inside nodes, counted shared roles, and temporary edge captions when hovering/selecting a line. Highlight both endpoints and their exact rows; dim unrelated content. Preserve continuous lines and stable zoom geometry.

Clean local/remote baseline `c199197e22a45454c4ebf4d51b228f9640cc07c8`; isolated branch `codex/studio-cycle-1-4-node-connections`. Origin/main remains `d7401bef6e48330796c74ec00c86db9622d48cdf`. This owner amendment extends the previous semantic candidate; it does not accept or close its independent gate. Allowed paths are Studio Structure presentation, focused tests and governance/evidence. Canonical semantic projection, shared package APIs, provider/action execution, storage/history, authored page styling and floating Format are unchanged.

Incoming connections stay left and outgoing connections right even when the graph arranges top to bottom. This keeps rows legible without cramming labels into columns across narrow card tops. Cards may grow vertically to fit their distinct visible roles. Counts mean declared references within the currently visible graph, not all hidden consumers. Hover is transient, click pins the trace; canvas/node click or Escape clears it. Keyboard edge focus also traces. Only one caption is placed at a time, using world paths/cards as obstacles; it neither masks nor cuts a line. Coincident records keep their exact paths but share one counted interactive line. Source selection and trace selection remain separate.

Initial checkpoint: builder checks and visual proof pending; superseded by the final checkpoint below. Earlier decisions and failed observations remain retained. Rollback checkpoint is the baseline on the preserved semantic branch. Owner testing and an independent assessment are next; no Stage 9 closure, main merge, release, publication or deployment follows from this trial.

Initial checks: focused29 passed28/failed1 because the new fixture incorrectly focused nonexistent source `first`; corrected to actual `field`. Initial Svelte check found2 diagnostics for a derived edge ID placed before the props declaration; corrected ordering. Raw failures remain in `focused-tests.log` and `svelte.log`. Recheck `final-tests.log`:29/29 pass; `final-svelte.log`:0 errors/5 inherited warnings. A final display refinement makes only the current trace caption visible when hovering another previously selected line; Escape is scoped to Structure and leaves menu handling intact. Actual production checks will verify these interactions.

## Final builder checkpoint — ready for owner trial

Initial product `c810b4afe39a09e8815baec3410593200cec30ba`; final product `90ba79a8d4a9b78013f4eb34053fc1abcb035ddc`. The following documentation/evidence delivery commit is reported with its full remote-verified SHA in the session handoff. Final production seal records 768 inputs / 491 outputs; `repair-build.log` exits 0. Candidate TypeScript passes; final affected Svelte check (`routing-repair-svelte.log`) has 0 errors / 5 inherited warnings. Focused29 passed after the two initial corrections; after routing repair,8 affected cases pass, including the new backward-route regression. These overlap and do not constitute a fresh full-suite run on the final product. Upstream build circular-dependency/chunk warnings and inherited Svelte accessibility warnings remain in the logs.

NC-V01 (retained, repaired): actual first production view showed the default midpoint return elbow passing through the state card when its ports occupied different rows. [Initial failure screenshot](cycle-1-4/node-connections/initial-feedback-crossing.png) remains. The bounded repair scores six deterministic outside-card corridors against visible node interiors and distance. It uses world geometry only, without moving nodes or changing source semantics. This does not claim general optimal obstacle routing; dense layouts may still have crossings or require focus/collapse. [Expanded clearance observation](cycle-1-4/node-connections/expanded-feedback-clearance.json) checks all4 backward routes in the36-node observed view:0 card conflicts.

Actual final production browser proof on the same signed-in [Studio tab](http://127.0.0.22:5616/design):

- [Horizontal view](cycle-1-4/node-connections/horizontal.png): labels are on their matching, fixed input-left/output-right rows. Default floating captions:0.
- [Clicked/pinned trace](cycle-1-4/node-connections/trace-pinned.png): exactly Value is captioned; the input's `in-value` and state's `out-value` rows highlight, while3 unrelated cards dim. It persists after clicking Fit View (pointer/focus move away). [Escape observation](cycle-1-4/node-connections/trace-cleared.json):0 captions and0 highlighted rows.
- [Keyboard trace](cycle-1-4/node-connections/trace-keyboard.json) selects the same Value relation/endpoints. CUA does not expose an isolated hover action in this session; pointer entry occurs through the successful mouse click, and the hover-only enter/leave flow remains an explicit owner test. No standalone hover-only browser proof is claimed.
- [Zoom proof](cycle-1-4/node-connections/zoom-proof.json): node positions/sizes, socket-row offsets/heights and edge path strings are exactly stable.
- [Expanded view](cycle-1-4/node-connections/expanded.png) has36 visible cards and67 rows, with0 clipped role labels and0 default edge captions; [readability metrics](cycle-1-4/node-connections/expanded-readability.json). The vertical arrangement is also captured. Fitting a large diagram naturally reduces text size; zoom/focus is still required for reading, rather than changing label metrics with zoom.
- Collapsing the expanded parent during cleanup correctly hid its dependent view and showed the inherited hidden-connections message. Inspection-only expansion/filter choices were reset through a normal page reload. The final [ready view](cycle-1-4/node-connections/ready-for-owner.png) has5 nodes /11 rows /0 temporary captions and no persisted source mutation.

Owner test:

1. Hover a line: follow its highlighted endpoint rows; move away to check the trace clears.
2. Click the Value line, move away, then press Escape: pinning and clearing should be clear and predictable.
3. Zoom and compare Value / Fallback into the input with Updates back into state. Open Selection → Relationships for exact reference locations.
4. Switch to Whole hierarchy / Expand all groups to try the denser diagram. Counts represent the currently visible declared references. Use focus and group controls to reduce clutter.

Saved source remains revision3 / digest `v1_fe0ac678e80522e8c9b9a004c95ba6f59c9d3261bd0e4fd54fe1bd47a0a54152`; no source Apply/Save, authored form interaction, provider turn or action invocation was performed. This trial changes Studio presentation only. The node trace and panel-source selection remain separate; exact directed semantic references and declaration paths remain intact.

Rollback: the previous semantic delivery is preserved on `codex/studio-cycle-1-4-structure-semantics` at baseline `c199197e22a45454c4ebf4d51b228f9640cc07c8`. If rejected, revert trial product commits newest first (`90ba79a`, `c810b4a`) in a follow-up, retain all evidence, rebuild/seal and restart only the owned preview. Do not reset another track or owner source.

Builder checks pass at these limits; next allowed action is owner hands-on trial and independent assessment of this exact candidate. Independent verdict, owner acceptance, overall Cycle1.4 acceptance and Stage9 closure remain pending. No main merge, package publication, release or deployment is claimed.
