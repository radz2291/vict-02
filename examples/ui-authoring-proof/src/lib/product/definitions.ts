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

/* ------------------------------------------------------------------ */
/* The authored detail document (vict.ui-document@1)                   */
/* ------------------------------------------------------------------ */

export const inspectionDetailDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'doc.inspection-detail',
  revision: '1',
  root: 'n.root',
  nodes: {
    'n.root': {
      kind: 'element',
      id: 'n.root',
      tag: 'section',
      classes: ['detail'],
      styleSources: ['ss.detailLayout', 'ss.detailNarrow'],
      children: ['n.header', 'n.columns', 'n.actions'],
    },
    'n.header': {
      kind: 'element',
      id: 'n.header',
      tag: 'header',
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'align-items', value: { type: 'text', value: 'baseline' } },
        { property: 'gap', value: { type: 'token', id: 'space.md' } },
        { property: 'border-bottom', value: { type: 'text', value: '1px solid #d9dde3' } },
      ],
      children: ['n.title', 'n.status'],
    },
    'n.title': {
      kind: 'element',
      id: 'n.title',
      tag: 'h1',
      children: ['n.titleText'],
    },
    'n.titleText': {
      kind: 'text',
      id: 'n.titleText',
      content: { type: 'expression', expression: { type: 'ref', path: 'record.title' } },
    },
    'n.status': {
      kind: 'element',
      id: 'n.status',
      tag: 'span',
      attributes: { 'data-status': { type: 'ref', path: 'record.status' }, role: 'status' },
      localStyle: [
        { property: 'font-weight', value: { type: 'text', value: '600' } },
        { property: 'color', value: { type: 'token', id: 'color.accent' } },
      ],
      children: ['n.statusText'],
    },
    'n.statusText': {
      kind: 'text',
      id: 'n.statusText',
      content: { type: 'expression', expression: { type: 'ref', path: 'record.status' } },
    },
    'n.columns': {
      kind: 'element',
      id: 'n.columns',
      tag: 'div',
      styleSources: ['ss.columns'],
      children: ['n.findingsSection', 'n.sideRail'],
    },
    'n.findingsSection': {
      kind: 'element',
      id: 'n.findingsSection',
      tag: 'section',
      attributes: { 'aria-label': 'Findings' },
      children: ['n.findingsHeading', 'n.findingsList'],
    },
    'n.findingsHeading': {
      kind: 'element',
      id: 'n.findingsHeading',
      tag: 'h2',
      children: ['n.findingsHeadingText'],
    },
    'n.findingsHeadingText': {
      kind: 'text',
      id: 'n.findingsHeadingText',
      content: { type: 'literal', value: 'Findings' },
    },
    'n.findingsList': {
      kind: 'element',
      id: 'n.findingsList',
      tag: 'ul',
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'token', id: 'space.sm' } },
      ],
      children: ['n.findingsRepeat'],
    },
    'n.findingsRepeat': {
      kind: 'repeat',
      id: 'n.findingsRepeat',
      collection: { type: 'ref', path: 'view.findings' },
      key: { type: 'ref', path: 'repeat.finding.description' },
      itemName: 'finding',
      templateRoot: 'n.findingCard',
    },
    'n.findingCard': {
      kind: 'component',
      id: 'n.findingCard',
      definitionId: 'def.findingCard',
      props: {
        severity: { type: 'ref', path: 'repeat.finding.severity' },
        description: { type: 'ref', path: 'repeat.finding.description' },
      },
    },
    // def.findingCard body (prop scope: severity/description)
    'n.card': {
      kind: 'element',
      id: 'n.card',
      tag: 'article',
      attributes: { 'aria-label': { type: 'ref', path: 'prop.description' } },
      children: ['n.cardSeverity', 'n.cardDescription'],
    },
    'n.cardSeverity': {
      kind: 'element',
      id: 'n.cardSeverity',
      tag: 'strong',
      children: ['n.cardSeverityText'],
    },
    'n.cardSeverityText': {
      kind: 'text',
      id: 'n.cardSeverityText',
      content: {
        type: 'expression',
        expression: {
          type: 'conditionalValue',
          when: {
            type: 'compare',
            op: 'eq',
            left: { type: 'ref', path: 'prop.severity' },
            right: { type: 'literal', value: 'high' },
          },
          then: { type: 'literal', value: 'HIGH severity' },
          otherwise: { type: 'ref', path: 'prop.severity' },
        },
      },
    },
    'n.cardDescription': {
      kind: 'text',
      id: 'n.cardDescription',
      content: { type: 'expression', expression: { type: 'ref', path: 'prop.description' } },
    },
    'n.sideRail': {
      kind: 'element',
      id: 'n.sideRail',
      tag: 'aside',
      attributes: { 'aria-label': 'Evidence and activity' },
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'token', id: 'space.md' } },
      ],
      children: ['n.evidenceHeading', 'n.evidenceList'],
    },
    'n.evidenceHeading': {
      kind: 'element',
      id: 'n.evidenceHeading',
      tag: 'h2',
      children: ['n.evidenceHeadingText'],
    },
    'n.evidenceHeadingText': {
      kind: 'text',
      id: 'n.evidenceHeadingText',
      content: { type: 'literal', value: 'Evidence' },
    },
    'n.evidenceList': {
      kind: 'element',
      id: 'n.evidenceList',
      tag: 'ul',
      children: ['n.evidenceRepeat'],
    },
    'n.evidenceRepeat': {
      kind: 'repeat',
      id: 'n.evidenceRepeat',
      collection: { type: 'ref', path: 'view.evidence' },
      key: { type: 'ref', path: 'repeat.evidenceItem.label' },
      itemName: 'evidenceItem',
      templateRoot: 'n.evidenceViewer',
    },
    'n.evidenceViewer': {
      kind: 'component',
      id: 'n.evidenceViewer',
      definitionId: 'ext.evidenceViewer',
      props: { label: { type: 'ref', path: 'repeat.evidenceItem.label' } },
    },
    'n.actions': {
      kind: 'element',
      id: 'n.actions',
      tag: 'div',
      attributes: { role: 'group', 'aria-label': 'Decision' },
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'gap', value: { type: 'token', id: 'space.md' } },
      ],
      children: ['n.approveButton', 'n.activityHeading', 'n.activityList'],
    },
    'n.approveButton': {
      kind: 'element',
      id: 'n.approveButton',
      tag: 'button',
      attributes: { type: 'button', 'aria-label': 'Approve inspection' },
      interactions: [
        {
          on: 'click',
          action: 'invokeAction',
          actionId: 'inspection.approve',
          input: {
            id: { type: 'ref', path: 'record.id' },
            expectedDomainRevision: { type: 'ref', path: 'record.domainRevision' },
          },
        },
      ],
      children: ['n.approveLabel'],
    },
    'n.approveLabel': {
      kind: 'text',
      id: 'n.approveLabel',
      content: { type: 'literal', value: 'Approve inspection' },
    },
    'n.activityHeading': {
      kind: 'element',
      id: 'n.activityHeading',
      tag: 'h2',
      children: ['n.activityHeadingText'],
    },
    'n.activityHeadingText': {
      kind: 'text',
      id: 'n.activityHeadingText',
      content: { type: 'literal', value: 'Activity' },
    },
    'n.activityList': {
      kind: 'element',
      id: 'n.activityList',
      tag: 'ul',
      children: ['n.activityRepeat'],
    },
    'n.activityRepeat': {
      kind: 'repeat',
      id: 'n.activityRepeat',
      collection: { type: 'ref', path: 'view.activity' },
      key: { type: 'ref', path: 'repeat.activityItem.entry' },
      itemName: 'activityItem',
      templateRoot: 'n.activityItem',
    },
    'n.activityItem': {
      kind: 'element',
      id: 'n.activityItem',
      tag: 'li',
      children: ['n.activityText'],
    },
    'n.activityText': {
      kind: 'text',
      id: 'n.activityText',
      content: {
        type: 'expression',
        expression: {
          type: 'op',
          name: 'concat',
          args: [
            { type: 'ref', path: 'repeat.activityItem.actor' },
            { type: 'literal', value: ': ' },
            { type: 'ref', path: 'repeat.activityItem.entry' },
          ],
        },
      },
    },
  },
  componentDefinitions: {
    'def.findingCard': {
      id: 'def.findingCard',
      revision: '1',
      root: 'n.card',
      props: [
        { name: 'severity', type: 'string', default: 'low' },
        { name: 'description', type: 'string', default: '' },
      ],
      slots: {},
      baseStyle: 'ss.findingCard',
    },
  },
  styleSources: {
    'ss.detailLayout': {
      id: 'ss.detailLayout',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'token', id: 'space.lg' } },
        { property: 'max-width', value: { type: 'text', value: '960px' } },
      ],
    },
    'ss.detailNarrow': {
      id: 'ss.detailNarrow',
      conditionId: 'cond.narrow',
      declarations: [{ property: 'max-width', value: { type: 'text', value: '100%' } }],
    },
    'ss.columns': {
      id: 'ss.columns',
      declarations: [
        { property: 'display', value: { type: 'text', value: 'grid' } },
        { property: 'grid-template-columns', value: { type: 'text', value: '2fr 1fr' } },
        { property: 'gap', value: { type: 'token', id: 'space.lg' } },
      ],
    },
    'ss.findingCard': {
      id: 'ss.findingCard',
      declarations: [
        { property: 'border', value: { type: 'text', value: '1px solid #d9dde3' } },
        { property: 'border-radius', value: { type: 'token', id: 'radius.md' } },
        { property: 'padding', value: { type: 'token', id: 'space.md' } },
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'token', id: 'space.xs' } },
      ],
    },
  },
  tokens: {
    'space.xs': { id: 'space.xs', value: '4px' },
    'space.sm': { id: 'space.sm', value: '8px' },
    'space.md': { id: 'space.md', value: '16px' },
    'space.lg': { id: 'space.lg', value: '24px' },
    'color.accent': { id: 'color.accent', value: '#0a6c96' },
    'radius.md': { id: 'radius.md', value: '8px' },
  },
  conditions: {
    'cond.narrow': { id: 'cond.narrow', kind: 'media', query: '(max-width: 700px)' },
  },
  assets: {},
  localState: {
    showDetails: { key: 'showDetails', type: 'boolean', initial: false },
  },
};

