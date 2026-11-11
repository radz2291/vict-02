# Draft authoring transactions

VICT-003 exposes `@victframework/control/draft-authoring` for governed edits to an open draft. The host supplies the authorized draft resolver, canonical journal, and receipt retention. The same interface supports an in-process journal or a proposal delivered to a separate journal owner, such as a browser editor.

## Public API

| Export | Role |
| --- | --- |
| `createDraftAuthoring(host).discover(turn)` | Reads the authorized open draft instance, editable occurrence, and current revision for the trusted actor and turn. |
| `createDraftAuthoring(host).apply(invocation, request)` | Binds the request to the trusted invocation, dispatches the proposal, and reads the exact journal receipt. |
| `createDraftAuthoring(host).observe(operation)` | Reads the authoritative receipt by actor, turn, and operation. It can be called after the turn ends. An absent receipt returns `undefined`. A journal read failure rejects. |
| `commitDraftEdit(proposal, signal, journal)` | Verifies the received edit's digest and checks replay, scope, Stop, and revision within the host's synchronous commit boundary. |

`DraftAuthoringHost` and `DraftAuthoringJournal` type the adapter. `DraftEditRequest` carries the target, expected revision, and host-encoded edit. `DraftEditProposal` adds the trusted actor, turn, operation ID, and a lowercase SHA-256 digest of the UTF-8 bytes of `JSON.stringify(edit)`. The receiving journal recomputes this digest synchronously with the browser-safe `@victframework/contracts/sha256` implementation. A mismatch throws before the journal writes a draft or receipt, so an exact retry can still apply. `DraftEditReceipt` carries the binding fields and an outcome. An applied receipt carries the committed revision, and a stale receipt carries the observed current revision. A receipt carries no edit text.

`apply` returns `confirmed` with the receipt when the journal verifies `applied`, `stale`, `cancelled`, `denied`, or `invalid`. A malformed request or scope denial before dispatch returns `invalid` or `denied` directly. Reusing an operation ID with a different target, expected revision, or edit returns `operation-conflict`. If delivery or the journal read cannot establish the outcome, `apply` returns `unconfirmed`. Retry the exact request with its original operation ID or observe that operation when the journal is reachable.

## TORI-004 adapter

1. Register the discovery and instruction-edit capabilities in the pinned Authoring Agent activation. Use the existing VICT tool bridge, effect approval policy, and runtime grant for invocation. Take the actor, turn, stable idempotency key, and cancellation signal from the trusted bridge's invocation context. In the Mastra composition, the `CapabilityBridgeDeps.invoke` seam receives `victActorId`, `victTurnId`, `victIdempotencyKey`, and `signal`. The capability input contract should accept only the expected draft, occurrence, revision, and proposed text.
2. Pin the permissible open Agent Definition to the authenticated turn using TORI's project and definition context. Use an identity for the particular open journal instance so a reopened draft at the same revision cannot inherit an outstanding proposal. Resolve the effective occurrence from the graph. For inline instructions it is `agent.instructions`. For a connected instruction source it is `instructions.text` on the bound node. Discovery and commit use the pinned scope even if the user changes selection.
3. Deliver the bound proposal to the owner of that draft journal. Verify the channel and the proposal's actor and turn binding before calling `commitDraftEdit`. Its synchronous `resolveDraft` must recheck the open instance and occurrence at the journal. Implement `apply` by mapping the text to the exact node and parameter and calling the same `GraphSessionV3.apply(operations, expectedRevision)` used for manual edits. Return `applied` from its successful graph result, `stale` with the current revision for a revision conflict, or `invalid` for a graph or domain validation refusal. Use the journal's actual revision including unsaved edits.
4. Serialize Stop, manual edits, and agent edits at that journal. Run `commitDraftEdit` inside one atomic section covering scope and revision checks, the Stop fence, graph mutation, and receipt recording. A same-process Flow owner can perform this in one synchronous section. With a browser journal, latch the exact turn's Stop fence at the journal owner and use that fence's signal. Then use `AgentTurnService.cancelTurn` for the governed turn. For a Stop originating elsewhere, coordinate with the journal owner before confirming the draft fence. Order Stop and commit at the same authority even when transport delivery or acknowledgement is delayed.
5. Store the receipt by actor, turn, and operation in that atomic section and read it from the authoritative journal. When graph state is persisted, commit its new state and receipt together or roll the transaction back on failure. Retain receipts for the promised retry and inspection window, including draft close/reopen. Set a delivery timeout if the host transports a proposal across processes. A dropped acknowledgement or a stopped tool must reconcile against the journal. A committed receipt remains `applied` if the turn later stops or the user undoes the edit.
6. Use the result for in-turn tool feedback. Link the receipt to the authenticated Session, pinned activation, and Run via the turn and the invocation's stable idempotency key. Authorize later inspection through the host and VICT's turn read checks before calling `observe`. Show an applied edit through the existing graph state and history in Configure and Canvas. Save and Activate are explicit Studio actions.

## Build and install proof

From a clean checkout of the candidate commit with Node.js 22.13 or newer and npm available, run:

```sh
npm ci --no-audit --no-fund
npm run verify:draft-authoring
```

The verifier builds the emitted packages, packs the required VICT packages, and installs the tarballs into a fresh temporary consumer outside the worktree. It verifies tarball integrity in the consumer lockfile, checks that installed packages resolve inside the consumer, typechecks and bundles the public entry point for browsers, and runs the governed turn and Flow journal tests. The temporary directory printed by the verifier contains the tarballs and the consumer. Run `npm ci --ignore-scripts --no-audit --no-fund` in that consumer to reinstall from its captured lockfile and `node --import tsx --test draft-authoring.test.mjs` to repeat the tests. Install the generated `victframework-control-0.4.0-rc.1.tgz` and `victframework-contracts-0.4.0-rc.1.tgz` together as file dependencies in the compatible VICT set. The verifier prints each tarball's integrity to distinguish the candidate from the baseline's version label.

The fixture drives the actual activation-pinned Mastra tool bridge and VICT turn service with scripted tool calls, a synthetic runtime grant and exact quiet-write policy, and an in-memory Flow journal and receipt index. It covers scope and graph validation, stale manual edits, both Stop orderings, undo/redo, an edit altered in transport, acknowledgement loss, and overlapping delivery. The fixture models transport timing and receipt reads in one process. TORI-004 owns the live browser transport, authorization for its real drafts, and its retention across reopen.
