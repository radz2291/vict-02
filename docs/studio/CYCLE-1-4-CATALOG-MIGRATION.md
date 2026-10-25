# Cycle 1.4 — complete pinned Rhea catalog reconciliation



All **63** pinned UI families are individually accounted for below. This is not a claim that63 families have complete canonical adapters or pixel parity. The original inventory remains unchanged. Machine-readable dependencies, hashes, exact registered identities, compatibility and omitted functionality are in [the migration matrix](CYCLE-1-4-CATALOG-MIGRATION.json).



## Outcome and material omissions



-30 families retain existing general adapters/public Bits parts, with an opt-in package-owned Rhea presentation. Existing 80 general registered contracts keep exact identities, defaults, required slots and output shapes.

-13 native patterns add reusable semantic classes and canonical source fragments, including controlled input/textarea/native-select. They add zero registered components.

-10 families remain in the existing specialist AI presentation closure. Raw exports do not become canonical adapters.

-10 host/adapter exceptions remain explicit below: carousel, chart, drawer, form, input-otp, questionnaire, resizable, sheet, sidebar and sonner. Existing host forms/charts/drawers/navigation remain usable; unimplemented upstream behavior is not claimed.



This deliberately omits carousel drag/snap, layerchart graphics/legends, gesture drawers, Superforms/formsnap, OTP authentication UX, questionnaire orchestration, general splitter authoring, screen-local routing and a Sonner toast host. These need real host/adapter contracts and complete interaction proof. They are not necessary to translate existing usable controls into one visual language and are not counted as newly supported.



## Family matrix



| Pinned family | Disposition | Actual counterpart / authoring |

| --- | --- | --- |

| accordion | compatible-general-presentation | packages/ui-svelte/src/catalog/accordion.ts; registered-component-and-parts |

| alert | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[alert]; canonical-native-source |

| alert-dialog | compatible-general-presentation | packages/ui-svelte/src/catalog/alert-dialog.ts; registered-component-and-parts |

| aspect-ratio | compatible-general-presentation | packages/ui-svelte/src/catalog/aspect-ratio.ts; registered-component-and-parts |

| attachment | existing-specialist-presentation | @victframework/ui-ai-svelte/components/attachment; public-presentation-composition-only |

| avatar | compatible-general-presentation | packages/ui-svelte/src/catalog/avatar.ts; registered-component-and-parts |

| badge | existing-specialist-presentation | @victframework/ui-ai-svelte/components/badge; public-presentation-composition-only |

| breadcrumb | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[breadcrumb]; canonical-native-source |

| bubble | existing-specialist-presentation | @victframework/ui-ai-svelte/components/bubble; public-presentation-composition-only |

| button | compatible-general-presentation | packages/ui-svelte/src/catalog/button.ts; registered-component-and-parts |

| button-group | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[button-group]; canonical-native-source |

| calendar | compatible-general-presentation | packages/ui-svelte/src/catalog/calendar.ts; registered-component-and-parts |

| card | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[card]; canonical-native-source |

| carousel | explicit-host-or-adapter-exception | No reusable carousel adapter.; host-composition-or-unavailable |

| chart | explicit-host-or-adapter-exception | packages/ui-svelte/src/Chart.svelte; host-composition-or-unavailable |

| checkbox | compatible-general-presentation | packages/ui-svelte/src/catalog/checkbox.ts; registered-component-and-parts |

| code-block | existing-specialist-presentation | @victframework/ui-ai-svelte/components/code-block; public-presentation-composition-only |

| collapsible | compatible-general-presentation | packages/ui-svelte/src/catalog/collapsible.ts; registered-component-and-parts |

| command | compatible-general-presentation | packages/ui-svelte/src/catalog/command.ts; registered-component-and-parts |

| context-menu | compatible-general-presentation | packages/ui-svelte/src/catalog/context-menu.ts; registered-component-and-parts |

| dialog | compatible-general-presentation | packages/ui-svelte/src/catalog/dialog.ts; registered-component-and-parts |

| drawer | explicit-host-or-adapter-exception | packages/ui-svelte/src/Overlay.svelte; host-composition-or-unavailable |

| dropdown-menu | compatible-general-presentation | packages/ui-svelte/src/catalog/dropdown-menu.ts; registered-component-and-parts |

| empty | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[empty]; canonical-native-source |

| field | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[field]; canonical-native-source |

| form | explicit-host-or-adapter-exception | packages/ui-svelte/src/Form.svelte + FormField.svelte; host-composition-or-unavailable |

| hover-card | compatible-general-presentation | packages/ui-svelte/src/catalog/link-preview.ts; registered-component-and-parts |

| input | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[input]; canonical-native-source |

| input-group | existing-specialist-presentation | @victframework/ui-ai-svelte/components/input-group; public-presentation-composition-only |

| input-otp | explicit-host-or-adapter-exception | Bits PinInput remains deferred in FOUNDATION-CATALOG.md.; host-composition-or-unavailable |

| item | existing-specialist-presentation | @victframework/ui-ai-svelte/components/item; public-presentation-composition-only |

| kbd | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[kbd]; canonical-native-source |

| label | compatible-general-presentation | packages/ui-svelte/src/catalog/label.ts; registered-component-and-parts |

| marker | existing-specialist-presentation | @victframework/ui-ai-svelte/components/marker; public-presentation-composition-only |

| menubar | compatible-general-presentation | packages/ui-svelte/src/catalog/menubar.ts; registered-component-and-parts |

| message | existing-specialist-presentation | @victframework/ui-ai-svelte/components/message; registered-specialist |

