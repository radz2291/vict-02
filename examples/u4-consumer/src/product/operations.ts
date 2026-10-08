/** Inspection Operations: canonical authored documents shared by both entries. */
import type { UiDocument, UiNode, UiExpression, UiOutputBinding, UiValueType, UiValue, UiCondition } from '@victframework/ui';
import { taskControlsDocument, taskShellDocument } from './documents.js';

export type ConsumerRouteId = 'controls' | 'shell' | 'queue' | 'detail' | 'schedule';
export const inspectionRoutes = [
  { id: 'queue', label: 'Inspection queue', documentId: 'consumer.queue' },
  { id: 'detail', label: 'Evidence & corrections', documentId: 'consumer.detail' },
  { id: 'schedule', label: 'Scheduling', documentId: 'consumer.schedule' },
  { id: 'controls', label: 'Submit review', documentId: 'consumer.taskControls' },
  { id: 'shell', label: 'Workspace & assignment', documentId: 'consumer.taskShell' },
] as const;
const literal = (value: string | number | boolean): UiExpression => ({ type: 'literal', value });
const ref = (path: string): UiExpression => ({ type: 'ref', path });
const choice = (path: string, match: string, then: string, otherwise: string): UiExpression => ({ type: 'conditionalValue', when: { type: 'compare', op: 'eq', left: ref(path), right: literal(match) }, then: literal(then), otherwise: literal(otherwise) });
const loop = (key: string): UiOutputBinding => ({ setState: { key } });
const operation = (value?: string): UiOutputBinding => ({ invokeAction: { actionId: 'task.operation', input: {
  noteId: literal('t_1'), operation: value === undefined ? ref('$output') : literal(value),
} } });
function author(id: string) {
  const nodes: Record<string, UiNode> = {};
  const conditions: Record<string, UiCondition> = {};
  const state: Record<string, { key: string; type: UiValueType; initial: UiValue }> = {};
  let next = 0;
  const key = (name: string, type: UiValueType, initial: UiValue) => { state[name] = { key: name, type, initial }; return ref(`state.${name}`); };
  const text = (value: string, name = `text-${++next}`) => { nodes[name] = { kind: 'text', id: name, content: { type: 'literal', value } }; return name; };
  const el = (tag: string, children: string[], name = `${tag}-${++next}`, style: Record<string, string> = {}) => {
    nodes[name] = { kind: 'element', id: name, tag, children,
      localStyle: Object.entries(style).map(([property, value]) => ({ property, value: { type: 'text', value } })) };
    return name;
  };
  const c = (family: string, name: string, props: Record<string, UiExpression> = {}, slots: Record<string, string[]> = {}, outputs: Record<string, UiOutputBinding> = {}) => {
    nodes[name] = { kind: 'component', id: name, definitionId: `vict.catalog.${family}`, revision: '1', props, outputs,
      slots: Object.fromEntries(Object.entries(slots).map(([slot, children]) => [slot, { name: slot, children }])) };
    return name;
  };
  const heading = (title: string, subtitle: string) => el('header', [el('h1', [text(title)]), el('p', [text(subtitle)])]);
  const panel = (title: string, children: string[]) => el('section', [el('h2', [text(title)]), ...children], `panel-${++next}`, {
    'display': 'grid', 'gap': '14px', 'padding': '20px', 'border': '1px solid #dce5e9', 'border-radius': '12px', 'background': '#fff', 'min-width': '0',
  });
  const finish = (children: string[]): UiDocument => {
    const feedback = el('aside', [], 'operation-feedback');
    state.lastResult = { key: 'lastResult', type: 'string', initial: '' };
    state.lastError = { key: 'lastError', type: 'string', initial: '' };
    state.busy = { key: 'busy', type: 'boolean', initial: false };
    nodes.result = { kind: 'text', id: 'result', content: { type: 'expression', expression: ref('state.lastResult') } };
    nodes.error = { kind: 'text', id: 'error', content: { type: 'expression', expression: ref('state.lastError') } };
    nodes[feedback] = { kind: 'element', id: feedback, tag: 'aside', attributes: { 'aria-live': 'polite' }, children: ['result', 'error'] };
    const content = el('main', [...children, feedback], 'operations-content', { 'display': 'grid', 'gap': '24px', 'max-width': '1120px', 'margin': '0 auto', 'padding': '24px', 'min-width': '0' });
    const shell = c('appshell', 'operations-shell', { title: literal('Inspection Operations'), navigation: ref('view.shellNavigation'), path: ref('view.path'), navigationMode: ref('view.navigationMode'), navigationAt: ref('view.navigationAt') }, { content: [content] });
    return { schema: 'vict.ui-document@1', id, revision: 'r1', root: shell, nodes, localState: state, componentDefinitions: {}, styleSources: {}, tokens: {}, conditions, assets: {} };
  };
  return { nodes, conditions, state, key, text, el, c, panel, heading, finish };
}

