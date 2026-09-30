# VICT Stage 09 — G3 Entry-Contract Re-Review Round 3 (targeted: B-1 repair), 2026-09-29

> Reviewer: independent third verifier (no role in any Stage 9 work).
> Scope: single-target verification of the B-1 repair at 13f7618 on
> `origin/codex/stage9-g3-proposal`, per WP-G3-C item 1 of
> `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md`.

## 0. Baseline hygiene (re-review note R-R1)

- `git ls-remote`: `refs/heads/codex/stage9-g3-proposal` = `13f761833df5de4526c039814db8b211aa765695` (matches). `refs/heads/main` = `510ef7ef668ebd9aea09378b05f221574c4d2ea6` (matches).
- `git merge-base --is-ancestor 510ef7e 13f7618` → exit 0. The branch sits on its named main baseline (non-forced), as R-R1 required.
- Regression scope: `git diff f61d01f..13f7618 --stat` touches exactly
  `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md` (+54/−22 net region),
  `docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md` (−2: dual-H1 removal),
  and `docs/governance/VICT-STAGE-09-G2-CLOSURE-2026-09-29.md` (+12/−6, the
  STATE/closure hygiene commit arriving via the merge of origin/main/510ef7e).
  Nothing else touched. PASS.

## 1. B-1 repair verification (WP-G3-C item 1)

Old oracle (M-1 repair, f61d01f) verified `commandSchema` as a command list
("must contain `agent.turn.get` and `app.data.query`, must NOT contain
G1 `run.*` reads"). At handoff lines 95–128 (repaired text, B-1 re-repair) the
oracle is now:

- **(i) Positive behavioral:** `agent.turn.get` and the `app.data.query` read
  of `qlt.inspection` must EXECUTE (both succeed). PRESENT.
- **(ii) Negative behavioral anti-newer probe:** the transport probes one G1
  operator read (`run.get` against a bounded id) and REQUIRES a refusal
  (unknown-command/unsupported outcome); any probe success FAILS CLOSED with a
  truthful version error. PRESENT — and correctly identified as the real
  0.3.1-vs-greenfield discriminator.
- **(iii) Inspect answer-record equality:** full `compatibility.inspect` +
  `health.inspect` answers recorded verbatim at journey time and must equal the
  pinned expected record (stream/changeset/turn schema ids, commandSchema
  marker, healthy, turnExecutorComposed); honest caveat recorded that (iii)
  alone cannot distinguish 0.3.1 from a newer set — carried by (ii) and (iv).
  PRESENT.
- **(iv) Provenance:** fixture records the exact Quellight git ref and that
  ref's own declared release identity (release-set identity and
  `@victframework/*@0.3.1` pins), labeled provenance, never claimed to be a
  runtime oracle. PRESENT.
- Registry self-echo: still banned ("Registry self-echo alone is never
  sufficient evidence"). PRESENT.
- Demo-target falsifier: retained ("pointing the transport at the demo target
  must refuse via probe (ii)"), plus a tampering falsifier for recorded oracle
  answers. PRESENT.

The old M-1 repair text is superseded in place, with the impossible premise
(`commandSchema` as a command list) explicitly retracted. PASS on all four
elements.

## 2. Independent behavioral-premise check on the REAL 0.3.1 artifact

Artifact: `https://registry.npmjs.org/@victframework/server/-/server-0.3.1.tgz`
(published tarball, unpacked; inspected `package/dist/commands.js` and
`package/dist/http.js`).

- **(a) Command inventory:** `VICT_COMMANDS` (commands.js:41–70) contains
  `agent.turn.get` (line 61) and `app.data.query` (line 65). It contains NONE
  of `run.get`/`run.list`/`run.detail`/`run.events`/`run.waits` (verified by
  grep: no matches for any `run.` read except `run.read` scope strings and
  `run.cancel`, which is not a read). The G1 probe `run.get` would therefore be
  treated as an unknown command. CONFIRMED.
- **(b) Unknown commands REFUSED, not no-op'd:** `commands.js:443–450`
  (`#...` execute path): `if (typeof commandName !== 'string' ||
  !VICT_COMMANDS.includes(commandName)) { return { ok: false, code:
  'VICT_COMMAND_UNKNOWN' }; }` — a hard structured refusal before any
  authorization. (Also the transport maps unknown names at
  `http.js:192/434`; `run.get` has no declared route.) The probe would in fact
  be refused. CONFIRMED.
- **(c) `commandSchema` is the opaque marker:** `commands.js:39`
  `VICT_COMMAND_SCHEMA = 'vict.command@1'`; both inspect answers return it
  verbatim (`commands.js:718` health.inspect, `commands.js:723`
  compatibility.inspect; also `http.js:314`), and the envelope check
  (`http.js:363`, `commands.js:234/360/385`) uses it as an opaque envelope
  schema id, NOT a list. The inspect answers additionally carry
  `streamSchema: 'vict.agent-stream@1'`, `changesetSchema: 'vict.changeset@1'`,
  `turnSchema: 'vict.agent-turn@1'`, `healthy: true`,
  `turnExecutorComposed` — exactly the record fields the (iii) oracle pins.
  The old M-1 oracle was indeed impossible. CONFIRMED — B-1 was real, and the
  repair matches the real surface.

No premise fails. No blocker from the artifact check.

## 3. Companion fixes checked

- **Criterion (b) alignment oracle** (handoff, G3-C bullet, lines ~238–243):
  the alignment oracle is now the target's OWN correlation identity — turnId
  must appear in BOTH answers and be rendered in the panel; absent correlation
  ⇒ truthfully NOT DEMONSTRATED, never approximated. PRESENT.
- **Item-8 cross-reference fix:** the AGENT-CONTEXT credential sentence now
  points at "the required-demonstrations list below" instead of the dangling
  "item 8". FIXED — but see MINOR-1 below (typo introduced by this edit).
- **Proposal dual-H1 fix:** `docs/governance/VICT-STAGE-09-G3-PROPOSAL-2026-09-29.md`
  previously had two `# VICT Stage 09 — G3 Decision-Ready Proposal` headings;
  at 13f7618 exactly one remains (the AMENDED one). FIXED.

## 4. Findings

- **MINOR-1 (doc typo, byte-located):** `docs/handoff/VICT-STAGE-09-G3-HANDOFF-2026-09-29.md`,
  line 136: `(used ONLY for used ONLY for the refusal demonstration in the`
  — the B-1-adjacent item-8-cross-reference repair duplicated
  "used ONLY for". Editorial; does not change any criterion, oracle, or
  falsifier. Fix at the next touch (or a single-word squash commit); does not
  block freeze.
- **No MAJOR or BLOCKER findings.** The B-1 repair's four elements are all
  present, all verified against the real 0.3.1 published artifact, scope is
  exactly the two contract files plus the merged closure-hygiene doc, and the
  branch topology satisfies R-R1.

## VERDICT: FREEZE-READY

(the MINOR-1 typo is editorial and non-structural; it may be fixed in a
no-content-change follow-up without reopening the contract).