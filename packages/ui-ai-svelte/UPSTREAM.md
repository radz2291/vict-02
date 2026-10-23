# Upstream baseline and maintenance

This package derives its presentation from the official **shadcn-svelte AI
Elements** family. It is not the separate community `svelte-ai-elements` project.
The official family is source-distributed composition patterns, not an AI runtime
or an npm AI Elements package. The upstream announcement is dated 2026-10-14.

- Repository: <https://github.com/huntabyte/shadcn-svelte>
- Immutable source: `b10f153250b18abfccf49a06e1c4c68945edffa5`
- Style: **Rhea**, from `docs/static/registry/styles/rhea/*.json`. These registry
  files contain the resolved upstream style classes, not the unstyled `cn-*`
  source templates. Copying only the generic template directories would omit the
  actual presentation.
- Family authority: `docs/content/ai-elements/*.md` at that same commit. There are
  **21 patterns**, excluding the introduction. [Coverage](COVERAGE.md) accounts
  for every one.
- Markdown: `docs/src/lib/components/markdown/{markdown,markdown-code-block}.svelte`.
- CSS utilities: `packages/cli/src/tailwind.css` at the same commit.
- License: copied MIT grant in `LICENSE.upstream`. Original VICT composition and
  adapters remain Apache-2.0. Dependencies retain their own licenses (including
  ISC for Lucide); no paid templates or examples are included.
- `upstream-manifest.json` records the upstream source payload hashes and local
  hashes, including derived TypeScript module exports. No mutable `latest` URL is
  an artifact identity.

## Boundaries

`@victframework/ui-ai-svelte` owns source-derived presentation, isolated built
CSS, the default conversation, and typed host callbacks. It has no VICT runtime,
Mastra/provider client, server endpoint, credential, persistence or approval
implementation. `src/adapters.ts` converts presentation records only. Studio
supplies the existing VICT/Mastra lifecycle and canonical editing behavior.

Specialist Markdown/Shiki/scroller dependencies stay in this package rather than
the neutral model or ordinary `ui-svelte` catalog. Consumers can import individual
families through `@victframework/ui-ai-svelte/components/<family>`, `/patterns`,
or the main barrel. These are public compositions/subcomponent exports, not a
new wrapper around every Bits primitive. The node package is separately bounded.

## Compatibility evidence

The upstream docs workspace declares Bits UI `^2.20.0` and Svelte `^5.57.2`.
That is the upstream docs application's dependency range, not a demonstrated
minimum for these copied components. The selected closure uses existing
Collapsible, DropdownMenu, LinkPreview, Tooltip, Progress and Separator APIs.
The VICT package pins **Bits UI 2.19.3**, matching the existing catalog exactly.
The scroller dependency `@shadcn-svelte/primitives@0.0.1` declares Svelte
`^5.33.0`, matching the VICT catalog peer floor. No second primitive major is
installed by this package. Actual runtime resolution remains recorded by the
root lockfile and consumer proof; declared ranges alone are not runtime evidence.

The complete source passed Svelte checking with strict repository settings,
including `noUncheckedIndexedAccess`, using the installed VICT Svelte toolchain:

```
node --max-old-space-size=2048 node_modules/svelte-check/bin/svelte-check --tsconfig packages/ui-ai-svelte/tsconfig.json --output machine
COMPLETED 4875 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS
```

This is builder compatibility evidence, not an independent product verdict.
Studio integration, real provider behavior, keyboard/visual checks and packed
consumer checks are separately required by Cycle 1.3.

## Recorded adaptations

1. Resolve registry `$UI$`, `$UTILS$`, `$LIB$` placeholders and docs aliases to
   relative package imports; no repository or `$lib` alias reaches consumers.
2. Resolve registry icon placeholders to explicit Lucide per-icon default exports. The completed 1.27.0 install contains their declarations. An earlier check during dependency installation reported missing declarations; the temporary barrel workaround was replaced with verified per-icon paths to avoid loading the entire icon catalog during development/testing. No ambient any declaration is added.
3. Extract module-script variant functions/types into adjacent `.variants.ts`
   files. The upstream `.svelte`-named exports work in Svelte checking but ordinary
   Studio `tsc` sees its ambient Svelte declaration and cannot resolve those
   exports. Both the component and public index now consume the same TypeScript
   definitions; no competing variant implementation or check suppression exists.
