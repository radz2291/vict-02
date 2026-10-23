<script lang="ts">
  import { onMount } from 'svelte';
  import { PatternShowcase, PrimitiveShowcase } from '@victframework/ui-ai-svelte';
  import { FlowCanvas, addEdge, type Node, type Edge, type Connection } from '@victframework/ui-flow-svelte';
  import StudioShowcase from '$lib/designer/StudioShowcase.svelte';
  import CompletionShowcase from '$lib/designer/CompletionShowcase.svelte';
  import '@victframework/ui-ai-svelte/styles.css';
  import '@victframework/ui-flow-svelte/styles.css';
  let mounted = $state(false);
  let nodes = $state<Node[]>([
    { id: 'source', type: 'input', position: { x: 20, y: 60 }, data: { label: 'Source definition' } },
    { id: 'view', position: { x: 280, y: 160 }, data: { label: 'Rendered view' } },
    { id: 'output', type: 'output', position: { x: 540, y: 60 }, data: { label: 'Declared output' } },
  ]);
  let edges = $state<Edge[]>([{ id: 'source-view', source: 'source', target: 'view' }]);
  let flowNotice = $state('Drag nodes, select, zoom, pan, and connect handles. This generic example has presentation meaning only.');
  function connect(connection: Connection) {
    edges = addEdge(connection, edges);
    flowNotice = `Connected ${connection.source} to ${connection.target}. The Designer below demonstrates guarded source edits.`;
  }
  onMount(() => { mounted = true; });
</script>

<svelte:head><title>Cycle 1.3 — complete UI showcase</title><meta name="description" content="Interactive AI patterns, shared UI building blocks, reusable node canvas, and all 83 Studio authoring recipes." /></svelte:head>
<main>
  <header>
    <p class="eyebrow">VICT Studio / Cycle 1.3</p>
    <h1>Complete UI showcase</h1>
    <p>Explore the actual reusable UI and Studio authoring surfaces. Examples use local presentation state and disposable in-memory documents. No provider calls or saved owner screens are used.</p>
    <nav aria-label="Showcase sections"><a href="#completion">Completion round</a><a href="#ai-patterns">21 AI patterns</a><a href="#building-blocks">Shared building blocks</a><a href="#flow">Node canvas</a><a href="#designer">83 Designer recipes</a><a href="#scope">Scope and limits</a></nav>
  </header>
  <section id="completion" aria-label="Completion round additions">{#if mounted}<CompletionShowcase />{/if}</section>
  <section id="ai-patterns" aria-label="AI patterns"><h2>All 21 AI Elements patterns</h2>{#if mounted}<PatternShowcase />{:else}<p>Interactive examples load after hydration.</p>{/if}</section>
  <section id="building-blocks" aria-label="Shared building blocks"><h2>Shared AI building blocks</h2>{#if mounted}<PrimitiveShowcase />{/if}</section>
  <section id="flow" aria-label="Reusable node canvas"><h2>Reusable node canvas</h2><p role="status">{flowNotice}</p><div class="flow">{#if mounted}<FlowCanvas bind:nodes bind:edges onconnect={connect} fitView aria-label="Showcase reusable node canvas" />{/if}</div></section>
  <section id="designer"><StudioShowcase /></section>
  <section id="scope"><h2>Scope and limits</h2><p>The gallery includes the 21 AI patterns, 19 shared AI component families and their composition parts, the public Flow canvas, all 83 registered Designer recipes, Inspector, selection palette, Composer, Layers, composition navigation, typed data editors, and Studio source Structure view.</p><p>Provider execution, authentication, persistent screen storage, and application deployment are host services rather than gallery effects. Context-owned parts appear in valid ancestor compositions. The existing catalog omits unsupported RadioGroup and AppShell recipes; this showcase does not invent them. Save/reopen applies only to the currently selected in-memory demo. AI decision callbacks demonstrate presentation and do not grant execution authority.</p><p><a href="/design">Open the full Studio Designer</a> to review its existing workspace chrome and AgentChat integration in the authenticated host. That separate workspace uses its ordinary saved-screen storage.</p></section>
</main>

<style>
  :global(body) { margin: 0; background: #f4f6fa; }
  main { max-width: 1560px; margin: auto; padding: 32px; color: #172033; font: 15px/1.5 system-ui, sans-serif; }
  header { max-width: 1000px; } .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: #617088; }
  h1 { margin: 8px 0; font-size: 38px; letter-spacing: -.04em; } h2 { font-size: 24px; }
  nav { display: flex; gap: 10px 22px; flex-wrap: wrap; margin-top: 22px; } a { color: #355cc9; }
  main > section { margin-top: 40px; scroll-margin-top: 20px; } .flow { height: 450px; background: white; border: 1px solid #d7dfe9; border-radius: 12px; overflow: hidden; }
  #scope { max-width: 980px; } @media(max-width: 800px) { main { padding: 16px; } h1 { font-size: 30px; } }
</style>
