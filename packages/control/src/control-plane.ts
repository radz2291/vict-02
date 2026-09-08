import {
  ActorScopeDeniedError,
  ActivationCatalog,
  ActivationSelection,
  AgentControlStores,
  ApplicationReleaseRecord,
  ChangeSetApprovalDecision,
  ChangeSetBase,
  ChangeSetOperation,
  ChangeSetOperationReceipt,
  ChangeSetRecord,
  ChangeSetSimulationEvidence,
  ChangeSetValidationEvidence,
  ControlAuditEvent,
  ControlRunDetail,
  ControlRunKind,
  ControlRunOperationOutcome,
  ControlRunRecord,
  ReleaseSelectionRecord,
  VictStoreError,
  changeSetOperationIdentity,
  controlContentHash,
} from '@vict/runtime';
import {
  authenticatedActorContext,
  captureClosedControlArray,
  captureClosedControlRecord,
  CHANGESET_BASE_NONE,
  CHANGESET_SCHEMA,
  VictControlError,
  validateApplicationReleaseContent,
  validateChangeSetContent,
  type ActorRecord,
  type ActorDirectory,
  type AuthenticatedActorContext,
  type ControlAuditAction,
  ACTOR_SCOPES,
  type ActorScope,
} from '@vict/runtime';

/**
 * Stage 06B — the ChangeSet and Application Release governance service.
 *
 * State machines (closed, forward-only):
 *
 * ```text
 * ChangeSet: draft → approved → committed | declined | expired
 *            draft ──(content revise)──→ draft  (NEW contentHash; earlier
 *                                               evidence and approvals are
 *                                               invalidated)
 * ```
 *
 * Requirements enforced here:
 * - stale-base proposals fail WITHOUT mutation (CTRL-002);
 * - approval binds to the exact immutable content hash;
 * - committing creates or selects immutable versions — never in-place edits
 *   (CTRL-003);
 * - commit is idempotent; competing commits have one truthful winner;
 * - rollback selects a prior immutable version for future work and never
 *   rewrites history or affects pinned in-flight runs (CTRL-005/DATA-009);
 * - every transition is attributable and audited (CTRL-007).
 */

export interface ControlPlaneServiceOptions {
  readonly stores: AgentControlStores;
  /** The activation catalog (publish/select of immutable activations). */
  readonly catalog: ActivationCatalog;
  /** Injected clock (epoch ms). */
  readonly clock?: () => number;
  /** Injected id factory (changeset, approval, audit, run ids). */
  readonly ids?: {
    changesetId(): string;
    changesetApprovalId(): string;
    auditId(): string;
    controlRunId(): string;
  };
  /**
   * The safe simulation boundary for `simulation` runs. When absent,
   * simulation runs are BLOCKED (never passed): a second copy of
   * prevalidation is not simulation evidence.
   */
  readonly simulator?: ChangeSetSimulator;
}

/** The authoritative actor resolution input (server-side truth only). */
export interface ActorAuthority {
  /** The actor record resolved from the directory by the composition. */
  readonly actor: ActorRecord | undefined;
  /** The actor id the request presents (must match the record). */
  readonly actorId: string;
}

/**
 * The subject-level guard carried by one operation: the expected base
 * version (release subjects) or the expected selection revision
 * (activation subjects) that must hold AT THE TARGET MUTATION. This is
 * the fencing data that makes two ChangeSets racing on ONE base produce
 * exactly one winner.
 */
export interface OperationGuard {
  readonly expectedBaseVersion?: string;
  /**
   * The expected activation-selection guard AT THE TARGET MUTATION: a
   * number fences on that selection revision; the literal `'none'`
   * fences on an EXPLICIT ABSENCE of any current selection (never
   * overload `undefined` — that means NO guard was supplied).
   */
  readonly expectedSelectionRevision?: number | 'none';
  /** The stable operation identity (idempotency anchor) for the effect. */
  readonly operationId?: string;
}

/** Resolve the authoritative actor context or fail closed. */
export function resolveActorContext(
  directory: ActorDirectory,
  actorId: string,
): Promise<AuthenticatedActorContext> {
  return (async () => {
    const actor = await directory.get(actorId);
    return authenticatedActorContext(actor, actorId);
  })();
}

/** One ChangeSet proposal input (validated; content hash derived).
 *
 * SAFETY: the COMPLETE untrusted input object is captured through guarded
 * descriptors before any member is read (exact closed field set; accessors,
 * symbols, and hostile/revoked containers are rejected with ONE stable
 * non-echoing error) — a direct package caller can never invoke a getter on
 * this boundary either.
 */
export interface ProposeChangeSetInput {
  readonly changesetId: string;
  readonly base: ChangeSetRecord['base'];
  readonly operations: readonly unknown[];
  readonly rationale: string;
  readonly riskClass: ChangeSetRecord['riskClass'];
  readonly requiredApproverCount: number;
  readonly expiresAt: number;
}

/** The exact closed field set of the direct propose entry point. */
const PROPOSE_INPUT_FIELDS: readonly string[] = [
  'changesetId',
  'base',
  'operations',
  'rationale',
  'riskClass',
  'requiredApproverCount',
  'expiresAt',
];

/** The exact closed field set of the direct revise entry point. */
const REVISE_INPUT_FIELDS: readonly string[] = [
  'changesetId',
  'operations',
  'rationale',
  'riskClass',
  'requiredApproverCount',
  'expiresAt',
];

export class ControlPlaneService {
  readonly #stores: AgentControlStores;
  readonly #catalog: ActivationCatalog;
  readonly #clock: () => number;
  readonly #ids: Required<NonNullable<ControlPlaneServiceOptions['ids']>>;
  readonly #simulator: ChangeSetSimulator | undefined;

