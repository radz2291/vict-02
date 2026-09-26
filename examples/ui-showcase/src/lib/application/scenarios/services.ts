import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Scenarios 3–6: AI coding agent, Quellight shared world, workflow /
 * governance, and the executive analytics dashboard. All surfaces are
 * ordinary VICT definition vocabulary; the agent and Quellight
 * conversations send through real mutation actions whose server handling
 * composes a real VICT capability run for the assistant reply.
 */

const AGENT_TONES = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  awaiting_approval: 'warning',
  queued: 'neutral',
};
const WORLD_TONES = { current: 'success', stale: 'warning', conflicted: 'danger' };
const STAGE_TONES = {
  draft: 'neutral',
  review: 'info',
  approval: 'warning',
  execution: 'info',
  verification: 'success',
};

export const agentScenario: Scenario = {
  routes: [
    {
      id: 'agent',
      path: '/agent',
      screenId: 's.agent',
      nav: { label: 'Sessions', group: 'Agent', order: 1 },
    },
    {
      id: 'agent-parallel',
      path: '/agent/parallel',
      screenId: 's.agent-parallel',
      nav: { label: 'Parallel work', group: 'Agent', order: 2 },
    },
    { id: 'agent-session', path: '/agent/sessions/:id', screenId: 's.agent-session' },
  ],
  screens: [
    {
      id: 's.agent',
      title: 'Agent Sessions',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Agent' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.agent-intro',
            level: 2,
            content:
              'Senarai sesi ejen pengekodan: projek, tugas, status, jumlah token dan cawangan kerja. Paparan ini menguji sama ada VICT UI meyakinkan sebagai bahagian hadapan ejen ringan.',
          },
          {
            role: 'status',
            id: 'st.agent-pool',
            value: '2 ejen aktif',
            tones: { '2 ejen aktif': 'info', 'Tiada ejen aktif': 'neutral' },
          },
          {
            role: 'table',
            id: 'tb.agent-sessions',
            viewId: 'v.agentSessions',
            searchFields: ['id', 'project', 'task', 'branch'],
            pageSize: 7,
            emptyMessage: 'Tiada sesi ejen.',
            columns: [
              { field: 'id', label: 'Sesi', sortable: true },
              { field: 'project', label: 'Projek', sortable: true },
              { field: 'status', label: 'Status', sortable: true },
              { field: 'model', label: 'Model', sortable: true },
              { field: 'filesChanged', label: 'Fail', sortable: true },
              { field: 'tokens', label: 'Token', sortable: true },
              { field: 'branch', label: 'Cawangan', sortable: true },
            ],
          },
          {
            role: 'text',
            id: 't.agent-hint',
            content:
              'Buka sesi kerja: /agent/sessions/AGT-2201 (menunggu kelulusan fasad), /agent/sessions/AGT-2204 (gagal).',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.agent-loading', content: 'Memuatkan sesi…' },
        failure: {
          role: 'text',
          id: 't.agent-failure',
          content: 'Senarai sesi gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.agent-session',
      title: 'Ruang Kerja Ejen',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Agent', routeId: 'agent' },
        { label: 'Sesi' },
      ],
      layout: [
        region('main', [
          { role: 'status', id: 'st.as-status', field: 'status', tones: AGENT_TONES },
          {
            role: 'detail',
            id: 'dt.as-detail',
            viewId: 'v.agentSessionDetail',
            fields: [
              'id',
              'project',
              'task',
              'status',
              'model',
              'startedAt',
              'durationMin',
              'filesChanged',
              'tokens',
              'branch',
            ],
            emptyMessage: 'Sesi ini tidak wujud.',
          },
          {
            role: 'tabs',
            id: 'ts.as-tabs',
            tabs: [
              {
                name: 'sembang',
                label: 'Sembang',
                surfaces: [
                  {
                    role: 'conversation',
                    id: 'cv.as-chat',
                    viewId: 'v.agentMessages',
                    messageField: 'text',
                    authorField: 'author',
                    participantField: 'participant',
                    sendActionId: 'act.agentSend',
                    inputLabel: 'Arahan ejen',
                    inputPlaceholder: 'Berikan arahan atau soalan…',
                    emptyMessage: 'Tiada mesej lagi. Berikan arahan pertama.',
                  },
                ],
              },
              {
                name: 'fail',
                label: 'Fail',
                surfaces: [
                  {
                    role: 'list',
                    id: 'ls.as-files',
                    viewId: 'v.agentFiles',
                    titleField: 'path',
                    secondaryField: 'status',
                    emptyMessage: 'Tiada fail disentuh oleh sesi ini.',
                  },
                  {
                    role: 'drawer',
                    id: 'dr.as-file',
                    title: 'Ringkasan fail',
                    triggerLabel: 'Ringkasan fail…',
                    content: [
                      {
                        role: 'text',
                        id: 't.as-file-text',
                        content:
                          'Fail yang disentuh oleh ejen semasa sesi ini, dengan status setiap fail (modified/new/clean/deleted) dan bilangan baris. Senarai ini tapisan pihak pelayan mengikut sesi semasa.',
                      },
                      {
                        role: 'list',
                        id: 'ls.as-files-drawer',
                        viewId: 'v.agentFiles',
                        titleField: 'path',
                        secondaryField: 'lines',
                        emptyMessage: 'Tiada fail.',
                      },
                    ],
                  },
                ],
              },
              {
                name: 'log',
                label: 'Log',
                surfaces: [
                  {
                    role: 'list',
                    id: 'ls.as-log',
                    viewId: 'v.agentMessages',
                    titleField: 'author',
                    secondaryField: 'text',
                    emptyMessage: 'Tiada peristiwa dilog.',
                  },
                ],
              },
            ],
          },
          {
            role: 'dialog',
            id: 'dlg.as-approve',
            title: 'Kelulusan tindakan fasad',
            triggerLabel: 'Kelulusan…',
            content: [
              {
                role: 'text',
                id: 't.as-approve-text',
                content:
                  'Ejen meminta kelulusan sebelum menyentuh senarai eksport fasad. Kelulusan demo memajukan sesi menunggu pertama kepada keadaan running (tindakan demo sebenar melalui sempadan penulisan).',
              },
              {
                role: 'action',
                id: 'act.as-approve-btn',
                actionId: 'act.approveSession',
                label: 'Luluskan dan teruskan',
              },
            ],
          },
          {
            role: 'action',
            id: 'act.as-fail-btn',
            actionId: 'act.failAgent',
            label: 'Simulasi kegagalan ejen (demo)',
          },
          {
            role: 'drawer',
            id: 'dr.as-task',
            title: 'Butiran tugas',
            triggerLabel: 'Butiran tugas…',
            content: [
              {
                role: 'text',
                id: 't.as-task-text',
                content: 'Tugas penuh, cawangan dan penggunaan token bagi sesi semasa.',
              },
              {
                role: 'detail',
                id: 'dt.as-task',
                viewId: 'v.agentSessionDetail',
                fields: ['task', 'branch', 'tokens', 'startedAt'],
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.as-loading', content: 'Memuatkan ruang kerja…' },
        failure: { role: 'text', id: 't.as-failure', content: 'Ruang kerja gagal dengan selamat.' },
      },
    },
    {
      id: 's.agent-parallel',
      title: 'Parallel Work',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Agent', routeId: 'agent' },
        { label: 'Parallel work' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.ap-intro',
            level: 2,
            content:
              'Tiga ejen serentak dalam keadaan berbeza — tekanan komunikasi status selari tanpa infrastruktur ejen sebenar.',
          },
          {
            role: 'status',
            id: 'st.ap-a',
            value: 'Ejen A — running (shell migration)',
            tones: { 'Ejen A — running (shell migration)': 'info' },
          },
          {
            role: 'status',
            id: 'st.ap-b',
            value: 'Ejen B — selesai (release pack)',
            tones: { 'Ejen B — selesai (release pack)': 'success' },
          },
          {
            role: 'status',
            id: 'st.ap-c',
            value: 'Ejen C — gagal (evidence split)',
            tones: { 'Ejen C — gagal (evidence split)': 'danger' },
          },
          {
            role: 'table',
            id: 'tb.ap-jobs',
            viewId: 'v.agentSessions',
            pageSize: 10,
            emptyMessage: 'Tiada kerja selari.',
            columns: [
              { field: 'id', label: 'Sesi', sortable: true },
              { field: 'status', label: 'Status', sortable: true },
              { field: 'model', label: 'Model', sortable: true },
              { field: 'tokens', label: 'Token', sortable: true },
              { field: 'filesChanged', label: 'Fail', sortable: true },
            ],
          },
        ]),
      ],
      states: {
        failure: {
          role: 'text',
          id: 't.ap-failure',
          content: 'Paparan selari gagal dengan selamat.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.agentSessions',
      resourceId: 'agentSessions',
      resourceRevision: '1',
      fields: ['id', 'project', 'status', 'model', 'filesChanged', 'tokens', 'branch', 'task'],
    },
    {
      viewId: 'v.agentSessionDetail',
      resourceId: 'agentSessions',
      resourceRevision: '1',
      fields: [
        'id',
        'project',
        'task',
        'status',
        'model',
        'startedAt',
        'durationMin',
        'filesChanged',
        'tokens',
        'branch',
      ],
    },
    {
      viewId: 'v.agentFiles',
      resourceId: 'agentFiles',
      resourceRevision: '1',
      fields: ['id', 'sessionId', 'path', 'status', 'lines'],
    },
    {
      viewId: 'v.agentMessages',
      resourceId: 'agentMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
  ],
  forms: [],
  actions: [
    {
      kind: 'mutation',
      id: 'act.agentSend',
      revision: '1',
      resourceId: 'agentMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.approveSession',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'approveSession',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.failAgent',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'showcase.demo.input',
    },
  ],
};

export const quellightScenario: Scenario = {
  routes: [
    {
      id: 'quellight',
      path: '/quellight',
      screenId: 's.quellight',
      nav: { label: 'Perbualan', group: 'Quellight', order: 1 },
    },
    {
      id: 'quellight-world',
      path: '/quellight/world',
      screenId: 's.quellight-world',
      nav: { label: 'Dunia bersama', group: 'Quellight', order: 2 },
    },
    {
      id: 'quellight-changes',
      path: '/quellight/changes',
      screenId: 's.quellight-changes',
      nav: { label: 'Perubahan dunia', group: 'Quellight', order: 3 },
    },
    { id: 'quellight-entry', path: '/quellight/world/:id', screenId: 's.quellight-entry' },
  ],
  screens: [
    {
      id: 's.quellight',
      title: 'Quellight',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Quellight' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.ql-intro',
            level: 2,
            content:
              'Produk perbualan dengan keadaan berstruktur tahan lasak: perbualan semasa di bawah, dan fokus dunia pengetahuan semasa (rekod QL-0042) sebagai butiran.',
          },
          {
            role: 'status',
            id: 'st.ql-focus',
            field: 'status',
            tones: WORLD_TONES,
          },
          {
            role: 'conversation',
            id: 'cv.ql-chat',
            viewId: 'v.quellightMessages',
            messageField: 'text',
            authorField: 'author',
            participantField: 'participant',
            sendActionId: 'act.quellightSend',
            inputLabel: 'Mesej',
            inputPlaceholder: 'Taip dalam Bahasa Malaysia atau BI…',
            emptyMessage: 'Tiada mesej lagi — mulakan perbualan.',
          },
          {
            role: 'detail',
            id: 'dt.ql-focus',
            viewId: 'v.worldDetail',
            fields: [
              'id',
              'topic',
              'kind',
              'confidence',
              'status',
              'source',
              'updatedAt',
              'summary',
            ],
            emptyMessage: 'Fokus dunia tidak tersedia.',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ql-loading', content: 'Memuatkan perbualan…' },
        failure: { role: 'text', id: 't.ql-failure', content: 'Perbualan gagal dengan selamat.' },
      },
    },
    {
      id: 's.quellight-world',
      title: 'Dunia Bersama',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Quellight', routeId: 'quellight' },
        { label: 'Dunia bersama' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.ql-world-intro',
            level: 2,
            content:
              'Pengetahuan tahan lasak: topik, jenis, keyakinan dan status. Provenansi dibuka dalam drawer.',
          },
          {
            role: 'table',
            id: 'tb.ql-world',
            viewId: 'v.world',
            searchFields: ['topic', 'kind'],
            filterFields: ['status'],
            pageSize: 8,
            emptyMessage: 'Tiada rekod dunia.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'topic', label: 'Topik', sortable: true },
              { field: 'kind', label: 'Jenis', sortable: true },
              { field: 'status', label: 'Status', sortable: true },
              { field: 'confidence', label: 'Keyakinan', sortable: true },
              { field: 'updatedAt', label: 'Dikemas kini', sortable: true },
            ],
          },
          {
            role: 'drawer',
            id: 'dr.ql-provenance',
            title: 'Provenansi dunia',
            triggerLabel: 'Provenansi…',
            content: [
              {
                role: 'text',
                id: 't.ql-provenance-text',
                content:
                  'Setiap rekod dunia membawa sumber dan masa kemas kini; konflik ditanda dengan status conflicted.',
              },
              {
                role: 'list',
                id: 'ls.ql-provenance',
                viewId: 'v.worldProvenance',
                titleField: 'source',
                secondaryField: 'updatedAt',
                emptyMessage: 'Tiada sumber direkodkan.',
              },
            ],
          },
          {
            role: 'text',
            id: 't.ql-world-hint',
            content:
              'Buka rekod: /quellight/world/QL-0047 (berkonflik/berstatus stale), /quellight/world/QL-0045.',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ql-world-loading', content: 'Memuatkan dunia…' },
        failure: {
          role: 'text',
          id: 't.ql-world-failure',
          content: 'Dunia bersama gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.quellight-entry',
      title: 'Rekod dunia',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Quellight', routeId: 'quellight' },
        { label: 'Dunia bersama', routeId: 'quellight-world' },
        { label: 'Rekod' },
      ],
      layout: [
        region('main', [
          { role: 'status', id: 'st.qe-status', field: 'status', tones: WORLD_TONES },
          {
            role: 'detail',
            id: 'dt.qe-detail',
            viewId: 'v.worldDetail',
            emptyMessage: 'Rekod dunia ini tidak wujud.',
          },
          {
            role: 'dialog',
            id: 'dlg.qe-propose',
            title: 'Cadangkan perubahan dunia',
            triggerLabel: 'Cadangkan…',
            content: [
              {
                role: 'text',
                id: 't.qe-propose-text',
                content:
                  'Tindakan demo: meluluskan cadangan menunggu pertama dalam dunia bersama melalui sempadan penulisan sebenar (kandungan demo, tiada infrastruktur sebenar).',
              },
              {
                role: 'action',
                id: 'act.qe-propose-btn',
                actionId: 'act.decideChange',
                label: 'Rekodkan keputusan demo',
              },
            ],
          },
          {
            role: 'drawer',
            id: 'dr.qe-provenance',
            title: 'Provenansi rekod',
            triggerLabel: 'Provenansi…',
            content: [
              {
                role: 'detail',
                id: 'dt.qe-provenance',
                viewId: 'v.worldDetail',
                fields: ['source', 'updatedAt', 'confidence'],
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.qe-loading', content: 'Memuatkan rekod…' },
        failure: { role: 'text', id: 't.qe-failure', content: 'Rekod dunia gagal dengan selamat.' },
      },
    },
    {
      id: 's.quellight-changes',
      title: 'Perubahan dunia',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Quellight', routeId: 'quellight' },
        { label: 'Perubahan' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.qlc-intro',
            level: 2,
            content:
              'Cadangan perubahan terhadap dunia bersama: menunggu, diterima, ditolak, dan maklumat lapuk/bertentangan.',
          },
          {
            role: 'table',
            id: 'tb.qlc-changes',
            viewId: 'v.changes',
            searchFields: ['proposal', 'proposedBy'],
            filterFields: ['status'],
            pageSize: 6,
            emptyMessage: 'Tiada cadangan.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'entryId', label: 'Rekod', sortable: true },
              { field: 'proposal', label: 'Cadangan', sortable: true },
              { field: 'status', label: 'Status', sortable: true },
              { field: 'proposedBy', label: 'Pencadang', sortable: true },
              { field: 'reviewedBy', label: 'Penyemak', sortable: true },
            ],
          },
          {
            role: 'dialog',
            id: 'dlg.qlc-decide',
            title: 'Keputusan demo',
            triggerLabel: 'Buat keputusan (demo)…',
            content: [
              {
                role: 'text',
                id: 't.qlc-decide-text',
                content:
                  'Demo ini meluluskan cadangan menunggu pertama (keadaan ditentukan secara deterministik) melalui sempadan penulihan sebenar.',
              },
              {
                role: 'action',
                id: 'act.qlc-decide-btn',
                actionId: 'act.decideChange',
                label: 'Terima cadangan menunggu pertama',
              },
            ],
          },
          {
            role: 'status',
            id: 'st.qlc-stale',
            value: 'Maklumat bertentangan dikesan',
            tones: {
              'Maklumat bertentangan dikesan': 'danger',
              'Maklumat lapuk dikesan': 'warning',
            },
          },
        ]),
      ],
      states: {
        failure: {
          role: 'text',
          id: 't.qlc-failure',
          content: 'Senarai perubahan gagal dengan selamat.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.world',
      resourceId: 'worldEntries',
      resourceRevision: '1',
      fields: ['id', 'topic', 'kind', 'status', 'confidence', 'updatedAt'],
    },
    {
      viewId: 'v.worldProvenance',
      resourceId: 'worldEntries',
      resourceRevision: '1',
      fields: ['source', 'updatedAt'],
    },
    {
      viewId: 'v.worldDetail',
      resourceId: 'worldEntries',
      resourceRevision: '1',
      fields: ['id', 'topic', 'kind', 'confidence', 'status', 'source', 'updatedAt', 'summary'],
    },
    {
      viewId: 'v.changes',
      resourceId: 'worldChanges',
      resourceRevision: '1',
      fields: ['id', 'entryId', 'proposal', 'status', 'proposedBy', 'reviewedBy'],
    },
    {
      viewId: 'v.quellightMessages',
      resourceId: 'quellightMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
  ],
  forms: [],
  actions: [
    {
      kind: 'mutation',
      id: 'act.quellightSend',
      revision: '1',
      resourceId: 'quellightMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.decideChange',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'decideChange',
      inputContractId: 'showcase.demo.input',
    },
  ],
};

export const workflowScenario: Scenario = {
  routes: [
    {
      id: 'workflow',
      path: '/workflow',
      screenId: 's.workflow',
      nav: { label: 'Workflow', group: 'Governance', order: 1 },
    },
    { id: 'workflow-instance', path: '/workflow/instances/:id', screenId: 's.workflow-instance' },
  ],
  screens: [
    {
      id: 's.workflow',
      title: 'Workflow / Governance',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Workflow' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.wf-intro',
            level: 2,
            content:
              'Aliran kerja lima peringkat: draf → semakan → kelulusan → pelaksanaan → verifikasi. Perhatikan hierarki dan komunikasi keadaan merentasi rekod.',
          },
          {
            role: 'table',
            id: 'tb.wf-instances',
            viewId: 'v.workflow',
            searchFields: ['id', 'title', 'owner'],
            filterFields: ['stage'],
            pageSize: 8,
            emptyMessage: 'Tiada instans kerja.',
            columns: [
              { field: 'id', label: 'Instans', sortable: true },
              { field: 'title', label: 'Tajuk', sortable: true },
              { field: 'stage', label: 'Peringkat', sortable: true },
              { field: 'owner', label: 'Pemilik', sortable: true },
              { field: 'dueDate', label: 'Tamat', sortable: true },
              { field: 'progress', label: 'Kemajuan (%)', sortable: true },
              { field: 'blocked', label: 'Sekat', sortable: true },
            ],
          },
          {
            role: 'text',
            id: 't.wf-hint',
            content:
              'Buka instans: /workflow/instances/WF-1042 (semakan), /workflow/instances/WF-1044 (kelulusan), /workflow/instances/WF-1047 (sekat).',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.wf-loading', content: 'Memuatkan aliran kerja…' },
        failure: {
          role: 'text',
          id: 't.wf-failure',
          content: 'Aliran kerja gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.workflow-instance',
      title: 'Instans aliran kerja',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Workflow', routeId: 'workflow' },
        { label: 'Instans' },
      ],
      layout: [
        region('main', [
          { role: 'status', id: 'st.wf-stage', field: 'stage', tones: STAGE_TONES },
          {
            role: 'detail',
            id: 'dt.wf-detail',
            viewId: 'v.workflowDetail',
            emptyMessage: 'Instans ini tidak wujud.',
          },
          {
            role: 'tabs',
            id: 'ts.wf-tabs',
            tabs: [
              {
                name: 'semakan',
                label: 'Semakan',
                surfaces: [
                  { role: 'form', id: 'fm.wf-note', formId: 'f.wf-note' },
                  {
                    role: 'action',
                    id: 'act.wf-note-reset',
                    actionId: 'act.resetForm',
                    label: 'Set semula (setempat)',
                  },
                ],
              },
              {
                name: 'acara',
                label: 'Acara',
                surfaces: [
                  {
                    role: 'list',
                    id: 'ls.wf-events',
                    viewId: 'v.workflowEvents',
                    titleField: 'stage',
                    secondaryField: 'note',
                    emptyMessage: 'Tiada acara direkodkan.',
                  },
                ],
              },
              {
                name: 'pelaksanaan',
                label: 'Pelaksanaan',
                surfaces: [
                  {
                    role: 'detail',
                    id: 'dt.wf-exec',
                    viewId: 'v.workflowDetail',
                    fields: ['progress', 'blocked', 'department', 'dueDate'],
                  },
                ],
              },
            ],
          },
          {
            role: 'dialog',
            id: 'dlg.wf-approve',
            title: 'Kelulusan peringkat',
            triggerLabel: 'Luluskan peringkat…',
            content: [
              {
                role: 'text',
                id: 't.wf-approve-text',
                content:
                  'Demo kelulusan: tindakan memajukan instans peringkat kelulusan yang tertua (menentukan secara deterministik) kepada pelaksanaan, melalui sempadan penulihan sebenar.',
              },
              {
                role: 'action',
                id: 'act.wf-approve-btn',
                actionId: 'act.advanceStage',
                label: 'Luluskan peringkat (demo)',
              },
            ],
          },
          {
            role: 'action',
            id: 'act.wf-fail-btn',
            actionId: 'act.forceVerifyFailure',
            label: 'Simulasi kegagalan verifikasi (demo)',
          },
          {
            role: 'drawer',
            id: 'dr.wf-policy',
            title: 'Polisi peringkat',
            triggerLabel: 'Polisi peringkat…',
            content: [
              {
                role: 'text',
                id: 't.wf-policy-text',
                content:
                  'Draf disediakan pemilik; semakan teknikal oleh unit perancangan; kelulusan oleh jawatankuasa; pelaksanaan oleh IT; verifikasi bebas oleh kewangan. Setiap peringkat merekodkan acara bertarikh.',
              },
              {
                role: 'list',
                id: 'ls.wf-policy-events',
                viewId: 'v.workflowEvents',
                titleField: 'actor',
                secondaryField: 'stage',
                emptyMessage: 'Tiada acara.',
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.wf-det-loading', content: 'Memuatkan instans…' },
        validation: {
          role: 'text',
          id: 't.wf-det-validation',
          content: 'Catatan semakan gagal pengesahan.',
        },
        failure: { role: 'text', id: 't.wf-det-failure', content: 'Instans gagal dengan selamat.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.workflow',
      resourceId: 'workflowInstances',
      resourceRevision: '1',
      fields: ['id', 'title', 'stage', 'owner', 'dueDate', 'progress', 'blocked'],
    },
    {
      viewId: 'v.workflowDetail',
      resourceId: 'workflowInstances',
      resourceRevision: '1',
      fields: ['id', 'title', 'stage', 'owner', 'dueDate', 'progress', 'blocked', 'department'],
    },
    {
      viewId: 'v.workflowEvents',
      resourceId: 'workflowEvents',
      resourceRevision: '1',
      fields: ['id', 'instanceId', 'stage', 'actor', 'note', 'at'],
    },
  ],
  forms: [
    {
      formId: 'f.wf-note',
      resourceId: 'demo',
      resourceRevision: '1',
      inputContractId: 'showcase.demo.input',
      fields: [{ name: 'note', label: 'Catatan semakan', required: false, widget: 'json' }],
      submitActionId: 'act.stageNote',
    },
  ],
  actions: [
    {
      kind: 'mutation',
      id: 'act.stageNote',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'note',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.advanceStage',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'advanceStage',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.forceVerifyFailure',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'showcase.demo.input',
    },
  ],
};

export const analyticsScenario: Scenario = {
  routes: [
    {
      id: 'analytics',
      path: '/analytics',
      screenId: 's.analytics',
      nav: { label: 'Analytics', group: 'Analytics', order: 1 },
    },
  ],
  screens: [
    {
      id: 's.analytics',
      title: 'Executive Analytics',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Analytics' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.an-intro',
            level: 2,
            content:
              'Papan pemuka eksekutif daripada definisi VICT biasa: penunjuk utama, grid data, dua carta, jadual urusan dan drawer butiran. Gaya datang sepenuhnya daripada VICT — tiada gaya papan pemuka khas.',
          },
          {
            role: 'status',
            id: 'st.an-quarter',
            value: 'Skuarten terkini: Q2 2026',
            tones: { 'Skuarten terkini: Q2 2026': 'info' },
          },
          {
            role: 'status',
            id: 'st.an-risk',
            value: 'Risiko sederhana',
            tones: { 'Risiko sederhana': 'warning', 'Risiko rendah': 'success' },
          },
          {
            role: 'list',
            id: 'ls.an-kpi',
            viewId: 'v.kpi',
            titleField: 'label',
            secondaryField: 'value',
            emptyMessage: 'Tiada penunjuk.',
          },
          {
            role: 'view',
            id: 'dv.an-kpi',
            viewId: 'v.kpi',
          },
          {
            role: 'chart',
            id: 'ch.an-trend',
            viewId: 'v.kpiTrend',
            kind: 'line',
            xField: 'quarter',
            yField: 'value',
            summary: 'Trend nilai penunjuk mengikut sukuarten',
            title: 'Trend sukuarten',
          },
          {
            role: 'chart',
            id: 'ch.an-segment',
            viewId: 'v.kpiBySegment',
            kind: 'bar',
            xField: 'segment',
            yField: 'value',
            summary: 'Jumlah nilai penunjuk mengikut segmen',
            title: 'Nilai mengikut segmen',
          },
          {
            role: 'table',
            id: 'tb.an-deals',
            viewId: 'v.deals',
            searchFields: ['account', 'region', 'owner'],
            pageSize: 7,
            emptyMessage: 'Tiada urusan.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'account', label: 'Akaun', sortable: true },
              { field: 'region', label: 'Wilayah', sortable: true },
              { field: 'value', label: 'Nilai (RM)', sortable: true },
              { field: 'stage', label: 'Peringkat', sortable: true },
              { field: 'closeDate', label: 'Tarikh tutup', sortable: true },
            ],
          },
          {
            role: 'drawer',
            id: 'dr.an-deal',
            title: 'Butiran urusan',
            triggerLabel: 'Butiran urusan…',
            content: [
              {
                role: 'text',
                id: 't.an-deal-text',
                content:
                  'Senarai urusan mengikut akaun dan nilai; jadual penuh kekal pada skrin utama.',
              },
              {
                role: 'list',
                id: 'ls.an-deal-list',
                viewId: 'v.deals',
                titleField: 'account',
                secondaryField: 'value',
                emptyMessage: 'Tiada urusan.',
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.an-loading', content: 'Memuatkan analitik…' },
        failure: { role: 'text', id: 't.an-failure', content: 'Analitik gagal dengan selamat.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.kpi',
      resourceId: 'kpi',
      resourceRevision: '1',
      fields: ['id', 'label', 'value', 'unit', 'deltaPct', 'segment', 'quarter'],
    },
    {
      viewId: 'v.kpiTrend',
      resourceId: 'kpi',
      resourceRevision: '1',
      fields: ['quarter', 'value'],
    },
    {
      viewId: 'v.kpiBySegment',
      resourceId: 'kpi',
      resourceRevision: '1',
      fields: ['segment', 'value'],
    },
    {
      viewId: 'v.deals',
      resourceId: 'deals',
      resourceRevision: '1',
      fields: ['id', 'account', 'region', 'value', 'stage', 'closeDate', 'owner'],
    },
  ],
  forms: [],
  actions: [],
};
