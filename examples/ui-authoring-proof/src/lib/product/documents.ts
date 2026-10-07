/** Canonical product presentation. Helpers only construct vict.ui-document@1 data. */
import type {
  UiDocument,
  UiExpression,
  UiNode,
  UiStyleDeclaration,
  UiExtensionDescriptor,
} from '@victframework/ui';

const ref = (path: string): UiExpression => ({ type: 'ref', path });
const lit = (value: string | number | boolean): UiExpression => ({ type: 'literal', value });
const eq = (path: string, value: string): UiExpression => ({
  type: 'compare',
  op: 'eq',
  left: ref(path),
  right: lit(value),
});
const and = (...terms: UiExpression[]): UiExpression => ({ type: 'boolean', op: 'and', terms });
const or = (...terms: UiExpression[]): UiExpression => ({ type: 'boolean', op: 'or', terms });
const concat = (...args: UiExpression[]): UiExpression => ({ type: 'op', name: 'concat', args });
const css = (values: Record<string, string>): UiStyleDeclaration[] =>
  Object.entries(values).map(([property, value]) => ({ property, value: { type: 'text', value } }));

export const productExtensions: readonly UiExtensionDescriptor[] = [
  {
    id: 'ext.evidenceViewer',
    revision: '2',
    props: [
      { name: 'label', type: 'string', default: '' },
      { name: 'kind', type: 'string', default: 'image-ref' },
    ],
    rendererImplementationId: 'impl.evidenceViewer.placeholder.v2',
    inspectionLimits: ['Labelled placeholder; no image is fetched.'],
  },
  {
    id: 'ext.button',
    revision: '1',
    props: [
      { name: 'label', type: 'string', default: '' },
      { name: 'variant', type: 'string', default: 'primary' },
      { name: 'disabled', type: 'boolean', default: false },
    ],
    rendererImplementationId: 'impl.vict.button.submit',
    inspectionLimits: ['Props only; form owns submit interaction.'],
  },
  {
    id: 'ext.status',
    revision: '1',
    props: [
      { name: 'value', type: 'string', default: '' },
      { name: 'tone', type: 'string', default: 'neutral' },
    ],
    rendererImplementationId: 'impl.vict.status',
    inspectionLimits: ['Props only.'],
  },
  {
    id: 'ext.feedback',
    revision: '1',
    props: [
      { name: 'message', type: 'string', default: '' },
      { name: 'kind', type: 'string', default: 'status' },
    ],
    rendererImplementationId: 'impl.vict.feedback',
    inspectionLimits: ['Props only.'],
  },
];

