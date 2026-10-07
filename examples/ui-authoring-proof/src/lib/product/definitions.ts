/**
 * The fictional inspection domain (PROOF-DESIGN §1) as REAL VICT
 * declarations: one `vict.application@3` application whose detail screen is
 * DOCUMENT MODE, resources, actions, and the authored UI document.
 *
 * Execution semantics (transitions, permissions, optimistic concurrency)
 * live in `./domain.ts` — the adapter/dispatch boundary. Declarations here
 * are references only; nothing embeds resolved values.
 */

import {
  APPLICATION_DEFINITION_SCHEMA_V3,
  type ApplicationDefinitionV3,
  type ResourceDefinition,
} from '@victframework/sdk';
import { canonicalUiDocument, type UiDocument } from '@victframework/ui';

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export const inspectionResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'inspection',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
    { name: 'status', type: 'string', required: true, label: 'Status' },
    { name: 'technician', type: 'string', required: true, label: 'Technician' },
    { name: 'supervisor', type: 'string', required: true, label: 'Supervisor' },
    { name: 'submittedAt', type: 'date', label: 'Submitted' },
    { name: 'decidedAt', type: 'date', label: 'Decided' },
    { name: 'rejectionReason', type: 'string', label: 'Rejection reason' },
    { name: 'domainRevision', type: 'number', required: true, label: 'Domain revision' },
    // Joined child collections materialized by the adapter (disclosed U1
    // decision: the view projection exposes findings/evidence so the
    // document can bind them; the scalar domain fields are §1.1 unchanged).
    { name: 'findings', type: 'json', label: 'Findings' },
    { name: 'evidence', type: 'json', label: 'Evidence' },
    { name: 'activity', type: 'json', label: 'Activity' },
  ],
  mutations: [
    {
      op: 'submit',
      effect: 'write',
      inputContractId: 'c.decision',
      outputContractId: 'c.decision',
      permissions: ['qlt.inspection.submit'],
    },
    {
      op: 'approve',
      effect: 'irreversible',
      inputContractId: 'c.decision',
      outputContractId: 'c.decision',
      permissions: ['qlt.inspection.approve'],
    },
    {
      op: 'reject',
      effect: 'irreversible',
      inputContractId: 'c.decision',
      outputContractId: 'c.decision',
      permissions: ['qlt.inspection.reject'],
    },
    {
      op: 'revise',
      effect: 'write',
      inputContractId: 'c.decision',
      outputContractId: 'c.decision',
      permissions: ['qlt.inspection.revise'],
    },
  ],
  authorization: {},
} as unknown as ResourceDefinition;

export const findingResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'finding',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'inspectionId', type: 'string', required: true, label: 'Inspection' },
    { name: 'severity', type: 'string', required: true, label: 'Severity' },
    { name: 'description', type: 'string', required: true, label: 'Description' },
  ],
  mutations: [
    {
      op: 'add',
      effect: 'create',
      idempotency: 'keyed',
      permissions: ['qlt.inspection.edit'],
    },
  ],
  authorization: {},
} as unknown as ResourceDefinition;

export const evidenceResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'evidence',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'inspectionId', type: 'string', required: true, label: 'Inspection' },
    { name: 'label', type: 'string', required: true, label: 'Label' },
    { name: 'kind', type: 'string', required: true, label: 'Kind' },
  ],
  mutations: [
    {
      op: 'add',
      effect: 'create',
      idempotency: 'keyed',
      permissions: ['qlt.inspection.edit'],
    },
  ],
  authorization: {},
} as unknown as ResourceDefinition;

export const activityResource: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'activity',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'inspectionId', type: 'string', required: true, label: 'Inspection' },
    { name: 'at', type: 'date', required: true, label: 'At' },
    { name: 'actor', type: 'string', required: true, label: 'Actor' },
    { name: 'entry', type: 'string', required: true, label: 'Entry' },
  ],
  authorization: {},
} as unknown as ResourceDefinition;