const q = author('consumer.queue');
const queueTitle = q.heading('Inspection queue', 'Review incoming site evidence, assign specialists and keep the next inspection moving.');
const queueMenu = q.c('dropdown-menu', 'queue-actions', { label: literal('Queue actions'), open: q.key('queueMenuOpen', 'boolean', false) }, {
  trigger: [q.text('Queue actions')], items: [
    q.c('dropdown-menu.item', 'queue-export', { value: literal('export'), label: literal('Prepare queue summary') }, { content: [q.text('Prepare queue summary')] }, { itemActivate: operation() }),
    q.c('dropdown-menu.checkbox-item', 'watch-queue', { label: literal('Notify me about changes'), checked: q.key('watching', 'boolean', true) }, { content: [q.text('Notify me about changes')] }, { checkedChange: loop('watching') }),
    q.c('dropdown-menu.sub', 'queue-sort', { label: literal('Sort queue'), open: q.key('sortMenuOpen', 'boolean', false) }, { trigger: [q.text('Sort queue')], items: [
      q.c('dropdown-menu.radio-group', 'queue-sort-options', { value: q.key('sort', 'string', 'priority') }, { items: [
        q.c('dropdown-menu.radio-item', 'sort-priority', { value: literal('priority'), label: literal('Priority first') }, { content: [q.text('Priority first')] }),
        q.c('dropdown-menu.radio-item', 'sort-recent', { value: literal('recent'), label: literal('Recently received') }, { content: [q.text('Recently received')] }),
      ] }, { valueChange: loop('sort') }),
    ] }, { openChange: loop('sortMenuOpen') }),
  ],
}, { openChange: loop('queueMenuOpen') });
const preview = q.c('link-preview', 'site-preview', { href: literal('/app.html?doc=detail'), label: literal('Riverside Plant'), title: literal('Riverside Plant · INSP-1042'), description: literal('Safety review · North loading bay'), open: q.key('previewOpen', 'boolean', false), openDelay: literal(150) }, { content: [q.text('Three findings require correction. Review the attached evidence before making a decision.')] }, { openChange: loop('previewOpen') });
const tip = q.c('tooltip', 'priority-help', { label: literal('Priority guidance'), title: literal('High priority'), description: literal('Safety findings must be acknowledged before submission.'), open: q.key('priorityHelpOpen', 'boolean', false), delay: literal(150) }, { trigger: [q.text('High priority ⓘ')], content: [q.text('The lead inspector reviews this case within one working day.')] }, { openChange: loop('priorityHelpOpen') });
const card1 = q.panel('INSP-1042 · Riverside Plant', [q.el('div', [q.c('avatar', 'lead-avatar', { alt: literal('Ada, lead inspector'), fallback: literal('AD') }), preview, tip], 'queue-owner', { display: 'flex', gap: '12px', 'align-items': 'center', 'flex-wrap': 'wrap' }), q.el('p', [q.text('3 findings · Safety · Evidence received 09 October')]), q.el('a', [q.text('Review evidence →')], 'open-evidence')]);
q.nodes['open-evidence'] = { ...q.nodes['open-evidence'], attributes: { href: '/app.html?doc=detail' }, interactions: [{ on: 'click', action: 'navigate', routeId: 'detail' }] } as UiNode;
const context = q.c('context-menu', 'inspection-context', { label: literal('Inspection actions'), open: q.key('contextOpen', 'boolean', false) }, { trigger: [card1], items: [
  q.c('context-menu.item', 'context-assign', { value: literal('assign'), label: literal('Request assignment') }, { content: [q.text('Request assignment')] }, { itemActivate: operation() }),
  q.c('context-menu.checkbox-item', 'context-watch', { checked: ref('state.watching'), label: literal('Watch inspection') }, { content: [q.text('Watch inspection')] }, { checkedChange: loop('watching') }),
  q.c('context-menu.sub', 'context-more', { label: literal('More actions'), open: q.key('moreActionsOpen', 'boolean', false) }, { trigger: [q.text('More actions')], items: [q.c('context-menu.item', 'context-copy', { value: literal('copy'), label: literal('Show inspection reference') }, { content: [q.text('Show inspection reference')] }, { itemActivate: operation() })] }, { openChange: loop('moreActionsOpen') }),
] }, { openChange: loop('contextOpen') });
const contextSort = q.c('context-menu.radio-group', 'context-sort-options', { value: ref('state.sort') }, { items: [
  q.c('context-menu.radio-item', 'context-priority', { value: literal('priority'), label: literal('Priority first') }),
  q.c('context-menu.radio-item', 'context-recent', { value: literal('recent'), label: literal('Recently received') }),
] }, { valueChange: loop('sort') });
const contextNode = q.nodes[context] as Extract<UiNode, {kind: 'component'}>;
q.nodes[context] = { ...contextNode, slots: { ...contextNode.slots, items: { name: 'items', children: [...(contextNode.slots?.items?.children ?? []), contextSort] } } };
const page = q.key('queuePage', 'number', 1);
q.conditions.firstPage = { id: 'firstPage', kind: 'localState', when: { type: 'compare', op: 'eq', left: page, right: literal(1) } };
const harbour = q.panel('INSP-1043 · Harbour Depot', [q.text('Electrical review · Ben · awaiting site access · received 10 October')]);
const riversideRow = q.el('div', [context], 'riverside-row');
q.nodes[riversideRow] = { ...q.nodes[riversideRow], localStyle: [{ property: 'order', value: { type: 'binding', expression: choice('state.sort', 'recent', '2', '1') } }] } as UiNode;
q.nodes[harbour] = { ...q.nodes[harbour], localStyle: [...(q.nodes[harbour]!.localStyle ?? []), { property: 'order', value: { type: 'binding', expression: choice('state.sort', 'recent', '1', '2') } }] } as UiNode;
q.nodes['queue-page'] = { kind: 'conditional', id: 'queue-page', branches: [{ when: 'firstPage', children: [q.el('div', [riversideRow, harbour], 'first-page-inspections', { display: 'flex', 'flex-direction': 'column', gap: '16px' })] }, { children: [q.panel('INSP-1044 · Orchard Warehouse', [q.text('Access review · Cy · evidence complete')])] }] };
const watchStatus = q.el('p', [], 'queue-watch-status');
q.nodes['watch-status-text'] = { kind: 'text', id: 'watch-status-text', content: { type: 'expression', expression: { type: 'conditionalValue', when: ref('state.watching'), then: literal('Watching this queue for inspection changes.'), otherwise: literal('Queue notifications paused.') } } };
q.nodes[watchStatus] = { ...q.nodes[watchStatus], children: ['watch-status-text'], attributes: { 'aria-live': 'polite' } } as UiNode;
export const inspectionQueueDocument = q.finish([queueTitle, queueMenu, watchStatus, 'queue-page', q.c('pagination', 'queue-pages', { page, count: literal(3), perPage: literal(2), label: literal('Inspection queue pages') }, {}, { pageChange: loop('queuePage') })]);

