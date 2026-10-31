# Independent completed originals audit — turns29 and30

**Archive integrity PASS; actual transaction counts/effects reconciled.** This is
not a native/whole-phase/owner verdict. Fresh isolated review branch
`review/actual-turns-29-30-archives-20261031` starts at evidence snapshot
`62bdd1a85b9770b4c45a337fd10fc8c6005881d0`. Completed29/30 archives were then
snapshotted read-only from the integrator checkout; active32 archives were not
read in this audit. No browser/tool replay, application/source operation or root
write occurred.

`audit-archives.mjs` verifies every inventory item, ID/index/label, exact raw text
hash/character count, JSON parse, complete capture marker, contiguous page offsets,
per-page text length, reconstructed text equality and matching page metadata.
Lossless compressed bundles retain all original files, including capture text and
metadata. A second read verifies the source files did not change during capture.
Run the script without arguments to reproduce from retained bundles; passing an
explicit source checkout creates fresh snapshots of completed29/30 only.

| Turn | Complete originals | Characters | Pages | Successful edit acknowledgements | Refused results | Unsettled edit input |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
|29|53|151709|65|0|3 readonly preflights|1|
|30|106|839208|215|7|6 (5preflights,1edit)|0|

The30 observation is508067characters and fully reconstructed. No unavailable
placeholder or missing transport segment is substituted for a listed original.
Completeness of these inventories does not grant semantic truth to model
interpretation or certify an unrecorded action.

##29 — interrupted stale document, no confirmed migration

26 Read inputs/results include three side-effect-free preflight refusals, all
`STUDIO_AGENT_GRAPH_INVALID`, with "Graph changed; read the current revision"
diagnostics. They retain applied:false. The final original is one Edit input
requesting explicit factory preparation and nested+outer migration against
r1.r13#7. It has no Edit result or acknowledgement in this inventory.

The separately retained `29-turn-details.txt.gz` shows the proposal waiting for
browser commit and then **UI_DOC_STALE_REVISION**, explicitly reporting no edit
applied and requiring a fresh request. Therefore no29 migration success is
claimed. The absent original result is not fabricated; the browser-reported
refusal and no-confirmed-edit count are stated separately. Earlier unexplained
35→37 source changes and the owner's later42/5/8 baseline are not attributed to
the agent or overwritten by old route values.

Last retained preflight metrics precede the unsettled Edit input:26calls,
23completed/3refused,0confirmed edits,14provider requests,970126ms elapsed.
These are not a fabricated final total including that pending input.

##30 — eight edit attempts, seven acknowledgements

44 Read input/results,8 Edit input/results and1 Observe input/result account
for106 originals and53 actual tool calls. The eight edit requests are serialized
and paired with their own results. Seven succeed, moving source cursor
r1.r14#13→#14 through #20. The receipt's applied field is a **cumulative confirmed
transaction counter1→7**, not command count and not a separate eighth success.

| Successful transaction | Input/result archive indices | Confirmed effects |
| --- | --- | --- |
|1|18/19|Public defineNodeType replacement prepares the explicit neutral graph3 Finishing factory, then migrateGraph includes both controlled fin-ws occurrences and ws-main using working containing revision43. Current data is preserved. |
|2|60/61|Sets Social nested canvas defaults through finS's routed occurrence. |
|3|70/71|Fresh corrected route sets Poster nested canvas defaults, preserving Social. |
|4|74/75|Sets outer canvas defaults and only e18 appearance override. |
|5|86/87|Adds outer canvas edge-settings and six native fields/reset through public composition. |
|6|92/93|Adds outer selected-edge settings, readonly/disabled bindings, inheritance status and reset. |
|7|98/99|Adds both nested shared-body panels and their controls/reset, reused independently for Social/Poster. |

The earlier independent r1.r15 data audit separately proves exact current
42/5/8→48/6/9 configuration preservation except schemas/revisions, intended
defaults/e18 override and explicit factory. Full original requests now establish
that those effects were authored through supported public operations, rather than
substituted by a coding-agent replacement app. This archive audit does not repair
or close C1's canvas-readOnly composition finding.

Six retained refusals are not hidden by eventual successful source output:

| Result index | Kind/code | Observation and recovery |
| --- | --- | --- |
|52|Read preflight / GRAPH_INVALID|Stale containing graph revision; no edit applied. |
|63|Edit / GRAPH_INVALID|Poster request retains stale ancestor revision after Social write; no new source cursor. Fresh reads precede the corrected successful request70/71. |
|77|Read preflight / INVALID_EDIT|Insert operations omit required kind; exact shape diagnostics precede corrected construction. |
|79|Read preflight / PROPERTY|Native field change is not a component output; diagnostic directs wireInput. Successful construction uses native field wiring. |
|89|Read preflight / INVALID_EDIT|bind uses name instead of required prop; corrected supported binding follows. |
|95|Read preflight / VALIDATION|Native div attributes.class is undeclared; canonical source validation refuses it before corrected nested construction. |

No schema coercion or source-policy weakening is inferred from recovery. The
archive records refusal and subsequent success; it does not by itself certify
every intermediate document state or native field action.

Last complete receipt metrics:53calls,47completed/6refused,7confirmed edits,
33provider requests,1vision request,first edit543902ms,elapsed2010206ms.
Usage is cumulative3510309input/94257output tokens; no cost is supplied.
Tool-active262008ms and outside-tool1748198ms are host accounting, not measured
provider latency. These observations preserve substantive authoring-efficiency
limits; success is not universal model reliability or a performance certificate.

The complete observation succeeds at its declared capture boundary but explicitly
has semanticClaimsVerified:false and interactionVerified:false. Image612×528 is
cropped from source612×1445 at offsetTop278; viewport628×528 has scrollTop277.6.
Image/model claims do not establish full-page, overlap, pointer, native controls
or persistence. Later native findings remain separate.

## Count corrections and next step

The agent's "eight acknowledged" summary is inaccurate: **eight attempts,
seven acknowledgements**. This supersedes the parent/agent-reported8 in the
earlier qualified checkpoint. This verifier also corrects its earlier wording:
port28 applied values are cumulative1→4 (the four-ack count remains correct), and
the r1.r15 tail's applied7 was wrongly called commands. The original receipts,
tail, prior report commits and failed observations remain preserved; no data/
factory conclusion changes because of this narration correction.

Continue with the separately supplied final32 source/receipt repair audit, then
root's native interaction/history/portable gates. No32 archive was accessed by
this script or included in these counts. No runtime activation, push/publication,
owner acceptance, milestone or Stage9 closure follows.