/** Declared extension descriptor: evidence viewer (labeled placeholder in U1). */
export const evidenceViewerExtension = {
  id: 'ext.evidenceViewer',
  revision: '1',
  props: [{ name: 'label', type: 'string', default: '' }],
  events: [],
  slots: [],
  styleTargets: [],
  rendererImplementationId: 'impl.evidenceViewer.placeholder',
  inspectionLimits: ['image-refs render as labeled placeholders in U1-U3'],
} as const;

/** The document's content digest (identity, U1-01). */
export const inspectionDetailDigest = (): string =>
  canonicalUiDocument(inspectionDetailDocument).contentDigest;

/* ------------------------------------------------------------------ */
/* The @3 application                                                  */
/* ------------------------------------------------------------------ */

export const inspectionApplication: ApplicationDefinitionV3 = {
  schema: APPLICATION_DEFINITION_SCHEMA_V3,
  id: 'app.inspection',
  revision: '1',
  name: 'Inspection proof',
  routes: [
    { id: 'queue', path: '/', screenId: 's.queue' },
    { id: 'detail', path: '/inspections/:id', screenId: 's.detail' },
  ],
  screens: [
    {
      id: 's.queue',
      title: 'Inspection queue',
      layout: [
        { name: 'main', surfaces: [{ role: 'text', id: 't.queue', content: 'Inspection queue' }] },
      ],
    },
    {
      id: 's.detail',
      title: 'Inspection detail',
      uiDocument: { documentId: 'doc.inspection-detail', revision: '1' },
    },
  ],
  views: [
    {
      viewId: 'v.inspections',
      resourceId: 'inspection',
      resourceRevision: '1',
      fields: ['id', 'title', 'status', 'domainRevision', 'findings', 'evidence', 'activity'],
    },
    {
      viewId: 'v.activity',
      resourceId: 'activity',
      resourceRevision: '1',
      fields: ['entry', 'actor'],
    },
  ],
  actions: [
    {
      kind: 'query',
      id: 'inspection.list',
      revision: '1',
      resourceId: 'inspection',
      resourceRevision: '1',
      inputContractId: 'c.unit',
      inputContractRevision: '1',
      outputContractId: 'c.unit',
      outputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'inspection.approve',
      revision: '1',
      resourceId: 'inspection',
      resourceRevision: '1',
      op: 'approve',
      inputContractId: 'c.unit',
      inputContractRevision: '1',
      outputContractId: 'c.unit',
      outputContractRevision: '1',
    },
  ],
  resources: [
    { resourceId: 'inspection', revision: '1' },
    { resourceId: 'finding', revision: '1' },
    { resourceId: 'evidence', revision: '1' },
    { resourceId: 'activity', revision: '1' },
  ],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V3 },
};
