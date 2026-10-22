# Independent busy-repair verification: PASS WITH NON-BLOCKING FINDINGS

Exact product assessed: `a811e2d22b60c9d30681c979fcbdf2b4960503a5`, pushed on
`codex/studio-cycle-1-1-busy-repair` and independently compared with the remote.
Delivery base: `ecfa4787728c9132a98c00b24ff0c85934e8dc0a`. `origin/main`
remained `d7401bef6e48330796c74ec00c86db9622d48cdf`.

The verifier used a separate source checkout on
`codex/studio-cycle-1-1-busy-verification-final`; no product repair was authored.
Dependency junctions reuse the builder's pinned installed dependencies and existing
framework outputs. This is source/build isolation, not an independent dependency
installation. Test-only Vite configuration permits exactly the verifier and shared
dependency roots. Existing framework Svelte warnings remain in the logs.

## Affected claims and evidence

| Claim | Independent result |
| --- | --- |
| Active same-owner turn remains busy; aborted/terminal turn releases owner admission | PASS: real host replacement tests and real two-tab production journey |
| Old cleanup remains included in global capacity four | PASS: own synchronous terminal-callback challenge filled remaining three slots; replacement refused for capacity until cleanup finished |
| Late success acknowledgement cannot mutate a cancelled run | PASS: own cancelled/replacement challenge, refused late ack, zero old effects, one cancelled terminal |
| Busy/capacity feedback retains a request never accepted | PASS: both UI regression cases; real BUSY refusal retained draft and unchanged document |
| Private directory cleanup cannot indefinitely hold host completion | PASS: new real pinned-Mastra hung-removal regression; previously red unchanged happy case now passed in 2.064 seconds |
| Terminal NDJSON EOF is independent of private cleanup completion | PASS: held-finished transport regression; production successful stream completed |
| Production bootstrap and real provider follow-up | PASS: own production build/server at 5592, real z.ai Stop and retained retry, one visible committed heading |
| Selected credential and server-only dependency isolation | PASS: actual selected-key scan of client and audit text, zero matches; server-only marker scan clean |

[Targeted log](a811-targeted.log): **10/10 tests, five files, 76.01 seconds**,
sequential worker policy. This covers four real-Mastra lifecycle cases, two UI
cases, the new hung-removal and terminal-EOF cases, and the verifier's two
[capacity/late-ack challenges](lifecycle.test.ts). The terminal-EOF test mocks the
host's held cleanup promise; the hung-removal test uses the real pinned Mastra
host. Neither is presented as a live-provider failure test. The builder separately
reported its committed full suite **137/137, 25 files, 56.93 seconds**, plus
check/lint. The independent affected-claims suite is the gate recheck; a second
full-suite run was not required for this bounded repair.

[Production build](a811-production-build.log) passed using the exact product
source. [Manifest](artifact-manifest.json) records **202 SHA-256 file entries**,
producing commit `a811e2d22b60c9d30681c979fcbdf2b4960503a5`, and no absolute or
checkout-escaping JavaScript runtime imports. Artifact directory:
`C:/Users/RZ1/.codex/worktrees/studio-cycle-1-1-verification/260831-VCT-02/apps/studio/build`.
Reuse requires the same pinned runtime dependency layout and manifest comparison;
this is not a general deployment portability claim.

## Actual production journey

[Browser records](browser.json), [driver log](a811-browser.log),
[retained draft screenshot](busy-draft-retained.png), and
[visible retry screenshot](live-retry-success.png) record two real Designer tabs
sharing a legitimate session on the verifier's separate origin `127.0.0.1:5592`.
The secure launcher used the owner-designated `zai/glm-5.3-flash` configuration;
external credential files were neither copied nor printed.

While the first turn was active, the second request received
`STUDIO_AGENT_BUSY`, no started event, no proposal and zero document effects.
The message accurately explained that another turn was running; the composer
retained the request. Stop on the first tab returned HTTP 200. Re-clicking the
retained request, without retyping, admitted a replacement **153 ms** later.
The first stream ended with the expected browser AbortError and no old proposal
was observed.

The actual provider's initial tool attempt failed canonical validation safely.
It re-read the unchanged document, then submitted a valid edit: one heading
visibly reading **Busy repair verified**. The completed turn
`turn-aaa7b456-6b92-4c8c-b8c4-5d50eb2ea543` used profile
`v1_9a8331caffc726ac5c9c051a5e77d1a2a05217a8582a1c76b7538514d5db960d`.
The stream completed, the composer cleared only after admission, and no browser
page errors were recorded. The invalid attempt is retained as a refused operation,
not hidden as a clean first-attempt provider result. These timings are samples,
not a latency guarantee.

## Preserved failures and limits

The prior candidate `cb5a63660498b50daa63cfa6f9dc3ed0c7a05290` remains
**HELD**, with [its report](HELD-CB5.md), two independent 120-second timeouts,
and traces intact. A failing trace reached completed terminal delivery at 946 ms
but never resolved `finished` before the deadline. A separate successful cleanup
trace took 8.4 seconds, including approximately 7.3 seconds in directory removal;
it did not directly capture the 120-second removal stall. The bounded removal and
terminal-EOF repair addresses the demonstrated completion coupling. The new
regressions and passing unchanged case resolve this gate's blocking finding.
The old [cb5 artifact manifest](cb5-artifact-manifest.json) is historical and was
not approved for activation.

Browser collector failures before agent work remain as attempt logs/screenshots.
The final driver brings background tabs to the foreground and uses timer polling;
those failed collection attempts do not establish a product authentication fault.
No failed observation was discarded or attributed to load without evidence.

The owner's earlier exact blocking lifecycle was not logged. Its observed BUSY
classification is definite; these findings do not prove which run caused that
specific incident. Cleanup capacity remains occupied until bounded host cleanup
settles. Best-effort filesystem removal may continue after its wait deadline,
without regaining document or acknowledgement authority.

Earlier Cycle 1.1 records remain authoritative for their exact candidates:
original independent FAIL evidence `31a3a357c95ea9243be58341a44230b56a1e0d88`,
repaired independent PASS evidence `6610c4db571868b299747d3da4995f5f180e2e38`,
and busy-repair HELD evidence `9f4ac6a5181620590677b18c008dda06a55f41c6`.
Inherited non-blocking findings, including oversized POST socket reset instead of
a structured refusal and direct canvas input selection requiring Layers for an
exact field, were not broadened into this repair or claimed re-tested here.

## Next allowed action

This affected-claims gate passes for exact product `a811e2d22b60c9d30681c979fcbdf2b4960503a5`.
The parent may activate the manifest-checked artifact locally when the owner turn
is idle, preserving old hashed assets and the unsaved owner document. Renewing
the in-memory operator session in a separate same-origin tab and reconnecting
the agent avoids a document reload. An already-open owner tab still has its old
loaded chat classifier until a safe reload; activation alone must not be described
as loading the repaired client into that tab. The verifier did not access/reload
owner origin 5591. Owner acceptance remains separate; this report awards neither
whole Stage 9 verification nor permission to begin Cycle 1.2.
