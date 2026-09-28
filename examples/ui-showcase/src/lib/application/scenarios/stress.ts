import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Scenario 8 — Stress Lab (+ deep breadcrumb trail and the navigation
 * stress group). This route deliberately makes the UI uncomfortable:
 * 30-column tables, 110 rows, unbroken long identifiers, long Bahasa
 * Malaysia sentences, empty strings, 12 tabs with long names, 55-message
 * conversation, huge/decimal/negative numbers, a 22-field form with a very
 * long validation message, and nested drawer → tabs → detail. The data is
 * NOT softened to make the UI look better.
 */

const STRESS_COLUMNS = [
  'id',
  ...Array.from({ length: 29 }, (_, index) => `c${String(index + 1).padStart(2, '0')}`),
];

const STRESS_TABS = [
  { name: 'n01', label: 'Surveilans Rantai Bekalan Negara' },
  { name: 'n02', label: 'Kadaran Kontrak Kerajaan Besar' },
  { name: 'n03', label: 'Penyeliaan Operasi Lapangan Semenanjung' },
  { name: 'n04', label: 'Integriti Data Berpusat Wilayah' },
  { name: 'n05', label: 'Pemantauan Rangkaian Nasional' },
  { name: 'n06', label: 'Aduan Pengguna Awam' },
  { name: 'n07', label: 'Pematuhan Regulasi Kewangan' },
  { name: 'n08', label: 'Perancangan Bandar Dan Desa' },
  { name: 'n09', label: 'Keselamatan Siber Komuniti' },
  { name: 'n10', label: 'Perkhidmatan Pengangkutan Awam' },
  { name: 'n11', label: 'Pengurusan Aset Kerajaan' },
  { name: 'n12', label: 'Kandungan Terakhir Dan Nota Panjang' },
] as const;

const NAV_STRESS_LABELS = [
  'Navigasi Tekanan Satu Dengan Nama Yang Sangat Panjang Untuk Sidebar',
  'Navigasi Tekanan Dua — Ujian Pembungkusan Label Panjang',
  'Navigasi Tekanan Tiga (Kandungan Ringkas)',
  'Navigasi Tekanan Empat Dengan Nama Yang Juga Sangat Panjang Sekali',
  'Navigasi Tekanan Lima — Nombor Dan Perpuluhan 123456789.42',
  'Navigasi Tekanan Enam — Bahasa Melayu Dan English Mixed',
] as const;

