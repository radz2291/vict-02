import {
  ActorScopeDeniedError,
  ActivationCatalog,
  ActivationSelection,
  AgentControlStores,
  ApplicationReleaseRecord,
  ChangeSetApprovalDecision,
  ChangeSetOperation,
  ChangeSetRecord,
  ChangeSetSimulationEvidence,
  ChangeSetValidationEvidence,
  ControlAuditEvent,
  ControlRunKind,
  ControlRunRecord,
  ReleaseSelectionRecord,
} from '@vict/runtime';
import {
  authenticatedActorContext,
  CHANGESET_BASE_NONE,
  CHANGESET_SCHEMA,
  controlContentHash,
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
}

/** The authoritative actor resolution input (server-side truth only). */
export interface ActorAuthority {
  /** The actor record resolved from the directory by the composition. */
  readonly actor: ActorRecord | undefined;
  /** The actor id the request presents (must match the record). */
  readonly actorId: string;
}

/** Resolve the authoritative context or fail closed. */
export function resolveActorContext(
  directory: ActorDirectory,
  actorId: string,
): Promise<AuthenticatedActorContext> {
  return (async () => {
    const actor = await directory.get(actorId);
    return authenticatedActorContext(actor, actorId);
  })();
}

/** One ChangeSet proposal input (validated; content hash derived). */
export interface ProposeChangeSetInput {
  readonly changesetId: string;
  readonly base: ChangeSetRecord['base'];
  readonly operations: readonly unknown[];
  readonly rationale: string;
  readonly riskClass: ChangeSetRecord['riskClass'];
  readonly requiredApproverCount: number;
  readonly expiresAt: number;
}

export class ControlPlaneService {
  readonly #stores: AgentControlStores;
  readonly #catalog: ActivationCatalog;
  readonly #clock: () => number;
  readonly #ids: Required<NonNullable<ControlPlaneServiceOptions['ids']>>;

