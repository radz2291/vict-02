# U2 founder walkthrough — design proofs (~10 minutes)

Everything below is clickable at the design-proof dev server (default
`http://127.0.0.1:5333`). Start from the **Overview** page — it links to both
experiences. No technical knowledge needed; expected results are written after
each step. Source IDs, digests and counters exist but live in the advanced
views — this walkthrough never needs them.

## 1. Look at the finished page (2 min)

1. Open **Overview** → click **Finished page**.
   _Expect: a calm home page for the fictional "Northwind Atelier" — big serif
   headline, an intro line, a white card overlapping the hero on the right, a
   "What we do" grid with three cards, a story section with a contact card that
   stays pinned while you scroll, and a "Request a quote" form._
2. Scroll the page slowly. _Expect: the "Every project, documented" card
   follows you down the right side (sticky) until its section ends._
3. Resize the window narrow (phone width). _Expect: the three service cards
   stack in one column; text grows no smaller than readable; nothing overflows
   or clips._

## 2. Change the page from the workbench (3 min)

1. Open **Workbench**. _Expect: dark navigation rail on the left ("Service
   page" / "Graph fixture", Undo/Redo/Save/Reload stored), the page in the
   middle, the Inspector on the right, an Activity log at the bottom._
2. In the middle canvas, click the words **"Kitchens"** (first service card
   title). _Expect: a blue outline marks the selection; the Inspector shows the
   selected text._
3. In the Inspector, change the **Text** field to `Kitchens & pantries` and
   click **Apply text**. _Expect: the card in the canvas updates immediately._
4. Click **Undo**, then **Redo** in the left rail. _Expect: the text flips back
   and forward again._
5. Click **Save** in the rail. _Expect: the Activity log records "Saved as
   stored revision … (persists across reload)" and the Status area shows
   "Saved"._
6. Press the browser's refresh button. _Expect: your edit is still there._
7. Open **Finished page** in a new tab. _Expect: **the same edited text** — the
   workbench edits the source the real page renders. Switching the workbench's
   preview size (Full / 1024 / 390 / 480 container) never changes the page
   source and never marks it "Unsaved"._

## 3. Shared cards: edit once, update everywhere (2 min)

1. In the workbench, click the **background/body area** of any service card and
   look at the Inspector. _Expect: "Inside component … editing the SHARED
   definition — 5 instances update together" and an "Edits apply to" choice._
2. Keep **the shared definition (all instances)** selected, choose a style
   (Property: `background-color`, Value: `#e7f2ec`), click **Apply style**.
   _Expect: all five cards change together._
3. Now choose **this instance only** in "Edits apply to", pick a different
   color, **Apply style** again. _Expect: only the card you clicked changes._
4. Press **Undo** a few times to walk the changes back. _Expect: each step
   reverses cleanly._

## 4. The form (1 min)

1. Open **Finished page**, click into **Your name**, then press **Enter**.
   _Expect: a red-bordered feedback box appears: "The request was not sent
   yet:" with one clear message per field (name, email, message)._
2. Fill the three fields with real values and press **Send request** (keyboard
   works throughout). _Expect: a green box: "Request sent (simulated)…" — it
   honestly says nothing is stored._

## 5. Something goes wrong — recovery (1 min)

1. In the workbench, corrupt the saved data (ask your agent to run
   `localStorage.setItem('vict.u2.service.doc', '{oops')`), then refresh.
   _Expect: a clear warning that the stored data is unreadable and has been
   **PRESERVED**; the page still opens; trying to Save is refused with an
   honest message; your unsaved edits stay in the editor._
2. Clear the site data (or ask your agent to clear that key) and refresh.
   _Expect: everything back to normal._

## 6. The second experience (1 min)

1. In the workbench, switch the document to **Graph fixture**. _Expect: a
   presentation sample of boxes and connectors with deliberately long labels —
   try the small preview size: labels wrap, columns stack, nothing clips._
   This fixture is intentionally just shapes and labels: no workflow editing,
   no live controls.

## What the founder is judging

Clarity, appearance, coherence and useful behavior. Technical correctness
(contracts, identity, persistence, accessibility, performance) is proven
separately by independent verification and is not part of this walkthrough.
