function _layout($$renderer, $$props) {
  let { children } = $$props;
  $$renderer.push(`<div class="design-host"><header class="design-top"><span class="design-brand">Northwind Atelier — design proof</span> <nav class="design-nav" aria-label="Proof pages"><a href="/">Overview</a> <a href="/service">Finished page</a> <a href="/workbench">Workbench</a></nav></header> `);
  children($$renderer);
  $$renderer.push(`<!----></div>`);
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-DYOu93k2.js.map