function author(id: string, revision: string) {
  const doc: UiDocument = {
    schema: 'vict.ui-document@1',
    id,
    revision,
    root: 'n.root',
    nodes: {},
    componentDefinitions: {},
    styleSources: {},
    tokens: {},
    conditions: {},
    assets: {},
    localState: {},
  };
  const presentationState: Record<string, string | number | boolean> = {
    actorRole: 'supervisor',
    actorId: 's.hart',
    busy: false,
    findingCount: 0,
    evidenceCount: 0,
    hasFindings: false,
    hasEvidence: false,
    hasFeedback: false,
    feedbackMessage: '',
    feedbackKind: 'status',
    canReload: false,
    awaitingCount: 0,
    inspectionCount: 0,
    hasError: false,
    hasRows: false,
  };
  for (const [key, initial] of Object.entries(presentationState))
    (doc.localState as Record<string, UiDocument['localState'][string]>)[key] = {
      key,
      type: typeof initial as 'string' | 'number' | 'boolean',
      initial,
    };
  const nodes = doc.nodes as Record<string, UiNode>;
  const styles = doc.styleSources as Record<
    string,
    { id: string; declarations: UiStyleDeclaration[]; conditionId?: string }
  >;
  const conditions = doc.conditions as Record<string, UiDocument['conditions'][string]>;
  const add = (node: UiNode) => {
    nodes[node.id] = node;
    return node.id;
  };
  const text = (id: string, content: string | UiExpression) =>
    add({
      id,
      kind: 'text',
      content:
        typeof content === 'string'
          ? { type: 'literal', value: content }
          : { type: 'expression', expression: content },
    });
  const el = (
    id: string,
    tag: string,
    children: string[],
    style: Record<string, string> = {},
    attributes: Record<string, string | UiExpression> = {},
    classes: string[] = [],
  ) => add({ id, kind: 'element', tag, children, attributes, classes, localStyle: css(style) });
  const words = (
    id: string,
    tag: string,
    value: string | UiExpression,
    style: Record<string, string> = {},
  ) => el(id, tag, [text(`${id}Text`, value)], style);
  const ext = (id: string, definitionId: string, props: Record<string, UiExpression>) =>
    add({ id, kind: 'component', definitionId, props });
  const when = (
    id: string,
    predicate: UiExpression,
    children: string[],
    fallback: string[] = [],
  ) => {
    conditions[id] = { id, kind: 'localState', when: predicate };
    return add({
      id,
      kind: 'conditional',
      branches: [{ when: id, children }, { children: fallback }],
    });
  };
  const style = (id: string, values: Record<string, string>, conditionId?: string) => {
    styles[id] = { id, declarations: css(values), ...(conditionId ? { conditionId } : {}) };
  };
  const responsive = (node: string, values: Record<string, string>) => {
    const n = nodes[node];
    if (n) styles[`${node}.base`] = { id: `${node}.base`, declarations: [...(n.localStyle ?? [])] };
    style(`${node}.mobile`, values, 'cond.narrow');
    style(`${node}.container`, values, 'cond.container');
    if (n)
      nodes[node] = {
        ...n,
        localStyle: [],
        styleSources: [`${node}.base`, `${node}.mobile`, `${node}.container`],
      };
  };
  conditions['cond.narrow'] = { id: 'cond.narrow', kind: 'media', query: '(max-width: 700px)' };
  conditions['cond.container'] = {
    id: 'cond.container',
    kind: 'container',
    name: 'inspection',
    query: '(max-width: 600px)',
  };
  const status = (id: string, path: string) =>
    ext(id, 'ext.status', {
      value: ref(path),
      tone: {
        type: 'conditionalValue',
        when: eq(path, 'approved'),
        then: lit('success'),
        otherwise: {
          type: 'conditionalValue',
          when: eq(path, 'rejected'),
          then: lit('danger'),
          otherwise: {
            type: 'conditionalValue',
            when: eq(path, 'submitted'),
            then: lit('info'),
            otherwise: lit('neutral'),
          },
        },
      },
    });
  const link = (id: string, label: string, href: UiExpression) =>
    el(
      id,
      'a',
      [text(`${id}Text`, label)],
      { color: 'var(--vict-color-accent)', 'font-weight': '600', 'text-decoration': 'none' },
      { href },
    );
  const brand = el(
    'n.brand',
    'nav',
    [
      link('n.brandLink', 'VICT / Inspections', concat(lit('/?as='), ref('state.actorRole'))),
      words('n.identity', 'span', concat(lit('Fictional demo · '), ref('state.actorRole')), {
        color: 'var(--vict-color-textMuted)',
        'font-size': '13px',
      }),
    ],
    {
      display: 'flex',
      'justify-content': 'space-between',
      'align-items': 'center',
      gap: '12px',
      'flex-wrap': 'wrap',
      'padding-bottom': '24px',
      'border-bottom': '1px solid var(--vict-color-border)',
    },
    { 'aria-label': 'Application' },
  );
  const root = (children: string[]) => {
    el('n.root', 'main', [brand, ...children], {
      'max-width': '1120px',
      margin: '0 auto',
      padding: '32px',
      display: 'flex',
      'flex-direction': 'column',
      gap: '28px',
      'min-width': '0',
      'overflow-wrap': 'anywhere',
    });
    responsive('n.root', { padding: '20px 16px', gap: '22px' });
  };
  return { doc, nodes, add, text, el, words, ext, when, style, responsive, status, link, root };
}

const panel = {
  background: 'var(--vict-color-surface)',
  border: '1px solid var(--vict-color-border)',
  'border-radius': '12px',
  padding: '24px',
  'min-width': '0',
};
const heading = {
  margin: '0',
  'font-size': '18px',
  'line-height': '1.3',
  'letter-spacing': '-0.02em',
};
const muted = { margin: '0', color: 'var(--vict-color-textMuted)', 'font-size': '14px' };
const stack = { display: 'flex', 'flex-direction': 'column', gap: '16px', 'min-width': '0' };
const list = { ...stack, padding: '0', margin: '0', 'list-style': 'none' };

