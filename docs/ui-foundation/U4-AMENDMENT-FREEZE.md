# U4 component-amendment freeze record

Status: **FROZEN — VERIFIED** (payload `68e166f…`; independent freeze-check
`U4 AMENDMENT FREEZE CHECK: VERIFIED`, §4 below). Runtime/U4 implementation
remains UNAUTHORIZED; this record freezes the **contract** only.

## 1. Frozen payload

Payload commit (tree-exact, immutable candidate): **`68e166f3eeb27657ff5b28e21c255960256ccdc6`**
on `codex/ui-foundation-u4-component-amendment` (empty marker commit; the
payload paths above it are byte-exact as pinned).

| Path | SHA-256 (at `68e166f…`) |
| --- | --- |
| `docs/ui-foundation/U4-COMPONENT-AMENDMENT.md` | `c3d048d841ebba36de73a834e794d388a42798f80575bddacf4fb1a41e3d720f` |
| `docs/ui-foundation/fixtures/component-contract/README.md` | `ca15aea8a50098aa950b3ead052c00a2034429aa917194b5088aecaa13daebc2` |
| `docs/ui-foundation/fixtures/component-contract/checkbox-valid.json` | `f3e6010d33a79701502cd43eb6cb566c96c68adb1558ac260cd2420916f8fc85` |
| `docs/ui-foundation/fixtures/component-contract/select-valid.json` | `4d20631c77ecb3a4fce349cf13189f16a74fad68731b0df714afc272781c47e2` |
| `docs/ui-foundation/fixtures/component-contract/button-action.json` | `e412f5d6306fe9722a8558f683527f821d779a77e62f47b77715d9ae4d610a94` |
| `docs/ui-foundation/fixtures/component-contract/dialog-slot.json` | `56e22748025f71ce1f6d965d54c45134a3f7c4ab576b86fbd758219991829acb` |
| `docs/ui-foundation/fixtures/component-contract/appshell-content.json` | `57a86d00f12e42961aff27a60b03f0a7409c590ab2f86e4190de7cde833122a5` |
| `docs/ui-foundation/fixtures/component-contract/invalid-cases.json` | `bcd5f4d08dbee7a0df6a54980361e4c14f8fd62fac2f14279c2b5af71bf87466` |
| `docs/ui-foundation/fixtures/component-contract/render-failures.json` | `d484dcad7c8acab03550a364951dd7c9d1c0dfd1ae0355e1932fe7ce45f58738` |

The payload commit is empty by design (a freeze marker): any later edit to a
payload path makes the live bytes diverge from these pins, which is exactly
what the checker and any future verifier reproduce against.

## 2. What the amendment supersedes — and what stays governing

Superseded (documents; no frozen byte rewritten):

1. The prepared [U4-HANDOFF](U4-HANDOFF.md) representative-proof definition
   (P3 registered-component surface with code-owned state/wiring as the
   component proof) and its §12 authorization prompt — replaced by the
   amendment contract and the §12.2 prompt; §12.1 is retained marked
   SUPERSEDED so it cannot be reused.
2. The prepared handoff's props-only-gap disposition ("extension v2" sketch,
   proposed-not-implemented) — withdrawn unresolved; replaced by the
   amendment's implementable drafts (§3–§5).

Governing, unchanged: all seven frozen U4 criteria (STAGES §6 at
`9ec87f3…`, U4-01…U4-07 with original evidence requirements); packaging /
packed-tarball isolation; public-export consumption; preview/production
parity and bundle separation; declared-action runtime authority and preview
fencing; the unfamiliar-agent exercise; the independent final gate; the
founder checkpoint; U0–U3 closure records (U3 closure `16df3bf…`, combined
verified implementation `952d92d…`, frozen U0 authority `9ec87f3…`). The
prior P3 recommendation remains recorded (DECISIONS history, reuse matrix)
as a legitimate route and labelled comparison — superseded only as the
required proof.

## 3. Review lineage (independent contract reviewer; authored none of the payload)

| Round | Candidate | Verdict | Repairs |
| --- | --- | --- | --- |
| 1 | `9c31fae…` | **FAIL** (B-1 blocker: instance revision pin misattributed as existing — the extension compile path echoes the descriptor revision and resolves id-keyed last-wins; 8 minors, 6 infos) | `d84035a…` |
| 2 | `d84035a…` | **PASS WITH NON-BLOCKING FINDINGS** (N-1 SLOT_REQUIRED applicability loose; N-2 `.gitattributes` line replaced) | `8cc0a97…` → `d78a309…` |
| 3 | `d78a309…` | **PASS** (N-1/N-2 verified; new-claim scan clean) | — |

Report imported verbatim (rounds 1–3):
[reviews/u4/U4-AMENDMENT-REVIEW-01.md](reviews/u4/U4-AMENDMENT-REVIEW-01.md)
— final sha256
`34506ab95bf0ea58c77c66293ba22933e7961b9843b0fbebc7cb93a8ec4d9a01`
(round-1 section byte-identical to the delivered original
`9ce2267c55e3382f0865dec099b236836512c32858b2912ad10560471e83b933`;
bytes preserved via scoped `.gitattributes`).

## 4. Freeze check (separate fresh checker) — VERIFIED

Checker independent of both the payload authors and the contract reviewer.
Full report imported verbatim:
[reviews/u4/FREEZE-CHECK-01.md](reviews/u4/FREEZE-CHECK-01.md) (sha256
`18b213f3d582a985915fbe7e848352e99513cf3179af52f9661ccb53460e09ca`), ending
**`U4 AMENDMENT FREEZE CHECK: VERIFIED`** at pinned HEAD `62ce2c8…`. All
eight steps passed: (1) orientation; (2) all nine SHA-256 pins reproduce
from the payload commit AND live bytes (18/18); (3) `68e166f…` is an empty
marker whose parent carries the payload at pinned bytes; (4) lineage SHAs
all exist in order (`8cc0a97…` off-chain superseded); (5) scope `cfbd6d3…→62ce2c8…`
touches only docs/ui-foundation — zero source paths; (6) §12.1 SUPERSEDED /
§12.2 pinned, U0 authority `9ec87f3…` criteria byte-identical; (7) report
integrity verified (full `34506ab9…`, round-1 section `9ce2267c…` byte-
identical); (8) `.gitattributes` carries all three `-text` lines.

## 5. Decisions of record (carried from this cycle)

- Owner decision: catalog components must be canonically authorable; the
  registered-component proof does not satisfy the requirement; P3 remains a
  legitimate route and labelled comparison, not a substitute.
- Schema/version decisions: additive optional fields inside
  `vict.ui-document@1` / `vict.ui-render-plan@1` (schema strings unchanged —
  verified guard `UI_DOC_UNKNOWN_SCHEMA`); ABI carried by the explicit
  `vict.ui-component-abi@1` marker, fail-closed on mismatch; instance
  revision pinning built by the amendment (`UI_COMPONENT_REVISION_UNRESOLVED`);
  emit-only implementation authority; generation-gated stale-drop.
- Open owner items at U4 authorization time: none new — the amendment is
  the owner's decision; U4 implementation still requires the amended
  authorization prompt ([U4-HANDOFF](U4-HANDOFF.md) §12.2).
