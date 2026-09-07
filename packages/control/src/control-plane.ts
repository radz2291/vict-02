import {
  ActorScopeDeniedError,
  ActivationCatalog,
  ActivationSelection,
  AgentControlStores,
  ApplicationReleaseRecord,
  ChangeSetApprovalDecision,
  ChangeSetRecord,
  ChangeSetSimulationEvidence,
  ChangeSetValidationEvidence,
  ControlAuditEvent,
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
  /** Injected id factory (changeset, approval, audit ids). */
  readonly ids?: {
    changesetId(): string;
    changesetApprovalId(): string;
    auditId(): string;
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

  /** Attach validation evidence (draft only; attributable). */
  async attachValidationEvidence(
    actor: AuthenticatedActorContext,
    input: { changesetId: string; evidence: ChangeSetValidationEvidence },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.propose');
    const updated = await this.#stores.control.updateChangeSet(input.changesetId, (record) => {
      this.#assertDraft(record, input.changesetId);
      return { ...record, validation: input.evidence };
    });
    await this.#audit(
      actor.actorId,
      'changeset.evidence-attached',
      'changeset',
      input.changesetId,
      'validation evidence',
    );
    return updated;
  }

  /** Attach simulation evidence (draft only; attributable). */
  async attachSimulationEvidence(
    actor: AuthenticatedActorContext,
    input: { changesetId: string; evidence: ChangeSetSimulationEvidence },
  ): Promise<ChangeSetRecord> {
    this.#assertScope(actor, 'changeset.propose');
    const updated = await this.#stores.control.updateChangeSet(input.changesetId, (record) => {
      this.#assertDraft(record, input.changesetId);
      return { ...record, simulation: input.evidence };
    });
    await this.#audit(
      actor.actorId,
      'changeset.evidence-attached',
      'changeset',
      input.changesetId,
      'simulation evidence',
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
   * Commit a ChangeSet: execute its closed operations against immutable
   * versions. Commit is idempotent; a competing commit leaves the second
   * caller with a truthful stale-base failure and NO mutation.
   */
  async commit(
    actor: AuthenticatedActorContext,
    input: { changesetId: string },
  ): Promise<{ record: ChangeSetRecord; applied: string[] }> {
    this.#assertScope(actor, 'changeset.commit');
    let record = await this.#requireChangeSet(input.changesetId);
    // Idempotent commit.
    if (record.status === 'committed') {
      return { record, applied: [] };
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
    const applied: string[] = [];
    for (const operation of record.operations) {
      switch (operation.kind) {
        case 'select-activation': {
          const selection = await this.#catalog.select({
            graphId: operation.graphId,
            activationVersion: operation.activationVersion,
          });
          applied.push(`select-activation:${selection.activationVersion}`);
          await this.#audit(
            actor.actorId,
            'activation.selected',
            'activation',
            operation.graphId,
            operation.activationVersion,
          );
          break;
        }
        case 'rollback-activation': {
          const selection = await this.#catalog.select({
            graphId: operation.graphId,
            activationVersion: operation.targetActivationVersion,
          });
          applied.push(`rollback-activation:${selection.activationVersion}`);
          await this.#audit(
            actor.actorId,
            'activation.rolled-back',
            'activation',
            operation.graphId,
            operation.targetActivationVersion,
          );
          break;
        }
        case 'publish-and-select-release': {
          const content = validateApplicationReleaseContent(operation.release);
          const release: ApplicationReleaseRecord = {
            ...content,
            publishedByActorId: actor.actorId,
            publishedAt: this.#clock(),
            contentHash: controlContentHash(content),
          };
          await this.#stores.control.publishRelease(release);
          await this.#stores.control.selectRelease({
            applicationId: release.applicationId,
            releaseVersion: release.releaseVersion,
            actorId: actor.actorId,
            at: this.#clock(),
            reason: 'select',
          });
          applied.push(`publish-and-select-release:${release.releaseVersion}`);
          await this.#audit(
            actor.actorId,
            'release.published',
            'release',
            release.releaseVersion,
            release.applicationId,
          );
          break;
        }
        case 'select-release': {
          await this.#stores.control.selectRelease({
            applicationId: operation.applicationId,
            releaseVersion: operation.releaseVersion,
            actorId: actor.actorId,
            at: this.#clock(),
            reason: 'select',
          });
          applied.push(`select-release:${operation.releaseVersion}`);
          await this.#audit(
            actor.actorId,
            'release.selected',
            'release',
            operation.releaseVersion,
            operation.applicationId,
          );
          break;
        }
        case 'rollback-release': {
          await this.#stores.control.selectRelease({
            applicationId: operation.applicationId,
            releaseVersion: operation.targetReleaseVersion,
            actorId: actor.actorId,
            at: this.#clock(),
            reason: 'rollback',
          });
          applied.push(`rollback-release:${operation.targetReleaseVersion}`);
          await this.#audit(
            actor.actorId,
            'release.rolled-back',
            'release',
            operation.targetReleaseVersion,
            operation.applicationId,
          );
          break;
        }
      }
    }
    record = await this.#stores.control.updateChangeSet(record.changesetId, (current) => ({
      ...current,
      status: 'committed',
    }));
    await this.#audit(
      actor.actorId,
      'changeset.committed',
      'changeset',
      record.changesetId,
      `${applied.length} operation(s) applied`,
    );
    return { record, applied };
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

  /** Select one published activation for future runs (operator path; audited). */
  async selectActivation(input: {
    graphId: string;
    activationVersion: string;
  }): Promise<{ graphId: string; activationVersion: string; selectionRevision: number }> {
    const selection = await this.#catalog.select({
      graphId: input.graphId,
      activationVersion: input.activationVersion,
    });
    await this.#audit(
      'system',
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

  /** Read one ChangeSet. */
  async get(changesetId: string): Promise<ChangeSetRecord | undefined> {
    return this.#stores.control.getChangeSet(changesetId);
  }

  /** List ChangeSets (safe records only). */
  async list(): Promise<readonly ChangeSetRecord[]> {
    return this.#stores.control.listChangeSets();
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

  /** The currently selected release for an application. */
  async getSelectedRelease(applicationId: string): Promise<ApplicationReleaseRecord | undefined> {
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