const d = author('consumer.detail');
const detailTitle = d.heading('INSP-1042 · Riverside Plant', 'Review evidence, record corrections and prepare a defensible decision.');
const evidencePhoto = d.c('aspect-ratio', 'evidence-photo', { ratio: literal(16 / 9) }, { content: [d.el('img', [], 'loading-bay-evidence', { width: '100%', height: '100%', 'object-fit': 'cover' })] });
d.nodes['loading-bay-evidence'] = { ...d.nodes['loading-bay-evidence'], attributes: { src: '/evidence-loading-bay.svg', alt: 'North loading bay inspection diagram. The handrail fixing is circled as finding F-01.' } } as UiNode;
const findings = d.c('accordion-multiple', 'findings', { values: d.key('openFindings', 'stringList', ['handrail']) }, { items: [
  d.c('accordion-item', 'finding-handrail', { value: literal('handrail'), label: literal('F-01 · Loose handrail connection') }, { content: [d.text('Secure the fixing and attach a dated photograph before the next inspection.')] }),
  d.c('accordion-item', 'finding-signage', { value: literal('signage'), label: literal('F-02 · Missing access signage') }, { content: [d.text('Install the approved access sign at the north bay entrance.')] }),
] }, { valuesChange: loop('openFindings') });
const report = d.c('accordion', 'report-summary', { value: d.key('summarySection', 'string', 'scope') }, { items: [
  d.c('accordion-item', 'summary-scope', { value: literal('scope'), label: literal('Inspection scope') }, { content: [d.text('Loading bay safety and public access.')] }),
  d.c('accordion-item', 'summary-method', { value: literal('method'), label: literal('Evidence method') }, { content: [d.text('Visual inspection and site representative interview.')] }),
] }, { valueChange: loop('summarySection') });
const correctionForm = d.panel('Correction plan', [
  d.c('checkbox', 'partial-findings', { label: literal('Include every finding in the correction plan'), checked: d.key('allFindings', 'boolean', false), indeterminate: { type: 'boolean', op: 'not', terms: [ref('state.allFindings')] } }, {}, { checkedChange: loop('allFindings') }),
  d.c('select-multiple', 'notify-teams', { label: literal('Teams to notify'), values: d.key('teams', 'stringList', ['safety']) }, { items: ['safety', 'facilities', 'operations'].map(team => d.c('select-item', `team-${team}`, { value: literal(team), label: literal(team) }, { content: [d.text(team === 'safety' ? 'Safety team' : team === 'facilities' ? 'Facilities team' : 'Operations team')] })) }, { valuesChange: loop('teams') }),
  d.c('combobox', 'correction-owner', { label: literal('Search correction owner'), value: d.key('owner', 'string', 'ada'), search: d.key('ownerSearch', 'string', '') }, { items: ['ada', 'ben', 'cy'].map(value => d.c('combobox-item', `owner-${value}`, { value: literal(value), label: literal(value === 'ada' ? 'Ada' : value === 'ben' ? 'Ben' : 'Cy') }, { content: [d.text(value === 'ada' ? 'Ada · Safety' : value === 'ben' ? 'Ben · Electrical' : 'Cy · Access')] })) }, { valueChange: loop('owner'), searchChange: loop('ownerSearch') }),
  d.c('combobox-multiple', 'support-reviewers', { label: literal('Additional reviewers'), values: d.key('supportReviewers', 'stringList', []), search: d.key('supportSearch', 'string', ''), options: ref('view.reviewers') }, {}, { valuesChange: loop('supportReviewers'), searchChange: loop('supportSearch') }),
  d.c('toggle-group', 'correction-priority', { label: literal('Correction priority'), value: d.key('correctionPriority', 'string', 'urgent') }, { items: ['normal', 'urgent'].map(value => d.c('toggle-group-item', `priority-${value}`, { value: literal(value), label: literal(value) })) }, { valueChange: loop('correctionPriority') }),
  d.c('toggle-group-multiple', 'evidence-types', { label: literal('Required evidence'), values: d.key('evidenceTypes', 'stringList', ['photo']) }, { items: ['photo', 'report', 'signature'].map(value => d.c('toggle-group-item', `evidence-${value}`, { value: literal(value), label: literal(value) })) }, { valuesChange: loop('evidenceTypes') }),
  d.c('button', 'save-corrections', { label: literal('Save correction plan'), loading: ref('state.busy') }, {}, { press: { invokeAction: { actionId: 'task.configure', input: { noteId: literal('t_1'), owner: ref('state.owner'), allFindings: ref('state.allFindings'), teams: ref('state.teams'), reviewers: ref('state.supportReviewers'), priority: ref('state.correctionPriority'), evidence: ref('state.evidenceTypes') } } } }),
]);
const notes = d.c('collapsible', 'inspection-notes', { label: literal('Site notes'), open: d.key('notesOpen', 'boolean', false) }, { trigger: [d.text('Show site notes')], content: [d.text('Site representative: Morgan. Access requires a high visibility vest and induction.')] }, { openChange: loop('notesOpen') });
const explain = d.c('popover', 'decision-guidance', { label: literal('Decision guidance'), title: literal('Before you submit'), description: literal('Acknowledge findings and pricing in Submit review.'), open: d.key('guidanceOpen', 'boolean', false) }, { content: [d.el('a', [d.text('Continue to review →')], 'review-link')] }, { openChange: loop('guidanceOpen') });
d.nodes['review-link'] = { ...d.nodes['review-link'], attributes: { href: '/app.html?doc=controls' }, interactions: [{ on: 'click', action: 'navigate', routeId: 'controls' }] } as UiNode;
const archive = d.c('alert-dialog', 'archive-inspection', { label: literal('Archive inspection'), title: literal('Archive this inspection?'), description: literal('Record the archived decision for this inspection session.'), confirmLabel: literal('Archive'), open: d.key('archiveOpen', 'boolean', false) }, { body: [d.text('Keep the evidence available for future audit.')] }, { openChange: loop('archiveOpen'), confirm: { invokeAction: { actionId: 'task.archive', input: { noteId: literal('t_1') } } } });
export const inspectionDetailDocument = d.finish([detailTitle, d.c('tabs', 'inspection-tabs', { value: d.key('detailTab', 'string', 'evidence'), label: literal('Inspection sections') }, { tabs: [d.c('tabs-trigger', 'tab-evidence', { value: literal('evidence'), label: literal('Evidence') }), d.c('tabs-trigger', 'tab-corrections', { value: literal('corrections'), label: literal('Corrections') })], panels: [d.c('tabs-panel', 'evidence-panel', { value: literal('evidence') }, { content: [evidencePhoto, findings, d.c('separator', 'evidence-divider'), report, notes] }), d.c('tabs-panel', 'corrections-panel', { value: literal('corrections') }, { content: [correctionForm, explain, archive] })] }, { valueChange: loop('detailTab') })]);