  constructor(options: ControlPlaneServiceOptions) {
    this.#stores = options.stores;
    this.#catalog = options.catalog;
    this.#clock = options.clock ?? (() => Date.now());
    this.#simulator = options.simulator;
    this.#ids = {
      changesetId: options.ids?.changesetId ?? (() => failRandomIds()),
      changesetApprovalId: options.ids?.changesetApprovalId ?? (() => failRandomIds()),
      auditId: options.ids?.auditId ?? (() => failRandomIds()),
      controlRunId: options.ids?.controlRunId ?? (() => failRandomIds()),
    };
  }

  /**
   * Propose a ChangeSet. The proposal is created in `draft` with its
   * immutable content identity; NO mutation of active behavior occurs.
   */
  async propose(
    actor: AuthenticatedActorContext,
    input: ProposeChangeSetInput,
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.propose');
    // The DIRECT package entry point captures the complete untrusted input
    // BEFORE reading any member: hostile getters on ANY outer field never
    // run, and no raw exception can cross this boundary.
    const captured = captureClosedControlRecord(
      input,
      'ChangeSet proposal',
      PROPOSE_INPUT_FIELDS,
    ) as {
      changesetId: unknown;
      base: unknown;
      operations: unknown;
      rationale: unknown;
      riskClass: unknown;
      requiredApproverCount: unknown;
      expiresAt: unknown;
    };
    const validated = validateChangeSetContent({
      changesetId: captured.changesetId,
      authorActorId: actor.actorId,
      createdAt: this.#clock(),
      base: captured.base,
      operations: captureClosedControlArray(captured.operations, 'ChangeSet operation list', 64),
      rationale: captured.rationale,
      riskClass: captured.riskClass,
      requiredApproverCount: captured.requiredApproverCount,
      expiresAt: captured.expiresAt,
    });
    const record: ChangeSetRecord = {
      changesetId: validated.changesetId,
      schema: CHANGESET_SCHEMA,
      authorActorId: actor.actorId,
      createdAt: this.#clock(),
      base: validated.base,
      operations: validated.operations,
      rationale: validated.rationale,
      riskClass: validated.riskClass,
      requiredApproverCount: validated.requiredApproverCount,
      expiresAt: validated.expiresAt,
      validation: undefined,
      simulation: undefined,
      contentHash: validated.contentHash,
      status: 'draft',
    };
    await this.#stores.control.saveChangeSet(record);
    await this.#audit(
      actor.actorId,
      'changeset.proposed',
      'changeset',
      record.changesetId,
      'draft proposal recorded',
    );
    return record;
  }

  /**
   * Revise a DRAFT ChangeSet's content. The revision derives a NEW content
   * hash; earlier validation, simulation, and approval decisions for the
   * previous content are invalidated (they bind to the old hash).
   */
  async revise(
    actor: AuthenticatedActorContext,
    input: {
      changesetId: string;
      operations: readonly unknown[];
      rationale: string;
      riskClass: ChangeSetRecord['riskClass'];
      requiredApproverCount: number;
      expiresAt: number;
    },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.revise');
    // Same direct-boundary capture discipline as `propose`: the untrusted
    // input is captured before any member is read.
    const captured = captureClosedControlRecord(
      input,
      'ChangeSet revision',
      REVISE_INPUT_FIELDS,
    ) as {
      changesetId: unknown;
      operations: unknown;
      rationale: unknown;
      riskClass: unknown;
      requiredApproverCount: unknown;
      expiresAt: unknown;
    };
    const capturedOperations = captureClosedControlArray(
      captured.operations,
      'ChangeSet operation list',
      64,
    );
    if (typeof captured.changesetId !== 'string') {
      throw new VictControlError('VICT_CONTROL_FIELD_INVALID', 'the ChangeSet id is malformed.');
    }
    const changesetId: string = captured.changesetId;
    const updated = await this.#stores.control.reviseChangeSetContent(changesetId, (record) => {
      if (record.status !== 'draft' && record.status !== 'approved') {
        throw new VictControlError(
          'VICT_CONTROL_CHANGESET_NOT_DRAFT',
          'Only a draft or approved ChangeSet may be revised.',
        );
      }
      if (record.authorActorId !== actor.actorId) {
        throw new VictControlError(
          'VICT_CONTROL_CHANGESET_AUTHOR_MISMATCH',
          'Only the author actor may revise a draft ChangeSet.',
        );
      }
      const validated = validateChangeSetContent({
        changesetId: record.changesetId,
        authorActorId: record.authorActorId,
        createdAt: record.createdAt,
        base: record.base,
        operations: capturedOperations,
        rationale: captured.rationale,
        riskClass: captured.riskClass,
        requiredApproverCount: captured.requiredApproverCount,
        expiresAt: captured.expiresAt,
      });
      // Changing content invalidates earlier evidence and approvals: the
      // new record carries NO evidence and approvals for the OLD content
      // hash can never satisfy the new one.
      return {
        ...record,
        base: validated.base,
        operations: validated.operations,
        rationale: validated.rationale,
        riskClass: validated.riskClass,
        requiredApproverCount: validated.requiredApproverCount,
        expiresAt: validated.expiresAt,
        validation: undefined,
        simulation: undefined,
        contentHash: validated.contentHash,
        status: 'draft',
      };
    });
    await this.#audit(
      actor.actorId,
      'changeset.revised',
      'changeset',
      changesetId,
      'content revised',
    );
    return updated;
  }

  /** Attach authoritative validation evidence (draft only; attributable).
   *
   * The caller supplies ONLY the identity of an executed run. The evidence
   * record itself (outcome, timestamps, content hash, base binding, runner
   * profile, actor) is DERIVED from the authoritative stored run — a caller
   * can never fabricate `passed`, run outcomes, or timestamps.
   */
  async attachValidationEvidence(
    actor: AuthenticatedActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.propose');
    const record = await this.#requireChangeSet(input.changesetId);
    const run = await this.#verifyEvidenceBinding(actor, record, 'validation', input.runId);
    const evidence: ChangeSetValidationEvidence = {
      runId: run.runId,
      outcome: run.outcome === 'passed' ? 'passed' : 'failed',
      recordedAt: run.createdAt,
      contentHash: run.contentHash,
      base: run.base,
      runnerProfile: run.runnerProfile,
      actorId: run.actorId,
    };
    const updated = await this.#stores.control.updateChangeSet(input.changesetId, (current) => {
      this.#assertDraft(current, input.changesetId);
      return { ...current, validation: evidence };
    });
    await this.#audit(
      actor.actorId,
      'changeset.evidence-attached',
      'changeset',
      input.changesetId,
      'validation evidence derived from an executed run',
    );
    return updated;
  }

  /** Attach authoritative simulation evidence (draft only; attributable).
   * See `attachValidationEvidence` for the binding contract. */
  async attachSimulationEvidence(
    actor: AuthenticatedActorContext,
    input: { changesetId: string; runId: string },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.propose');
    const record = await this.#requireChangeSet(input.changesetId);
    const run = await this.#verifyEvidenceBinding(actor, record, 'simulation', input.runId);
    const evidence: ChangeSetSimulationEvidence = {
      runId: run.runId,
      outcome: run.outcome === 'passed' ? 'passed' : run.outcome,
      recordedAt: run.createdAt,
      contentHash: run.contentHash,
      base: run.base,
      runnerProfile: run.runnerProfile,
      actorId: run.actorId,
    };
    const updated = await this.#stores.control.updateChangeSet(input.changesetId, (current) => {
      this.#assertDraft(current, input.changesetId);
      return { ...current, simulation: evidence };
    });
    await this.#audit(
      actor.actorId,
      'changeset.evidence-attached',
      'changeset',
      input.changesetId,
      'simulation evidence derived from an executed run',
    );
    return updated;
  }

  /**
   * Record one approval decision. The decision binds to the ChangeSet's
   * CURRENT immutable content hash; decisions against older content can
   * never satisfy a revised proposal. The first durable decision per
   * approver wins; identical duplicates are idempotent; competing
   * decisions fail with one truthful winner.
   */
  async decide(
    actor: AuthenticatedActorContext,
    input: { changesetId: string; decision: 'approved' | 'declined'; reason?: string },
  ): Promise<{ record: ChangeSetRecord; decision: ChangeSetApprovalDecision }> {
    this.#assertScope(
      actor,
      input.decision === 'approved' ? 'changeset.approve' : 'changeset.approve',
    );
    const record = await this.#requireChangeSet(input.changesetId);
    if (record.status === 'expired') {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_EXPIRED',
        'The ChangeSet expired and can no longer be decided.',
      );
    }
    if (record.status !== 'draft') {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_NOT_DRAFT',
        'The ChangeSet is no longer open for decisions.',
      );
    }
    if (record.expiresAt <= this.#clock()) {
      await this.#stores.control.updateChangeSet(record.changesetId, (current) => ({
        ...current,
        status: 'expired',
      }));
      await this.#audit(
        actor.actorId,
        'changeset.expired',
        'changeset',
        record.changesetId,
        'expired at decision time',
      );
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_EXPIRED',
        'The ChangeSet expired and can no longer be decided.',
      );
    }
    const decision: ChangeSetApprovalDecision = {
      approvalId: this.#ids.changesetApprovalId(),
      changesetId: record.changesetId,
      contentHash: record.contentHash,
      approverActorId: actor.actorId,
      decision: input.decision,
      decidedAt: this.#clock(),
    };
    await this.#stores.control.recordChangeSetApproval(decision);
    await this.#audit(
      actor.actorId,
      input.decision === 'approved' ? 'changeset.approved' : 'changeset.declined',
      'changeset',
      record.changesetId,
      'decision recorded',
    );

    // Promote to `approved` when enough DISTINCT approvers have approved the
    // CURRENT content hash.
    const approvals = await this.#stores.control.listChangeSetApprovals(record.changesetId);
    const approvalsForCurrentContent = approvals.filter(
      (entry) => entry.contentHash === record.contentHash && entry.decision === 'approved',
    );
    if (
      approvalsForCurrentContent.length >= record.requiredApproverCount &&
      record.status === 'draft'
    ) {
      await this.#stores.control.updateChangeSet(record.changesetId, (current) => ({
        ...current,
        status: 'approved',
      }));
    }
    const final = await this.#requireChangeSet(record.changesetId);
    return { record: final, decision };
  }

  /**
   * The runner/profile identity of THIS trusted VICT boundary. Every
   * authoritative governance run executed here is recorded with it.
   */
  static readonly RUNNER_PROFILE = 'vict.control-plane@1';

  /**
   * Execute ONE authoritative governance run through the trusted VICT
   * boundary and record it durably. The two run kinds are genuinely
   * DIFFERENT executions:
   *
   * - `validation` performs the defined structural, identity,
   *   compatibility, stale-base and policy checks (authoritative
   *   prevalidation of the complete operation set against current durable
   *   state);
   * - `simulation` EXECUTES the proposed behavior through the composed
   *   safe simulation boundary (real doubles, no irreversible effects) and
   *   records the exact run identity, activation/release inputs, operation
   *   identities, per-operation outcomes and the simulator/profile version.
   *   Without a composed simulator the run is BLOCKED — never silently
   *   replaced by a copy of validation.
   *
   * Callers cannot fabricate run identities, outcomes, or timestamps —
   * they can only execute a run and reference its stable id afterwards.
   */
  async executeChangeSetCheck(
    actor: AuthenticatedActorContext,
    input: {
      changesetId: string;
      kind: ControlRunKind;
      runId?: string;
    },
  ): Promise<ControlRunRecord> {
    this.#assertScope(actor, 'changeset.propose');
    const record = await this.#requireChangeSet(input.changesetId);
    if (record.status !== 'draft') {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_NOT_DRAFT',
        'Governance runs execute against draft ChangeSets only.',
      );
    }
    const operationIdentities = record.operations.map((operation, index) =>
      changeSetOperationIdentity({
        changesetId: record.changesetId,
        contentHash: record.contentHash,
        operationIndex: index,
        operation,
      }),
    );
    let outcome: ControlRunRecord['outcome'];
    let detail: ControlRunDetail | undefined;
    // The OBSERVED subject base at run time (what this run actually
    // verified), captured as the safe base identity with the
    // CHANGESET_BASE_NONE sentinel for explicit absence. The run record
    // proves exactly what was checked — never a caller claim.
    const observedVersion = await this.#selectedVersionFor(record.base);
    const observedBase: ChangeSetBase = {
      kind: record.base.kind,
      subjectId: record.base.subjectId,
      expectedVersion: observedVersion ?? CHANGESET_BASE_NONE,
    };
    if (input.kind === 'validation') {
      // Authoritative prevalidation of the COMPLETE operation set against
      // the current durable state (never a caller claim). The declared
      // base must be the CURRENT subject selection (including explicit
      // expected absence): a stale base is ALWAYS blocked, never passed.
      outcome = 'passed';
      try {
        this.#verifyDeclaredBase(record.base, observedVersion);
        await this.#prevalidateOperations(record);
      } catch (error) {
        if (
          error instanceof VictControlError &&
          (error.code === 'VICT_CONTROL_RELEASE_MISSING' ||
            error.code === 'VICT_CONTROL_BASE_STALE' ||
            error.code === 'VICT_CONTROL_RELEASE_INVALID' ||
            error.code === 'VICT_CONTROL_OPERATION_INVALID')
        ) {
          outcome = 'blocked';
        } else {
          throw error;
        }
      }
    } else {
      // SIMULATION: real execution through the safe simulation boundary.
      // The simulation starts from and verifies the SAME exact base as
      // validation: a stale base is blocked BEFORE the sandbox runs (the
      // sandbox is never allowed to pass a base the durable state does
      // not match).
      const expectedVersion =
        record.base.expectedVersion === CHANGESET_BASE_NONE
          ? undefined
          : record.base.expectedVersion;
      if (observedVersion !== expectedVersion) {
        outcome = 'blocked';
        detail = {
          simulator: this.#simulator?.simulatorId ?? 'unavailable',
          inputs: { base: record.base, operationIdentities },
          operations: [],
        };
      } else if (this.#simulator === undefined) {
        // No simulator composed: simulation is BLOCKED (fail closed) —
        // validation is never accepted as a substitute.
        outcome = 'blocked';
        detail = {
          simulator: 'unavailable',
          inputs: { base: record.base, operationIdentities },
          operations: record.operations.map((operation, index) => ({
            operationIndex: index,
            operationDigest: operationIdentities[index] as string,
            outcome: 'blocked' as const,
            code: 'VICT_CONTROL_SIMULATOR_UNAVAILABLE',
          })),
        };
      } else {
        const simulation = await this.#simulator.simulate({
          record,
          operationIdentities,
        });
        outcome = simulation.outcome;
        detail = {
          simulator: this.#simulator.simulatorId,
          inputs: { base: record.base, operationIdentities },
          operations: simulation.operations,
        };
      }
    }
    const run: ControlRunRecord = {
      runId: input.runId ?? this.#ids.controlRunId(),
      kind: input.kind,
      changesetId: record.changesetId,
      contentHash: record.contentHash,
      base: record.base,
      operations: record.operations,
      runnerProfile: ControlPlaneService.RUNNER_PROFILE,
      actorId: actor.actorId,
      outcome,
      createdAt: this.#clock(),
      observedBase,
      ...(detail !== undefined ? { detail } : {}),
    };
    await this.#stores.control.recordControlRun(run);
    await this.#audit(
      actor.actorId,
      'changeset.evidence-attached',
      'changeset',
      record.changesetId,
      `${input.kind} run executed (${outcome})`,
    );
    return run;
  }

  /**
   * Verify that caller-presented evidence binds to an EXECUTED authoritative
   * run with the exact subject identity. Rejections are structured and
   * never echo the presented values.
   */
  async #verifyEvidenceBinding(
    actor: AuthenticatedActorContext,
    record: ChangeSetRecord,
    kind: ControlRunKind,
    runId: string,
  ): Promise<ControlRunRecord> {
    const run = await this.#stores.control.getControlRun(runId);
    if (run === undefined) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE',
        'The referenced run was not executed by the trusted VICT boundary.',
      );
    }
    if (run.kind !== kind) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE',
        'The referenced run kind does not match the evidence kind.',
      );
    }
    if (run.changesetId !== record.changesetId) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_SUBJECT_MISMATCH',
        'The referenced run was executed for a different ChangeSet.',
      );
    }
    if (run.contentHash !== record.contentHash) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_CONTENT_MISMATCH',
        'The referenced run was executed against different ChangeSet content.',
      );
    }
    if (
      run.base.subjectId !== record.base.subjectId ||
      run.base.kind !== record.base.kind ||
      run.base.expectedVersion !== record.base.expectedVersion
    ) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_BASE_MISMATCH',
        'The referenced run was executed against a different base identity.',
      );
    }
    if (run.runnerProfile !== ControlPlaneService.RUNNER_PROFILE) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE',
        'The referenced run was not executed by the composed VICT runner.',
      );
    }
    if (run.actorId !== actor.actorId) {
      throw new VictControlError(
        'VICT_CONTROL_EVIDENCE_ACTOR_MISMATCH',
        'The referenced run was executed for a different authenticated actor.',
      );
    }
    return run;
  }

  /**
   * The closed risk/effect evidence policy for commits. low-risk ChangeSets
   * require an authoritative PASSED validation run; medium- and high-risk
   * ChangeSets additionally require an authoritative PASSED simulation run.
   */
  #requiredEvidenceFor(record: ChangeSetRecord): readonly ControlRunKind[] {
    switch (record.riskClass) {
      case 'low':
        return ['validation'];
      case 'medium':
      case 'high':
        return ['validation', 'simulation'];
    }
  }

  /** Verify commit-time evidence against the risk policy and stored runs. */
  async #verifyCommitEvidence(record: ChangeSetRecord): Promise<void> {
    const required = this.#requiredEvidenceFor(record);
    for (const kind of required) {
      const evidence = kind === 'validation' ? record.validation : record.simulation;
      if (evidence === undefined) {
        throw new VictControlError(
          'VICT_CONTROL_EVIDENCE_MISSING',
          `Commit requires an executed ${kind} run for this risk class (${record.riskClass}).`,
        );
      }
      // The evidence must bind the CURRENT content hash and base.
      if (evidence.contentHash !== record.contentHash) {
        throw new VictControlError(
          'VICT_CONTROL_EVIDENCE_STALE',
          `The ${kind} evidence binds different ChangeSet content (revised proposals invalidate evidence).`,
        );
      }
      if (
        evidence.base.kind !== record.base.kind ||
        evidence.base.subjectId !== record.base.subjectId ||
        evidence.base.expectedVersion !== record.base.expectedVersion
      ) {
        throw new VictControlError(
          'VICT_CONTROL_EVIDENCE_STALE',
          `The ${kind} evidence binds a different base identity.`,
        );
      }
      // The evidence must reference an authoritative executed run whose
      // durable outcome was PASSED (replayed/fabricated evidence cannot
      // authorize a commit).
      const run = await this.#stores.control.getControlRun(evidence.runId);
      if (
        run === undefined ||
        run.kind !== kind ||
        run.changesetId !== record.changesetId ||
        run.contentHash !== record.contentHash ||
        run.runnerProfile !== ControlPlaneService.RUNNER_PROFILE
      ) {
        throw new VictControlError(
          'VICT_CONTROL_EVIDENCE_NOT_AUTHORITATIVE',
          `The ${kind} evidence does not reference a matching executed run.`,
        );
      }
      if (run.outcome !== 'passed') {
        throw new VictControlError(
          'VICT_CONTROL_EVIDENCE_FAILED',
          `The executed ${kind} run did not pass (${run.outcome}); commit is blocked.`,
        );
      }
    }
  }

  /**
   * Verify the DECLARED base is the CURRENT subject selection (including
   * explicit expected absence). A stale base can never pass validation —
   * the mutation-time commit CAS remains mandatory regardless (earlier
   * evidence never replaces mutation-time fencing).
   */
  #verifyDeclaredBase(base: ChangeSetRecord['base'], observedVersion: string | undefined): void {
    const expected =
      base.expectedVersion === CHANGESET_BASE_NONE ? undefined : base.expectedVersion;
    if (observedVersion !== expected) {
      throw new VictControlError(
        'VICT_CONTROL_BASE_STALE',
        'The ChangeSet base is stale: the declared base is not the current subject selection.',
      );
    }
  }

  /**
   * Prevalidate the COMPLETE operation set against current durable state
   * BEFORE any mutation. A commit that would fail mid-application must fail
   * here instead, so no partial external state is ever created.
   */
  async #prevalidateOperations(record: ChangeSetRecord): Promise<void> {
    for (const operation of record.operations) {
      switch (operation.kind) {
        case 'select-activation':
        case 'rollback-activation': {
          const target =
            operation.kind === 'select-activation'
              ? operation.activationVersion
              : operation.targetActivationVersion;
          const activation = await this.#catalog.get(target);
          if (activation === undefined || activation.graphId !== operation.graphId) {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_INVALID',
              'The referenced activation does not exist for this graph.',
            );
          }
          break;
        }
        case 'publish-and-select-release': {
          const content = validateApplicationReleaseContent(operation.release);
          const existing = await this.#stores.control.getRelease(content.releaseVersion);
          if (
            existing !== undefined &&
            existing.contentHash !==
              controlContentHash({
                ...content,
                publishedByActorId: existing.publishedByActorId,
                publishedAt: existing.publishedAt,
              })
          ) {
            throw new VictControlError(
              'VICT_CONTROL_RELEASE_COLLISION',
              'A release with this version exists with different content.',
            );
          }
          break;
        }
        case 'select-release':
        case 'rollback-release': {
          const target =
            operation.kind === 'select-release'
              ? operation.releaseVersion
              : operation.targetReleaseVersion;
          const release = await this.#stores.control.getRelease(target);
          if (release === undefined || release.applicationId !== operation.applicationId) {
            throw new VictControlError(
              'VICT_CONTROL_RELEASE_MISSING',
              'The referenced release does not exist for this application.',
            );
          }
          break;
        }
      }
    }
  }

  /**
   * Commit a ChangeSet: execute its closed operations against immutable
   * versions as a DURABLE `applying` saga.
   *
   * Model (durable resumable — the affected state spans several stores, so
   * no single transaction can span it):
   *
   * 1. Prevalidation: evidence policy, approvals, base staleness, and the
   *    COMPLETE operation set are verified BEFORE any mutation.
   * 2. One winner: the status is compare-and-set `approved` → `applying`;
   *    a concurrent commit fails with a structured conflict (never two
   *    logical applications).
   * 3. Each applied operation records a durable, immutable operation
   *    receipt; retries and recovery SKIP operations that already carry a
   *    receipt, so no effect is ever repeated.
   * 4. Once every operation carries a receipt, the status is advanced to
   *    `committed`. No failure can leave a falsely final state: until step
   *    4 completes, the truthful durable status is `applying`.
   * 5. `recoverChangeSetCommits()` deterministically completes interrupted
   *    commits after restart (SIGKILL) without duplication.
   */
  async commit(
    actor: AuthenticatedActorContext,
    input: { changesetId: string },
  ): Promise<{ record: ChangeSetRecord; applied: string[] }> {
    this.#assertScope(actor, 'changeset.commit');
    let record = await this.#requireChangeSet(input.changesetId);
    // Idempotent commit.
    if (record.status === 'committed') {
      const receipts = await this.#stores.control.listOperationReceipts(record.changesetId);
      return { record, applied: receipts.map((receipt) => receipt.operationKind) };
    }
    if (record.status === 'applying') {
      // Resume an interrupted commit (durable saga continuation).
      return this.#resumeCommit(actor, record);
    }
    if (record.status !== 'approved') {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_NOT_APPROVED',
        'The ChangeSet is not approved for commit.',
      );
    }
    if (record.expiresAt <= this.#clock()) {
      await this.#stores.control.updateChangeSet(record.changesetId, (current) => ({
        ...current,
        status: 'expired',
      }));
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_EXPIRED',
        'The ChangeSet expired and can no longer be committed.',
      );
    }
    // Approvals must still bind to the CURRENT content hash.
    const approvals = await this.#stores.control.listChangeSetApprovals(record.changesetId);
    const validApprovals = approvals.filter(
      (entry) => entry.contentHash === record.contentHash && entry.decision === 'approved',
    );
    if (validApprovals.length < record.requiredApproverCount) {
      throw new VictControlError(
        'VICT_CONTROL_APPROVALS_INVALIDATED',
        'The required approvals no longer bind to the current ChangeSet content.',
      );
    }
    // Stale-base check: the expected base must still be the selected
    // identity for the subject. Failures happen BEFORE any mutation.
    const selectedVersion = await this.#selectedVersionFor(record.base);
    const expected =
      record.base.expectedVersion === CHANGESET_BASE_NONE ? undefined : record.base.expectedVersion;
    if (selectedVersion !== expected) {
      throw new VictControlError(
        'VICT_CONTROL_BASE_STALE',
        `The ChangeSet base is stale: expected '${record.base.expectedVersion}'.`,
      );
    }
    // Authoritative evidence policy — REQUIRED by risk class, verified
    // against executed runs (missing, failed, stale, mismatched, or
    // fabricated evidence blocks the commit with structured diagnostics).
    await this.#verifyCommitEvidence(record);
    // Prevalidate the COMPLETE operation set before ANY mutation.
    await this.#prevalidateOperations(record);
    // Capture the base-subject guard from the SAME observed state that the
    // stale-base check just verified: the guard is captured BEFORE the
    // status CAS so two ChangeSets racing on one base can never both pass
    // the absent-selection window.
    let capturedBaseGuard:
      { subjectId: string; expectedSelectionRevision: number | 'none' } | undefined;
    if (record.base.kind === 'activation') {
      const baseSelection = await this.#catalog.getSelection(record.base.subjectId);
      capturedBaseGuard = {
        subjectId: record.base.subjectId,
        expectedSelectionRevision: baseSelection?.selectionRevision ?? 'none',
      };
    }
    // One winner: approved → applying is a durable compare-and-set.
    record = await this.#stores.control.compareAndSetChangeSetStatus({
      changesetId: record.changesetId,
      expectedStatus: 'approved',
      nextStatus: 'applying',
    });
    return this.#resumeCommit(actor, record, capturedBaseGuard);
  }

  /**
   * Continue (or complete) an `applying` saga: apply exactly the operations
   * that do not yet carry an APPLIED durable receipt, then advance to
   * `committed`.
   *
   * Operation protocol (exactly-once across crashes):
   *
   * 1. PREPARED INTENT before the effect: every operation gets a durable
   *    receipt row (`prepared`) whose identity derives from ChangeSet ID,
   *    content hash, operation index and the exact operation content. The
   *    row carries the subject guard (fencing data) captured from the
   *    projected base state.
   * 2. FENCED EFFECT: the target mutation accepts the operation identity
   *    as its idempotency key and the subject guard as its CAS —
   *    re-application returns the ORIGINAL result without adding another
   *    selection revision or audit event; conflicting content under the
   *    same identity fails closed.
   * 3. APPLIED receipt: recorded after the effect (atomically with it
   *    where effect and receipt share the store's transaction boundary).
   * 4. Recovery VERIFIES target state for prepared intents — it never
   *    manufactures a receipt merely because the operation was supposed
   *    to run.
   */
  async #resumeCommit(
    actor: AuthenticatedActorContext,
    record: ChangeSetRecord,
    capturedBaseGuard?: { subjectId: string; expectedSelectionRevision: number | 'none' },
  ): Promise<{ record: ChangeSetRecord; applied: string[] }> {
    const receipts = await this.#stores.control.listOperationReceipts(record.changesetId);
    const receiptByIndex = new Map(receipts.map((receipt) => [receipt.operationIndex, receipt]));
    const guards: (OperationGuard | undefined)[] = [
      ...(await this.#projectOperationGuards(record, capturedBaseGuard)),
    ];
    const applied: string[] = [];
    for (let index = 0; index < record.operations.length; index += 1) {
      const operation = record.operations[index] as ChangeSetOperation;
      const operationDigest = changeSetOperationIdentity({
        changesetId: record.changesetId,
        contentHash: record.contentHash,
        operationIndex: index,
        operation,
      });
      const existing = receiptByIndex.get(index);
      if (existing !== undefined) {
        // The durable intent binds the EXACT operation content: conflicting
        // content under the same identity fails closed.
        if (existing.operationDigest !== operationDigest) {
          throw new VictControlError(
            'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
            'The durable operation intent carries different content; conflicting content fails closed.',
          );
        }
        if (existing.state === 'applied') {
          applied.push(operation.kind);
          continue;
        }
        // PREPARED intent (crash between intent and settlement): verify the
        // target state — if the effect already exists, settle the receipt
        // WITHOUT repeating it; otherwise re-apply through the fenced path
        // with the RECEIPT's captured subject guard (verbatim), never a
        // re-read of the moved live state.
        if (await this.#operationEffectExists(record, index, operation, operationDigest)) {
          await this.#stores.control.markOperationApplied({
            changesetId: record.changesetId,
            operationIndex: index,
            at: this.#clock(),
          });
          applied.push(operation.kind);
          continue;
        }
        if (existing.guardJson !== undefined) {
          try {
            guards[index] = JSON.parse(existing.guardJson) as OperationGuard;
          } catch {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_IDENTITY_CONFLICT',
              'The prepared operation intent carries an unreadable subject guard.',
            );
          }
        }
      }
      if (existing === undefined) {
        // Durable intent BEFORE the effect.
        await this.#stores.control.recordOperationIntent({
          changesetId: record.changesetId,
          operationIndex: index,
          operationKind: operation.kind,
          operationDigest,
          effectRef: `op:${operationDigest}`,
          actorId: actor.actorId,
          appliedAt: this.#clock(),
          state: 'prepared',
          guardJson: guards[index] === undefined ? undefined : JSON.stringify(guards[index]),
        });
      }
      // Fenced effect (operation identity = idempotency key; guard = CAS).
      await this.#applyOperation(actor, record, operation, guards[index], operationDigest);
      await this.#stores.control.markOperationApplied({
        changesetId: record.changesetId,
        operationIndex: index,
        at: this.#clock(),
      });
      applied.push(operation.kind);
    }
    record = await this.#stores.control.compareAndSetChangeSetStatus({
      changesetId: record.changesetId,
      expectedStatus: 'applying',
      nextStatus: 'committed',
    });
    // The commit audit is IDEMPOTENT under the same operation set: its id
    // derives from the changeset identity, so a crash during audit emission
    // and a recovery re-emission produce ONE attributable outcome.
    await this.#auditWithId(
      this.#deterministicAuditId('changeset.committed', record.changesetId, record.contentHash),
      record.authorActorId,
      'changeset.committed',
      'changeset',
      record.changesetId,
      `${record.operations.length} operation(s) applied exactly once`,
    );
    return { record, applied };
  }

  /**
   * Project the subject-level guards for every operation index. The FIRST
   * operation that touches the base subject is fenced on the ChangeSet's
   * expected base (version or selection revision, read at projection time);
   * subsequent operations on the same subject are fenced on the projected
   * state after their predecessors. Subjects other than the ChangeSet base
   * are not fenced (the base covers exactly one subject).
   */
  async #projectOperationGuards(
    record: ChangeSetRecord,
    capturedBaseGuard?: { subjectId: string; expectedSelectionRevision: number | 'none' },
  ): Promise<readonly (OperationGuard | undefined)[]> {
    const guards: (OperationGuard | undefined)[] = new Array(record.operations.length).fill(
      undefined,
    );
    const releaseProjected = new Map<string, string | undefined>();
    const activationProjected = new Map<string, number>();
    for (let index = 0; index < record.operations.length; index += 1) {
      const operation = record.operations[index] as ChangeSetOperation;
      switch (operation.kind) {
        case 'select-activation':
        case 'rollback-activation': {
          const target =
            operation.kind === 'select-activation'
              ? operation.activationVersion
              : operation.targetActivationVersion;
          let expectedRevision: number | 'none';
          if (
            capturedBaseGuard !== undefined &&
            capturedBaseGuard.subjectId === operation.graphId
          ) {
            // The base-subject guard was captured BEFORE the status CAS
            // (from the same observed state the stale-base check
            // verified) — never re-read after it.
            expectedRevision = capturedBaseGuard.expectedSelectionRevision;
          } else if (activationProjected.has(operation.graphId)) {
            expectedRevision = activationProjected.get(operation.graphId) as number | 'none';
          } else if (
            record.base.kind === 'activation' &&
            record.base.subjectId === operation.graphId
          ) {
            const selection = await this.#catalog.getSelection(operation.graphId);
            expectedRevision = selection?.selectionRevision ?? 'none';
          } else {
            guards[index] = undefined; // not the base subject: unfenced
            void target;
            break;
          }
          guards[index] = { expectedSelectionRevision: expectedRevision };
          const current = activationProjected.has(operation.graphId)
            ? (activationProjected.get(operation.graphId) ?? 0)
            : ((await this.#catalog.getSelection(operation.graphId))?.selectionRevision ?? 0);
          void target;
          activationProjected.set(
            operation.graphId,
            expectedRevision === 'none' ? 1 : expectedRevision + 1,
          );
          void current;
          break;
        }
        case 'publish-and-select-release': {
          const appId = operation.release.applicationId;
          let expected: string | undefined;
          if (releaseProjected.has(appId)) {
            expected = releaseProjected.get(appId);
          } else if (record.base.kind === 'release' && record.base.subjectId === appId) {
            expected = record.base.expectedVersion;
          } else {
            expected = undefined;
          }
          guards[index] = { expectedBaseVersion: expected };
          releaseProjected.set(appId, operation.release.releaseVersion);
          break;
        }
        case 'select-release': {
          let expected: string | undefined;
          if (releaseProjected.has(operation.applicationId)) {
            expected = releaseProjected.get(operation.applicationId);
          } else if (
            record.base.kind === 'release' &&
            record.base.subjectId === operation.applicationId
          ) {
            expected = record.base.expectedVersion;
          } else {
            expected = undefined;
          }
          guards[index] = { expectedBaseVersion: expected };
          releaseProjected.set(operation.applicationId, operation.releaseVersion);
          break;
        }
        case 'rollback-release': {
          let expected: string | undefined;
          if (releaseProjected.has(operation.applicationId)) {
            expected = releaseProjected.get(operation.applicationId);
          } else if (
            record.base.kind === 'release' &&
            record.base.subjectId === operation.applicationId
          ) {
            expected = record.base.expectedVersion;
          } else {
            expected = undefined;
          }
          guards[index] = { expectedBaseVersion: expected };
          releaseProjected.set(operation.applicationId, operation.targetReleaseVersion);
          break;
        }
      }
    }
    return guards;
  }

  /**
   * Verification-only check for a PREPARED intent whose effect may have
   * completed before the crash: the target state itself must show the
   * operation's effect (selection with the same operation identity, or a
   * selection already pointing at the target activation).
   */
  async #operationEffectExists(
    record: ChangeSetRecord,
    index: number,
    operation: ChangeSetOperation,
    operationDigest: string,
  ): Promise<boolean> {
    void index;
    switch (operation.kind) {
      case 'select-activation':
      case 'rollback-activation': {
        const target =
          operation.kind === 'select-activation'
            ? operation.activationVersion
            : operation.targetActivationVersion;
        const selection = await this.#catalog.getSelection(operation.graphId);
        // The EXACT operation identity must be verifiable: a selection of
        // the same target made through ANY other path (an operator select,
        // a different operation) is NOT proof that THIS operation's effect
        // completed.
        return (
          selection !== undefined &&
          selection.activationVersion === target &&
          selection.operationId === operationDigest
        );
      }
      case 'publish-and-select-release':
      case 'select-release':
      case 'rollback-release': {
        const appId =
          operation.kind === 'publish-and-select-release'
            ? operation.release.applicationId
            : operation.applicationId;
        // The selection is the LAST step of every release operation: a
        // selection row carrying this operation identity proves the whole
        // operation completed (publication happened before it).
        const selections = await this.#stores.control.listReleaseSelections(appId);
        return selections.some((selection) => selection.operationId === operationDigest);
      }
    }
  }

  /**
   * Fenced activation selection: translates the store-level selection
   * conflict into the stable stale-base control error (the loser of a
   * base race receives a structured control-plane conflict, never a raw
   * store error).
   */
  async #selectActivationFenced(
    graphId: string,
    activationVersion: string,
    guard: OperationGuard | undefined,
    operationDigest: string,
  ) {
    try {
      return await this.#catalog.select({
        graphId,
        activationVersion,
        ...(guard?.expectedSelectionRevision !== undefined
          ? { expectedSelectionRevision: guard.expectedSelectionRevision }
          : {}),
        operationId: operationDigest,
      });
    } catch (error) {
      if (error instanceof VictStoreError && error.code === 'VICT_STORE_SELECTION_CONFLICT') {
        throw new VictControlError(
          'VICT_CONTROL_BASE_STALE',
          'The activation selection changed since the ChangeSet base was verified; the guarded selection lost the base race.',
        );
      }
      throw error;
    }
  }

  /** Apply ONE closed operation under its operation identity and guard. */
  async #applyOperation(
    actor: AuthenticatedActorContext,
    record: ChangeSetRecord,
    operation: ChangeSetOperation,
    guard: OperationGuard | undefined,
    operationDigest: string,
  ): Promise<void> {
    switch (operation.kind) {
      case 'select-activation': {
        const selection = await this.#selectActivationFenced(
          operation.graphId,
          operation.activationVersion,
          guard,
          operationDigest,
        );
        await this.#auditWithId(
          this.#deterministicAuditId('activation.selected', operationDigest),
          actor.actorId,
          'activation.selected',
          'activation',
          operation.graphId,
          operation.activationVersion,
        );
        void selection;
        return;
      }
      case 'rollback-activation': {
        const selection = await this.#selectActivationFenced(
          operation.graphId,
          operation.targetActivationVersion,
          guard,
          operationDigest,
        );
        await this.#auditWithId(
          this.#deterministicAuditId('activation.rolled-back', operationDigest),
          actor.actorId,
          'activation.rolled-back',
          'activation',
          operation.graphId,
          operation.targetActivationVersion,
        );
        void selection;
        return;
      }
      case 'publish-and-select-release': {
        const content = validateApplicationReleaseContent(operation.release);
        const release: ApplicationReleaseRecord = {
          ...content,
          publishedByActorId: actor.actorId,
          publishedAt: this.#clock(),
          contentHash: controlContentHash(content),
        };
        const selection = {
          applicationId: release.applicationId,
          releaseVersion: release.releaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'select' as const,
          operationId: operationDigest,
          ...(guard?.expectedBaseVersion !== undefined
            ? { expectedBaseVersion: guard.expectedBaseVersion }
            : {}),
        };
        if (this.#stores.control.applyReleaseOperation !== undefined) {
          // ATOMIC composition (where effect and receipt share SQLite):
          // publication + guarded selection + applied receipt in ONE
          // durable transaction — the dual-write gap is structurally closed.
          const intent = await this.#preparedIntent(record, operationDigest);
          if (intent === undefined) {
            throw new VictControlError(
              'VICT_CONTROL_OPERATION_RECEIPT_MISSING',
              'The prepared operation intent must exist before the effect is applied.',
            );
          }
          await this.#stores.control.applyReleaseOperation({
            release,
            selection,
            receipt: intent,
          });
        } else {
          await this.#stores.control.publishRelease(release);
          await this.#stores.control.selectRelease(selection);
        }
        await this.#auditWithId(
          this.#deterministicAuditId('release.published', operationDigest),
          actor.actorId,
          'release.published',
          'release',
          release.releaseVersion,
          release.applicationId,
        );
        return;
      }
      case 'select-release': {
        await this.#stores.control.selectRelease({
          applicationId: operation.applicationId,
          releaseVersion: operation.releaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'select',
          operationId: operationDigest,
          ...(guard?.expectedBaseVersion !== undefined
            ? { expectedBaseVersion: guard.expectedBaseVersion }
            : {}),
        });
        await this.#auditWithId(
          this.#deterministicAuditId('release.selected', operationDigest),
          actor.actorId,
          'release.selected',
          'release',
          operation.releaseVersion,
          operation.applicationId,
        );
        return;
      }
      case 'rollback-release': {
        await this.#stores.control.selectRelease({
          applicationId: operation.applicationId,
          releaseVersion: operation.targetReleaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'rollback',
          operationId: operationDigest,
          ...(guard?.expectedBaseVersion !== undefined
            ? { expectedBaseVersion: guard.expectedBaseVersion }
            : {}),
        });
        await this.#auditWithId(
          this.#deterministicAuditId('release.rolled-back', operationDigest),
          actor.actorId,
          'release.rolled-back',
          'release',
          operation.targetReleaseVersion,
          operation.applicationId,
        );
        return;
      }
    }
  }

  /**
   * Read the durable PREPARED intent for one operation (fail closed when
   * missing; the caller knows the owning ChangeSet through `record`).
   */
  async #preparedIntent(
    record: ChangeSetRecord,
    operationDigest: string,
  ): Promise<ChangeSetOperationReceipt | undefined> {
    const receipts = await this.#stores.control.listOperationReceipts(record.changesetId);
    return receipts.find(
      (receipt) => receipt.operationDigest === operationDigest && receipt.state === 'prepared',
    );
  }

  /**
   * Deterministic recovery: every `applying` ChangeSet is completed through
   * the SAME operation protocol as a live commit (prepared intents, fenced
   * idempotent effects, target-state verification) or reports the truthful
   * interrupted state when an operation can no longer be applied (for
   * example a lost base race). Called at composition/reconciliation time;
   * idempotent. Recovery NEVER manufactures a receipt: an applied receipt
   * exists only when the target state verifies it.
   */
  async recoverChangeSetCommits(): Promise<{
    readonly completed: number;
    readonly interrupted: readonly { changesetId: string; code: string }[];
  }> {
    const all = await this.#stores.control.listChangeSets();
    const applyingRecords = all.filter((record) => record.status === 'applying');
    let completed = 0;
    const interrupted: { changesetId: string; code: string }[] = [];
    for (const record of applyingRecords) {
      try {
        // Recovery continues the saga with the AUTHORING system identity:
        // receipts carry the committing actor; recovery adds no new effects
        // beyond the recorded operation set.
        await this.#resumeCommit(
          {
            actorId: record.authorActorId,
            roles: [],
            scopes: [],
            mastraResourceId: `vict-actor-${record.authorActorId}`,
          },
          record,
        );
        completed += 1;
      } catch (error) {
        interrupted.push({
          changesetId: record.changesetId,
          code: error instanceof VictControlError ? error.code : 'VICT_CONTROL_COMMIT_INTERRUPTED',
        });
      }
    }
    return { completed, interrupted };
  }

  /** Decline a draft ChangeSet (attributable; forward-only). */
  async decline(
    actor: AuthenticatedActorContext,
    input: { changesetId: string },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.approve');
    const updated = await this.#stores.control.updateChangeSet(input.changesetId, (record) => {
      if (record.status !== 'draft') {
        throw new VictControlError(
          'VICT_CONTROL_CHANGESET_NOT_DRAFT',
          'Only a draft ChangeSet can be declined.',
        );
      }
      return { ...record, status: 'declined' };
    });
    await this.#audit(
      actor.actorId,
      'changeset.declined',
      'changeset',
      input.changesetId,
      'declined',
    );
    return updated;
  }

  /**
   * Select one published activation for future runs (operator path).
   * AUTHORIZATION REQUIRED: the caller's authenticated context must hold
   * the `activation.select` scope, and the selection is attributed to the
   * authenticated actor — never to a synthetic identity.
   */
  async selectActivation(
    actor: AuthenticatedActorContext,
    input: { graphId: string; activationVersion: string },
  ): Promise<{ graphId: string; activationVersion: string; selectionRevision: number }> {
    this.#assertScope(actor, 'activation.select');
    const selection = await this.#catalog.select({
      graphId: input.graphId,
      activationVersion: input.activationVersion,
    });
    await this.#audit(
      actor.actorId,
      'activation.selected',
      'activation',
      input.graphId,
      input.activationVersion,
    );
    return {
      graphId: selection.graphId,
      activationVersion: selection.activationVersion,
      selectionRevision: selection.selectionRevision,
    };
  }

  /**
   * Read one ChangeSet (actor-scoped): the author and holders of the
   * privileged `operator.resolve` scope may read; other actors receive the
   * SAME missing-record denial (no existence disclosure).
   */
  async get(
    actor: AuthenticatedActorContext,
    changesetId: string,
  ): Promise<ChangeSetRecord | undefined> {
    this.#assertScope(actor, 'changeset.read');
    const record = await this.#stores.control.getChangeSet(changesetId);
    if (record === undefined) {
      return undefined;
    }
    if (record.authorActorId !== actor.actorId && !actor.scopes.includes('operator.resolve')) {
      return undefined;
    }
    return record;
  }

  /** List ChangeSets visible to the actor (authored records; privileged
   * `operator.resolve` holders see all). Identifiers of other actors are
   * never disclosed to unprivileged callers. */
  async list(actor: AuthenticatedActorContext): Promise<readonly ChangeSetRecord[]> {
    this.#assertScope(actor, 'changeset.read');
    const all = await this.#stores.control.listChangeSets();
    if (actor.scopes.includes('operator.resolve')) {
      return all;
    }
    return all.filter((record) => record.authorActorId === actor.actorId);
  }

  /** Publish an immutable Application Release directly (operator path). */
  async publishRelease(
    actor: AuthenticatedActorContext,
    content: ApplicationReleaseRecordContent,
  ): Promise<ApplicationReleaseRecord> {
    this.#assertScope(actor, 'release.publish');
    const validated = validateApplicationReleaseContent(content);
    const record: ApplicationReleaseRecord = {
      ...validated,
      publishedByActorId: actor.actorId,
      publishedAt: this.#clock(),
      contentHash: controlContentHash(validated),
    };
    await this.#stores.control.publishRelease(record);
    await this.#audit(
      actor.actorId,
      'release.published',
      'release',
      record.releaseVersion,
      record.applicationId,
    );
    return record;
  }

  /** Select one published release (attributable, monotonic). */
  async selectRelease(
    actor: AuthenticatedActorContext,
    input: { applicationId: string; releaseVersion: string },
  ): Promise<ReleaseSelectionRecord> {
    this.#assertScope(actor, 'release.select');
    const result = await this.#stores.control.selectRelease({
      applicationId: input.applicationId,
      releaseVersion: input.releaseVersion,
      actorId: actor.actorId,
      at: this.#clock(),
      reason: 'select',
    });
    const record: ReleaseSelectionRecord = {
      applicationId: input.applicationId,
      releaseVersion: input.releaseVersion,
      selectionRevision: result.selectionRevision,
      actorId: actor.actorId,
      at: this.#clock(),
      reason: 'select',
    };
    await this.#audit(
      actor.actorId,
      'release.selected',
      'release',
      input.releaseVersion,
      input.applicationId,
    );
    return record;
  }

  /** Rollback: select a prior immutable release for future work. */
  async rollbackRelease(
    actor: AuthenticatedActorContext,
    input: { applicationId: string; targetReleaseVersion: string },
  ): Promise<ReleaseSelectionRecord> {
    this.#assertScope(actor, 'release.select');
    const result = await this.#stores.control.selectRelease({
      applicationId: input.applicationId,
      releaseVersion: input.targetReleaseVersion,
      actorId: actor.actorId,
      at: this.#clock(),
      reason: 'rollback',
    });
    const record: ReleaseSelectionRecord = {
      applicationId: input.applicationId,
      releaseVersion: input.targetReleaseVersion,
      selectionRevision: result.selectionRevision,
      actorId: actor.actorId,
      at: this.#clock(),
      reason: 'rollback',
    };
    await this.#audit(
      actor.actorId,
      'release.rolled-back',
      'release',
      input.targetReleaseVersion,
      input.applicationId,
    );
    return record;
  }

  /** The currently selected release for an application (requires `release.read`). */
  async getSelectedRelease(
    actor: AuthenticatedActorContext,
    applicationId: string,
  ): Promise<ApplicationReleaseRecord | undefined> {
    this.#assertScope(actor, 'release.read');
    return this.#stores.control.getSelectedRelease(applicationId);
  }

  /** Audit trail read (safe events only). */
  async auditTrail(subject: {
    subjectType?: string;
    subjectId?: string;
  }): Promise<readonly ControlAuditEvent[]> {
    return this.#stores.control.listAuditEvents(subject);
  }

  // ---- internals ----------------------------------------------------------

  async #requireChangeSet(changesetId: string): Promise<ChangeSetRecord> {
    const record = await this.#stores.control.getChangeSet(changesetId);
    if (record === undefined) {
      throw new VictControlError('VICT_CONTROL_CHANGESET_MISSING', 'The ChangeSet does not exist.');
    }
    return record;
  }

  #assertDraft(record: ChangeSetRecord, changesetId: string): void {
    if (record.status !== 'draft') {
      throw new VictControlError(
        'VICT_CONTROL_CHANGESET_NOT_DRAFT',
        `The ChangeSet '${changesetId}' is no longer a draft.`,
      );
    }
  }

  /** Resolve the currently selected identity for a ChangeSet base. */
  async #selectedVersionFor(base: ChangeSetRecord['base']): Promise<string | undefined> {
    if (base.kind === 'activation') {
      const selection: ActivationSelection | undefined = await this.#catalog.getSelection(
        base.subjectId,
      );
      return selection?.activationVersion;
    }
    const release = await this.#stores.control.getSelectedRelease(base.subjectId);
    return release?.releaseVersion;
  }

  async #audit(
    actorId: string,
    action: ControlAuditAction,
    subjectType: string,
    subjectId: string,
    summary: string,
  ): Promise<void> {
    const event: ControlAuditEvent = {
      auditId: this.#ids.auditId(),
      at: this.#clock(),
      actorId,
      action,
      subjectType,
      subjectId,
      summary,
    };
    await this.#stores.control.appendAuditEvent(event);
  }

  /**
   * Deterministic audit idempotency anchor: the SAME logical operation (or
   * commit) always maps to the SAME audit id, so a crash during emission
   * plus a recovery re-emission produce exactly ONE attributable outcome.
   */
  #deterministicAuditId(...identity: readonly string[]): string {
    return `audit-${controlContentHash({ domain: 'vict.control-audit@1', identity })}`;
  }

  /** Emit an audit event with an EXPLICIT (deterministic) id. */
  async #auditWithId(
    auditId: string,
    actorId: string,
    action: ControlAuditAction,
    subjectType: string,
    subjectId: string,
    summary: string,
  ): Promise<void> {
    const event: ControlAuditEvent = {
      auditId,
      at: this.#clock(),
      actorId,
      action,
      subjectType,
      subjectId,
      summary,
    };
    await this.#stores.control.appendAuditEvent(event);
  }

  #assertScope(
    actor: AuthenticatedActorContext,
    scope: Parameters<typeof assertScopeForActor>[1],
  ): void {
    assertScopeForActor(actor, scope);
  }
}

