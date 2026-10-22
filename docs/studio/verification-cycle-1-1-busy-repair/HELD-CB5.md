# Busy repair candidate cb5 — HELD FOR BOUNDED REPAIR

Product assessed: `cb5a63660498b50daa63cfa6f9dc3ed0c7a05290`, independently
remote-compared before checkout. Delivery base:
`ecfa4787728c9132a98c00b24ff0c85934e8dc0a`; `origin/main` remained
`d7401bef6e48330796c74ec00c86db9622d48cdf`.

The verifier used its separate checkout on
`codex/studio-cycle-1-1-busy-verification`. Product source was unchanged. The
same previously disclosed dependency junctions and narrowly allowed two-root Vite
test configuration were reused. Only audit documents/test drivers were authored.

## Results and reason for hold

The intended admission repair is sound on review. Terminal delivery fences the old
run before notifying its consumer; aborted/fenced work releases the per-session
slot while continuing to count against global four-run capacity. Late old
acknowledgements remain refused. UI distinguishes admission refusal and preserves
requests that never receive a started event.

Independent targeted results were **7 passed / 1 timed out**. Passing cases include
actual Conversation busy/capacity rendering and draft retention, cancelled/terminal
replacement, provider rejection after an acknowledged edit, and independently
authored global cleanup-capacity and late-success-acknowledgement challenges.
See [targeted log](focused-independent.log) and [independent lifecycle tests](lifecycle.test.ts).

The unchanged governed read/edit success case timed out at 120 seconds. A
sequential rerun of only that unmodified case timed out again at 120 seconds;
[recheck log](happy-path-recheck.log). A test-module event trace showed committed
EditorBridge success, acknowledged tool result, visible text and `done: completed`
within **946 ms**, but `opened.finished` remained pending until the test deadline.
That [trace](happy-path-trace.log) locates the wait **after terminal delivery**, not
in provider inference, canonical validation, acknowledgement or framework outcome.

A subsequent in-memory cleanup-phase diagnostic **passed in 8.4 seconds**:
terminal at 830 ms, unsubscribe effectively immediate, flush 279 ms, close
effectively immediate, then approximately **7.3 seconds in directory removal**.
[Phase trace](cleanup-phase-trace.log). This successful sample did not directly
capture a 120-second `rm` stall. Source inspection identifies directory removal as
the only unbounded awaited cleanup operation; flush/close already use time bounds.
The route also waits for `finished` before closing its NDJSON stream, coupling
interactive completion to this private cleanup tail.

The builder's committed full suite passed 135/135, and its later single-case
comparison passed in 8.36 seconds. Those passing samples do not erase the
independent repeated red observations. No unsupported environment attribution or
longer test deadline is used to declare a pass. A bounded cleanup/terminal-stream
repair is required before this verification gate is awarded.

## Production and retained harness observations

The own exact-candidate production build passed. A
[202-file SHA-256 manifest](cb5-artifact-manifest.json) found no absolute or
checkout-escaping runtime imports. This cb5 artifact was prepared for review,
**not approved for activation**, and will be superseded by a newly built repaired
candidate. No builder activation or owner browser reload was performed by this
verifier.

Two initial browser-driver attempts stopped during login/navigation collection,
before any agent request. The native login action separately issued a session
cookie successfully; no product authentication defect is established by those
driver failures. Logs/screenshots remain. The driver now uses that same-origin
login action directly before navigating to Designer. Production/live follow-up is
paused pending the new candidate; it is not claimed as passed here. The verifier's
temporary 5592 server was stopped. Owner origin 5591, its active turn and unsaved
document were untouched.

The owner's earlier exact blocking lifecycle was not logged and cannot be
reconstructed. Its observed `STUDIO_AGENT_BUSY` classification is definite;
this cleanup/admission evidence does not prove which earlier run blocked that
specific request. Earlier Cycle 1.1 FAIL/PASS records remain unchanged.

Next action: builder's bounded cleanup and terminal-EOF repair, exact pushed
candidate, independent affected-claims recheck and real-provider follow-up.
No owner acceptance, Stage 9 closure or Cycle 1.2 claim is made.