const s = author('consumer.schedule');
const visit = s.key('visitDate', 'isoDate', '2026-10-12');
const start = s.key('windowStart', 'isoDate', '2026-10-12');
const end = s.key('windowEnd', 'isoDate', '2026-10-16');
const time = s.key('visitTime', 'isoTime', '09:30');
const dateProps = { min: literal('2026-10-01'), max: literal('2026-12-31'), placeholder: literal('2026-10-12'), locale: literal('en-GB') };
const availability = s.c('collapsible', 'visit-availability', { label: literal('Browse visit availability'), open: s.key('availabilityOpen', 'boolean', false) }, { content: [s.c('calendar', 'visit-calendar', { ...dateProps, value: visit, label: literal('Inspection availability'), weekStartsOn: literal(1) }, {}, { valueChange: loop('visitDate') })] }, { openChange: loop('availabilityOpen') });
const datePanel = s.panel('Site visit', [s.c('date-field', 'visit-date-entry', { ...dateProps, value: visit, label: literal('Planned inspection date') }, {}, { valueChange: loop('visitDate') }), s.c('date-picker', 'visit-date-picker', { ...dateProps, value: visit, label: literal('Choose inspection date'), open: s.key('visitPickerOpen', 'boolean', false) }, {}, { valueChange: loop('visitDate'), openChange: loop('visitPickerOpen') }), availability, s.c('time-field', 'visit-time', { value: time, min: literal('08:00'), max: literal('17:00'), label: literal('Site arrival · local wall time'), hourCycle: literal(24), granularity: literal('minute') }, {}, { valueChange: loop('visitTime') })]);
const windowPanel = s.panel('Correction window', [s.c('date-range-field', 'window-fields', { ...dateProps, start, end, label: literal('Correction window dates') }, {}, { startChange: loop('windowStart'), endChange: loop('windowEnd') }), s.c('date-range-picker', 'window-picker', { ...dateProps, start, end, label: literal('Choose correction window'), open: s.key('windowPickerOpen', 'boolean', false) }, {}, { startChange: loop('windowStart'), endChange: loop('windowEnd'), openChange: loop('windowPickerOpen') }), s.c('range-calendar', 'window-calendar', { ...dateProps, start, end, label: literal('Correction window calendar') }, {}, { startChange: loop('windowStart'), endChange: loop('windowEnd') })]);
const provisionalWindow = s.c('date-range-field', 'provisional-window', { ...dateProps, label: literal('Provisional follow-up window'), start: s.key('provisionalStart', 'isoDate', '2026-10-20'), end: s.key('provisionalEnd', 'isoDate', '') }, { help: [s.text('A start-only window stays provisional until an end is agreed.')] }, { startChange: loop('provisionalStart'), endChange: loop('provisionalEnd') });
const reserveDate = s.c('date-field', 'reserve-date', { ...dateProps, value: s.key('reserveDate', 'isoDate', ''), label: literal('Optional reserve date') }, { help: [s.text('Leave empty until the site confirms a reserve visit.')] }, { valueChange: loop('reserveDate') });
const preciseTime = s.c('time-field', 'handover-time', { value: s.key('handoverTime', 'isoTime', '13:30:00'), label: literal('Evidence handover · seconds'), hourCycle: literal(12), granularity: literal('second') }, {}, { valueChange: loop('handoverTime') });
const provisionalPicker = s.c('date-range-picker', 'provisional-window-picker', { ...dateProps, start: ref('state.provisionalStart'), end: ref('state.provisionalEnd'), label: literal('Choose provisional follow-up window'), open: s.key('provisionalPickerOpen', 'boolean', false) }, {}, { startChange: loop('provisionalStart'), endChange: loop('provisionalEnd'), openChange: loop('provisionalPickerOpen') });
const provisionalCalendar = s.c('range-calendar', 'provisional-window-calendar', { ...dateProps, start: ref('state.provisionalStart'), end: ref('state.provisionalEnd'), label: literal('Provisional follow-up calendar') }, {}, { startChange: loop('provisionalStart'), endChange: loop('provisionalEnd') });
const accessHour = s.c('time-field', 'access-cutoff', { value: s.key('accessCutoff', 'isoTime', '12:00'), label: literal('Site access cutoff · hour'), hourCycle: literal(24), granularity: literal('hour') }, {}, { valueChange: loop('accessCutoff') });
const provisional = s.c('collapsible', 'provisional-arrangements', { label: literal('Provisional arrangements and precise handover'), open: s.key('provisionalOpen', 'boolean', false) }, { content: [s.panel('Provisional arrangements', [provisionalWindow, provisionalPicker, provisionalCalendar, reserveDate, preciseTime, accessHour])] }, { openChange: loop('provisionalOpen') });
const resources = s.panel('Inspection capacity', [s.c('slider', 'visit-duration', { value: s.key('duration', 'numberList', [60]), min: literal(30), max: literal(180), step: literal(15), label: literal('Visit duration · minutes') }, {}, { valueChange: loop('duration') }), s.c('slider', 'capacity-range', { value: s.key('capacity', 'numberList', [20, 80]), min: literal(0), max: literal(100), step: literal(5), label: literal('Acceptable capacity range · percent') }, {}, { valueChange: loop('capacity') }), s.c('meter', 'capacity-meter', { value: s.key('load', 'number', 65), min: literal(0), max: literal(100), label: literal('Current team capacity · 65%') }), s.c('progress', 'preparation-progress', { value: s.key('preparation', 'number', 75), label: literal('Evidence preparation · 75%'), indeterminate: s.key('preparationPending', 'boolean', false) }), s.c('progress', 'schedule-sync', { label: literal('Schedule synchronization pending'), indeterminate: s.key('syncPending', 'boolean', true) })]);
const scheduleSubmit = s.c('button', 'confirm-schedule', { label: literal('Confirm inspection schedule'), loading: ref('state.busy') }, {}, { press: { invokeAction: { actionId: 'task.schedule', input: { noteId: literal('t_1'), date: visit, start, end, time, duration: ref('state.duration'), capacity: ref('state.capacity') } } } });
export const inspectionScheduleDocument = s.finish([s.heading('Schedule inspection', 'Choose a site visit and correction window. Dates and wall time remain separate.'), datePanel, windowPanel, provisional, resources, scheduleSubmit]);

