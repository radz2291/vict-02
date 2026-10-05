function load(event) {
  return {
    id: event.params.id,
    actorRole: event.url.searchParams.get("as") === "technician" ? "technician" : "supervisor"
  };
}

var _page_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 3;
let component_cache;
const component = async () => component_cache ??= (await import('./_page.svelte-CIGbrlju.js')).default;
const universal_id = "src/routes/inspection/[id]/+page.ts";
const imports = ["_app/immutable/nodes/3.Cx4QLmUv.js","_app/immutable/chunks/CVa_xE6x.js","_app/immutable/chunks/BOVszMWl.js","_app/immutable/chunks/BXOlZpij.js","_app/immutable/chunks/CmT3yktc.js","_app/immutable/chunks/aqHTk1Mq.js","_app/immutable/chunks/CJt06QAS.js","_app/immutable/chunks/BYNcFcRk.js","_app/immutable/chunks/B4AbNuLJ.js"];
const stylesheets = [];
const fonts = [];

export { component, fonts, imports, index, stylesheets, _page_ts as universal, universal_id };
//# sourceMappingURL=3-BF9TOlCA.js.map
