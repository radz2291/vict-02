import { e as escape_html, b as ensure_array_like, c as attr } from './index.js-BVAQDQEm.js';
import { g as grantsForRole } from './domain-DMh9RB7j.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    $$renderer2.push(`<main class="app-page svelte-1uha8ag"><header class="app-header svelte-1uha8ag"><h1 class="svelte-1uha8ag">Inspection queue</h1> <p class="app-subtitle svelte-1uha8ag">Viewing as <strong>${escape_html(data.actorRole)}</strong> · decisions require the supervisor role (enforced at the
      adapter boundary, not by button visibility)</p></header> <ul class="queue svelte-1uha8ag" aria-label="Submitted inspections"><!--[-->`);
    const each_array = ensure_array_like(data.rows);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let row = each_array[$$index];
      $$renderer2.push(`<li class="queue-row svelte-1uha8ag"><a class="queue-link svelte-1uha8ag"${attr("href", `/inspection/${String(row.id)}?as=${data.actorRole}`)}><span class="queue-title svelte-1uha8ag">${escape_html(String(row.title))}</span> <span class="queue-status svelte-1uha8ag"${attr("data-status", String(row.status))}>${escape_html(String(row.status))}</span></a></li>`);
    }
    $$renderer2.push(`<!--]--></ul> <p class="app-note svelte-1uha8ag">Grants for this role: ${escape_html(grantsForRole(data.actorRole).join(", "))}</p></main>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-BQqzStsS.js.map