/** Read-only rendering projection of the existing inspection.list result.
 * No storage, mutation, new record facts, or server implementation. */
export const inspectionQueueProjection: ResourceDefinition = {
  schema: 'vict.resource@1',
  id: 'inspectionQueue',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true },
    { name: 'inspections', type: 'json' },
  ],
  authorization: { effect: 'read' },
} as ResourceDefinition;

/* ------------------------------------------------------------------ */
/* The authored detail document (vict.ui-document@1)                   */
/* ------------------------------------------------------------------ */

export { inspectionDetailDocument, inspectionQueueDocument } from './documents.js';
import {
  inspectionDetailDocument,
  inspectionQueueDocument,
  productExtensions,
} from './documents.js';
export const evidenceViewerExtension = productExtensions[0]!;
export const inspectionDetailDigest = (): string =>
  canonicalUiDocument(inspectionDetailDocument).contentDigest;

/* ------------------------------------------------------------------ */
/* The @3 application                                                  */
/* ------------------------------------------------------------------ */

export const inspectionApplication: ApplicationDefinitionV3 = {
  schema: APPLICATION_DEFINITION_SCHEMA_V3,
  id: 'app.inspection',
  revision: '2',
  name: 'VICT Inspections',
  routes: [
    { id: 'queue', path: '/', screenId: 's.queue' },
    { id: 'detail', path: '/inspection/:id', screenId: 's.detail' },
  ],
  screens: [
    {
      id: 's.queue',
      title: 'Inspection queue',
      uiDocument: { documentId: 'doc.inspection-queue', revision: '1' },
    },
    {
      id: 's.detail',
      title: 'Inspection detail',
      uiDocument: { documentId: 'doc.inspection-detail', revision: '2' },
    },
  ],
  views: [
    {
      viewId: 'v.queue',
      resourceId: 'inspectionQueue',
      resourceRevision: '1',
      fields: ['inspections'],
    },
    {
      viewId: 'v.inspections',
      resourceId: 'inspection',
      resourceRevision: '1',
      fields: [
        'id',
        'title',
        'status',
        'technician',
        'supervisor',
        'domainRevision',
        'findings',
        'evidence',
        'activity',
      ],
    },
    {
      viewId: 'v.activity',
      resourceId: 'activity',
      resourceRevision: '1',
      fields: ['id', 'entry', 'actor', 'at'],
    },
  ],
  actions: [
    ...['list', 'get'].map((op) => ({
      kind: 'query' as const,
      id: `inspection.${op}`,
      revision: '1',
      resourceId: 'inspection',
      resourceRevision: '1',
      inputContractId: 'c.unit',
      inputContractRevision: '1',
      outputContractId: 'c.unit',
      outputContractRevision: '1',
    })),
    ...['approve', 'reject', 'revise', 'submit'].map((op) => ({
      kind: 'mutation' as const,
      id: `inspection.${op}`,
      revision: '1',
      resourceId: 'inspection',
      resourceRevision: '1',
      op,
      inputContractId: 'c.unit',
      inputContractRevision: '1',
      outputContractId: 'c.unit',
      outputContractRevision: '1',
    })),
    ...['finding', 'evidence'].map((resourceId) => ({
      kind: 'mutation' as const,
      id: `${resourceId}.add`,
      revision: '1',
      resourceId,
      resourceRevision: '1',
      op: 'add',
      inputContractId: 'c.unit',
      inputContractRevision: '1',
      outputContractId: 'c.unit',
      outputContractRevision: '1',
    })),
  ],
  resources: [
    { resourceId: 'inspectionQueue', revision: '1' },
    { resourceId: 'inspection', revision: '1' },
    { resourceId: 'finding', revision: '1' },
    { resourceId: 'evidence', revision: '1' },
    { resourceId: 'activity', revision: '1' },
  ],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V3 },
};
