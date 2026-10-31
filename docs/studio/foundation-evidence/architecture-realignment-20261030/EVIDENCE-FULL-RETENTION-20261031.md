# Full sanitized evidence and transcript retention — owner policy change, 2026-10-31

The owner explicitly removed the artificial tool evidence budget and similar
application-imposed limits. Earlier quota/expiry observations remain historical
receipts; this candidate deliberately changes that policy. It does not claim an
earlier failed observation passed or rewrite a saved authored application.

## Evidence integration

Studio now retains complete sanitized tool input/result exchanges in a private
per-process temporary directory, not an unbounded in-memory payload map. New
`vict.studio-tool-archive@2` references have `expiresAt:null`. There is no per-run
160 KB evidence allowance, 256 KB original truncation, 4 MB archive allowance,
32 MB global allowance, 512-entry eviction or 30-minute policy expiry. Metadata
and full text are on disk; a read loads only the requested character page.

The existing 6,000-character page is a navigable display window, not a total
evidence limit. Offsets accept safe nonnegative integers without the former
nine-digit ceiling. UTF-16 storage preserves the established code-unit offset
semantics and reconstructs Unicode exactly even across surrogate-pair boundaries.
Archive owner identities are salted hashes; session authorization remains at the
HTTP route. Archive IDs do not authorize another session's access. Retrieval never
invokes a tool. Storage errors return explicit failures rather than a quota story.

The data-only sanitizer uses iterative traversal and serialization. It has no
depth, visited-node, string, array-item or object-property policy cutoff. It does
not invoke getters, proxy traps or custom `toJSON`. Ancestor cycles, unavailable
accessors/functions/proxies and other non-data values are visibly represented;
those are nonexecution protections, not policy-budget truncation. Repeated shared
objects that are not ancestor cycles retain both values. Secret-key and known
secret-value/Bearer redaction remain in place.

Compact inline previews remain windows only when a full archive is retained.
Without archive negotiation the evidence event carries the complete sanitized
text. The producer awaits retention and delivery, reserves phase identity before
awaiting, and keeps run/phase/monotonic/closed-run fences. It never emits a new
budget-unavailable result. Actual retention failure is `storage-error`; malformed
or unreturned invocations keep their existing truthful unavailable reasons.
Historical budget events remain readable as historical policy. Historical @1
references still require numeric expiry and retain their old expiry semantics;
@2 requires null. No saved-app migration or capability authority is added.

The public tool-payload presentation now accepts a host-confirmed
`completeOriginalAvailable` flag. Its shared renderer labels a compact preview
“Preview only; complete sanitized exchange retained.” Studio supplies that flag
only after receiving an exact matching @2/non-partial reference for the same
run/tool/call/phase. The complete pages are discoverable in Chat details →
Sanitized exchanges. Historical @1 or partial originals keep their explicit
truncation/partial labels; they are never relabeled as complete.

## Shared presentation and Studio retention

The public ui-ai transcript helper retains all events by default. An explicit
consumer-selected finite window remains opt-in; Studio uses the shared default
without its former Infinity override. Both the actual ui-ai PromptInput and the
native ui-svelte Conversation textarea lose their 6,000-character maxlength.

The authored public transcript/attachment parser also loses its arbitrary JSON,
message/event/activity/stage/attachment count, text/name and ID-length quotas.
It still requires version 1, arrays/objects/string fields, nonempty unique IDs,
the existing role/state/event enums and closed public-only fields. Private
reasoning or execution instructions remain rejected; retaining more supplied
presentation data grants no provider/action authority. Existing valid documents
remain valid without migration. The two changed inspection descriptions refresh
their compatibility digests; component IDs/revisions, shapes and renderer
capability digests remain unchanged. The before/after digest receipt is retained.

Studio removes its prompt check, twelve-message/6,000-character history projection,
100-progress retention, 256-reference retention, 64-page cache eviction and
24-turn/30-minute turn expiry. All admitted messages and terminal turn snapshots
remain inspectable in the tab, including failures and cancellation. Full source
guards, cancellation, authentication and tool identity checks remain. Request,
stream/frame transport removals and awaited server archive integration are owned
by the parallel server/transport candidate, not a new UI policy engine.

Tab reload and server restart remain actual lifecycle boundaries. Filesystem or
physical resource failure is reported rather than being misrepresented as an
application evidence budget. The disk archive is not a new durable application
data service or persistence migration.

## Validation and retained failures

- Backend/archive focused suite: 20/20 passed across four files. This includes
  full >4 MB evidence, 530 exchanges exceeding the old 32 MB/global and 512-entry
  limits, 16,000-level nesting, 5,000-item arrays/properties, Unicode, secret
  redaction, getters/proxies/cycles/custom-toJSON nonexecution, paging/session
  negatives, awaited delivery and actual storage failures.
- UI suite: 15/15 passed across two files. A live mounted component test retains
  27 turns past two hours, a full >6,000-character first prompt in later history,
  110 progress events, 270 archive references and 66 loaded pages. Existing
  cancellation, wrong-run/late-frame and draft-retention checks pass. The shared
  default retains 501 events/full exchange while explicit compaction still works.
  A separate test checks that only a matching complete @2 archive changes the
  preview label, while legacy evidence remains partial.
- Authored chat package suite: 11/11 passed, including exact-content acceptance
  beyond 120 messages, 240 events, 80 activities/stages, 40 attachments, 24,000
  characters per text and 262,144 characters per JSON envelope. Invalid roles,
  states, flags, types, private fields, duplicate IDs and unsupported versions
  still refuse. The descriptor/capability digest compatibility test passes.
- Scoped ESLint: zero errors; the repository config ignores the three supplied
  Svelte files, so this is not a claim of Svelte lint coverage. UI tests compile
  their component imports; package build validation is coordinated by the parent.
- Studio TypeScript initially caught two page-loop inference annotations here;
  those were fixed. The later run reports only two out-of-scope readonly fixture
  assignments in `independent-nested-route-guidance.test.ts` at lines 101/111.
  The parent owns their correction and final integrated typecheck. That last
  measured tsc receipt is retained; no final integrated tsc pass is asserted here.

The initial UI run passed 13 and failed one: the new test found the actual ui-ai
PromptInput still imposed native maxlength after the older ui-svelte component was
fixed. The real active PromptInput cap was removed and the next UI run passed all
14; the subsequent complete-original labeling run passed all 15. Those receipts
and the earlier TypeScript reports remain alongside this file.
No browser/provider acceptance, running service activation, push or owner-device
result is claimed. The shared continuity test contains parent-owned task-context
changes and is intentionally excluded from this slice's commit; the parent will
commit that combined test separately.
