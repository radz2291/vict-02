<script lang="ts">
  const year = new Date().getFullYear();
</script>

<main class="design-index">
  <h1>Design proof — two contrasting experiences</h1>
  <p>
    Both experiences are real UI documents rendered by the shared renderer and edited
    through the exported editor modules. Nothing here is hard-coded markup: the page and
    the fixture are source, and the workbench edits that source.
  </p>
  <div class="cards">
    <section class="card">
      <h2>Finished page</h2>
      <p>
        A service/editorial page for the fictional Northwind Atelier: hero, overlapping
        card, CSS-grid services, sticky section, reusable cards, responsive typography and
        an accessible request form.
      </p>
      <p><a href="/service">Open the finished page</a></p>
    </section>
    <section class="card">
      <h2>Workbench</h2>
      <p>
        A Studio-style workbench: navigation rail, central preview, adjustable inspector
        and an activity area. It edits the page and the presentation fixture — resize
        panels, switch sizes, undo, redo, save.
      </p>
      <p><a href="/workbench">Open the workbench</a></p>
    </section>
    <section class="card">
      <h2>Try in two minutes</h2>
      <ol>
        <li>Open the finished page, then the workbench.</li>
        <li>Select the “Kitchens” card title and change its text.</li>
        <li>Open “Finished page” again — the shared definition updated everywhere.</li>
      </ol>
    </section>
  </div>
  <p style="margin-top: 28px; color: #5c6b63; font-size: 14px">
    Fictional content for proof purposes · © {year} the U2 design proof
  </p>
</main>
