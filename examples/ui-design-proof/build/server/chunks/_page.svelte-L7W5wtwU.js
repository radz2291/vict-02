import { b as ensure_array_like, e as escape_html, c as attr } from './index.js-DY7Rze5x.js';
import { c as compileUiDocument, D as DocumentHost, d as designCatalogs, s as serviceDocument, r as readContactFields, v as validateContact } from './service-document-qhvxONqo.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const compiled = compileUiDocument(serviceDocument, designCatalogs.elements, [], {
      actionIds: designCatalogs.actionIds,
      routeIds: designCatalogs.routeIds,
      viewFields: designCatalogs.viewFields
    });
    let outcome = null;
    let feedbackEl = void 0;
    function focusFeedback() {
      requestAnimationFrame(() => feedbackEl?.focus());
    }
    async function dispatch(actionId) {
      if (actionId === "design.submitContact") {
        const fields = readContactFields(document.body);
        const result = validateContact(fields);
        outcome = result;
        focusFeedback();
        return result;
      }
      return {
        status: "denied",
        heading: `Unknown action ${actionId}`,
        issues: []
      };
    }
    function navigate() {
    }
    if (compiled.ok) {
      $$renderer2.push("<!--[0-->");
      DocumentHost($$renderer2, {
        plan: compiled.plan,
        dispatch,
        navigate,
        as: "article",
        ariaLabel: "Northwind Atelier home page"
      });
    } else {
      $$renderer2.push(`<!--[-1--><div role="alert" style="max-width: 720px; margin: 40px auto; font-family: system-ui">The page document does not compile: <ul><!--[-->`);
      const each_array = ensure_array_like(compiled.issues);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let issue = each_array[$$index];
        $$renderer2.push(`<li>${escape_html(issue.code)}: ${escape_html(issue.message)}</li>`);
      }
      $$renderer2.push(`<!--]--></ul></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (outcome !== null) {
      $$renderer2.push(`<!--[0--><div class="design-form-feedback"${attr("data-status", outcome.status)} id="design-form-feedback" role="status" tabindex="-1"><strong>${escape_html(outcome.heading)}</strong> `);
      if (outcome.status === "ok") {
        $$renderer2.push(`<!--[0--><p style="margin: 6px 0 0">${escape_html(outcome.detail)}</p>`);
      } else {
        $$renderer2.push(`<!--[-1--><ul><!--[-->`);
        const each_array_1 = ensure_array_like(outcome.issues);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let issue = each_array_1[$$index_1];
          $$renderer2.push(`<li>${escape_html(issue.message)}</li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-L7W5wtwU.js.map
