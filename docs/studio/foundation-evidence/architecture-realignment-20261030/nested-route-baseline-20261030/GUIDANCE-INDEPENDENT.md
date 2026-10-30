# Nested route guidance — independent scoped review

**QUALIFIED OFFLINE PASS** for final exact source
`8d8be402893a8942b985ad920b32b31807e2ad47`. This verifies passive metadata,
knowledge delivery, strict schemas and existing source-route compatibility; it
does not demonstrate that the actual agent can now complete the partial nested
application. Actual retry, affected build/artifact evidence, device/integrated
exit and owner acceptance remain separate.

## Identity and preserved finding

Started clean and created `review/nested-route-guidance-20261030` from initial
candidate `ca1b6489dbc9822d2adf49b559a719a431148267`. Review identified an ambiguity
in the actual passive edit schema: "controlled graph@1 nesting refuse" could
incorrectly imply that graph1 targets cannot be nested. The unchanged source
resolver requires a graph2 **containing workspace**, independently of the target
format. Package workspace@2 knowledge already expressed that distinction.

The parent supplied final `8d8be402893a8942b985ad920b32b31807e2ad47`, changing only
that tail to "Private runtime instances and graph@1 containing workspaces refuse."
Created separate `review/nested-route-guidance-final-20261030` directly from 8d8;
the initial and all earlier review branches remain preserved. No product repair
was made by this verifier. An initial check was still compiling during that
transition; its passing output is retained as `independent-guidance-transition.log`
but is not used as exact-candidate final evidence. The final check was launched
after the switch and completed against unchanged 8d8 product files.

The actual stopped agent trial and partial saved r1.r2 source remain partial.
Correctly routed fixture acceptance diagnoses no existing source-ownership defect;
it does not reconstruct unavailable final actual-agent payloads or establish why
each actual refusal occurred. The earlier oversized 33,204-byte passive-schema
failure remains retained separately in the builder evidence; the misleading
`focused-tests-final.log` filename is historical red evidence, while
`focused-tests-green.log` is the later builder success.

## Accuracy, authority and compatibility

Only passive schema descriptions/examples and package-owned composition guidance
change from ab329. Target workspace source ID and target revision are distinct
from each containing workspace source ID, its graph-model member ID and containing
revision. Routes exclude the target workspace, run outermost first and must fence
every ancestor. The generic examples use different target/parent revision numbers,
require per-instance definitions before adding nodes, and instruct rereading
source/document revisions after accepted edits. They distinguish private runtime
state, shared uncontrolled source defaults and controlled occurrence parameters.
No app-specific identifiers or owner source are embedded in the guidance.

Authoritative parser and source resolver are byte-identical to ab329:

- `agent-edits.ts` git blob `692b976635a36436a8b2d855e1b4e751ef9118c6`.
- `graph-authoring.ts` git blob `a24d5dbc6fb33b1246a1dec185a36b47dd734fca`.

No field grammar, runtime operation, state/history authority, saved schema,
capability/input shape or ABI changes. An input revision bump is unnecessary for
these nonvalidating descriptions/examples. Package registration guidance enters
the existing content digest in `packages/ui/src/authoring.ts`; knowledge body
identities derive from that digest and projection. The unchanged paging protocol
therefore fences fresh content without reinterpreting old contract bodies.

## Independent challenge

Added `apps/studio/tests/independent-nested-route-guidance.test.ts`:

- Reads the actual supported scalar knowledge path for workspace@2, reassembles
  every page with one stable body identity and extracts the delivered generic
  example. Validates it through authoritative agent Zod, Ajv against the actual
  server-exported edit metadata and public graph2 parsing/application.
- Challenges extra route properties, string-valued revisions and empty routes;
  both authoritative and presented schemas refuse them. Captures the actual
  metadata through the frozen presentation validator and checks the 32KiB bound.
- Uses a disposable source-resolver compatibility fixture with graph1 target in
  graph2 containing ownership. A routed cycle-policy edit succeeds and leaves
  input source untouched. This isolates target-versus-containing format semantics;
  it is not a rendered/imported graph1 nested application demonstration.

## Final checks

From `apps/studio`, exact 8d8:

```powershell
npx vitest run tests/independent-nested-route-guidance.test.ts tests/nested-route-guidance-schema.test.ts tests/actual-nested-route-baseline.test.ts tests/agent-edit-slot-scope-presentation.test.ts tests/agent-knowledge-read.test.ts
```

**16/16 PASS**, five files, exit 0. Actual passive metadata is **32,667 UTF-8 bytes**, 101 bytes below the 32,768-byte bound; frozen capture succeeds. Workspace@2 guidance is delivered in two bounded pages with a stable content-derived identity. Raw final evidence:
`independent-guidance-final-8d8.log`. The selected existing cases additionally
exercise actual partial-source p1/p2 routed edits, stale/wrong owners, import
admission, scoped wrapper strictness, exact knowledge revision selection,
continuation/digest invalidation and bounded delivery.

Earlier source/runtime regression evidence (19 Flow, 21 Studio and 44/15/8
popup/media/capture) is reused at its existing scope because these runtime files
are unchanged. No broad renderer rebuild or duplicate runtime run was performed.
Existing warnings remain in raw logs. No browser/provider/device operation,
owner application write, serving activation, push, merge or publication occurred.

## Next allowed action

Integrate this local independent evidence, complete affected source/package/build
checks, then use the already authorized reversible activation and actual agent
retry against fresh knowledge. Preserve the partial application and stopped-run
evidence. Successful offline examples do not award actual nested-app completion,
whole Gate E, owner acceptance or Stage 9 closure.