| message-scroller | existing-specialist-presentation | @victframework/ui-ai-svelte/components/message-scroller; registered-specialist |

| native-select | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[native-select]; canonical-native-source |

| navigation-menu | compatible-general-presentation | packages/ui-svelte/src/catalog/navigation-menu.ts; registered-component-and-parts |

| pagination | compatible-general-presentation | packages/ui-svelte/src/catalog/pagination.ts; registered-component-and-parts |

| popover | compatible-general-presentation | packages/ui-svelte/src/catalog/popover.ts; registered-component-and-parts |

| progress | compatible-general-presentation | packages/ui-svelte/src/catalog/progress.ts; registered-component-and-parts |

| questionnaire | explicit-host-or-adapter-exception | No canonical questionnaire adapter.; host-composition-or-unavailable |

| radio-group | compatible-general-presentation | packages/ui-svelte/src/catalog/radio-group.ts; host-required |

| range-calendar | compatible-general-presentation | packages/ui-svelte/src/catalog/range-calendar.ts; registered-component-and-parts |

| resizable | explicit-host-or-adapter-exception | Studio inspection sizing is product composition, not a reusable canonical splitter.; host-composition-or-unavailable |

| scroll-area | compatible-general-presentation | packages/ui-svelte/src/catalog/scroll-area.ts; registered-component-and-parts |

| select | compatible-general-presentation | packages/ui-svelte/src/catalog/select.ts; registered-component-and-parts |

| separator | compatible-general-presentation | packages/ui-svelte/src/catalog/separator.ts; registered-component-and-parts |

| sheet | explicit-host-or-adapter-exception | packages/ui-svelte/src/Overlay.svelte; host-composition-or-unavailable |

| sidebar | explicit-host-or-adapter-exception | packages/ui-svelte/src/AppShell.svelte; vict.catalog.appshell@1 host-required; host-composition-or-unavailable |

| skeleton | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[skeleton]; canonical-native-source |

| slider | compatible-general-presentation | packages/ui-svelte/src/catalog/slider.ts; registered-component-and-parts |

| sonner | explicit-host-or-adapter-exception | packages/ui-svelte/src/Feedback.svelte and ActionFeedback.svelte; host-composition-or-unavailable |

| spinner | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[spinner]; canonical-native-source |

| switch | compatible-general-presentation | packages/ui-svelte/src/catalog/switch.ts; registered-component-and-parts |

| table | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[table]; canonical-native-source |

| tabs | compatible-general-presentation | packages/ui-svelte/src/catalog/tabs.ts; registered-component-and-parts |

| textarea | native-source-pattern | @victframework/ui-svelte/rhea: rheaNativePatterns[textarea]; canonical-native-source |

| toggle | compatible-general-presentation | packages/ui-svelte/src/catalog/toggle.ts; registered-component-and-parts |

| toggle-group | compatible-general-presentation | packages/ui-svelte/src/catalog/toggle-group.ts; registered-component-and-parts |

| tooltip | compatible-general-presentation | packages/ui-svelte/src/catalog/tooltip.ts; registered-component-and-parts |

| trace | existing-specialist-presentation | @victframework/ui-ai-svelte/components/trace; public-presentation-composition-only |



## Compatibility, provenance and proof boundaries



Rhea source is pinned at `b10f153250b18abfccf49a06e1c4c68945edffa5`. [Package provenance](../../packages/ui-svelte/rhea-upstream-manifest.json) records63exact registry response hashes and 461 upstream source payload hashes, registry/runtime/development dependencies and local adaptations; the MIT grant is shipped as `LICENSE.rhea`. The actual general implementation is VICT-owned scoped CSS translation over existing public components, not a copied new primitive runtime. Existing Bits 2.19.3 is retained; upstream ranges are guidance, not a demonstrated minimum. No new dependency/install or global preflight is introduced.



[Package usage](../../packages/ui-svelte/RHEA.md) describes import order, portal scopes, native source style dependency and local-style precedence. Explicit theme opt-in avoids changing existing saved documents and consumers that only import the accepted legacy styles. Studio must opt its actual rendered catalog and portals into the same theme; a shell-only stylesheet is insufficient. Authored local declarations remain later/higher-specificity source rules and must be checked using browser computed values.



Date/time serialization, provider-owned parts, structured radio data, host application navigation and specialist Flow geometry remain deliberate VICT compatibility boundaries. Flow shares surrounding tokens, not Rhea graph behavior. Existing extra Bits families outside this pinned registry are separately listed in JSON. Source tests/metadata do not substitute for actual integrated keyboard, pointer, portal, small-window, legacy-document and installed-consumer verification.



## Package source checks



Native fragments compile through the same canonical compiler, keep unique IDs and valid ownership, and controlled fields render/change through DocumentHost. Recorded results are supplied to the stage manager; final integrated evidence and independent verdict remain in the Cycle 1.4 report.

Builder checks, 2026-10-25: `rhea-native.test.ts` **20/20 PASS** (13 canonical
compile/render patterns, four actual controlled native changes, 80 retained
descriptor digests, the complete matrix, scoped CSS/context-trigger safety).
Package TypeScript no-emit passed. Strict UTF-8/replacement audit passed for all
12 affected package/metadata/matrix text files; three local provenance hashes
match. The initial test run had 18 passes and one fixture failure because Vite
gave `import.meta.url` a non-file URL; a repository-relative fixture read
corrected it, followed by 19/19 and the expanded 20/20 pass. Five existing
DocumentHost/RenderNode Svelte warnings remain. These are builder checks,
not the independent integrated verdict or browser computed-style proof.