  constructor(options: ControlPlaneServiceOptions) {
    this.#stores = options.stores;
    this.#catalog = options.catalog;
    this.#clock = options.clock ?? (() => Date.now());
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
    const validated = validateChangeSetContent({
      changesetId: input.changesetId,
      authorActorId: actor.actorId,
      createdAt: this.#clock(),
      base: input.base,
      operations: input.operations,
      rationale: input.rationale,
      riskClass: input.riskClass,
      requiredApproverCount: input.requiredApproverCount,
      expiresAt: input.expiresAt,
    });
    const record: ChangeSetRecord = {
      changesetId: input.changesetId,
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
    const updated = await this.#stores.control.reviseChangeSetContent(
      input.changesetId,
      (record) => {
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
          operations: input.operations,
          rationale: input.rationale,
          riskClass: input.riskClass,
          requiredApproverCount: input.requiredApproverCount,
          expiresAt: input.expiresAt,
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
      },
    );
    await this.#audit(
      actor.actorId,
      'changeset.revised',
      'changeset',
      input.changesetId,
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
   * Execute ONE authoritative governance run (validation or simulation)
   * through the trusted VICT boundary and record it durably. The run
   * deterministically prevalidates the ChangeSet's full operation set
   * against the CURRENT durable state; callers cannot fabricate run
   * identities, outcomes, or timestamps — they can only execute a run and
   * reference its stable id afterwards.
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
    // Authoritative prevalidation of the COMPLETE operation set against the
    // current durable state (never a caller claim).
    let outcome: ControlRunRecord['outcome'] = 'passed';
    try {
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
    // One winner: approved → applying is a durable compare-and-set.
    record = await this.#stores.control.compareAndSetChangeSetStatus({
      changesetId: record.changesetId,
      expectedStatus: 'approved',
      nextStatus: 'applying',
    });
    return this.#resumeCommit(actor, record);
  }

  /**
   * Continue (or complete) an `applying` saga: apply exactly the operations
   * that do not yet carry a durable receipt, then advance to `committed`.
   */
  async #resumeCommit(
    actor: AuthenticatedActorContext,
    record: ChangeSetRecord,
  ): Promise<{ record: ChangeSetRecord; applied: string[] }> {
    const receipts = await this.#stores.control.listOperationReceipts(record.changesetId);
    const receiptByIndex = new Map(receipts.map((receipt) => [receipt.operationIndex, receipt]));
    const applied: string[] = [];
    for (let index = 0; index < record.operations.length; index += 1) {
      const operation = record.operations[index] as ChangeSetOperation;
      const existing = receiptByIndex.get(index);
      if (existing !== undefined) {
        applied.push(existing.operationKind);
        continue;
      }
      const effectRef = await this.#applyOperation(actor, operation);
      await this.#stores.control.recordOperationReceipt({
        changesetId: record.changesetId,
        operationIndex: index,
        operationKind: operation.kind,
        operationDigest: controlContentHash(operation),
        effectRef,
        actorId: actor.actorId,
        appliedAt: this.#clock(),
      });
      applied.push(operation.kind);
    }
    record = await this.#stores.control.compareAndSetChangeSetStatus({
      changesetId: record.changesetId,
      expectedStatus: 'applying',
      nextStatus: 'committed',
    });
    await this.#audit(
      actor.actorId,
      'changeset.committed',
      'changeset',
      record.changesetId,
      `${record.operations.length} operation(s) applied exactly once`,
    );
    return { record, applied };
  }

  /** Apply ONE closed operation; returns its stable effect identity. */
  async #applyOperation(
    actor: AuthenticatedActorContext,
    operation: ChangeSetOperation,
  ): Promise<string> {
    switch (operation.kind) {
      case 'select-activation': {
        const selection = await this.#catalog.select({
          graphId: operation.graphId,
          activationVersion: operation.activationVersion,
        });
        await this.#audit(
          actor.actorId,
          'activation.selected',
          'activation',
          operation.graphId,
          operation.activationVersion,
        );
        return `activation:${operation.graphId}@${selection.activationVersion}`;
      }
      case 'rollback-activation': {
        const selection = await this.#catalog.select({
          graphId: operation.graphId,
          activationVersion: operation.targetActivationVersion,
        });
        await this.#audit(
          actor.actorId,
          'activation.rolled-back',
          'activation',
          operation.graphId,
          operation.targetActivationVersion,
        );
        return `activation:${operation.graphId}@${selection.activationVersion}`;
      }
      case 'publish-and-select-release': {
        const content = validateApplicationReleaseContent(operation.release);
        const release: ApplicationReleaseRecord = {
          ...content,
          publishedByActorId: actor.actorId,
          publishedAt: this.#clock(),
          contentHash: controlContentHash(content),
        };
        // Publish is idempotent by content identity; select is a monotonic
        // selection record. If the process dies between the two, the op has
        // NO receipt yet, so recovery re-executes the whole op without
        // duplicating the publish (immutability guard) and completes the
        // selection.
        await this.#stores.control.publishRelease(release);
        await this.#stores.control.selectRelease({
          applicationId: release.applicationId,
          releaseVersion: release.releaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'select',
        });
        await this.#audit(
          actor.actorId,
          'release.published',
          'release',
          release.releaseVersion,
          release.applicationId,
        );
        return `release:${release.applicationId}@${release.releaseVersion}`;
      }
      case 'select-release': {
        await this.#stores.control.selectRelease({
          applicationId: operation.applicationId,
          releaseVersion: operation.releaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'select',
        });
        await this.#audit(
          actor.actorId,
          'release.selected',
          'release',
          operation.releaseVersion,
          operation.applicationId,
        );
        return `release-selection:${operation.applicationId}@${operation.releaseVersion}`;
      }
      case 'rollback-release': {
        await this.#stores.control.selectRelease({
          applicationId: operation.applicationId,
          releaseVersion: operation.targetReleaseVersion,
          actorId: actor.actorId,
          at: this.#clock(),
          reason: 'rollback',
        });
        await this.#audit(
          actor.actorId,
          'release.rolled-back',
          'release',
          operation.targetReleaseVersion,
          operation.applicationId,
        );
        return `release-selection:${operation.applicationId}@${operation.targetReleaseVersion}`;
      }
    }
  }

  /**
   * Deterministic recovery: every `applying` ChangeSet is completed from
   * its durable operation receipts (or reports the truthful interrupted
   * state when an operation can no longer be applied). Called at
   * composition/reconciliation time; idempotent.
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
        const receipts = await this.#stores.control.listOperationReceipts(record.changesetId);
        const receiptByIndex = new Map(receipts.map((entry) => [entry.operationIndex, entry]));
        for (let index = 0; index < record.operations.length; index += 1) {
          const operation = record.operations[index] as ChangeSetOperation;
          if (receiptByIndex.has(index)) {
            continue;
          }
          // Recovery applies operations as a system continuation of the
          // original authorized commit (the decision was already made and
          // durably recorded; the effects are the approved operation set).
          const effectRef = await this.#applyOperation(
            {
              actorId: record.authorActorId,
              roles: [],
              scopes: [],
              mastraResourceId: `vict-actor-${record.authorActorId}`,
            },
            operation,
          );
          await this.#stores.control.recordOperationReceipt({
            changesetId: record.changesetId,
            operationIndex: index,
            operationKind: operation.kind,
            operationDigest: controlContentHash(operation),
            effectRef,
            actorId: record.authorActorId,
            appliedAt: this.#clock(),
          });
        }
        await this.#stores.control.compareAndSetChangeSetStatus({
          changesetId: record.changesetId,
          expectedStatus: 'applying',
          nextStatus: 'committed',
        });
        await this.#audit(
          record.authorActorId,
          'changeset.committed',
          'changeset',
          record.changesetId,
          `${record.operations.length} operation(s) completed by recovery`,
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
