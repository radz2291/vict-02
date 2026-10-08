/**
 * The consumer's SEEDED B1 documents (authored shape, canonical source of
 * truth). Every control is a registered component instance of a frozen B1
 * descriptor; outputs wire through the frozen binding vocabulary. These are
 * the EDITOR'S STARTING documents — the founder edits them in the Inspector
 * and the finished app replays the SAVED result.
 */
import type { UiDocument } from '@victframework/ui';

const registries = {
  componentDefinitions: {},
  styleSources: {},
  tokens: {},
  conditions: {},
  assets: {},
} as const;

/** Task controls: button (declared action + loading), checkboxes A/B feeding a declared submission, select, switch, toggle, radio-group. */
export const taskControlsDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'consumer.taskControls',
  revision: 'r1',
  root: 'page',
  ...registries,
  localState: {
    ackFindings: { key: 'ackFindings', type: 'boolean', initial: false },
    ackPricing: { key: 'ackPricing', type: 'boolean', initial: false },
    approving: { key: 'approving', type: 'boolean', initial: false },
    submissionError: { key: 'submissionError', type: 'string', initial: '' },
    submissionResult: { key: 'submissionResult', type: 'string', initial: '' },
    region: { key: 'region', type: 'string', initial: '' },
    reviewer: { key: 'reviewer', type: 'string', initial: '' },
    notifications: { key: 'notifications', type: 'boolean', initial: true },
    escalated: { key: 'escalated', type: 'boolean', initial: false },
    tags: { key: 'tags', type: 'stringList', initial: [] },
  },
  nodes: {
    page: {
      kind: 'element',
      id: 'page',
      tag: 'section',
      children: [
        'heading',
        'ackA',
        'ackB',
        'regionSelect',
        'notifySwitch',
        'escalateToggle',
        'reviewerRadio',
        'submitBar',
      ],
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'text', value: '14px' } },
        { property: 'max-width', value: { type: 'text', value: '560px' } },
        { property: 'margin', value: { type: 'text', value: '0 auto' } },
        { property: 'padding', value: { type: 'text', value: '24px' } },
      ],
    },
    heading: { kind: 'element', id: 'heading', tag: 'h1', children: ['headingText'] },
    headingText: {
      kind: 'text',
      id: 'headingText',
      content: { type: 'literal', value: 'Task review' },
    },
    ackA: {
      kind: 'component',
      id: 'ackA',
      definitionId: 'vict.catalog.checkbox',
      props: {
        label: { type: 'literal', value: 'Acknowledge findings' },
        checked: { type: 'ref', path: 'state.ackFindings' },
      },
      outputs: {
        checkedChange: {
          setState: { key: 'ackFindings', value: { type: 'ref', path: '$output' } },
        },
      },
    },
    ackB: {
      kind: 'component',
      id: 'ackB',
      definitionId: 'vict.catalog.checkbox',
      props: {
        label: { type: 'literal', value: 'Acknowledge pricing' },
        checked: { type: 'ref', path: 'state.ackPricing' },
      },
      outputs: {
        checkedChange: { setState: { key: 'ackPricing', value: { type: 'ref', path: '$output' } } },
      },
    },
    regionSelect: {
      kind: 'component',
      id: 'regionSelect',
      definitionId: 'vict.catalog.select',
      props: {
        options: { type: 'ref', path: 'view.regions' },
        value: { type: 'ref', path: 'state.region' },
      },
      outputs: {
        valueChange: { setState: { key: 'region', value: { type: 'ref', path: '$output' } } },
      },
    },
    notifySwitch: {
      kind: 'component',
      id: 'notifySwitch',
      definitionId: 'vict.catalog.switch',
      props: {
        label: { type: 'literal', value: 'Email notifications' },
        checked: { type: 'ref', path: 'state.notifications' },
      },
      outputs: {
        checkedChange: {
          setState: { key: 'notifications', value: { type: 'ref', path: '$output' } },
        },
      },
    },
    escalateToggle: {
      kind: 'component',
      id: 'escalateToggle',
      definitionId: 'vict.catalog.toggle',
      props: {
        label: { type: 'literal', value: 'Escalate to lead' },
        pressed: { type: 'ref', path: 'state.escalated' },
      },
      outputs: {
        pressedChange: { setState: { key: 'escalated', value: { type: 'ref', path: '$output' } } },
      },
    },
    reviewerRadio: {
      kind: 'component',
      id: 'reviewerRadio',
      definitionId: 'vict.catalog.radio-group',
      props: {
        label: { type: 'literal', value: 'Reviewer' },
        options: { type: 'ref', path: 'view.reviewers' },
        value: { type: 'ref', path: 'state.reviewer' },
      },
      outputs: {
        valueChange: { setState: { key: 'reviewer', value: { type: 'ref', path: '$output' } } },
      },
    },
    submitBar: {
      kind: 'element',
      id: 'submitBar',
      tag: 'div',
      children: ['submitBtn'],
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'gap', value: { type: 'text', value: '10px' } },
      ],
    },
    submitBtn: {
      kind: 'component',
      id: 'submitBtn',
      definitionId: 'vict.catalog.button',
      props: {
        label: { type: 'literal', value: 'Submit review' },
        loading: { type: 'ref', path: 'state.approving' },
        disabled: { type: 'boolean', op: 'or', terms: [
          { type: 'boolean', op: 'not', terms: [{ type: 'ref', path: 'state.ackFindings' }] },
          { type: 'boolean', op: 'not', terms: [{ type: 'ref', path: 'state.ackPricing' }] },
          { type: 'compare', op: 'eq', left: { type: 'ref', path: 'state.region' }, right: { type: 'literal', value: '' } },
        ] },
      },
      outputs: {
        press: {
          invokeAction: {
            actionId: 'task.submit',
            input: { noteId: { type: 'literal', value: 't_1' }, ackFindings: { type: 'ref', path: 'state.ackFindings' }, ackPricing: { type: 'ref', path: 'state.ackPricing' }, region: { type: 'ref', path: 'state.region' } },
          },
        },
      },
    },
  },
};

