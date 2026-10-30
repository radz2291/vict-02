# Reusable component architecture conformance

> Owner pause,29October2026: **PAUSED / HELD**. The new flow composition delta
> remains partial at integrated/actual-agent scope. Historical conformance verdicts
> below retain their stated scope. Product119c80bf is built but not installed;
> serving product27788de9 remains. No activation or implementation until the owner
> resumes. Read [the pause handoff](VICT-PAUSED-HANDOFF-20261029.md) first.

> Sanitized public requirements excerpt. Private verification history is omitted; all owner acceptances remain open. See [publication handoff](VICT-PAUSED-PUBLIC-HANDOFF-20261030.md).

## Required check CF-01

Before a component can pass foundation acceptance, record its actual rendering path and verify:

1. Existing public VICT controls/catalog wrappers and intended shadcn/Bits interaction machinery are reused where their capability is already covered. A dependency declaration, lookalike class or hand-written screenshot is insufficient. Shared presentation recipes are appropriate for native fields where no matching standalone interaction primitive exists; preserve their existing semantics.
2. Specialist geometry, native media and inert SVG use the established registered renderer/asset contracts. Document why a custom surface is needed; do not substitute a library indiscriminately. Material divergence or duplicate interaction infrastructure requires correction or an explicit owner-approved exception.
3. Semantic tokens/theme, public CSS order, scoped catalog ancestry and owned portals work in Studio's isolated iframe, a normal installed consumer and capture. Studio-only CSS or defaults do not prove consumer behavior.
4. Canonical registration/implementation/compatibility, props/slots/outputs, part targets and discovery agree. Part classes and ownership survive composition, including repeated/portaled parts. Source/history/save remain authoritative.
5. Runtime, accessible naming/keyboard/focus/disabled/error states and responsive behavior match the claimed capability. Applicable managed assets and references survive save/reopen/Run and portable export/import.
6. Evidence distinguishes source review, focused tests, browser observation, actual-agent output, device checks and independent verdict. Required actual-agent or device evidence cannot be substituted with fixtures. No exception is approved by the implementing agent.


## Approved owned-popup rendering path

The new shared core owns application-local input/layer arbitration for Dialog, Menu and Tooltip. OwnedMenuContent plus its single context/keyboard engine is used by AI ModelSelector and B4 dropdown/context/menubar/submenu adapters; native items retain actual roles, markers, shared presentation and controlled outputs. OwnedTooltip is used by MessageAction and B5Tooltip, with real public Button reuse, exact owner/part/scope forwarding and description/source lifetime handling. Public Bits Portal remains the rendering primitive; ordinary unowned Bits Content paths remain compatible. Public Floating UI1.8.0 supplies positioning, cleanup and stale/style-replacement fences. This is the owner-approved architectural mode, not a component-specific bypass or a claim that owned input behavior is Bits Content.
