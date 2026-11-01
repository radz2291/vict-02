# Readable Structure state captions

Owner request: fix graph/JSON state captions in shared VICT Structure, retain full
Selection/Data values, check other captions, verify and close.

**CLOSED.** Installed product:2de11bc7719984f23341852b1cc8b9985ff81adf.

## Change

Shared State presentation replaces raw JSON prefixes with readable summaries.
Supported Flow graph@1/@2/@3 values are recognized through the existing public
validators and show node/connection counts. Other valid JSON objects/arrays show
field/item counts. Unknown or invalid graph-shaped objects stay generic JSON;
malformed JSON-like text is described without dumping fragments. Ordinary text
has a whitespace-normalized, surrogate-safe preview, and list/date/time labels
are readable. None of this changes the declared type or initial value.

Flow exposes its existing model APIs through a nonvisual `/model` entry so the
Structure projection can reuse validation without loading canvas components or
introducing a duplicate graph recognizer. Root Flow exports remain compatible.

## Other captions and complete data

The audit covered literal/element summaries, conditional/repeat/slot/portal
descriptions, scoped-state/prop/output ownership, action/route/catalog/definition
descriptions, assets/styles and token values. They use semantic descriptions or
intended literal/token content, rather than the State initial-value prefix.
Regression checks retain those captions and source facts; user-authored text is
not reinterpreted as JSON merely because it looks structured.

Shared `structureFacts` retains the complete initial value. Studio's Selection
Starting value and Data editor continue reading the canonical declaration.
No document schema, data, graph topology, execution or history ownership changes.

## Verification

The affected seven-file suite passes64/64; this includes the prior repaired
keyboard/command cases and the new state-summary cases. Type checking and lint
pass. The first test run's old fixture URL caused one fixture-read failure;
that harness failure is retained separately from the final green run.

The isolated public consumer passes5/5 checks and its production build. Flow and
Structure are freshly checked/packed; seven unchanged packages are verified reuse.
All nine installed packages and647 nonmanifest files match. A separate Node/TSX
probe exercises all three public model validators without a browser document.
The shared package check retains five existing warnings, with zero errors.

The production build passes. Integrator pre/post verification binds344 staged
inputs,398 installed outputs,93 historical proof files and the398-file preserved
predecessor build. Seal:
`fc482c3907086031b6ce3d1289df8e596e3f0ece3ac58149434585b0d99166f1`.
The full predecessor is retained at
`C:/Users/RZ1/AppData/Local/Temp/vict-pre-state-captions-a629b408-20261101-build`.
These are integrator checks, not a new independent whole-foundation review.

Native Studio now shows **Graph configuration · 3 nodes · 2 connections** for
Evidence graph. Selection's Starting value and the Data textarea each contain
the exact1648-character initial JSON. Evidence desk r1.r7's43653-character canonical
source is byte-identical across activation. Only view/selection navigation was
used; no authored edit, Save, execution or data migration occurred.

[Native result](foundation-evidence/structure-captions-20261101/final-caption.png),
[native value/source checks](foundation-evidence/structure-captions-20261101/native-checks.json),
[final suite log](foundation-evidence/structure-captions-20261101/structure-caption-final.log),
[post-activation proof](foundation-evidence/structure-captions-20261101/post-activation-review.json).
Raw failures and historical delivery records remain preserved. No push, merge,
publication or broader milestone closure is inferred.
