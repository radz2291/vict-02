import { c as createInspectionServer, I as InspectionDataAdapter, s as seedDomain } from './domain-DMh9RB7j.js';

function load(event) {
  const server = createInspectionServer(new InspectionDataAdapter(seedDomain()));
  return server.dispatch("inspection.list", {}, { role: "supervisor", actorId: "server" }).then((result) => ({
    actorRole: event.url.searchParams.get("as") === "technician" ? "technician" : "supervisor",
    rows: result.ok ? result.value.rows ?? [] : []
  }));
}

var _page_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 2;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-BQqzStsS.js')).default;
const universal_id = "src/routes/+page.ts";
const imports = ["_app/immutable/nodes/2.C7gpW3rg.js","_app/immutable/chunks/B4AbNuLJ.js","_app/immutable/chunks/CVa_xE6x.js","_app/immutable/chunks/BOVszMWl.js","_app/immutable/chunks/BXOlZpij.js","_app/immutable/chunks/BYNcFcRk.js"];
const stylesheets = ["_app/immutable/assets/2.DGtExnH_.css"];
const fonts = [];

export { component, fonts, imports, index, stylesheets, _page_ts as universal, universal_id };
//# sourceMappingURL=2-BHymSKfw.js.map
