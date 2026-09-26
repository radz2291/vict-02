import { APPLICATION_DEFINITION_SCHEMA_V2, type ApplicationDefinition } from '@victframework/sdk';
import { compileApplication, type ApplicationPlan } from '@victframework/application';
import { agentRegistryContracts, agentResourceList } from './agent-data.js';

/**
 * The coding-agent product proof: ONE coherent workspace application
 * (choosing a project and session, working the conversation, steering the
 * current task through running/waiting/completed/failed states, and
 * inspecting the work). Everything visible is ordinary Application
 * Definition vocabulary rendered by the generic @victframework/ui-svelte
 * renderer, plus THREE registered product surfaces for genuinely
 * product-specific composition:
 *
 * - cmp.session-picker  the project + session chooser (self-fetching)
 * - cmp.session-console the task console: progress, approval, state controls
 * - cmp.output-log      the tool output log
 *
 * No AI agent or Mastra infrastructure is built here: all behaviour is
 * deterministic and local (see ../server/agent-server.ts).
 */

export const agentApplication: ApplicationDefinition = {
  schema: APPLICATION_DEFINITION_SCHEMA_V2,
  id: 'app.agent-workspace',
  revision: '1',
  name: 'Victor Workspace',
  composition: {
    navigation: 'sidebar',
    contentWidth: 'wide',
    density: 'compact',
    responsive: { navigationAt: 'medium' },
  },
  routes: [
    { id: 'home', path: '/', redirect: 'sessions' },
    {
      id: 'sessions',
      path: '/agent',
      screenId: 's.agent-sessions',
      nav: { label: 'Sessions', group: 'Workspace', order: 1 },
    },
    { id: 'session', path: '/agent/sessions/:id', screenId: 's.agent-session' },
  ],
  screens: [
    {
      id: 's.agent-sessions',
      title: 'Sessions',
      breadcrumbs: [{ label: 'Workspace' }, { label: 'Sessions' }],
      composition: { contentWidth: 'standard' },
      layout: [
        {
          name: 'intro',
          surfaces: [
            {
              role: 'status',
              id: 'agent.sessions-state',
              value: 'Local demo data',
              tones: { 'Local demo data': 'info' },
            },
            {
              role: 'text',
              id: 'agent.sessions-heading',
              level: 2,
              content: 'Pick up where the work left off.',
            },
            {
              role: 'text',
              id: 'agent.sessions-description',
              content:
                'Choose a project and a Victor session. Running sessions stream their work here; waiting sessions pause for your approval.',
            },
          ],
        },
        {
          name: 'picker',
          surfaces: [
            {
              role: 'component',
              id: 'agent.session-picker',
              componentId: 'cmp.session-picker',
              revision: '1',
              props: {
                kind: 'picker',
                sessionsActionId: 'act.pickSessions',
                projectsActionId: 'act.pickProjects',
                resetActionId: 'act.reset',
              },
            },
          ],
        },
        {
          name: 'support',
          flow: 'inline',
          surfaces: [
            {
              role: 'drawer',
              id: 'agent.guide',
              triggerLabel: 'How this workspace works',
              title: 'Working with Victor',
              content: [
                {
                  role: 'text',
                  id: 'agent.guide-body',
                  content:
                    'Each session pairs a conversation with a task console. Approve a waiting session to let Victor continue, advance a running session step by step, and retry a failed session from its last checkpoint.',
                },
                {
                  role: 'text',
                  id: 'agent.guide-followup',
                  content:
                    'The inspector alongside a session shows its changed files, activity and tool output. Sending a message while a session is stopped keeps your draft so you can send it once work resumes.',
                },
                {
                  role: 'text',
                  id: 'agent.guide-reset',
                  content:
                    '“Reset demo data” next to the session list restores the whole workspace to its original state.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 's.agent-session',
      title: 'Session workspace',
      breadcrumbs: [{ label: 'Sessions', routeId: 'sessions' }, { label: 'Session' }],
      layoutMode: 'split',
      composition: { supportingWidth: 'standard', stackAt: 'medium' },
      layout: [
        {
          name: 'task',
          size: 'main',
          surfaces: [
            {
              role: 'component',
              id: 'agent.session-console',
              componentId: 'cmp.session-console',
              revision: '1',
              props: { kind: 'console', sessionsActionId: 'act.pickSessions' },
            },
            {
              role: 'conversation',
              id: 'agent.chat',
              viewId: 'v.agentMessages',
              messageField: 'text',
              authorField: 'author',
              participantField: 'participant',
              sendActionId: 'act.send',
              inputLabel: 'Message Victor',
              inputPlaceholder: 'Ask about this task, or tell Victor what to adjust…',
              emptyMessage: 'No messages yet. Describe the task or say hello.',
            },
          ],
        },
        {
          name: 'inspector',
          size: 'aside',
          appearance: 'panel',
          surfaces: [
            { role: 'text', id: 'agent.inspector-heading', level: 2, content: 'Inspector' },
            {
              role: 'tabs',
              id: 'agent.inspector-tabs',
              tabs: [
                {
                  name: 'files',
                  label: 'Changed files',
                  surfaces: [
                    {
                      role: 'list',
                      id: 'agent.files-list',
                      viewId: 'v.agentFiles',
                      titleField: 'path',
                      secondaryField: 'status',
                      emptyMessage: 'No file changes recorded for this session yet.',
                    },
                  ],
                },
                {
                  name: 'activity',
                  label: 'Activity',
                  surfaces: [
                    {
                      role: 'list',
                      id: 'agent.activity-list',
                      viewId: 'v.agentActivity',
                      titleField: 'summary',
                      secondaryField: 'at',
                      emptyMessage: 'Nothing has happened in this session yet.',
                    },
                  ],
                },
                {
                  name: 'log',
                  label: 'Output log',
                  surfaces: [
                    {
                      role: 'component',
                      id: 'agent.output-log',
                      componentId: 'cmp.output-log',
                      revision: '1',
                      props: { kind: 'log', logActionId: 'act.queryLog' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  views: [
    {
      viewId: 'v.agentSessions',
      resourceId: 'agentSessions',
      resourceRevision: '1',
      fields: [
        'id',
        'projectId',
        'task',
        'status',
        'progress',
        'model',
        'branch',
        'startedAt',
        'updatedAt',
        'durationMin',
        'filesChanged',
        'tokens',
      ],
    },
    {
      viewId: 'v.agentProjects',
      resourceId: 'agentProjects',
      resourceRevision: '1',
      fields: ['id', 'name', 'description', 'repository'],
    },
    {
      viewId: 'v.agentMessages',
      resourceId: 'agentMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
    {
      viewId: 'v.agentFiles',
      resourceId: 'agentFiles',
      resourceRevision: '1',
      fields: ['id', 'path', 'status', 'additions', 'deletions'],
    },
    {
      viewId: 'v.agentActivity',
      resourceId: 'agentActivity',
      resourceRevision: '1',
      fields: ['id', 'at', 'actor', 'summary'],
    },
    {
      viewId: 'v.agentLog',
      resourceId: 'agentLog',
      resourceRevision: '1',
      fields: ['id', 'at', 'level', 'tool', 'line'],
    },
  ],
  actions: [
    {
      kind: 'query',
      id: 'act.pickSessions',
      revision: '1',
      resourceId: 'agentSessions',
      resourceRevision: '1',
    },
    {
      kind: 'query',
      id: 'act.pickProjects',
      revision: '1',
      resourceId: 'agentProjects',
      resourceRevision: '1',
    },
    {
      kind: 'query',
      id: 'act.queryLog',
      revision: '1',
      resourceId: 'agentLog',
      resourceRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.send',
      revision: '1',
      resourceId: 'agentMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'agent.message.input',
      feedback: {
        success: 'Victor acknowledged your message.',
        failure:
          'Victor can’t take new messages while this session isn’t running. Your draft is still here — resume or reset the session, then send it again.',
      },
    },
    {
      kind: 'mutation',
      id: 'act.approve',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'approve',
      inputContractId: 'agent.console.input',
      feedback: { success: 'Approved — Victor resumed the session.' },
    },
    {
      kind: 'mutation',
      id: 'act.decline',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'decline',
      inputContractId: 'agent.console.input',
      feedback: { success: 'Declined — the session closed without applying the pending change.' },
    },
    {
      kind: 'mutation',
      id: 'act.advance',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'advance',
      inputContractId: 'agent.console.input',
      feedback: { success: 'Step complete — progress updated.' },
    },
    {
      kind: 'mutation',
      id: 'act.fail',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'agent.console.input',
      feedback: {
        success: 'Failure simulated — Victor stopped at its last checkpoint.',
      },
    },
    {
      kind: 'mutation',
      id: 'act.retry',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'retry',
      inputContractId: 'agent.console.input',
      feedback: { success: 'Victor resumed from the last checkpoint.' },
    },
    {
      kind: 'mutation',
      id: 'act.reset',
      revision: '1',
      resourceId: 'agentConsole',
      resourceRevision: '1',
      op: 'reset',
      inputContractId: 'agent.console.input',
      feedback: { success: 'Demo data restored.' },
    },
  ],
  resources: agentResourceList.map((resource) => ({ resourceId: resource.id, revision: '1' })),
  components: [
    { componentId: 'cmp.session-picker', revision: '1' },
    { componentId: 'cmp.session-console', revision: '1' },
    { componentId: 'cmp.output-log', revision: '1' },
  ],
  compatibility: { applicationSchema: APPLICATION_DEFINITION_SCHEMA_V2 },
  theme: {
    reference: 'vict.default-theme',
    tokens: [
      { name: 'color.accent', value: '#0f766e' },
      { name: 'color.focusRing', value: '#0f766e' },
      { name: 'radius.base', value: '10px' },
    ],
  },
};

/** Compile the neutral definition into the immutable plan. */
export function compileAgentPlan(): ApplicationPlan {
  const result = compileApplication({
    application: agentApplication,
    resources: agentResourceList,
    contracts: [...agentRegistryContracts],
    components: agentApplication.components ?? [],
  });
  if (!result.ok) {
    const summary = result.issues
      .map((issue) => `${issue.code}: ${issue.message}${issue.path ? ` @ ${issue.path}` : ''}`)
      .join('\n');
    throw new Error(
      `agent workspace definition invalid (${result.issues.length} issues):\n${summary}`,
    );
  }
  return result.plan;
}
