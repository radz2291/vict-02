<script lang="ts">
  import '@victframework/ui-svelte/styles.css';
  import '@victframework/ui-svelte/catalog.css';
  import { ControlScope } from '@victframework/ui-svelte/controls';
  import ActionsExamples from '$lib/catalog/ActionsExamples.svelte';
  import SelectionExamples from '$lib/catalog/SelectionExamples.svelte';
  import DateExamples from '$lib/catalog/DateExamples.svelte';
  import DisplayExamples from '$lib/catalog/DisplayExamples.svelte';
  import DirectExamples from '$lib/catalog/DirectExamples.svelte';
</script>

<svelte:head><title>VICT foundation catalog</title></svelte:head>
<div class="vict-app">
  <main class="catalog-page">
    <ControlScope>
      <header>
        <p class="vict-control-help">VICT · Foundation catalog coverage</p>
        <h1>One visual system. Room to build.</h1>
        <p>Interactive examples of the supported controls, their states, and their composition.</p>
        <nav aria-label="Catalog sections" class="vict-control-row">
          <a href="#actions">Actions & disclosure</a><a href="#selection">Selection</a><a
            href="#dates">Dates & time</a
          ><a href="#display">Navigation & display</a><a href="#direct">Direct composition</a><a
            href="/requests/schedule">Try the request flow →</a
          >
        </nav>
      </header>
      <section id="actions" aria-labelledby="actions-heading">
        <h2 id="actions-heading">Actions and disclosure</h2>
        <div class="catalog-grid"><ActionsExamples /></div>
      </section>
      <section id="selection" aria-labelledby="selection-heading">
        <h2 id="selection-heading">Selection and settings</h2>
        <div class="catalog-grid"><SelectionExamples /></div>
      </section>
      <section id="dates" aria-labelledby="dates-heading">
        <h2 id="dates-heading">Dates and time</h2>
        <div class="catalog-grid"><DateExamples /></div>
      </section>
      <section id="display" aria-labelledby="display-heading">
        <h2 id="display-heading">Navigation and display</h2>
        <div class="catalog-grid"><DisplayExamples /></div>
      </section>
      <section id="direct" aria-labelledby="direct-heading">
        <h2 id="direct-heading">Supported direct composition</h2>
        <p>
          These utilities retain the Bits parts API. The examples show accessible labels,
          token-based styling, and product-owned content.
        </p>
        <div class="catalog-grid"><DirectExamples /></div>
      </section>
      <footer>
        PIN Input, Rating Group, and Time Range Field remain explicit deferrals. <a href="/requests"
          >Return to Requests</a
        >
      </footer>
    </ControlScope>
  </main>
</div>

<style>
  .catalog-page {
    max-width: 1440px;
    margin: auto;
    padding: 40px;
  }
  header {
    margin-bottom: 48px;
    max-width: 900px;
  }
  h1 {
    font-size: clamp(26px, 4vw, 38px);
    letter-spacing: -0.035em;
    line-height: 1.2;
  }
  h2 {
    font-size: 24px;
    margin-block: 32px 20px;
  }
  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    align-items: start;
    gap: 20px;
  }
  .catalog-grid :global(.catalog-wide) {
    grid-column: 1 / -1;
  }
  section {
    scroll-margin-top: 16px;
    margin-bottom: 40px;
  }
  a {
    color: var(--vict-color-accent);
  }
  nav {
    column-gap: 22px;
  }
  footer {
    border-top: 1px solid var(--vict-color-border);
    padding-block: 24px;
  }
  @media (max-width: 600px) {
    .catalog-page {
      padding: 24px 16px;
    }
    .catalog-grid {
      gap: 16px;
    }
  }
</style>
