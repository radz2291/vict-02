import {
  APPLICATION_DEFINITION_SCHEMA,
  RESOURCE_DEFINITION_SCHEMA,
  defineApplication,
  defineContract,
  defineResource,
} from '@vict/sdk';
import { compileApplication } from '@vict/application';
import type { ApplicationPlan } from '@vict/application';

/**
 * The ENTIRE proof application surface, described neutrally.
 *
 * This module contains no Svelte, no React, and no renderer code: it is the
 * framework-neutral Application Definition plus its resource/contract
 * bindings, compiled into an immutable Application Plan. The generic host
 * in `src/routes/[...vict]` renders whatever this definition declares — no
 * manual page shell exists for the declared screen.
 */

export const noteInputContract = defineContract<{ id: string; title: string }>({
  id: 'proof.note.input',
  revision: '1',
  expected: '{ id: string, title: string }',
  parse: (input) => {
    const candidate = input as { id?: unknown; title?: unknown } | null;
    if (
      candidate !== null &&
      typeof candidate === 'object' &&
      typeof candidate.id === 'string' &&
      candidate.id.length > 0 &&
      typeof candidate.title === 'string'
    ) {
      return { ok: true as const, value: { id: candidate.id, title: candidate.title } };
    }
    return {
      ok: false as const,
      issues: [
        { code: 'invalid_type', path: '(root)', message: 'a note with id and title is required' },
      ],
    };
  },
});

export const noteResource = defineResource({
  schema: RESOURCE_DEFINITION_SCHEMA,
  id: 'notes',
  revision: '1',
  identity: { key: 'id' },
  fields: [
    { name: 'id', type: 'string', required: true, label: 'Id' },
    { name: 'title', type: 'string', required: true, label: 'Title' },
  ],
  queries: { list: { sort: ['title'], pagination: true } },
  mutations: [
    {
      op: 'create',
      effect: 'write',
      inputContractId: 'proof.note.input',
      idempotency: 'keyed',
      permissions: ['notes.create'],
    },
    {
      op: 'delete',
      effect: 'write',
      permissions: ['notes.admin.delete'],
    },
  ],
  authorization: { effect: 'read' },
});

export const proofApplication = defineApplication({
  schema: APPLICATION_DEFINITION_SCHEMA,
  id: 'app.proof',
  revision: '1',
  name: 'Stage 04 Proof',
  routes: [
    {
      id: 'home',
      path: '/',
      screenId: 's.home',
      nav: { label: 'Proof', order: 1 },
    },
  ],
  screens: [
    {
      id: 's.home',
      title: 'Stage 04 Proof',
      layout: [
        {
          name: 'header',
          surfaces: [{ role: 'text', id: 't.heading', content: 'VICT Application Proof' }],
        },
        {
          name: 'main',
          surfaces: [
            { role: 'view', id: 'sv.notes', viewId: 'v.notes' },
            {
              role: 'form',
              id: 'sf.note',
              formId: 'f.note',
            },
            {
              role: 'action',
              id: 'sa.clear',
              actionId: 'act.clear',
              label: 'Clear form',
            },
            {
              role: 'action',
              id: 'sa.summarize',
              actionId: 'act.summarize',
              label: 'Summarize (VICT capability)',
            },
            {
              role: 'action',
              id: 'sa.adminDelete',
              actionId: 'act.adminDelete',
              label: 'Admin delete (denied below UI)',
            },
            {
              role: 'component',
              id: 'sc.badge',
              componentId: 'cmp.badge',
              revision: '1',
              props: { label: 'custom component' },
            },
          ],
        },
      ],
      states: {
        loading: { role: 'text', id: 't.loading', content: 'Loading…' },
        empty: { role: 'text', id: 't.empty', content: 'No notes yet.' },
        denied: { role: 'text', id: 't.denied', content: 'Denied by the authorization boundary.' },
        failure: { role: 'text', id: 't.failure', content: 'Something failed safely.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.notes',
      resourceId: 'notes',
      resourceRevision: '1',
      fields: ['id', 'title'],
    },
  ],
  forms: [
    {
      formId: 'f.note',
      resourceId: 'notes',
      resourceRevision: '1',
      inputContractId: 'proof.note.input',
      fields: [
        { name: 'id', label: 'Id', required: true, widget: 'text' },
        { name: 'title', label: 'Title', required: true, widget: 'text' },
      ],
      submitActionId: 'act.create',
    },
  ],
  actions: [
    { kind: 'local', id: 'act.clear', revision: '1' },
    {
      kind: 'mutation',
      id: 'act.create',
      revision: '1',
      resourceId: 'notes',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'proof.note.input',
    },
    {
      kind: 'mutation',
      id: 'act.adminDelete',
      revision: '1',
      resourceId: 'notes',
      resourceRevision: '1',
      op: 'delete',
    },
    {
      kind: 'capability',
      id: 'act.summarize',
      revision: '1',
      capabilityId: 'proof.summarize',
      capabilityRevision: '1',
      inputContractId: 'proof.note.input',
    },
  ],
  resources: [{ resourceId: 'notes', revision: '1' }],
  components: [{ componentId: 'cmp.badge', revision: '1' }],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA },
});

/** Available contract/capability/component bindings for compilation. */
export const proofBindings = {
  contracts: [{ id: 'proof.note.input', revision: '1' }],
  capabilities: [{ id: 'proof.summarize', revision: '1' }],
  components: [{ componentId: 'cmp.badge', revision: '1' }],
} as const;

/** Compile the neutral definition into the immutable plan. */
export function compileProofPlan(): ApplicationPlan {
  const result = compileApplication({
    application: proofApplication,
    resources: [noteResource],
    contracts: proofBindings.contracts,
    capabilities: proofBindings.capabilities,
    components: proofBindings.components,
  });
  if (!result.ok) {
    throw new Error(`proof definition invalid: ${JSON.stringify(result.issues)}`);
  }
  return result.plan;
}