/** Application Release authoring content (identity fields only). */
export type ApplicationReleaseRecordContent = Pick<
  ApplicationReleaseRecord,
  | 'releaseVersion'
  | 'applicationId'
  | 'applicationVersion'
  | 'rendererIdentity'
  | 'componentRegistryIdentity'
  | 'dataAdapterIdentity'
  | 'activationBinding'
>;

/**
 * The safe simulation boundary: executes a proposed ChangeSet through REAL
 * safe doubles (no irreversible effects) and reports per-operation
 * outcomes. Composed explicitly; a deployment without a simulator BLOCKS
 * simulation runs instead of passing them.
 */
export interface ChangeSetSimulator {
  /** Stable simulator identity recorded in the run detail. */
  readonly simulatorId: string;
  simulate(input: {
    record: ChangeSetRecord;
    /** The stable operation identities the run covers. */
    operationIdentities: readonly string[];
  }): Promise<{
    outcome: 'passed' | 'failed' | 'blocked';
    operations: readonly ControlRunOperationOutcome[];
  }>;
}

/** Scope enforcement below every layer (fail closed). */
export function assertScopeForActor(actor: AuthenticatedActorContext, scope: ActorScope): void {
  if (!(ACTOR_SCOPES as readonly string[]).includes(scope)) {
    throw new ActorScopeDeniedError(scope);
  }
  if (!actor.scopes.includes(scope)) {
    throw new ActorScopeDeniedError(scope);
  }
}

function failRandomIds(): string {
  throw new VictControlError(
    'VICT_CONTROL_IDS_REQUIRED',
    'The ControlPlaneService requires an injected id factory for deterministic, attributable records.',
  );
}
