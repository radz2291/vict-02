const roleGrants = {
  supervisor: ["qlt.inspection.read", "qlt.inspection.approve", "qlt.inspection.reject"],
  technician: [
    "qlt.inspection.read",
    "qlt.inspection.submit",
    "qlt.inspection.revise",
    "qlt.inspection.edit"
  ]
};
function grantsForRole(role) {
  return roleGrants[role] ?? ["qlt.inspection.read"];
}
function seedDomain() {
  const now = "2026-10-06T09:00:00.000Z";
  return {
    inspections: [
      {
        id: "i-101",
        title: "Cold-chain compressor room",
        status: "submitted",
        technician: "t.nguyen",
        supervisor: "s.hart",
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 3
      },
      {
        id: "i-102",
        title: "Dock leveller hydraulics",
        status: "submitted",
        technician: "t.nguyen",
        supervisor: "s.hart",
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 2
      },
      {
        id: "i-103",
        title: "Fire shutter mechanism",
        status: "submitted",
        technician: "m.osei",
        supervisor: "s.hart",
        submittedAt: now,
        decidedAt: null,
        rejectionReason: null,
        domainRevision: 1
      }
    ],
    findings: [
      {
        id: "f-1",
        inspectionId: "i-101",
        severity: "high",
        description: "Seal wear beyond tolerance"
      },
      {
        id: "f-2",
        inspectionId: "i-101",
        severity: "low",
        description: "Label fade on shutoff valve"
      },
      {
        id: "f-3",
        inspectionId: "i-102",
        severity: "medium",
        description: "Hydraulic weep at fitting 4B"
      }
    ],
    evidence: [
      { id: "e-1", inspectionId: "i-101", label: "Compressor seal photo", kind: "image-ref" },
      { id: "e-2", inspectionId: "i-101", label: "Torque log excerpt", kind: "note" },
      { id: "e-3", inspectionId: "i-102", label: "Fitting 4B close-up", kind: "image-ref" }
    ],
    activity: [
      {
        id: "a-1",
        inspectionId: "i-101",
        at: now,
        actor: "t.nguyen",
        entry: "Inspection submitted for decision"
      },
      {
        id: "a-2",
        inspectionId: "i-102",
        at: now,
        actor: "t.nguyen",
        entry: "Inspection submitted for decision"
      },
      {
        id: "a-3",
        inspectionId: "i-103",
        at: now,
        actor: "m.osei",
        entry: "Inspection submitted for decision"
      }
    ]
  };
}
class InspectionDataAdapter {
  id = "vict.inspection-memory";
  revision = "1";
  #inspections;
  #findings;
  #evidence;
  #activity;
  constructor(seed) {
    this.#inspections = seed.inspections.map((row) => ({ ...row }));
    this.#findings = seed.findings.map((row) => ({ ...row }));
    this.#evidence = seed.evidence.map((row) => ({ ...row }));
    this.#activity = seed.activity.map((row) => ({ ...row }));
  }
  query(request, context) {
    if (!context.permissions.includes("qlt.inspection.read")) {
      return Promise.resolve({ ok: false, code: "DATA_UNAUTHORIZED", message: "Read denied." });
    }
    if (request.op === "list") {
      const resourceId = request.resourceId;
      if (resourceId === "inspection") {
        return Promise.resolve({
          ok: true,
          rows: this.#inspections.map((row) => this.joined(row))
        });
      }
      if (resourceId === "activity") {
        return Promise.resolve({ ok: true, rows: [...this.#activity] });
      }
      return Promise.resolve({
        ok: false,
        code: "DATA_UNKNOWN_RESOURCE",
        message: `Unknown resource '${resourceId}'.`
      });
    }
    if (request.op === "get") {
      const row = this.#inspections.find((candidate) => candidate.id === request.id);
      if (row === void 0) {
        return Promise.resolve({
          ok: false,
          code: "DATA_UNKNOWN_IDENTITY",
          message: "No such inspection."
        });
      }
      return Promise.resolve({ ok: true, row: this.joined(row) });
    }
    return Promise.resolve({
      ok: false,
      code: "DATA_UNSUPPORTED_QUERY",
      message: `Unsupported op '${request.op}'.`
    });
  }
  mutate(request, context) {
    if (request.resourceId !== "inspection") {
      return Promise.resolve({
        ok: false,
        code: "DATA_UNKNOWN_RESOURCE",
        message: `Unknown resource '${request.resourceId}'.`
      });
    }
    const row = this.#inspections.find((candidate) => candidate.id === request.id);
    if (row === void 0) {
      return Promise.resolve({
        ok: false,
        code: "DATA_UNKNOWN_IDENTITY",
        message: "No such inspection."
      });
    }
    const input = request.input ?? {};
    const actor = context.actor ?? "unknown";
    const appendActivity = (entry) => {
      this.#activity.push({
        id: `a-${this.#activity.length + 1}`,
        inspectionId: row.id,
        at: (/* @__PURE__ */ new Date()).toISOString(),
        actor,
        entry
      });
    };
    if (request.op === "approve") {
      if (!context.permissions.includes("qlt.inspection.approve")) {
        return Promise.resolve({
          ok: false,
          code: "DATA_UNAUTHORIZED",
          message: "Approve requires qlt.inspection.approve."
        });
      }
      if (row.status !== "submitted") {
        return Promise.resolve({
          ok: false,
          code: "DATA_INVALID_INPUT",
          message: `Approve requires status 'submitted' (found '${row.status}').`
        });
      }
      if (input.expectedDomainRevision !== row.domainRevision) {
        return Promise.resolve({
          ok: false,
          code: "DATA_CONTRACT_REJECTED",
          message: `Stale decision: expected domain revision ${String(input.expectedDomainRevision)}, actual ${String(row.domainRevision)}. State unchanged.`
        });
      }
      row.status = "approved";
      row.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
      row.domainRevision += 1;
      appendActivity("Inspection approved");
      return Promise.resolve({ ok: true, row: this.joined(row) });
    }
    if (request.op === "reject") {
      if (!context.permissions.includes("qlt.inspection.reject")) {
        return Promise.resolve({
          ok: false,
          code: "DATA_UNAUTHORIZED",
          message: "Reject requires qlt.inspection.reject."
        });
      }
      if (row.status !== "submitted") {
        return Promise.resolve({
          ok: false,
          code: "DATA_INVALID_INPUT",
          message: `Reject requires status 'submitted' (found '${row.status}').`
        });
      }
      const reason = input.rejectionReason ?? "";
      if (reason.trim().length === 0) {
        return Promise.resolve({
          ok: false,
          code: "DATA_INVALID_INPUT",
          message: "A rejection reason is mandatory."
        });
      }
      if (input.expectedDomainRevision !== row.domainRevision) {
        return Promise.resolve({
          ok: false,
          code: "DATA_CONTRACT_REJECTED",
          message: `Stale decision: state unchanged.`
        });
      }
      row.status = "rejected";
      row.rejectionReason = reason;
      row.decidedAt = (/* @__PURE__ */ new Date()).toISOString();
      row.domainRevision += 1;
      appendActivity(`Inspection rejected — reason: ${reason}`);
      return Promise.resolve({ ok: true, row: this.joined(row) });
    }
    if (request.op === "revise") {
      if (!context.permissions.includes("qlt.inspection.revise")) {
        return Promise.resolve({
          ok: false,
          code: "DATA_UNAUTHORIZED",
          message: "Revise requires qlt.inspection.revise."
        });
      }
      if (row.status !== "rejected") {
        return Promise.resolve({
          ok: false,
          code: "DATA_INVALID_INPUT",
          message: `Revise requires status 'rejected' (found '${row.status}').`
        });
      }
      if (actor !== row.technician) {
        return Promise.resolve({
          ok: false,
          code: "DATA_UNAUTHORIZED",
          message: "Only the assigned technician may revise."
        });
      }
      row.status = "draft";
      row.decidedAt = null;
      row.rejectionReason = null;
      row.domainRevision += 1;
      appendActivity("Revise requested — returned to draft for corrections");
      return Promise.resolve({ ok: true, row: this.joined(row) });
    }
    return Promise.resolve({
      ok: false,
      code: "DATA_MUTATION_NOT_DECLARED",
      message: `Mutation '${request.op}' is not declared.`
    });
  }
  /** Materialize the joined child collections (adapter-owned projection). */
  joined(row) {
    return {
      ...row,
      findings: this.#findings.filter((finding) => finding.inspectionId === row.id),
      evidence: this.#evidence.filter((item) => item.inspectionId === row.id),
      activity: this.#activity.filter((item) => item.inspectionId === row.id)
    };
  }
  /** Direct read for server-side dispatch (already permission-checked callers). */
  activityFor(inspectionId) {
    return this.#activity.filter((row) => row.inspectionId === inspectionId);
  }
}
function createInspectionServer(data) {
  return {
    adapter: data,
    async dispatch(actionId, input, actor) {
      const permissions = grantsForRole(actor.role);
      const context = {
        permissions,
        effect: actionId === "inspection.list" ? "read" : "write",
        actor: actor.actorId
      };
      if (actionId === "inspection.list") {
        const result = await data.query({ op: "list", resourceId: "inspection" }, context);
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: { rows: result.rows ?? [] } };
      }
      if (actionId === "inspection.approve") {
        const payload = input ?? {};
        const result = await data.mutate(
          {
            resourceId: "inspection",
            op: "approve",
            id: payload.id,
            input: { expectedDomainRevision: payload.expectedDomainRevision }
          },
          context
        );
        if (!result.ok) return { ok: false, code: result.code, message: result.message };
        return { ok: true, value: result.row };
      }
      return {
        ok: false,
        code: "UNKNOWN_ACTION",
        message: `Action '${actionId}' is not declared.`
      };
    }
  };
}

export { InspectionDataAdapter as I, createInspectionServer as c, grantsForRole as g, seedDomain as s };
//# sourceMappingURL=domain-DMh9RB7j.js.map
