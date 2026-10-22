# Cycle 1.1 owner-observed busy repair

Started 2026-10-22, Asia/Kuala_Lumpur, on
`codex/studio-cycle-1-1-busy-repair`, from remote-equal delivery
`ecfa4787728c9132a98c00b24ff0c85934e8dc0a`. Main baseline remains
`d7401bef6e48330796c74ec00c86db9622d48cdf`. Earlier accepted Designer lineage,
saved screens, original Cycle 1.1 failures and independent verdicts are preserved.

The owner saw “The agent could not finish. Check the provider connection and
retry. 0 applied edits remain undoable.” twice on a new WhatsApp screen.
Reading the actual browser Connection record identified `STUDIO_AGENT_BUSY`;
Activity had only “Connecting…”, so those requests never started provider work.
Source inspection shows the guard also retains an admission slot through
asynchronous cleanup: terminal/cancelled work was indistinguishable from active
work. The earlier run's exact lifecycle state was not logged and is no longer
available, so that specific blocking run cannot be reconstructed. Regression
checks directly challenge the reproducible cleanup/admission gap. The builder retried the exact request without resetting the screen or
restarting the provider: real z.ai GLM-5.3-Flash built the WhatsApp-style preview
in three acknowledged batches. This establishes that the displayed provider
explanation was misleading; it does not establish a provider outage.

The bounded repair excludes fenced/cancelled runs from the per-session busy guard,
fences terminal runs before emitting completion, and still counts cleanup runs
against the global four-run capacity. Old mutation tools and acknowledgements
remain refused. No model retries or parallel unfenced same-session turns are
introduced. Chat distinguishes busy/capacity/unconfigured/provider/other failure,
and retains the composer request when no started event accepted it.

Regression checks exercise active same-owner refusal, immediate replacement at
terminal delivery, replacement after cancellation with zero original effects, and
actual Conversation rendering/draft retention on refused admission. This is a
Cycle 1.1 repair, not collaboration polish or a later cycle. Candidate, validation,
independent re-verification and activation results will be appended below.

## Builder candidate checks

- Focused server lifecycle + actual Conversation UI regression: 6/6 PASS.
- Full Studio local Vitest 3.2.7 suite: 135/135 PASS, 23 files, 120.57 seconds.
- Studio check and scoped ESLint: PASS.
- Existing framework source, palette, canonical editing/history/save code and
  temporary provider files are unchanged.
- The real original 8be production retry built the owner's WhatsApp screen in
  three batches; screenshot `cycle-1-1-busy-repair-2026-10-22/owner-whatsapp-retry.jpg`.
  This is recovery evidence, not proof of the repaired product runtime.
- Production build, independent exact-candidate gate and local activation remain
  pending at candidate submission. A live owner polishing turn was detected, so
  restart was deferred to preserve that work. No browser refresh was performed.

Builder logs retain their results/failures, with whitespace-only normalization
recorded in the evidence directory. Original successful product and independent
records remain ancestors of this repair rather than being overwritten.

## Retained candidate cb5 red and bounded completion repair

First repair candidate `cb5a63660498b50daa63cfa6f9dc3ed0c7a05290` was pushed and
remote verified. Independent targeted checks passed 7/8; the existing read/edit
success test repeatedly timed out at 120 seconds. Builder's same single-worker
case passed in 8.36 seconds. This is not relabelled an environment PASS.
Independent event instrumentation observed real read, validated proposal,
EditorBridge receipt, model tool result, text and completed terminal event all
within 946ms, followed by `finished` still pending beyond 120 seconds. A separate
cleanup-phase probe passed in 8.4 seconds, with roughly 7.3 seconds spent in file
removal. It did not directly reproduce a 120 second removal in that instrumented
sample. Source confirms filesystem removal was the only unbounded awaited
cleanup operation. Those precise observations and red logs remain retained.