export const stressScenario: Scenario = {
  routes: [
    {
      id: 'stress',
      path: '/stress',
      screenId: 's.stress',
      nav: { label: 'Stress Lab', group: 'Reference', order: 2 },
    },
    { id: 'stress-deep', path: '/stress/deep/l3/l4/l5', screenId: 's.stress-deep' },
    ...NAV_STRESS_LABELS.map((_, index) => ({
      id: `stress-nav-${index + 1}`,
      path: `/stress/nav/n${index + 1}`,
      screenId: `s.nav-stress-${index + 1}`,
      nav: { label: NAV_STRESS_LABELS[index] as string, group: 'Stress nav', order: index + 1 },
    })),
  ],
  screens: [
    {
      id: 's.stress',
      title: 'Stress Lab',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Reference', routeId: 'gallery' },
        { label: 'Stress Lab' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.stress-intro',
            level: 2,
            content:
              'Makmal tekanan: data TIDAK dipermudahkan supaya UI kelihatan kemas. Jadual 30 lajur dan 110 baris, pengenalan panjang tanpa jeda, ayat panjang Bahasa Malaysia, rentetan kosong, banyak lencana, dua belas tab bernama panjang, perbualan 55 mesej, nombor besar, perpuluhan, nilai negatif, borang 22 medan dengan mesej pengesahan yang sangat panjang, dan penumpukan drawer → tab → butiran.',
          },
          {
            role: 'table',
            id: 'tb.stress-rows',
            viewId: 'v.stressRows',
            queryActionId: 'act.queryStress',
            searchFields: ['id', 'c01', 'c07'],
            filterFields: ['c01'],
            pageSize: 25,
            emptyMessage: 'Tiada baris stres.',
            columns: STRESS_COLUMNS.map((field, index) => ({
              field,
              label:
                field === 'id' ? 'Pengenalan panjang' : `Lajur ${String(index).padStart(2, '0')}`,
              sortable: index < 6,
            })),
          },
          {
            role: 'text',
            id: 't.stress-empty-note',
            content:
              'Lajur 10 dan 25 mengandungi rentetan kosong secara sengaja; lajur 06/12/18/24 mengandungi nombor melebihi 1_000_000_000; lajur 04/13/22 mengandungi perpuluhan dan nilai negatif.',
          },
          {
            role: 'status',
            id: 'st.stress-01',
            value: 'Operasi Normal Berterusan',
            tones: { 'Operasi Normal Berterusan': 'success' },
          },
          {
            role: 'status',
            id: 'st.stress-02',
            value: 'Menunggu Pengesahan Vendor',
            tones: { 'Menunggu Pengesahan Vendor': 'warning' },
          },
          {
            role: 'status',
            id: 'st.stress-03',
            value: 'Gagal Semakan Integriti',
            tones: { 'Gagal Semakan Integriti': 'danger' },
          },
          {
            role: 'status',
            id: 'st.stress-04',
            value: 'Penggantungan Sementara Perkhidmatan',
            tones: { 'Penggantungan Sementara Perkhidmatan': 'danger' },
          },
          {
            role: 'status',
            id: 'st.stress-05',
            value: 'Pemindahan Data Berjadual',
            tones: { 'Pemindahan Data Berjadual': 'info' },
          },
          {
            role: 'status',
            id: 'st.stress-06',
            value: 'Kuota Hampir Penuh',
            tones: { 'Kuota Hampir Penuh': 'warning' },
          },
          {
            role: 'status',
            id: 'st.stress-07',
            value: 'Draf Polisi Baharu',
            tones: { 'Draf Polisi Baharu': 'neutral' },
          },
          {
            role: 'status',
            id: 'st.stress-08',
            value: 'Maklumat Bertentangan',
            tones: { 'Maklumat Bertentangan': 'danger' },
          },
          {
            role: 'status',
            id: 'st.stress-09',
            value: 'Selesai Sepenuhnya',
            tones: { 'Selesai Sepenuhnya': 'success' },
          },
          {
            role: 'status',
            id: 'st.stress-10',
            value: 'Perkhidmatan Terhad',
            tones: { 'Perkhidmatan Terhad': 'warning' },
          },
          {
            role: 'status',
            id: 'st.stress-11',
            value: 'Maklumat Pemindahan',
            tones: { 'Maklumat Pemindahan': 'info' },
          },
          {
            role: 'status',
            id: 'st.stress-12',
            value: 'Gagal Sepenuhnya',
            tones: { 'Gagal Sepenuhnya': 'danger' },
          },
          {
            role: 'tabs',
            id: 'ts.stress-tabs',
            tabs: STRESS_TABS.map((tab, index) => ({
              name: tab.name,
              label: tab.label,
              surfaces: [
                {
                  role: 'text',
                  id: `t.stress-tab-${tab.name}`,
                  content:
                    index % 3 === 0
                      ? `Kandungan tab ${index + 1}: ${tab.label} — perenggan panjang bagi menguji tab yang penuh dengan nama panjang serta pembungkusan kandungan panel tab apabila lajur sempit pada 320px.`
                      : `Kandungan tab ${index + 1}: ${tab.label}.`,
                },
                ...(index === 11
                  ? [
                      {
                        role: 'drawer' as const,
                        id: 'dr.stress-nested',
                        title: 'Butiran bertingkat',
                        triggerLabel: 'Buka butiran bertingkat…',
                        content: [
                          {
                            role: 'text' as const,
                            id: 't.stress-nested-text',
                            content:
                              'Drawer mengandungi tab, dan tab kedua mengandungi butiran (rekod tidak wujud pada laluan ini — butiran kosong di dalam penumpukan).',
                          },
                          {
                            role: 'tabs' as const,
                            id: 'ts.stress-nested',
                            tabs: [
                              {
                                name: 'inner-a',
                                label: 'Dalam A',
                                surfaces: [
                                  {
                                    role: 'text' as const,
                                    id: 't.stress-inner-a',
                                    content: 'Tab dalam A di dalam drawer di dalam tab.',
                                  },
                                ],
                              },
                              {
                                name: 'inner-b',
                                label: 'Dalam B (butiran)',
                                surfaces: [
                                  {
                                    role: 'detail' as const,
                                    id: 'dt.stress-inner',
                                    viewId: 'v.stressRows',
                                    fields: ['id', 'c01', 'c07'],
                                    emptyMessage:
                                      'Butiran kosong di dalam penumpukan (tiada rekod semasa).',
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            })),
          },
          {
            role: 'conversation',
            id: 'cv.stress-chat',
            viewId: 'v.stressMessages',
            messageField: 'text',
            authorField: 'author',
            participantField: 'participant',
            sendActionId: 'act.stressSend',
            inputLabel: 'Mesej tekanan',
            inputPlaceholder: 'Mesej ke-56…',
            emptyMessage: 'Tiada mesej.',
          },
          {
            role: 'chart',
            id: 'ch.stress-mixed',
            viewId: 'v.gchartMixed',
            kind: 'bar',
            xField: 'label',
            yField: 'value',
            summary: 'Nilai besar 1_250_000, sifar, negatif dan label panjang dalam keadaan stres',
            title: 'Carta tekanan (nilai bercampur)',
          },
          {
            role: 'text',
            id: 't.stress-form-note',
            level: 3,
            content:
              'Borang 22 medan. Medan c03 mengandungi pencetus mesej panjang: taip perkataan "tolak" dalam medan 03 kemudian hantar untuk menerima mesej pengesahan yang sangat panjang daripada kontrak pelayan.',
          },
          { role: 'form', id: 'fm.stress-form', formId: 'f.stress-form' },
          {
            role: 'action',
            id: 'act.stress-reset-btn',
            actionId: 'act.resetForm',
            label: 'Set semula borang tekanan (setempat)',
          },
          {
            role: 'text',
            id: 't.stress-mobile-note',
            content:
              'Ujian lebar: 1440, 1024, 768, 430, 380 dan 320 piksel. Jadual 30 lajur dan tab 12 di sini sengaja tidak selesa pada skrin sempit — nilai kebenaran susun atur, bukan varian mudah alih yang dipoles.',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.stress-loading', content: 'Memuatkan makmal tekanan…' },
        validation: {
          role: 'text',
          id: 't.stress-validation',
          content: 'Pengesahan gagal — baca mesej panjang di atas dan semak medan yang ditanda.',
        },
        failure: {
          role: 'text',
          id: 't.stress-failure',
          content: 'Makmal tekanan gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.stress-deep',
      title: 'Jejak rapat',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Reference', routeId: 'gallery' },
        { label: 'Stress Lab', routeId: 'stress' },
        { label: 'Peringkat 3' },
        { label: 'Peringkat 4' },
        { label: 'Peringkat 5 — hujung jejak' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.stress-deep-text',
            level: 2,
            content:
              'Jejak remah enam aras: Home / Reference / Stress Lab / Peringkat 3 / Peringkat 4 / Peringkat 5. Nilai sama ada jejak ini kekal boleh dibaca pada 320px.',
          },
        ]),
      ],
      states: {
        failure: {
          role: 'text',
          id: 't.stress-deep-failure',
          content: 'Paparan jejak gagal dengan selamat.',
        },
      },
    },
    ...NAV_STRESS_LABELS.map((label, index) => ({
      id: `s.nav-stress-${index + 1}`,
      title: `Tekanan navigasi ${index + 1}`,
      layout: [
        region('main', [
          {
            role: 'text',
            id: `t.nav-stress-${index + 1}`,
            content: `Skrin tekanan navigasi ${index + 1}: ${label}. Kumpulan "Stress nav" menguji sidebar dengan banyak masukan dan label panjang.`,
          },
        ]),
      ],
      states: {
        failure: {
          role: 'text' as const,
          id: `t.nav-stress-${index + 1}-failure`,
          content: 'Skrin navigasi gagal dengan selamat.',
        },
      },
    })),
  ],
  views: [
    {
      viewId: 'v.stressRows',
      resourceId: 'stressRows',
      resourceRevision: '1',
      fields: STRESS_COLUMNS,
    },
    {
      viewId: 'v.stressMessages',
      resourceId: 'stressMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
  ],
  forms: [
    {
      formId: 'f.stress-form',
      resourceId: 'stressRows',
      resourceRevision: '1',
      inputContractId: 'showcase.stress.input',
      fields: [
        { name: 'c01', label: 'Medan 01 (wajib)', required: true, widget: 'text' },
        { name: 'c02', label: 'Medan 02', required: false, widget: 'text' },
        {
          name: 'c03',
          label: 'Medan 03 (taip "tolak" untuk mesej pengesahan panjang)',
          required: true,
          widget: 'text',
        },
        { name: 'c04', label: 'Medan 04 (perpuluhan)', required: false, widget: 'number' },
        { name: 'c05', label: 'Medan 05 (wajib)', required: true, widget: 'text' },
        { name: 'c06', label: 'Medan 06 (nombor besar)', required: false, widget: 'number' },
        { name: 'c07', label: 'Medan 07 (ayat panjang)', required: false, widget: 'json' },
        { name: 'c08', label: 'Medan 08', required: false, widget: 'text' },
        { name: 'c09', label: 'Medan 09 (boolean)', required: false, widget: 'boolean' },
        { name: 'c10', label: 'Medan 10 (biasanya kosong)', required: false, widget: 'text' },
        { name: 'c11', label: 'Medan 11', required: false, widget: 'text' },
        { name: 'c12', label: 'Medan 12 (nombor besar)', required: false, widget: 'number' },
        { name: 'c13', label: 'Medan 13 (perpuluhan)', required: false, widget: 'number' },
        { name: 'c14', label: 'Medan 14', required: false, widget: 'text' },
        { name: 'c15', label: 'Medan 15', required: false, widget: 'date' },
        { name: 'c16', label: 'Medan 16', required: false, widget: 'text' },
        { name: 'c17', label: 'Medan 17 (ayat panjang)', required: false, widget: 'json' },
        { name: 'c18', label: 'Medan 18 (nombor besar)', required: false, widget: 'number' },
        { name: 'c19', label: 'Medan 19', required: false, widget: 'text' },
        { name: 'c20', label: 'Medan 20 (boolean)', required: false, widget: 'boolean' },
        { name: 'c21', label: 'Medan 21', required: false, widget: 'text' },
        { name: 'c22', label: 'Medan 22 (perpuluhan)', required: false, widget: 'number' },
      ],
      submitActionId: 'act.stressSubmit',
    },
  ],
  actions: [
    {
      kind: 'query',
      id: 'act.queryStress',
      revision: '1',
      resourceId: 'stressRows',
      resourceRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.stressSend',
      revision: '1',
      resourceId: 'stressMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.stressSubmit',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'stress',
      inputContractId: 'showcase.stress.input',
    },
  ],
};
