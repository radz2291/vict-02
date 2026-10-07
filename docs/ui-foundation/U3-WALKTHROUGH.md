# U3 walkthrough — inspections that behave like a real product (~10 minutes)

This walkthrough is for the founder. Everything runs in your browser from one
command. No technical knowledge needed — if a screen doesn't behave as
described, that's a finding worth reporting.

## Start the product

```text
cd examples/ui-authoring-proof
npx vite dev --port 5333 --strictPort
```

Open **http://127.0.0.1:5333/** — this is the inspection queue. You are
viewing as the **supervisor** (the person who approves or rejects work). A
technician view is one click away (`?as=technician`) — try both where the
steps say so.

## 1. Approve an inspection (2 min)

1. On the queue, click **Cold-chain compressor room** (submitted).
2. You see the inspection: its findings (problems noted on site), its
   evidence (photos, logs), and the activity trail at the bottom (everything
   that has happened, oldest first).
3. Click **Approve this inspection**.
   _Expect: a green "Recorded" note; the status on the page flips to
   **approved**; a new line appears in the activity trail ("Inspection
   approved")._
4. Go back to the queue. _Expect: the row now says **approved**._

## 2. Reject it, correct it, resubmit it (3 min)

The heart of a real inspection workflow — work goes back and forth until
it's right.

1. Open **Dock leveller hydraulics** (still submitted) and click
   **Reject with reason** after typing, e.g., `Hydraulic weep needs a
   measured value`. (The button stays disabled until a reason exists — a
   rejection without a reason is not allowed, enforced in the product's
   rules, not just the button.)
   _Expect: status **rejected**; your reason appears word-for-word in the
   activity trail._
2. Now switch to the technician: change the address to
   `/inspection/i-102?as=technician`. Click **Revise — return to draft**.
   _Expect: status **draft**; the rejection reason disappears from the
   record — but remains quoted in the activity trail (history is never
   erased)._
3. As the technician, add a finding (pick a severity, type a description,
   **Add finding**) and a piece of evidence (**Add evidence**). Then click
   **Submit for decision**.
   _Expect: status **submitted** again, and the trail shows the corrections._
4. Back as the supervisor (`?as=supervisor`): try to approve with the OLD
   paperwork — you can't (the product protects against deciding on stale
   information; the message says exactly what revision it expected and what
   it found). Approve normally.
   _Expect: **approved** against the NEW revision._

## 3. Watch the product say "no" — and recover (3 min)

A trustworthy product refuses gracefully. Try these from the **Scenario
console** at `/scenarios`:

1. Click the **denied** tab, then **Run approve**. _Expect: OPERATION_DENIED
   — a technician may not record decisions. Nothing changed._
2. Click **failure**, **Run approve**. _Expect: SIMULATED_FAILURE — the
   service says it failed; nothing changed._
3. Click **conflict**, then **Run approve (stale revision)**. _Expect:
   DOMAIN_CONFLICT with the expected and actual revision — someone already
   decided; your stale decision was dropped, state untouched._
4. Click **missing**. The approve button is disabled and the coverage table
   declares approve **unavailable** — nothing runs, and nothing pretends to.
5. Click **latency**, then **Fencing demo: reset mid-flight**. _Expect:
   FENCED: SESSION_STALE — a decision that was in flight when the scenario
   reset was dropped; it never lands half-applied._
6. After each "no", click **Reset scenario**: the same scenario comes back
   exactly as before. These are reproducible demonstrations, not flukes.

The queue page has the same reset buttons plus an **empty** scenario: the
queue says plainly "The queue is empty" instead of pretending.

## 4. The decision that survives a restart (2 min)

1. On the queue, find **Decision implementation** and click
   **durable-local (SQLite file)**. Approve **Fire shutter mechanism**.
2. Stop the product (Ctrl-C in the terminal) and start it again with the
   same command. Reopen the queue and switch to durable-local again.
   _Expect: **Fire shutter mechanism** is still **approved** — the decision
   was written to a local database file, and the restarted process read it
   back from there. Nothing survived "in memory"; the memory died with the
   process._
3. Honest contrast: switch to **simulated (in-memory)** — the queue shows a
   fresh seed. The simulated implementation never claims to remember.

## What this stage proves

- The complete inspection journey works: queue → inspection → findings and
  evidence → submit → decision → refreshed views — including the full
  reject → correct → resubmit loop.
- Rules are enforced where they belong (in the product's server boundary):
  permissions, status transitions, mandatory reasons, stale-decision
  protection — clicking the right buttons is never the security mechanism.
- Eight negative and positive scenarios reproduce on demand and reset
  cleanly.
- One simulated decision became a durable one with the same actions, the
  same contracts, and zero changes to the screens — and it survives a real
  restart.

Independent verification reports (a fresh examiner's findings) are kept in
`docs/ui-foundation/reviews/u3/`. Those reports are technical; this page is
the product judgment sheet — if any step above surprised you, that is exactly
the feedback the founder checkpoint is for.