Bounded follow-up within the same repair: limit best-effort temporary directory
removal to 1 second of host waiting, following existing bounded flush/close.
End NDJSON when the terminal event is enqueued, independently of private cleanup.
The terminal edit/ack fence and global cleanup capacity remain in place. The
browser can finish the accepted request without waiting for file deletion. OS
cleanup may continue in the background; immediate physical removal is not claimed.

Two regressions were added: a deliberately never-settling filesystem removal
through the genuine Mastra host, and terminal NDJSON EOF while mocked host cleanup
remains pending. The latter is a transport-only test, not a live agent claim.
Builder full suite now **137/137 PASS in 25 files**, 56.93 seconds; Studio check and
scoped ESLint PASS. Logs in the evidence directory include the first 135-suite,
focused checks, single-worker comparison and final 137-suite. A new exact commit
must receive independent re-verification; cb5 is not promoted to PASS by this text.
The owner's current 5591 session remains on its working earlier build, with no
refresh/discard during these checks.

## Final verified repair and local activation — 2026-10-23

Product `a811e2d22b60c9d30681c979fcbdf2b4960503a5`; Studio product tree
`b39b60e710589d00cce8a39727a28ecdc55cf732`. Independent **PASS WITH NON-BLOCKING
FINDINGS** on `codex/studio-cycle-1-1-busy-verification-final`, pushed and
remote-equal evidence `7bf55462acb96764bb25a5889dae4639894c2c09`.
[Full independent report](verification-cycle-1-1-busy-repair/FINAL-VERIFICATION.md).
Only documentation/evidence is added after this verified product.

The affected independent 10/10 checks pass. The formerly red happy case completed
in 2.064s; hung removal in 1.971s; held-cleanup terminal EOF in 92ms. Real production
z.ai busy/Stop/retry passed: definite BUSY retained the draft with no effects,
Stop returned 200, the retained retry was admitted 153ms later and committed a
visible heading, then reached terminal EOF. An invalid first model operation was
refused safely before the valid retry. Observed timings are not guarantees.
The earlier cb5 HELD verdict and repeated 120s red remain preserved at
`9f4ac6a5181620590677b18c008dda06a55f41c6` and in the final evidence directory.

Activation reused the verifier's independent exact-source production build;
there was no separate second builder build. [Activation record](cycle-1-1-busy-repair-2026-10-22/activation.json)
checks all 202 artifact SHA-256 hashes after copying into the builder's ignored
build directory. [Runtime resolution](cycle-1-1-busy-repair-2026-10-22/runtime-dependencies.json)
confirms the same physical pinned Mastra/native dependency files. Old hashed
assets were retained for already-open clients. This is local review activation,
not publication or deployment readiness.

The original 5591 server was stopped only with no agent turn active. The secure
launcher restarted it on the same origin using the designated temporary z.ai
files; neither credential/configuration file was copied or modified, and no
provider credential was printed. In-memory
session renewal used a separate same-origin tab, then Reconnect on the owner's
original tab. The temporary tab was closed. The owner had changed from the earlier
unsaved WhatsApp view to a saved Untitled screen before activation; the builder
did not make that navigation and does not claim the earlier unsaved view remained.
[Preservation check](cycle-1-1-busy-repair-2026-10-22/owner-preservation.json): current
canvas DOM, composer draft and chat feed were byte-identical across activation.
No owner-tab reload/navigation occurred. Existing history remains in the mounted
editor. Already loaded AgentChat still uses its earlier classifier until a safe
refresh; backend admission, completion and cleanup fixes are active immediately.

Running review URL: `http://127.0.0.1:5591/design`. For reproduction, use the
[existing secure launch commands](CYCLE-1-1-REPORT.md#live-provider-and-launch)
from this checkout. Save if dirty, then refresh to load the improved client
messages. Busy refusals now retain the request for retry; completed turns no
longer wait for directory deletion. Existing inherited findings (oversized-body
socket reset, precise field selection through Layers, ephemeral chat/local
preview scope) remain retained. Global capacity counts until bounded HOST cleanup
finishes; best-effort physical deletion may continue afterward without edit/ack
authority. No acceptance, whole-Stage 9 closure, main merge or Cycle 1.2 is claimed.