function detail(): UiDocument {
  const a = author('doc.inspection-detail', '2');
  const { doc, nodes, add, el, words, text, ext, when, status, root, responsive } = a;
  const state = doc.localState as Record<string, UiDocument['localState'][string]>;
  for (const [key, initial] of Object.entries({
    reason: '',
    finding: '',
    severity: 'low',
    evidence: '',
    evidenceKind: 'note',
  }))
    state[key] = { key, type: 'string', initial };
  const input = (id: string, label: string, stateKey: string, placeholder: string) => {
    el(
      id,
      'input',
      [],
      {},
      {
        id,
        type: 'text',
        value: ref(`state.${stateKey}`),
        placeholder,
        required: lit(true),
        disabled: ref('state.busy'),
      },
      ['vict-input'],
    );
    nodes[id] = {
      ...nodes[id],
      interactions: [
        { on: 'change', action: 'setState', key: stateKey, value: ref(`state.${stateKey}`) },
      ],
    } as UiNode;
    return el(
      `${id}.field`,
      'div',
      [
        el(
          `${id}.label`,
          'label',
          [text(`${id}.labelText`, label)],
          { 'font-weight': '600', 'font-size': '14px' },
          { for: id },
        ),
        id,
      ],
      { ...stack, gap: '6px' },
    );
  };
  const select = (id: string, label: string, key: string, options: string[]) => {
    el(
      id,
      'select',
      options.map((value) =>
        el(
          `${id}.${value}`,
          'option',
          [text(`${id}.${value}Text`, value === 'image-ref' ? 'Image reference' : value)],
          {},
          {
            value,
            'aria-label': value === 'image-ref' ? 'Image reference' : value,
            selected: eq(`state.${key}`, value),
          },
        ),
      ),
      {},
      { id, 'aria-label': label, disabled: ref('state.busy') },
      ['vict-select'],
    );
    nodes[id] = {
      ...nodes[id],
      interactions: [{ on: 'change', action: 'setState', key, value: ref(`state.${key}`) }],
    } as UiNode;
    return id;
  };
  const action = (
    id: string,
    label: string,
    actionId: string,
    params: Record<string, UiExpression>,
    fields: string[] = [],
    variant = 'primary',
    invalid?: UiExpression,
  ) => {
    const button = ext(`${id}.button`, 'ext.button', {
      label: lit(label),
      variant: lit(variant),
      disabled: invalid ? or(ref('state.busy'), invalid) : ref('state.busy'),
    });
    el(
      id,
      'form',
      [...fields, button],
      { ...stack, 'align-items': 'stretch' },
      { 'aria-label': label },
    );
    nodes[id] = {
      ...nodes[id],
      interactions: [{ on: 'submit', action: 'invokeAction', actionId, input: params }],
    } as UiNode;
    return id;
  };
  const identity = { id: ref('record.id'), expectedDomainRevision: ref('record.domainRevision') };
  const choose = (
    when: UiExpression,
    then: string | UiExpression,
    otherwise: string | UiExpression,
  ): UiExpression => ({
    type: 'conditionalValue',
    when,
    then: typeof then === 'string' ? lit(then) : then,
    otherwise: typeof otherwise === 'string' ? lit(otherwise) : otherwise,
  });
  const isAssigned = and(eq('state.actorRole', 'technician'), {
    type: 'compare',
    op: 'eq',
    left: ref('record.technician'),
    right: ref('state.actorId'),
  });
  const nextAction = choose(
    eq('record.status', 'approved'),
    'Approved. The review is complete.',
    choose(
      eq('record.status', 'rejected'),
      choose(
        isAssigned,
        'Returned for correction. Start corrections, then resubmit for review.',
        'Returned for correction. The assigned technician can revise and resubmit.',
      ),
      choose(
        eq('record.status', 'draft'),
        choose(
          isAssigned,
          'Complete the corrections, then submit for review.',
          'Draft. Waiting for the assigned technician to submit.',
        ),
        choose(
          eq('state.actorRole', 'supervisor'),
          'Review the findings and evidence, then approve or return for correction.',
          'Submitted for review. A supervisor will make the decision.',
        ),
      ),
    ),
  );
  const supervisorSubmitted = and(
    eq('state.actorRole', 'supervisor'),
    eq('record.status', 'submitted'),
  );
  const assigned = and(eq('state.actorRole', 'technician'), {
    type: 'compare',
    op: 'eq',
    left: ref('record.technician'),
    right: ref('state.actorId'),
  });
  const approve = el(
    'n.approveButton',
    'button',
    [text('n.approveLabel', 'Approve inspection')],
    {},
    { type: 'button', disabled: ref('state.busy') },
    ['vict-btn'],
  );
  nodes[approve] = {
    ...nodes[approve],
    interactions: [
      { on: 'click', action: 'invokeAction', actionId: 'inspection.approve', input: identity },
    ],
  } as UiNode;
  const reject = action(
    'n.rejectForm',
    'Return for correction',
    'inspection.reject',
    { ...identity, rejectionReason: ref('state.reason') },
    [input('n.reason', 'Reason for return', 'reason', 'Explain what needs to change')],
    'danger',
    eq('state.reason', ''),
  );
  const decisions = when(
    'n.supervisorDecision',
    supervisorSubmitted,
    [el('n.decisionControls', 'div', [approve, reject], { ...stack, 'align-items': 'stretch' })],
    [words('n.decisionHelp', 'p', nextAction, muted)],
  );
  const revise = when('n.reviseAvailable', and(assigned, eq('record.status', 'rejected')), [
    action(
      'n.reviseForm',
      'Start corrections',
      'inspection.revise',
      { id: ref('record.id') },
      [],
      'secondary',
    ),
  ]);
  const submit = when('n.submitAvailable', and(assigned, eq('record.status', 'draft')), [
    action('n.submitForm', 'Submit for review', 'inspection.submit', { id: ref('record.id') }),
  ]);
  const corrections = when(
    'n.correctionsAvailable',
    and(
      eq('state.actorRole', 'technician'),
      or(eq('record.status', 'draft'), eq('record.status', 'submitted')),
    ),
    [
      el(
        'n.corrections',
        'section',
        [
          words('n.correctionsHeading', 'h2', 'Add corrections', heading),
          words(
            'n.correctionsHelp',
            'p',
            'Record additional findings and labelled evidence for this inspection.',
            muted,
          ),
          action(
            'n.findingForm',
            'Add finding',
            'finding.add',
            {
              inspectionId: ref('record.id'),
              description: ref('state.finding'),
              severity: ref('state.severity'),
            },
            [
              select('n.severity', 'Finding severity', 'severity', ['low', 'medium', 'high']),
              input('n.findingInput', 'Finding description', 'finding', 'Describe the finding'),
            ],
            'secondary',
            eq('state.finding', ''),
          ),
          action(
            'n.evidenceForm',
            'Add evidence',
            'evidence.add',
            {
              inspectionId: ref('record.id'),
              label: ref('state.evidence'),
              kind: ref('state.evidenceKind'),
            },
            [
              select('n.evidenceKind', 'Evidence kind', 'evidenceKind', ['note', 'image-ref']),
              input('n.evidenceInput', 'Evidence label', 'evidence', 'Describe this evidence'),
            ],
            'secondary',
            eq('state.evidence', ''),
          ),
        ],
        { ...panel, ...stack },
      ),
    ],
  );
  const findingCard = add({
    id: 'n.findingCard',
    kind: 'component',
    definitionId: 'def.findingCard',
    props: {
      severity: ref('repeat.finding.severity'),
      description: ref('repeat.finding.description'),
    },
  });
  el(
    'n.card',
    'li',
    [
      ext('n.cardSeverity', 'ext.status', {
        value: concat(ref('prop.severity'), lit(' severity')),
        tone: {
          type: 'conditionalValue',
          when: eq('prop.severity', 'high'),
          then: lit('danger'),
          otherwise: {
            type: 'conditionalValue',
            when: eq('prop.severity', 'medium'),
            then: lit('warning'),
            otherwise: lit('neutral'),
          },
        },
      }),
      words('n.cardDescription', 'p', ref('prop.description'), { margin: '0' }),
    ],
    {
      ...stack,
      gap: '10px',
      padding: '16px 0',
      'border-top': '1px solid var(--vict-color-border)',
    },
  );
  (doc.componentDefinitions as Record<string, UiDocument['componentDefinitions'][string]>)[
    'def.findingCard'
  ] = {
    id: 'def.findingCard',
    revision: '2',
    root: 'n.card',
    props: [
      { name: 'severity', type: 'string', default: 'low' },
      { name: 'description', type: 'string', default: '' },
    ],
    slots: {},
  };
  add({
    id: 'n.findingsRepeat',
    kind: 'repeat',
    collection: ref('view.findings'),
    key: ref('repeat.finding.id'),
    itemName: 'finding',
    templateRoot: findingCard,
  });
  el(
    'n.findingsSection',
    'section',
    [
      words(
        'n.findingsHeading',
        'h2',
        concat(lit('Findings · '), ref('state.findingCount')),
        heading,
      ),
      when(
        'n.hasFindings',
        ref('state.hasFindings'),
        [el('n.findingsList', 'ul', ['n.findingsRepeat'], list)],
        [words('n.noFindings', 'p', 'No findings recorded.', muted)],
      ),
    ],
    { ...panel, ...stack },
    { 'aria-label': 'Findings' },
  );
  ext('n.evidenceViewer', 'ext.evidenceViewer', {
    label: ref('repeat.evidenceItem.label'),
    kind: ref('repeat.evidenceItem.kind'),
  });
  el('n.evidenceItem', 'li', ['n.evidenceViewer']);
  add({
    id: 'n.evidenceRepeat',
    kind: 'repeat',
    collection: ref('view.evidence'),
    key: ref('repeat.evidenceItem.id'),
    itemName: 'evidenceItem',
    templateRoot: 'n.evidenceItem',
  });
  el(
    'n.evidenceSection',
    'section',
    [
      words(
        'n.evidenceHeading',
        'h2',
        concat(lit('Evidence · '), ref('state.evidenceCount')),
        heading,
      ),
      when(
        'n.hasEvidence',
        ref('state.hasEvidence'),
        [el('n.evidenceList', 'ul', ['n.evidenceRepeat'], list)],
        [words('n.noEvidence', 'p', 'No evidence recorded.', muted)],
      ),
    ],
    { ...panel, ...stack },
    { 'aria-label': 'Evidence' },
  );
  el('n.columns', 'div', ['n.findingsSection', 'n.evidenceSection'], {
    display: 'grid',
    'grid-template-columns': 'minmax(0, 1.2fr) minmax(0, 1fr)',
    gap: '20px',
  });
  responsive('n.columns', { 'grid-template-columns': 'minmax(0, 1fr)' });
  el(
    'n.activityItem',
    'li',
    [
      words('n.activityText', 'p', ref('repeat.activityItem.entry'), {
        margin: '0',
        'font-weight': '500',
      }),
      words(
        'n.activityMeta',
        'p',
        concat(ref('repeat.activityItem.actor'), lit(' · '), ref('repeat.activityItem.at')),
        { ...muted, 'font-size': '12px' },
      ),
    ],
    {
      ...stack,
      gap: '4px',
      'padding-bottom': '14px',
      'border-bottom': '1px solid var(--vict-color-border)',
    },
  );
  add({
    id: 'n.activityRepeat',
    kind: 'repeat',
    collection: ref('view.activity'),
    key: ref('repeat.activityItem.id'),
    itemName: 'activityItem',
    templateRoot: 'n.activityItem',
  });
  el(
    'n.activity',
    'section',
    [
      words('n.activityHeading', 'h2', 'Activity', heading),
      el('n.activityList', 'ol', ['n.activityRepeat'], list),
    ],
    { ...panel, ...stack },
    { 'aria-label': 'Activity trail' },
  );
  const feedback = when('n.hasFeedback', ref('state.hasFeedback'), [
    ext('n.feedback', 'ext.feedback', {
      message: ref('state.feedbackMessage'),
      kind: ref('state.feedbackKind'),
    }),
  ]);
  const reload = when('n.canReload', ref('state.canReload'), [
    action(
      'n.reloadForm',
      'Reload inspection',
      'inspection.get',
      { id: ref('record.id') },
      [],
      'secondary',
    ),
  ]);
  el(
    'n.actions',
    'section',
    [
      words('n.decisionHeading', 'h2', 'Review decision', heading),
      feedback,
      reload,
      decisions,
      revise,
      submit,
    ],
    { ...panel, ...stack },
    { 'aria-label': 'Decision' },
  );
  el(
    'n.workflowColumns',
    'div',
    [el('n.workflow', 'div', ['n.actions', corrections], stack), 'n.activity'],
    {
      display: 'grid',
      'grid-template-columns': 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: '20px',
      'align-items': 'start',
    },
  );
  responsive('n.workflowColumns', { 'grid-template-columns': 'minmax(0, 1fr)' });
  el(
    'n.header',
    'header',
    [
      a.link('n.back', '← Inspection queue', concat(lit('/?as='), ref('state.actorRole'))),
      el(
        'n.titleRow',
        'div',
        [
          el('n.title', 'h1', [text('n.titleText', ref('record.title'))], {
            margin: '0',
            'font-size': 'clamp(24px, 3vw, 32px)',
            'line-height': '1.2',
            'letter-spacing': '-0.035em',
          }),
          el('n.status', 'span', [status('n.statusBadge', 'record.status')]),
        ],
        { display: 'flex', 'align-items': 'center', gap: '12px', 'flex-wrap': 'wrap' },
      ),
      words(
        'n.context',
        'p',
        concat(
          lit('Assigned technician: '),
          ref('record.technician'),
          lit(' · Supervisor: '),
          ref('record.supervisor'),
        ),
        muted,
      ),
      words('n.nextAction', 'p', nextAction, { margin: '0', 'font-weight': '500' }),
    ],
    stack,
  );
  root(['n.header', 'n.columns', 'n.workflowColumns']);
  return doc;
}