4. The streaming highlighter's final indexed line uses `?? tail` for an empty
   result, preserving plain output under strict indexed-access checking.
5. Portals wrap their children in `display: contents` `.vict-ai` containers so
   floating content receives the same styles and tokens as inline components.
6. Markdown keeps Streamdown and upstream CodeBlock, with VICT safety defaults:
   HTML source is escaped, image syntax becomes text without network loading,
   links require explicit HTTP(S), no credentials/control characters/relative
   resolution, and external anchors carry `noopener noreferrer`. Mermaid fences
   render as code rather than creating an additional active diagram runtime.
7. Reusable patterns replace upstream tutorial AI SDK transports and fabricated
   tool executions with typed data/callbacks. The gallery labels fixtures and
   local callbacks. This is a presentation adaptation, not a provider migration.
8. Owner review identified that the initial wrappers simplified official example
   compositions. Primary structure/icons/grouping/states are corrected in the
   presentation-fidelity pass. Each pattern now records immutable example hashes.
   See `PRESENTATION.md` for retained host adaptations and secondary variants;
   export counts and provenance alone do not prove visual fidelity.

## CSS consumption and isolation

Import `@victframework/ui-ai-svelte/styles.css` once. Default Conversation and
PatternShowcase supply `.vict-ai` scope roots. Wrap standalone subcomponents in
`<div class="vict-ai">`. Portal wrappers supply their own scope.

The package builds Tailwind **4.3.3** utilities from its own source and Streamdown
only; it does not require consumers to install Tailwind or scan package sources.
It imports no global Preflight. Build output selectors are scoped to `.vict-ai`,
tokens live on that scope, and utility properties/keyframes use VICT identities.
The small reset is also scoped. Unlayered package selectors keep copied registry
utilities active against host element rules; this alone does not prove pattern
composition or pixel fidelity. No styling reaches
the existing Bits catalog outside the AI scope. Importing CSS cannot establish
that every host override is compatible: packed-host and Studio visual proofs
remain part of the gate.

Host appearance can set `--vict-ai-background`, `--vict-ai-foreground`,
`--vict-ai-primary`, or `--vict-ai-font` on the scope. The default palette is light;
automatic host-theme inference is not promised. Floating scope roots use the
default palette unless deployment CSS sets the same public variables there.

## Upgrade procedure

1. Select an immutable upstream commit and compare **all** AI Elements pages;
   add every newly introduced or removed pattern to the coverage disposition.
2. Re-resolve the Rhea registry dependency closure and compare source payload
   hashes against `upstream-manifest.json`; preserve the MIT grant.
3. Reapply the listed small adaptations, especially safe Markdown and portals.
   Update source and local hashes truthfully; never relabel VICT edits upstream.
4. Review exact runtime/build dependency pins and the root lockfile. Re-prove
   Bits/Svelte APIs instead of widening versions speculatively.
5. Run package Svelte check, build scoped CSS, Studio's ordinary TypeScript and
   regression checks, and a new packed consumer with no aliases. Exercise all
   21 gallery patterns plus default chat/scroll/Markdown/security/keyboard cases.
6. Re-run the actual VICT/Mastra editing lifecycle and obtain an independent
   verdict on the pushed candidate. No npm publication or main merge is implied.

## Retained failed observations

- Initial CSS build used `import.meta.resolve('@tailwindcss/cli')`; that package
  exposes only `./package.json`, so Node refused the main export. Build now
  resolves the declared manifest and its `dist/index.mjs` executable. Rebuild
  passed (`Built isolated ui-ai-svelte/dist/styles.css`).
- Initial Svelte check: 10 errors, consisting of an indexed highlighter tail and
  missing Lucide alias declarations. No successful check was claimed then.
- Next check: two extraction defects (private InputGroup variant not exported;
  Badge default accidentally routed to its variants module). Both repaired;
  the final complete check above passed. Studio's earlier plain-tsc failure is
  separately retained in `docs/studio/cycle-1-3/studio-check-initial.log`.
