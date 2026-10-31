# Independent actual-app r1.r17 source and turn32 review

Verdict: **PASS within source preservation, saved/export association and acknowledged-edit scope.** The r15 C1 finding is resolved in the actual saved app. This is not a native interaction, runtime repair, artifact activation or whole-candidate verdict.

Review branch starts at `621259d1606d8e63aac34be7926ff0c0156452bc`, following the exact root evidence snapshot `62bdd1a85b9770b4c45a337fd10fc8c6005881d0`. This commit changes evidence only. The actual authoring turns ran on `bac786840d7519c041638e1b9d239d54efdf56f5`; the separately packed owned-port candidate is `afa8dd9d9f550392811ce286ecc025b9933d99a7`. Neither runtime is silently substituted for the other.

## Exact final source

`saved-source.json` is actual Campaign Foundry document `screen-a8690ffa-1e90-4b72-909c-66141d372773`, normal save **r1.r17**, SHA-256 `61cb0084f0ea47ae570673ed09d1643cdceadb931944816f679eab09bc480938`. The supported export SHA-256 is `fb44619809dec2e9266fdbd9b5843e7288ec064e97bb58a64cd3fa37e30c6a5b`; its document is deeply identical to that saved source.

The independent comparison reconstructs the complete expected document from the retained actual r15 snapshot and permits only:

- The documented native Negative-node move: x `446.83595102709694` to `378.5910038381814`, unchanged y; outer graph revision48 to49. Every other graph field, node, position, value and link is exact. This is an intentional correction, not a claim of position preservation for Negative.
- Two canvas EdgeSettings content scopes declaring their public `readOnly:boolean` prop, twelve corresponding fields and two Reset buttons disabled through that prop. The two selected-edge panels and their existing read-only bindings are unchanged. All four source panels now consume readOnly.
- Four colour-input display expressions mapping canonical `token:border` to the current theme border `#2b3b52`, otherwise passing through `state.color`. The conditional changes display only; graph data, canonical reset semantics and native input writeback bindings are unchanged. Arbitrary future theme tokens are not proved by this literal current-theme mapping.
- Normal document save revision r1.r17.

Deep equality rejects any other source change. In particular, the entire final `localState` is exactly the layout-corrected pre-agent source. Outer/Social/Poster graph3 revisions remain49/6/9. All defaults, e18 override, factories, manual Social/Poster values, ordinary controls, 27 named port-row definitions and occurrence structure audited in the [r15 review](../graph3-phase/R15-QUALIFIED-REVIEW.md) remain exact. No literal HTML id/for was introduced. The prior installed public add-Finishing proof remains applicable to the byte-identical factory/model content; it was an offline copied-app test, not an actual native Add action.

## Actual turn32 receipts

The lossless `32-originals.json.gz` retains all32 originals plus their capture/page metadata and SHA-256 manifest; `32-turn-details.txt.gz` retains the terminal UI record. Independent replay verifies all32 JSON records, 96,760 text characters and38 continuous pages, with every record capture complete. The supplied inventory is `inventory.json`; no aggregate inventory-complete file was supplied or invented.

There were **three edit attempts, two acknowledged transactions**. The first attempt bound `prop.readOnly` before declaring the scope and was strictly refused with `STUDIO_AGENT_VALIDATION` / `UI_EXPR_UNKNOWN_REFERENCE`. The successful retry first declared the outer scope, then bound outer disabled/display fields; the second acknowledged transaction applied the nested scope/fields. Their cumulative applied counters are1 then2, source cursors `r1.r16#24` and `r1.r16#25`. These counters count confirmed transactions, not individual operations.

The terminal turn was **failed**, with two confirmed edits, because observation first refused as `STUDIO_CAPTURE_STALE` and then `STUDIO_CAPTURE_ASSESSMENT_INVALID`. The invalid model assessment was not accepted. Neither failure erases the acknowledged source edits, and neither supplies an agent visual or interaction pass. The final saved/exported source independently confirms their effects.

The final metrics record16 tool calls,13 completed/3 refused,13 provider requests,2 vision requests,2 confirmed edits and625,595ms total elapsed. Reported token totals are cumulative usage, not cost; outside-tool time is not provider latency.

## Verification and remaining scope

Run from the review checkout:

```text
node docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/final-r17/audit-source.mjs
node docs/studio/foundation-evidence/node-suite-stress-20261031/actual-app-independent/final-r17/audit-completed32.mjs
```

Both pass against the committed snapshots/bundle without the live app or root checkout. Machine-readable outputs are `independent-final-source.json` and `independent-32-archives.json`. Failed attempts and original exchanges remain retained.

No source-preservation or C1 app-source blocker remains in this bounded review. Native Reset/readonly/focus/history/reopen, edge endpoints/halo, nested connection and drag behavior require their separate receipts. Root reported a native duplicate select-event history entry and nested connect-drag auto-pan issue; their runtime repairs are in another review lane and are **not awarded here**. A static source pass cannot close either. No owner acceptance, Stage9 closure, push, publication or activation is authorized by this verdict.
