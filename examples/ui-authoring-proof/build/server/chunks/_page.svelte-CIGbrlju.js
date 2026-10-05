import { h as head, c as attr, d as stringify, e as escape_html, f as attr_class, i as derived } from './index.js-BVAQDQEm.js';
import { i as inspectionPlan, D as DocumentHost } from './compile-DzXXxGCi.js';
import { c as createInspectionServer, I as InspectionDataAdapter, s as seedDomain, g as grantsForRole } from './domain-DMh9RB7j.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    const { detailPlan } = inspectionPlan();
    const server = createInspectionServer(new InspectionDataAdapter(seedDomain()));
    let state = {
      record: null,
      activity: [],
      feedback: { kind: "idle", message: "" }
    };
    async function loadDetail(id) {
      const result = await server.dispatch("inspection.list", {}, { role: data.actorRole, actorId: "server" });
      const rows = result.ok ? result.value.rows : [];
      const record = rows.find((row) => row.id === id) ?? null;
      state = { ...state, record, activity: server.adapter.activityFor(id) };
    }
    loadDetail(data.id);
    const viewScope = derived(() => ({
      findings: state.record?.["findings"] ?? [],
      evidence: state.record?.["evidence"] ?? [],
      activity: state.activity.map((row) => ({ entry: row.entry, actor: row.actor }))
    }));
    head("fyx8g7", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`<style>
    /* Product shell presentation (not document source) */
    .app-page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 24px;
      font-family: system-ui, sans-serif;
      color: #1c2430;
    }
    .app-header h1 {
      font-size: 1.4rem;
      margin: 0 0 4px;
    }
    .app-subtitle {
      color: #5b6572;
      margin: 0 0 20px;
      font-size: 0.9rem;
    }
    .decision-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 16px 0;
    }
    .decision-button {
      font: inherit;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #0a6c96;
      background: #0a6c96;
      color: white;
      cursor: pointer;
    }
    .decision-button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .feedback {
      font-size: 0.9rem;
      padding: 8px 12px;
      border-radius: 8px;
    }
    .feedback-success {
      background: #e5f6ec;
      color: #116337;
    }
    .feedback-error {
      background: #fdeaea;
      color: #8f1f1f;
    }
    .feedback-pending {
      background: #eef2f7;
      color: #33445c;
    }
    .queue-status,
    .app-note {
      font-size: 0.85rem;
      color: #5b6572;
    }
  </style>`);
    });
    $$renderer2.push(`<main class="app-page"><nav class="app-subtitle" aria-label="Breadcrumb"><a${attr("href", `/?as=${stringify(data.actorRole)}`)}>← Queue</a> · viewing as <strong>${escape_html(data.actorRole)}</strong> (${escape_html(grantsForRole(data.actorRole).join(", "))})</nav> `);
    if (state.feedback.kind !== "idle") {
      $$renderer2.push(`<!--[0--><p${attr_class(`feedback feedback-${stringify(state.feedback.kind)}`)} role="status">${escape_html(state.feedback.message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (state.record !== null) {
      $$renderer2.push("<!--[0-->");
      DocumentHost($$renderer2, {
        plan: detailPlan,
        view: viewScope(),
        record: state.record,
        dispatch: async () => ({ ok: true }),
        navigate: () => void 0,
        ariaLabel: "Inspection detail"
      });
      $$renderer2.push(`<!----> <div class="decision-bar"><button type="button" class="decision-button"${attr("disabled", state.feedback.kind === "pending", true)}>${escape_html(state.feedback.kind === "pending" ? "Recording decision…" : "Approve this inspection")}</button> <span class="app-note">The document’s Approve button and this control dispatch the SAME declared action through the SAME
        adapter boundary.</span></div>`);
    } else {
      $$renderer2.push(`<!--[-1--><p role="alert">Inspection not found.</p>`);
    }
    $$renderer2.push(`<!--]--></main>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-CIGbrlju.js.map