function queue(): UiDocument {
  const { doc, el, words, add, text, when, status, root } = author('doc.inspection-queue', '1');
  el('q.row', 'li', [
    el(
      'q.link',
      'a',
      [
        el(
          'q.info',
          'div',
          [
            words('q.rowTitle', 'h2', ref('repeat.inspection.title'), {
              ...heading,
              'font-size': '16px',
            }),
            words(
              'q.context',
              'p',
              concat(lit('Technician: '), ref('repeat.inspection.technician')),
              muted,
            ),
          ],
          { ...stack, gap: '6px' },
        ),
        status('q.status', 'repeat.inspection.status'),
        words('q.open', 'span', 'Review →', {
          color: 'var(--vict-color-accent)',
          'font-weight': '600',
          'white-space': 'nowrap',
        }),
      ],
      {
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'space-between',
        gap: '16px',
        'flex-wrap': 'wrap',
        color: 'inherit',
        'text-decoration': 'none',
        padding: '22px',
        background: 'var(--vict-color-surface)',
        border: '1px solid var(--vict-color-border)',
        'border-radius': '10px',
      },
      {
        href: concat(
          lit('/inspection/'),
          ref('repeat.inspection.id'),
          lit('?as='),
          ref('state.actorRole'),
        ),
      },
    ),
  ]);
  add({
    id: 'q.repeat',
    kind: 'repeat',
    collection: ref('view.inspections'),
    key: ref('repeat.inspection.id'),
    itemName: 'inspection',
    templateRoot: 'q.row',
  });
  el(
    'q.header',
    'header',
    [
      words('q.eyebrow', 'p', 'REVIEW WORKSPACE', {
        ...muted,
        'font-size': '11px',
        'letter-spacing': '0.12em',
        'font-weight': '700',
      }),
      el('q.title', 'h1', [text('q.headingText', 'Inspection queue')], {
        margin: '0',
        'font-size': '32px',
        'line-height': '1.2',
        'letter-spacing': '-0.035em',
      }),
      words(
        'q.subtitle',
        'p',
        concat(
          ref('state.awaitingCount'),
          lit(' awaiting review · '),
          ref('state.inspectionCount'),
          lit(
            ' inspections in this demo. Select an inspection to review its findings and evidence.',
          ),
        ),
        muted,
      ),
    ],
    { ...stack, gap: '10px' },
  );
  root([
    'q.header',
    when(
      'q.hasError',
      ref('state.hasError'),
      [words('q.error', 'p', 'The queue could not load. Reload the page to try again.', panel)],
      [
        when(
          'q.hasRows',
          ref('state.hasRows'),
          [el('q.list', 'ul', ['q.repeat'], list, { 'aria-label': 'Inspections' })],
          [
            el(
              'q.empty',
              'section',
              [
                words('q.emptyHeading', 'h2', 'No inspections to review', heading),
                words(
                  'q.emptyText',
                  'p',
                  'The queue is empty. New inspections will appear here when submitted.',
                  muted,
                ),
              ],
              { ...panel, ...stack },
              { role: 'status' },
            ),
          ],
        ),
      ],
    ),
  ]);
  return doc;
}

export const inspectionDetailDocument = detail();
export const inspectionQueueDocument = queue();