/** Keep the B1 seeds intact; extend their canonical workspace composition. */
const w = author('consumer.workspace-extra');
const nav = w.c('navigation-menu', 'workspace-navigation', { value: w.key('workspaceDestination', 'string', '') }, { items: [w.c('navigation-menu.item', 'workspace-navigation-group', { value: literal('inspections'), label: literal('Inspections') }, { trigger: [w.text('Inspections')], content: inspectionRoutes.slice(0, 3).map(route => w.c('navigation-menu.link', `nav-${route.id}`, { href: literal(`/app.html?doc=${route.id}`), label: literal(route.label) }, { content: [w.text(route.label)] })) })] }, { valueChange: loop('workspaceDestination') });
const menubar = w.c('menubar', 'workspace-menubar', { value: w.key('workspaceMenu', 'string', '') }, { menus: [w.c('menubar.menu', 'workspace-file-menu', { value: literal('inspection'), label: literal('Inspection') }, { trigger: [w.text('Inspection')], items: [w.c('menubar.item', 'workspace-export', { value: literal('export'), label: literal('Prepare summary') }, { content: [w.text('Prepare summary')] }, { itemActivate: operation() }), w.c('menubar.sub', 'workspace-share', { label: literal('Reference'), open: w.key('referenceMenuOpen', 'boolean', false) }, { trigger: [w.text('Share')], items: [w.c('menubar.item', 'workspace-copy', { value: literal('copy'), label: literal('Show inspection reference') }, { content: [w.text('Show inspection reference')] }, { itemActivate: operation() })] }, { openChange: loop('referenceMenuOpen') })] })] }, { valueChange: loop('workspaceMenu') });
const menuChecks = w.c('menubar.checkbox-item', 'workspace-notifications', { checked: w.key('workspaceWatching', 'boolean', true), label: literal('Notify assigned reviewers') }, {}, { checkedChange: loop('workspaceWatching') });
const menuRadio = w.c('menubar.radio-group', 'workspace-density', { value: w.key('workspaceDensity', 'string', 'comfortable') }, { items: [w.c('menubar.radio-item', 'workspace-comfortable', { value: literal('comfortable'), label: literal('Comfortable spacing') }), w.c('menubar.radio-item', 'workspace-compact', { value: literal('compact'), label: literal('Compact spacing') })] }, { valueChange: loop('workspaceDensity') });
const fileMenu = w.nodes['workspace-file-menu'] as Extract<UiNode, {kind: 'component'}>;
w.nodes['workspace-file-menu'] = { ...fileMenu, slots: { ...fileMenu.slots, items: { name: 'items', children: [...(fileMenu.slots?.items?.children ?? []), menuChecks, menuRadio] } } };
const toolbar = w.c('toolbar', 'workspace-toolbar', { label: literal('Inspection tools') }, { tools: [w.c('toolbar-button', 'refresh-queue', { label: literal('Refresh queue') }, {}, { press: operation('refresh') }), w.c('toolbar-button', 'export-inspection', { label: literal('Prepare summary') }, {}, { press: operation('export') })] });
const command = w.c('command', 'workspace-command', { label: literal('Find an inspection operation'), search: w.key('commandSearch', 'string', '') }, { items: [w.c('command.item', 'command-assign', { value: literal('assign'), label: literal('Request reviewer assignment') }, { content: [w.text('Request reviewer assignment')] }, { itemActivate: operation() }), w.c('command.item', 'command-export', { value: literal('export'), label: literal('Prepare inspection summary') }, { content: [w.text('Prepare inspection summary')] }, { itemActivate: operation() })], empty: [w.text('No matching operation. Try assignment or export.')] }, { searchChange: loop('commandSearch') });
const scroll = w.c('scroll-area', 'workspace-activity', { type: literal('always') }, { content: [w.el('ol', ['Evidence received at Riverside Plant', 'Safety team reviewing findings', 'Correction window awaiting confirmation', 'Lead inspector assignment requested', 'Harbour Depot access requested', 'Electrical evidence received', 'Orchard Warehouse evidence complete', 'Loading bay photograph attached', 'Handrail finding recorded', 'Access signage finding recorded', 'Site representative details confirmed', 'Audit trail retained for review'].map(value => w.el('li', [w.text(value)])))] });
w.nodes[scroll] = { ...w.nodes[scroll], localStyle: [{ property: 'height', value: { type: 'text', value: '180px' } }] } as UiNode;
const label = w.c('label', 'workspace-label', { for: literal('workspace-reference'), label: literal('Inspection reference') });
const input = w.el('input', [], 'workspace-reference');
w.nodes[input] = { ...w.nodes[input], attributes: { id: 'workspace-reference', value: 'INSP-1042', readonly: literal(true) } } as UiNode;
const extra = w.finish([w.heading('Workspace', 'Inspection operations, team assignment and recent activity.'), nav, menubar, toolbar, command, label, input, scroll]);
const workspaceContent = taskShellDocument.nodes.content;
const workspaceShell = taskShellDocument.nodes.shell as Extract<UiNode, {kind: 'component'}>;
export const inspectionWorkspaceDocument: UiDocument = { ...taskShellDocument,
  nodes: { ...taskShellDocument.nodes, ...Object.fromEntries(Object.entries(extra.nodes).filter(([id]) => !['operations-shell', 'operations-content'].includes(id))), shell: { ...workspaceShell, props: { ...workspaceShell.props, title: literal('Inspection Operations') } }, content: { ...workspaceContent, localStyle: [...(workspaceContent?.localStyle ?? []).filter(declaration => declaration.property !== 'gap' && declaration.property !== 'padding'), { property: 'gap', value: { type: 'binding', expression: choice('state.workspaceDensity', 'compact', '8px', '20px') } }, { property: 'padding', value: { type: 'binding', expression: choice('state.workspaceDensity', 'compact', '12px', '24px') } }], children: [...((workspaceContent as Extract<UiNode, {kind: 'element'}>).children), ...(extra.nodes['operations-content'] as Extract<UiNode, {kind: 'element'}>).children] } as UiNode },
  localState: { ...taskShellDocument.localState, ...extra.localState },
};
export const inspectionReviewDocument: UiDocument = { ...taskControlsDocument, root: 'review-shell', nodes: { ...taskControlsDocument.nodes, 'review-shell': { kind: 'component', id: 'review-shell', definitionId: 'vict.catalog.appshell', revision: '1', props: { title: literal('Inspection Operations'), navigation: ref('view.shellNavigation'), path: ref('view.path'), navigationMode: ref('view.navigationMode'), navigationAt: ref('view.navigationAt') }, slots: { content: { name: 'content', children: [taskControlsDocument.root] } } } } };
export const inspectionDocuments: readonly UiDocument[] = [inspectionReviewDocument, inspectionWorkspaceDocument, inspectionQueueDocument, inspectionDetailDocument, inspectionScheduleDocument];
