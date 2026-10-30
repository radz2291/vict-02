# VICT conversation and node consumer

This small Vite/Svelte application imports only public `@victframework/ui-ai-svelte` and `@victframework/ui-flow-svelte` exports. It has no Studio import, repository source alias or provider credential. Chat streaming, tools and the 21-pattern gallery are explicitly labelled local presentation fixtures. Flow connections edit only the example diagram.

Private verification evidence omitted from this public checkpoint; see VICT-PAUSED-PUBLIC-HANDOFF-20261030.md for evidence limits.

In the reported consumer directory run `npm run preview -- --port 5595` after checking port ownership. Open the printed local address in a separate browser profile. Send and Stop a simulated reply, copy a message/code block, inspect each pattern, pan/zoom/select nodes, drag a handle to add an edge and use the minimap. None of those fixture actions implies a Studio backend capability.

Consumers explicitly import each package stylesheet. AI styling is scoped to `.vict-ai`; upstream floating portals get that scope too. Flow's own class selectors are separately loaded. Host content outside those scopes must retain its styles. A bundler with Svelte5 support is required because the packages intentionally ship Svelte/TypeScript source like the existing VICT renderer package.
