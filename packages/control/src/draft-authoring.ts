import { sha256 } from '@victframework/contracts/sha256';

/** Values come from the host's governed turn context. */
export interface DraftTurn {
  readonly actorId: string;
  readonly turnId: string;
}

export interface DraftOperation extends DraftTurn {
  /** Stable identity of the logical invocation, shared by all deliveries. */
  readonly operationId: string;
}

export interface DraftTarget {
  /** Identifies this open draft instance within the host. */
  readonly draftId: string;
  /** Identifies the exact editable occurrence within the draft. */
  readonly occurrenceId: string;
}

export type DraftRevision = string | number;

export interface DraftSnapshot extends DraftTarget {
  readonly revision: DraftRevision;
}

export interface DraftEditRequest extends DraftTarget {
  readonly expectedRevision: DraftRevision;
  /** Host-defined edit data, encoded as a string by the capability. */
  readonly edit: string;
}

interface DraftEditBinding extends DraftOperation, DraftTarget {
  readonly expectedRevision: DraftRevision;
  readonly editDigest: string;
}

export interface DraftEditProposal extends DraftEditBinding {
  readonly edit: string;
}

export type DraftMutationOutcome =
  | { readonly status: 'applied' | 'stale'; readonly revision: DraftRevision }
  | { readonly status: 'denied' | 'invalid' };

type DraftEditOutcome = DraftMutationOutcome | { readonly status: 'cancelled' };

export type DraftEditReceipt = DraftEditBinding & DraftEditOutcome;

export type DraftEditResult =
  | { readonly status: 'confirmed'; readonly receipt: DraftEditReceipt }
  | { readonly status: 'denied' | 'invalid' | 'operation-conflict' | 'unconfirmed' };

type Awaitable<T> = T | Promise<T>;

export interface DraftAuthoringHost {
  /** Resolve the actor's turn-pinned, currently authorized open draft occurrence. */
  resolveDraft(turn: DraftTurn): Awaitable<DraftSnapshot | undefined>;
  /** Read the authoritative journal by exact actor, turn and operation. */
  readReceipt(operation: DraftOperation): Awaitable<DraftEditReceipt | undefined>;
  /** Dispatch to the journal owner and settle or time out the delivery. */
  commit(proposal: DraftEditProposal, signal: AbortSignal): Awaitable<void>;
}

/** Synchronous operations within the host's atomic journal commit boundary. */
export interface DraftAuthoringJournal {
  resolveDraft(turn: DraftTurn): DraftSnapshot | undefined;
  readReceipt(operation: DraftOperation): DraftEditReceipt | undefined;
  /** Validate and apply through the same revision-checked journal as manual edits. */
  apply(proposal: DraftEditProposal): DraftMutationOutcome;
  /** Retain by operation identity. A recording failure must roll back the draft mutation. */
  recordReceipt(receipt: DraftEditReceipt): void;
}

/**
 * Compose inside a governed capability handler. Actor, turn, operation ID and
 * signal come from trusted invocation context. The tool input supplies the
 * proposed edit and the target/revision it expects.
 */
export function createDraftAuthoring(host: DraftAuthoringHost) {
  async function discover(turn: DraftTurn): Promise<DraftSnapshot | undefined> {
    if (!validTurn(turn)) return undefined;
    const { actorId, turnId } = turn;
    const draft = await host.resolveDraft(Object.freeze({ actorId, turnId }));
    if (draft === undefined) return undefined;
    const { draftId, occurrenceId, revision } = draft;
    if (!isId(draftId) || !isId(occurrenceId) || !isRevision(revision)) {
      throw new Error('The draft resolver returned an invalid snapshot.');
    }
    return { draftId, occurrenceId, revision };
  }

  async function observe(operation: DraftOperation): Promise<DraftEditReceipt | undefined> {
    if (!validTurn(operation) || !isId(operation.operationId)) {
      throw new Error('Draft observation requires an exact operation identity.');
    }
    const key = operationKey(operation);
    const receipt = await host.readReceipt(key);
    if (receipt === undefined) return undefined;
    if (
      receipt.actorId !== key.actorId ||
      receipt.turnId !== key.turnId ||
      receipt.operationId !== key.operationId
    ) {
      throw new Error('The draft journal returned a receipt for another operation.');
    }
    return makeReceipt(bindingOf(receipt), receipt);
  }

  async function apply(
    invocation: DraftOperation & { readonly signal: AbortSignal },
    request: DraftEditRequest,
  ): Promise<DraftEditResult> {
    const key = operationKey(invocation);
    const { signal } = invocation;
    const { draftId, occurrenceId, expectedRevision, edit } = request;
    if (
      !validTurn(key) ||
      !isId(key.operationId) ||
      typeof signal?.aborted !== 'boolean' ||
      !isId(draftId) ||
      !isId(occurrenceId) ||
      !isRevision(expectedRevision) ||
      typeof edit !== 'string'
    ) {
      return { status: 'invalid' };
    }

    try {
      const proposal: DraftEditProposal = Object.freeze({
        ...key,
        draftId,
        occurrenceId,
        expectedRevision,
        edit,
        editDigest: digestEdit(edit),
      });
      const prior = await observe(key);
      if (prior !== undefined) return confirm(proposal, prior);

      const draft = await discover(key);
      if (draft === undefined || !sameTarget(draft, proposal)) {
        // An in-flight delivery may have committed before the draft closed.
        const receipt = await observe(key);
        return receipt === undefined ? { status: 'denied' } : confirm(proposal, receipt);
      }

      try {
        await host.commit(proposal, signal);
      } catch {
        // The transport can fail after the journal commits. Read the journal
        // on either path and keep the outcome uncertain if it cannot confirm.
      }
      const receipt = await observe(key);
      return receipt === undefined ? { status: 'unconfirmed' } : confirm(proposal, receipt);
    } catch {
      return { status: 'unconfirmed' };
    }
  }

  return { discover, apply, observe };
}