/** App shell + dialog: content slot composition, nav, P-overlay open loop with an authored confirm control. */
export const taskShellDocument: UiDocument = {
  schema: 'vict.ui-document@1',
  id: 'consumer.taskShell',
  revision: 'r1',
  root: 'shell',
  ...registries,
  localState: {
    assignOpen: { key: 'assignOpen', type: 'boolean', initial: false },
    reviewer: { key: 'reviewer', type: 'string', initial: '' },
  },
  nodes: {
    shell: {
      kind: 'component',
      id: 'shell',
      definitionId: 'vict.catalog.appshell',
      props: { title: { type: 'literal', value: 'Review queue' }, navigation: { type: 'ref', path: 'view.shellNavigation' }, path: { type: 'ref', path: 'view.path' }, navigationMode: { type: 'ref', path: 'view.navigationMode' }, navigationAt: { type: 'ref', path: 'view.navigationAt' } },
      slots: { content: { name: 'content', children: ['content'] } },
    },
    content: {
      kind: 'element',
      id: 'content',
      tag: 'div',
      children: ['title', 'requestAssignment', 'assignTrigger'],
      localStyle: [
        { property: 'display', value: { type: 'text', value: 'flex' } },
        { property: 'flex-direction', value: { type: 'text', value: 'column' } },
        { property: 'gap', value: { type: 'text', value: '16px' } },
        { property: 'padding', value: { type: 'text', value: '8px' } },
      ],
    },
    title: { kind: 'element', id: 'title', tag: 'h2', children: ['titleText'] },
    titleText: {
      kind: 'text',
      id: 'titleText',
      content: { type: 'literal', value: 'Queue: 3 tasks awaiting review' },
    },
    requestAssignment: {
      kind: 'component', id: 'requestAssignment', definitionId: 'vict.catalog.button',
      props: { label: { type: 'literal', value: 'Request reviewer assignment' } },
      outputs: { press: { invokeAction: { actionId: 'task.approve', input: {
        noteId: { type: 'literal', value: 't_1' }, ack: { type: 'literal', value: true },
      } } } },
    },
    assignTrigger: {
      kind: 'component',
      id: 'assignTrigger',
      definitionId: 'vict.catalog.dialog',
      props: {
        title: { type: 'literal', value: 'assignment' },
        open: { type: 'ref', path: 'state.assignOpen' },
      },
      outputs: {
        openChange: { setState: { key: 'assignOpen', value: { type: 'ref', path: '$output' } } },
      },
      slots: {
        body: { name: 'body', children: ['dialogSelect', 'confirmBtn'] },
      },
    },
    dialogSelect: {
      kind: 'component', id: 'dialogSelect', definitionId: 'vict.catalog.select',
      props: { options: { type: 'ref', path: 'view.reviewers' }, value: { type: 'ref', path: 'state.reviewer' } },
      outputs: { valueChange: { setState: { key: 'reviewer' } } },
    },
    confirmBtn: {
      kind: 'component', id: 'confirmBtn', definitionId: 'vict.catalog.button',
      props: { label: { type: 'literal', value: 'Confirm assignment' } },
      outputs: { press: { invokeAction: { actionId: 'task.assign', input: {
        noteId: { type: 'literal', value: 't_1' }, reviewer: { type: 'ref', path: 'state.reviewer' },
      } } } },
    },
  },
};

export const consumerDocuments: readonly UiDocument[] = [taskControlsDocument, taskShellDocument];
