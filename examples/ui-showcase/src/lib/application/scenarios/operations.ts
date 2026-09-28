import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Scenario 1 — Operations / CRUD (Bahasa Malaysia product data).
 *
 * A realistic Malaysian service-desk/operations product: dashboard with a
 * server-side query table, status language, a chart over ticket cost, a
 * create form with every widget and BM labels, a detail screen with tabs,
 * a destructive dialog (real authorization denial), a drawer, and the
 * edit form with prefill (including a zero numeric value on OPS-1057).
 */

const STATE_TONES = { baru: 'info', dalam_proses: 'info', selesai: 'success', batal: 'neutral' };
const PRIORITY_TONES = {
  rendah: 'neutral',
  sederhana: 'info',
  tinggi: 'warning',
  kritikal: 'danger',
};

export const operationsScenario: Scenario = {
  routes: [
    {
      id: 'ops',
      path: '/ops',
      screenId: 's.ops',
      nav: { label: 'Operasi', group: 'Operations', order: 1 },
    },
    { id: 'ops-ticket-new', path: '/ops/tickets/new', screenId: 's.ops-new' },
    { id: 'ops-ticket-detail', path: '/ops/tickets/:id', screenId: 's.ops-ticket' },
  ],
  screens: [
    {
      id: 's.ops',
      title: 'Pusat Operasi',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Pusat Operasi' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.ops-intro',
            level: 2,
            content:
              'Papan pemuka khidmatan operasi: tiket pelanggan, keutamaan, kos dan tarikh SLA. Carian, tapisan, isihan dan muka surat berjalan melalui tindakan pertanyaan VICT di sebalik UI.',
          },
          {
            role: 'status',
            id: 'st.ops-health',
            value: 'Operasi normal',
            tones: { 'Operasi normal': 'success', Tertunggak: 'warning', Gangguan: 'danger' },
          },
          {
            role: 'table',
            id: 'tb.ops-tickets',
            viewId: 'v.tickets',
            queryActionId: 'act.queryTickets',
            searchFields: ['title', 'customer', 'owner', 'location'],
            filterFields: ['state'],
            pageSize: 8,
            emptyMessage: 'Tiada tiket sepadan. Cipta satu untuk bermula.',
            columns: [
              { field: 'title', label: 'Tajuk', sortable: true },
              { field: 'customer', label: 'Pelanggan', sortable: true },
              { field: 'state', label: 'Keadaan', sortable: true },
              { field: 'priority', label: 'Keutamaan', sortable: true },
              { field: 'amount', label: 'Kos (RM)', sortable: true },
              { field: 'slaDate', label: 'Tarikh SLA', sortable: true },
            ],
          },
          {
            role: 'chart',
            id: 'ch.ops-byState',
            viewId: 'v.ticketsByState',
            kind: 'bar',
            xField: 'state',
            yField: 'amount',
            summary: 'Jumlah kos tiket mengikut keadaan tiket',
            title: 'Kos tiket mengikut keadaan',
          },
          {
            role: 'action',
            id: 'act.ops-new-btn',
            actionId: 'act.navNewTicket',
            label: 'Tiket baharu',
          },
          {
            role: 'text',
            id: 't.ops-record-hint',
            content:
              'Buka rekod terus melalui URL: /ops/tickets/OPS-1042 (maklumat lengkap), /ops/tickets/OPS-1057 (contoh kos sifar).',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ops-loading', content: 'Memuatkan tiket…' },
        empty: { role: 'text', id: 't.ops-empty', content: 'Tiada tiket lagi.' },
        denied: {
          role: 'text',
          id: 't.ops-denied',
          content: 'Akses ditolak oleh sempadan kebenaran.',
        },
        stale: {
          role: 'text',
          id: 't.ops-stale',
          content: 'Menunjukkan data tersimpan yang mungkin lapuk.',
        },
        partial: {
          role: 'text',
          id: 't.ops-partial',
          content: 'Sebahagian data tiket tidak tersedia buat masa ini.',
        },
        failure: {
          role: 'text',
          id: 't.ops-failure',
          content: 'Senarai tiket gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.ops-new',
      title: 'Tiket baharu',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Pusat Operasi', routeId: 'ops' },
        { label: 'Tiket baharu' },
      ],
      layout: [
        region('main', [
          { role: 'form', id: 'fm.ops-create', formId: 'f.ticket-create' },
          {
            role: 'action',
            id: 'act.ops-reset-btn',
            actionId: 'act.resetForm',
            label: 'Kosongkan borang (setempat)',
          },
          {
            role: 'text',
            id: 't.ops-validation-hint',
            content:
              'Pengesahan pelayan: keadaan mesti salah satu daripada baru, dalam_proses, selesai atau batal. Taip nilai lain (contohnya "x") untuk melihat keadaan kegagalan pengesahan; keutamaan mesti rendah, sederhana, tinggi atau kritikal.',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ops-new-loading', content: 'Memuatkan borang…' },
        validation: {
          role: 'text',
          id: 't.ops-new-validation',
          content: 'Pengesahan gagal; semak medan yang ditanda.',
        },
        failure: { role: 'text', id: 't.ops-new-failure', content: 'Borang gagal dengan selamat.' },
      },
    },
    {
      id: 's.ops-ticket',
      title: 'Rekod tiket',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Pusat Operasi', routeId: 'ops' },
        { label: 'Rekod' },
      ],
      layout: [
        region('main', [
          {
            role: 'status',
            id: 'st.ops-state',
            field: 'state',
            tones: STATE_TONES,
          },
          {
            role: 'status',
            id: 'st.ops-priority',
            field: 'priority',
            tones: PRIORITY_TONES,
          },
          {
            role: 'tabs',
            id: 'ts.ops-tabs',
            tabs: [
              {
                name: 'ringkasan',
                label: 'Ringkasan',
                surfaces: [
                  {
                    role: 'detail',
                    id: 'dt.ops-detail',
                    viewId: 'v.ticketDetail',
                    emptyMessage: 'Tiket ini tidak wujud.',
                  },
                ],
              },
              {
                name: 'kemaskini',
                label: 'Kemaskini',
                surfaces: [
                  { role: 'form', id: 'fm.ops-edit', formId: 'f.ticket-edit' },
                  {
                    role: 'action',
                    id: 'act.ops-edit-reset-btn',
                    actionId: 'act.resetForm',
                    label: 'Set semula borang (setempat)',
                  },
                ],
              },
            ],
          },
          {
            role: 'dialog',
            id: 'dlg.ops-delete',
            title: 'Padam tiket',
            triggerLabel: 'Padam…',
            content: [
              {
                role: 'text',
                id: 't.ops-delete-warning',
                content:
                  'Tindakan ini memerlukan kebenaran tickets.admin.delete yang sengaja TIDAK dibawa oleh profil perkhidmatan ini — sempadan kebenaran akan menolaknya (keterlihatan butang bukan kebenaran).',
              },
              {
                role: 'action',
                id: 'act.ops-delete-btn',
                actionId: 'act.deleteTicket',
                label: 'Sahkan pemadaman',
              },
            ],
          },
          {
            role: 'drawer',
            id: 'dr.ops-audit',
            title: 'Nota audit',
            triggerLabel: 'Nota audit…',
            content: [
              {
                role: 'text',
                id: 't.ops-audit-text',
                content:
                  'Nota audit direkodkan oleh juruaudit dalaman. Kandungan di bawah datang daripada rekod tiket semasa — tiada kandungan tangan ditulis bagi skrin ini.',
              },
              {
                role: 'detail',
                id: 'dt.ops-audit',
                viewId: 'v.ticketDetail',
                fields: ['id', 'owner', 'createdAt', 'location'],
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ops-det-loading', content: 'Memuatkan rekod…' },
        denied: {
          role: 'text',
          id: 't.ops-det-denied',
          content: 'Pemadaman ditolak oleh sempadan kebenaran.',
        },
        failure: {
          role: 'text',
          id: 't.ops-det-failure',
          content: 'Rekod tiket gagal dengan selamat.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.tickets',
      resourceId: 'tickets',
      resourceRevision: '1',
      fields: [
        'id',
        'title',
        'customer',
        'state',
        'priority',
        'amount',
        'slaDate',
        'owner',
        'location',
      ],
    },
    {
      viewId: 'v.ticketsByState',
      resourceId: 'tickets',
      resourceRevision: '1',
      fields: ['state', 'amount'],
    },
    {
      viewId: 'v.ticketDetail',
      resourceId: 'tickets',
      resourceRevision: '1',
      fields: [
        'id',
        'title',
        'customer',
        'state',
        'priority',
        'channel',
        'amount',
        'slaDate',
        'escalated',
        'notes',
        'owner',
        'location',
        'createdAt',
      ],
    },
  ],
  forms: [
    {
      formId: 'f.ticket-create',
      resourceId: 'tickets',
      resourceRevision: '1',
      inputContractId: 'showcase.ticket.input',
      fields: [
        { name: 'id', label: 'Pengenalan (slug)', required: true, widget: 'text' },
        { name: 'title', label: 'Tajuk tiket', required: true, widget: 'text' },
        { name: 'customer', label: 'Pelanggan', required: true, widget: 'text' },
        {
          name: 'state',
          label: 'Keadaan (baru | dalam_proses | selesai | batal)',
          required: true,
          widget: 'text',
        },
        {
          name: 'priority',
          label: 'Keutamaan (rendah | sederhana | tinggi | kritikal)',
          required: true,
          widget: 'text',
        },
        { name: 'channel', label: 'Saluran', required: false, widget: 'text' },
        { name: 'amount', label: 'Kos (RM)', required: true, widget: 'number' },
        { name: 'slaDate', label: 'Tarikh SLA', required: true, widget: 'date' },
        { name: 'escalated', label: 'Eskalasi', required: true, widget: 'boolean' },
        { name: 'notes', label: 'Nota pentadbir (JSON/teks)', required: false, widget: 'json' },
        { name: 'owner', label: 'Pemilik', required: true, widget: 'text' },
        { name: 'location', label: 'Lokasi', required: false, widget: 'text' },
      ],
      submitActionId: 'act.ticketCreate',
    },
    {
      formId: 'f.ticket-edit',
      resourceId: 'tickets',
      resourceRevision: '1',
      inputContractId: 'showcase.ticket.input',
      fields: [
        { name: 'title', label: 'Tajuk tiket', required: true, widget: 'text' },
        { name: 'customer', label: 'Pelanggan', required: true, widget: 'text' },
        {
          name: 'state',
          label: 'Keadaan (baru | dalam_proses | selesai | batal)',
          required: true,
          widget: 'text',
        },
        {
          name: 'priority',
          label: 'Keutamaan (rendah | sederhana | tinggi | kritikal)',
          required: true,
          widget: 'text',
        },
        { name: 'channel', label: 'Saluran', required: false, widget: 'text' },
        { name: 'amount', label: 'Kos (RM)', required: true, widget: 'number' },
        { name: 'slaDate', label: 'Tarikh SLA', required: true, widget: 'date' },
        { name: 'escalated', label: 'Eskalasi', required: true, widget: 'boolean' },
        { name: 'notes', label: 'Nota pentadbir (JSON/teks)', required: false, widget: 'json' },
        { name: 'owner', label: 'Pemilik', required: true, widget: 'text' },
        { name: 'location', label: 'Lokasi', required: false, widget: 'text' },
      ],
      submitActionId: 'act.ticketUpdate',
    },
  ],
  actions: [
    {
      kind: 'navigation',
      id: 'act.navNewTicket',
      revision: '1',
      routeId: 'ops-ticket-new',
    },
    {
      kind: 'query',
      id: 'act.queryTickets',
      revision: '1',
      resourceId: 'tickets',
      resourceRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.ticketCreate',
      revision: '1',
      resourceId: 'tickets',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.ticket.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.ticketUpdate',
      revision: '1',
      resourceId: 'tickets',
      resourceRevision: '1',
      op: 'update',
      inputContractId: 'showcase.ticket.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.deleteTicket',
      revision: '1',
      resourceId: 'tickets',
      resourceRevision: '1',
      op: 'delete',
      inputContractId: 'showcase.ticket.input',
    },
  ],
};