/**
 * Run at the journal owner, after any async preparation, inside the host's
 * commit boundary. The host serializes receipt writes, draft edits and Stop
 * here. For a remote journal, use the signal fenced by that journal's owner.
 */
export function commitDraftEdit(
  proposal: DraftEditProposal,
  signal: AbortSignal,
  journal: DraftAuthoringJournal,
): void {
  const binding = bindingOf(proposal);
  const { edit } = proposal;
  if (typeof edit !== 'string') throw new Error('The draft proposal contains invalid edit data.');
  if (digestEdit(edit) !== binding.editDigest) {
    throw new Error('The draft proposal edit does not match its digest.');
  }

  const key = operationKey(binding);
  // A terminal receipt wins even after Stop, undo, or loss of draft access.
  if (journal.readReceipt(key) !== undefined) return;

  const draft = journal.resolveDraft({ actorId: key.actorId, turnId: key.turnId });
  const stopped = signal?.aborted;
  if (typeof stopped !== 'boolean') throw new Error('The journal requires a turn Stop fence.');

  let outcome: DraftEditOutcome;
  if (draft === undefined || !sameTarget(draft, binding)) {
    outcome = { status: 'denied' };
  } else if (stopped) {
    outcome = { status: 'cancelled' };
  } else if (draft.revision !== binding.expectedRevision) {
    outcome = { status: 'stale', revision: draft.revision };
  } else {
    outcome = journal.apply(Object.freeze({ ...binding, edit }));
  }
  journal.recordReceipt(makeReceipt(binding, outcome));
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRevision(value: unknown): value is DraftRevision {
  return isId(value) || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
}

function validTurn(turn: DraftTurn): boolean {
  return isId(turn.actorId) && isId(turn.turnId);
}

function sameTarget(left: DraftTarget, right: DraftTarget): boolean {
  return left.draftId === right.draftId && left.occurrenceId === right.occurrenceId;
}

function operationKey({ actorId, turnId, operationId }: DraftOperation): DraftOperation {
  return Object.freeze({ actorId, turnId, operationId });
}

function bindingOf(value: DraftEditBinding): DraftEditBinding {
  const key = operationKey(value);
  const { draftId, occurrenceId, expectedRevision, editDigest } = value;
  if (
    !validTurn(key) ||
    !isId(key.operationId) ||
    !isId(draftId) ||
    !isId(occurrenceId) ||
    !isRevision(expectedRevision) ||
    typeof editDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(editDigest)
  ) {
    throw new Error('The draft journal requires an exact edit binding.');
  }
  return { ...key, draftId, occurrenceId, expectedRevision, editDigest };
}

function makeReceipt(binding: DraftEditBinding, outcome: DraftEditOutcome): DraftEditReceipt {
  const { status } = outcome;
  switch (status) {
    case 'applied':
    case 'stale':
      if (!isRevision(outcome.revision) || outcome.revision === binding.expectedRevision) {
        throw new Error('The draft journal returned an invalid result revision.');
      }
      return Object.freeze({ ...binding, status, revision: outcome.revision });
    case 'cancelled':
    case 'denied':
    case 'invalid':
      return Object.freeze({ ...binding, status });
    default:
      throw new Error('The draft journal returned an invalid result status.');
  }
}

function confirm(proposal: DraftEditProposal, receipt: DraftEditReceipt): DraftEditResult {
  return sameTarget(proposal, receipt) &&
    proposal.expectedRevision === receipt.expectedRevision &&
    proposal.editDigest === receipt.editDigest
    ? { status: 'confirmed', receipt }
    : { status: 'operation-conflict' };
}

function digestEdit(edit: string): string {
  // JSON string encoding preserves lone surrogates before hashing the UTF-8 bytes.
  return sha256(JSON.stringify(edit));
}
