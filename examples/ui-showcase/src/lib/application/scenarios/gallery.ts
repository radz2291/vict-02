import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Scenario 7 — Component gallery (+ application-state demo routes and the
 * prefilled edit demo). One route that deliberately showcases every
 * currently available VICT UI presentation capability. Nothing here invents
 * unsupported semantics: unsupported presentation (e.g. a per-button
 * loading state, per-cell badges, secondary action variants) is noted in
 * text instead of being faked.
 */

export const galleryScenario: Scenario = {
  routes: [
    {
      id: 'gallery',
      path: '/gallery',
      screenId: 's.gallery',
      nav: { label: 'Gallery', group: 'Reference', order: 1 },
    },
    { id: 'gallery-stale', path: '/gallery/states/stale', screenId: 's.gallery-stale' },
    { id: 'gallery-partial', path: '/gallery/states/partial', screenId: 's.gallery-partial' },
    { id: 'gallery-prefill', path: '/gallery/forms/prefilled', screenId: 's.gallery-prefill' },
  ],
  screens: [
    {
      id: 's.gallery',
      title: 'Component Gallery',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Gallery' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.gal-intro',
            level: 2,
            content:
              'Setiap tab mempamerkan keupayaan pembentangan VICT yang wujud PADA HARI INI. Semua yang dipaparkan datang daripada penerima Svelte kekal; keupayaan yang tiada dinyatakan dalam teks, bukan direka-reka.',
          },
          {
            role: 'tabs',
            id: 'ts.gallery',
            tabs: [
              {
                name: 'typography',
                label: 'Typography',
                surfaces: [
                  { role: 'text', id: 't.gal-h1', level: 1, content: 'Aras satu — h1' },
                  { role: 'text', id: 't.gal-h2', level: 2, content: 'Aras dua — h2' },
                  { role: 'text', id: 't.gal-h3', level: 3, content: 'Aras tiga — h3' },
                  { role: 'text', id: 't.gal-h4', level: 4, content: 'Aras empat — h4' },
                  { role: 'text', id: 't.gal-h5', level: 5, content: 'Aras lima — h5' },
                  { role: 'text', id: 't.gal-h6', level: 6, content: 'Aras enam — h6' },
                  {
                    role: 'text',
                    id: 't.gal-para',
                    content:
                      'Perenggan biasa: lajur penunjuk, jarak dan hierarki dinilai daripada kandungan sebenar — contohnya 18_442_310 ringgit hasil kutipan dan 72.4 mata indeks keyakinan dalam sukuarten semasa.',
                  },
                  {
                    role: 'list',
                    id: 'ls.gal-typo',
                    viewId: 'v.kpi',
                    titleField: 'label',
                    secondaryField: 'unit',
                    emptyMessage: 'Tiada senarai.',
                  },
                  { role: 'view', id: 'dv.gal-typo', viewId: 'v.kpi' },
                ],
              },
              {
                name: 'tables',
                label: 'Tables',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-tables-note',
                    level: 3,
                    content:
                      'Tiga jadual: jadual biasa (isihan/carian/pagination sisi pelanggan), jadual lajur banyak, dan jadual kosong. Nilai sel adalah rentetan semata-mata — tiada lencana per sel.',
                  },
                  {
                    role: 'table',
                    id: 'tb.gal-normal',
                    viewId: 'v.deals',
                    searchFields: ['account', 'region'],
                    pageSize: 5,
                    emptyMessage: 'Tiada urusan.',
                    columns: [
                      { field: 'id', label: 'Id', sortable: true },
                      { field: 'account', label: 'Akaun', sortable: true },
                      { field: 'region', label: 'Wilayah', sortable: true },
                      { field: 'value', label: 'Nilai (RM)', sortable: true },
                    ],
                  },
                  {
                    role: 'table',
                    id: 'tb.gal-many',
                    viewId: 'v.signals',
                    searchFields: ['id', 'instrument'],
                    pageSize: 5,
                    emptyMessage: 'Tiada isyarat.',
                    columns: [
                      { field: 'id', label: 'Id', sortable: true },
                      { field: 'instrument', label: 'Instrumen', sortable: true },
                      { field: 'pattern', label: 'Corak', sortable: true },
                      { field: 'score', label: 'Skor', sortable: true },
                      { field: 'confidence', label: 'Keyakinan', sortable: true },
                      { field: 'rr', label: 'R:R', sortable: true },
                      { field: 'state', label: 'Keadaan', sortable: false },
                      { field: 'session', label: 'Sesi', sortable: false },
                    ],
                  },
                  {
                    role: 'table',
                    id: 'tb.gal-empty',
                    viewId: 'v.emptyInbox',
                    pageSize: 5,
                    emptyMessage:
                      'Jadual kosong: peti masuk belum mempunyai rekod (hantar mesej di tab Perbualan untuk menukarnya).',
                    columns: [
                      { field: 'id', label: 'Id', sortable: false },
                      { field: 'text', label: 'Teks', sortable: false },
                      { field: 'author', label: 'Pengarang', sortable: false },
                    ],
                  },
                ],
              },
              {
                name: 'forms',
                label: 'Forms',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-forms-note',
                    level: 3,
                    content:
                      'Setiap widget tersokong: teks, nombor, boolean, tarikh dan JSON (textarea). Hantar borang kosong untuk ralat medan setempat; taip rank di luar 0–100 untuk penolakan kontrak pelayan; nombor pilihan dibiarkan kosong dihilangkan (tiada 0 palsu).',
                  },
                  { role: 'form', id: 'fm.gal-create', formId: 'f.gallery-create' },
                  {
                    role: 'action',
                    id: 'act.gal-reset-btn',
                    actionId: 'act.resetForm',
                    label: 'Set semula (setempat)',
                  },
                  {
                    role: 'text',
                    id: 't.gal-forms-prefill',
                    content:
                      'Prefill/edit: /gallery/forms/prefilled (borang kemaskini tiket dengan nilai sedia ada) dan tab Kemaskini di /ops/tickets/OPS-1042. Nilai sifar kekal 0: /ops/tickets/OPS-1057.',
                  },
                ],
              },
              {
                name: 'actions',
                label: 'Actions',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-actions-note',
                    level: 3,
                    content:
                      'Varian butang: utama (default), bahaya (id tindakan mengandungi "delete"), dilumpuhkan (disabledWhen.paramMissing). Varian kedua hanya wujud pada butang tutang/overlay dalaman; keadaan loading hanya wujud pada hantaran perbualan ("Sending…") — kedua-duanya dinyatakan, bukan direka-reka.',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-success-btn',
                    actionId: 'act.demoSucceed',
                    label: 'Tindakan utama (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-danger-btn',
                    actionId: 'act.demoDelete',
                    label: 'Padam demo (bahaya)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-disabled-btn',
                    actionId: 'act.demoSucceed',
                    label: 'Butang dilumpuhkan (tiada :id)',
                    disabledWhen: { paramMissing: 'id' },
                  },
                  {
                    role: 'text',
                    id: 't.gal-actions-kind',
                    content:
                      'Jenis tindakan tersokong: local (transisi setempat), navigation (pautan dalam aplikasi), query (jadual), mutation (borang/perbualan), capability (merentasi runtime). Butang di atas ialah mutation demo.',
                  },
                ],
              },
              {
                name: 'status',
                label: 'Status',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-status-note',
                    level: 3,
                    content:
                      'Lima nada lencana yang tersokong; nilai daripada nilai statik atau medan rekod.',
                  },
                  {
                    role: 'status',
                    id: 'st.gal-success',
                    value: 'Berjaya',
                    tones: { Berjaya: 'success' },
                  },
                  {
                    role: 'status',
                    id: 'st.gal-warning',
                    value: 'Menunggu',
                    tones: { Menunggu: 'warning' },
                  },
                  {
                    role: 'status',
                    id: 'st.gal-danger',
                    value: 'Gagal',
                    tones: { Gagal: 'danger' },
                  },
                  {
                    role: 'status',
                    id: 'st.gal-info',
                    value: 'Maklumat',
                    tones: { Maklumat: 'info' },
                  },
                  {
                    role: 'status',
                    id: 'st.gal-neutral',
                    value: 'Neutral',
                    tones: { Neutral: 'neutral' },
                  },
                  {
                    role: 'text',
                    id: 't.gal-status-table-note',
                    content:
                      'Status dalam sel jadual dipaparkan sebagai teks biasa (lihat keadaan tiket atau status ejen). Lencana berasingan hanya tersedia sebagai permukaan status — jurang yang direkodkan untuk penilaian.',
                  },
                ],
              },
              {
                name: 'feedback',
                label: 'Feedback',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-feedback-note',
                    level: 3,
                    content:
                      'Setiap tindakan demo menghasilkan satu keadaan maklum balas sebenar di bawah skrin (keputusan tindakan terkini).',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-fb-validation',
                    actionId: 'act.demoValidation',
                    label: 'Kegagalan pengesahan (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-fb-denied',
                    actionId: 'act.demoDenied',
                    label: 'Akses ditolak (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-fb-failure',
                    actionId: 'act.demoFailure',
                    label: 'Kegagalan umum (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-fb-success',
                    actionId: 'act.demoSucceed',
                    label: 'Kejayaan (demo)',
                  },
                  {
                    role: 'list',
                    id: 'ls.gal-feedback-empty',
                    viewId: 'v.emptyInbox',
                    titleField: 'text',
                    secondaryField: 'author',
                    emptyMessage: 'Keadaan kosong: tiada apa-apa dalam peti masuk.',
                  },
                  {
                    role: 'status',
                    id: 'st.gal-inbox-active',
                    value: 'Peti masuk aktif',
                    tones: { 'Peti masuk aktif': 'info' },
                    visibleWhen: { viewNonEmpty: 'v.emptyInbox' },
                  },
                  {
                    role: 'text',
                    id: 't.gal-inbox-hint',
                    content:
                      'Peti masuk masih kosong — hantar mesej pada tab Perbualan dan badge bersyarat di atas akan muncul.',
                    visibleWhen: { viewEmpty: 'v.emptyInbox' },
                  },
                  {
                    role: 'text',
                    id: 't.gal-states-links',
                    content:
                      'Keadaan stale/partial pada skrin berdedikasi: /gallery/states/stale dan /gallery/states/partial.',
                  },
                ],
              },
              {
                name: 'overlays',
                label: 'Overlays',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-overlays-note',
                    level: 3,
                    content:
                      'Dialog dan drawer menggunakan elemen dialog asli (fokus, Escape, klik di luar). Drawer bersarang membuktikan dialog dalam drawer.',
                  },
                  {
                    role: 'dialog',
                    id: 'dlg.gal-basic',
                    title: 'Dialog asas',
                    triggerLabel: 'Buka dialog…',
                    content: [
                      {
                        role: 'text',
                        id: 't.gal-dialog-body',
                        content:
                          'Kandungan dialog: teks dan tindakan. Dialog asas menyokong tindakan penuh di dalamnya.',
                      },
                      {
                        role: 'action',
                        id: 'act.gal-dialog-btn',
                        actionId: 'act.demoSucceed',
                        label: 'Tindakan dalam dialog (demo)',
                      },
                    ],
                  },
                  {
                    role: 'drawer',
                    id: 'dr.gal-basic',
                    title: 'Drawer asas',
                    triggerLabel: 'Buka drawer…',
                    content: [
                      {
                        role: 'text',
                        id: 't.gal-drawer-body',
                        content:
                          'Kandungan drawer: senarai penunjuk di bawah datang daripada pandangan sebenar.',
                      },
                      {
                        role: 'list',
                        id: 'ls.gal-drawer',
                        viewId: 'v.kpi',
                        titleField: 'label',
                        secondaryField: 'quarter',
                        emptyMessage: 'Tiada penunjuk.',
                      },
                    ],
                  },
                  {
                    role: 'drawer',
                    id: 'dr.gal-nested',
                    title: 'Drawer bersarang',
                    triggerLabel: 'Drawer dengan dialog bersarang…',
                    content: [
                      {
                        role: 'text',
                        id: 't.gal-nested-text',
                        content:
                          'Drawer ini mengandungi dialog bersarang — lapisan atas asli menyokong penumpukan.',
                      },
                      {
                        role: 'dialog',
                        id: 'dlg.gal-nested',
                        title: 'Dialog dalam drawer',
                        triggerLabel: 'Buka dialog dalam drawer…',
                        content: [
                          {
                            role: 'text',
                            id: 't.gal-nested-dialog',
                            content:
                              'Dialog ini dibuka di atas drawer — penumpukan lapisan atas asli.',
                          },
                          {
                            role: 'action',
                            id: 'act.gal-nested-btn',
                            actionId: 'act.demoSucceed',
                            label: 'Tindakan dalam dialog bersarang (demo)',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                name: 'charts',
                label: 'Charts',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-charts-note',
                    level: 3,
                    content:
                      'Enam carta: dataset kosong, satu titik, 24 titik, label panjang, nilai besar/sifar/negatif tercampur, dan jenis palang berbanding garis pada data yang sama. Nilai negatif dilukis sebagai palang sifar (gelagat semasa, tidak diubah).',
                  },
                  {
                    role: 'chart',
                    id: 'ch.gal-zero',
                    viewId: 'v.gchartZero',
                    kind: 'bar',
                    xField: 'label',
                    yField: 'value',
                    summary: 'Dataset kosong',
                    title: 'Dataset kosong',
                  },
                  {
                    role: 'chart',
                    id: 'ch.gal-one',
                    viewId: 'v.gchartOne',
                    kind: 'line',
                    xField: 'label',
                    yField: 'value',
                    summary: 'Satu titik data',
                    title: 'Satu titik',
                  },
                  {
                    role: 'chart',
                    id: 'ch.gal-wide',
                    viewId: 'v.gchartWide',
                    kind: 'line',
                    xField: 'label',
                    yField: 'value',
                    summary: 'Siri 24 titik dengan label hari',
                    title: '24 titik',
                  },
                  {
                    role: 'chart',
                    id: 'ch.gal-mixed-bar',
                    viewId: 'v.gchartMixed',
                    kind: 'bar',
                    xField: 'label',
                    yField: 'value',
                    summary: 'Nilai besar, sifar, negatif dan label panjang',
                    title: 'Nilai bercampur (palang)',
                  },
                  {
                    role: 'chart',
                    id: 'ch.gal-mixed-line',
                    viewId: 'v.gchartMixed',
                    kind: 'line',
                    xField: 'label',
                    yField: 'value',
                    summary: 'Nilai besar, sifar, negatif dan label panjang',
                    title: 'Nilai bercampur (garis)',
                  },
                ],
              },
              {
                name: 'conversation',
                label: 'Conversation',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-conversation-note',
                    level: 3,
                    content:
                      'Dua perbualan: satu berisi (termasuk mesej panjang), satu kosong. Penghantaran sebenar melalui tindakan mutasi VICT; jawapan dibina oleh pelaksanaan keupayaan VICT yang sebenar.',
                  },
                  {
                    role: 'conversation',
                    id: 'cv.gal-chat',
                    viewId: 'v.galleryMessages',
                    messageField: 'text',
                    authorField: 'author',
                    participantField: 'participant',
                    sendActionId: 'act.gallerySend',
                    inputLabel: 'Mesej galeri',
                    inputPlaceholder: 'Taip mesej (BM atau BI)…',
                    emptyMessage: 'Tiada mesej lagi.',
                  },
                  {
                    role: 'conversation',
                    id: 'cv.gal-empty',
                    viewId: 'v.emptyInbox',
                    messageField: 'text',
                    authorField: 'author',
                    participantField: 'participant',
                    sendActionId: 'act.emptySend',
                    inputLabel: 'Peti masuk kosong',
                    inputPlaceholder: 'Hantar mesej pertama…',
                    emptyMessage: 'Keadaan kosong perbualan: tiada mesej lagi.',
                  },
                ],
              },
              {
                name: 'custom',
                label: 'Custom slot',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-custom-note',
                    level: 3,
                    content:
                      'Slot komponen tersuai: satu komponen pulau kod kecil (cmp.island@1) didaftarkan di luar manifes dengan semakan id/semakan semula. Ia hanya menerima prop primitif yang diisytiharkan dan sengaja tidak menggantikan atau menguatkan apa-apa daripada VICT.',
                  },
                  {
                    role: 'component',
                    id: 'cm.gal-island',
                    componentId: 'cmp.island',
                    revision: '1',
                    props: { label: 'Slot komponen tersuai' },
                  },
                  {
                    role: 'drawer',
                    id: 'dr.gal-island',
                    title: 'Komponen dalam drawer',
                    triggerLabel: 'Komponen dalam drawer…',
                    content: [
                      {
                        role: 'text',
                        id: 't.gal-island-drawer',
                        content:
                          'Komponen tersuai yang sama di dalam drawer: pengendalian lapisan asli kekal di tangan VICT.',
                      },
                      {
                        role: 'component',
                        id: 'cm.gal-island-drawer',
                        componentId: 'cmp.island',
                        revision: '1',
                        props: { label: 'Pulau kod dalam drawer' },
                      },
                    ],
                  },
                ],
              },
              {
                name: 'states',
                label: 'App states',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-states-note',
                    level: 3,
                    content:
                      'Keadaan aplikasi: stale dan partial pada skrin berdedikasi (/gallery/states/stale, /gallery/states/partial); kegagalan pengesahan, kebenaran, kegagalan umum dan kejayaan melalui tindakan demo (lihat tab Feedback).',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-states-success',
                    actionId: 'act.demoSucceed',
                    label: 'Kejayaan (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-states-validation',
                    actionId: 'act.demoValidation',
                    label: 'Pengesahan (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-states-denied',
                    actionId: 'act.demoDenied',
                    label: 'Ditolak (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-states-failure',
                    actionId: 'act.demoFailure',
                    label: 'Kegagalan (demo)',
                  },
                  {
                    role: 'action',
                    id: 'act.gal-states-local',
                    actionId: 'act.demoLocal',
                    label: 'Tindakan setempat (demo)',
                  },
                ],
              },
              {
                name: 'shell',
                label: 'Shell',
                surfaces: [
                  {
                    role: 'text',
                    id: 't.gal-shell-note',
                    level: 3,
                    content:
                      'Petala: tajuk skrin, kumpulan navigasi daripada laluan (Showcase, Operations, Trading, Agent, Quellight, Governance, Analytics, Reference, Stress nav), aria-current pada pautan aktif, breadcrumbs pada skrin rekod, dan menu hamburger mudah alih. Kumpulan tekanan navigasi berada di bawah /stress.',
                  },
                  {
                    role: 'text',
                    id: 't.gal-shell-route',
                    content:
                      'Laluan semasa: /gallery — paparan ini dirender oleh VitApp daripada pelan yang disusun; tiada laluan SvelteKit khusus bagi mana-mana skrin.',
                  },
                ],
              },
            ],
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.gal-loading', content: 'Memuatkan galeri…' },
        validation: {
          role: 'text',
          id: 't.gal-validation',
          content: 'Pengesahan gagal; semak medan yang ditanda.',
        },
        denied: {
          role: 'text',
          id: 't.gal-denied',
          content: 'Tindakan demo ditolak oleh sempadan kebenaran.',
        },
        failure: { role: 'text', id: 't.gal-failure', content: 'Galeri gagal dengan selamat.' },
        stale: {
          role: 'text',
          id: 't.gal-stale',
          content: 'Menunjukkan data tersimpan yang mungkin lapuk.',
        },
        partial: {
          role: 'text',
          id: 't.gal-partial',
          content: 'Sebahagian data tidak tersedia buat masa ini.',
        },
      },
    },
    {
      id: 's.gallery-stale',
      title: 'Keadaan aplikasi — stale',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Gallery', routeId: 'gallery' },
        { label: 'Stale' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.gal-stale-intro',
            level: 2,
            content:
              'Pelayan menandakan data paparan sebagai stale untuk laluan ini (sama seperti ?demo=stale pada mana-mana laluan). Banner stale dipaparkan oleh penerima di atas kandungan.',
          },
          {
            role: 'table',
            id: 'tb.gal-stale',
            viewId: 'v.deals',
            pageSize: 5,
            emptyMessage: 'Tiada urusan.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'account', label: 'Akaun', sortable: true },
              { field: 'value', label: 'Nilai (RM)', sortable: true },
              { field: 'stage', label: 'Peringkat', sortable: true },
            ],
          },
          {
            role: 'text',
            id: 't.gal-stale-note',
            content:
              'Keadaan stale diisyaratkan oleh datum paparan (stale: true) — bukan oleh kandungan tangan.',
          },
        ]),
      ],
      states: {
        stale: {
          role: 'text',
          id: 't.gal-stale-state',
          content: 'Menunjukkan data tersimpan yang mungkin lapuk (laluan demo stale).',
        },
        failure: {
          role: 'text',
          id: 't.gal-stale-failure',
          content: 'Paparan stale gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.gallery-partial',
      title: 'Keadaan aplikasi — partial',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Gallery', routeId: 'gallery' },
        { label: 'Partial' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.gal-partial-intro',
            level: 2,
            content:
              'Pelayan menandakan data paparan sebagai partial untuk laluan ini (sama seperti ?demo=partial).',
          },
          {
            role: 'table',
            id: 'tb.gal-partial',
            viewId: 'v.deals',
            pageSize: 5,
            emptyMessage: 'Tiada urusan.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'account', label: 'Akaun', sortable: true },
              { field: 'value', label: 'Nilai (RM)', sortable: true },
              { field: 'region', label: 'Wilayah', sortable: true },
            ],
          },
        ]),
      ],
      states: {
        partial: {
          role: 'text',
          id: 't.gal-partial-state',
          content: 'Sebahagian data tidak tersedia buat masa ini (laluan demo partial).',
        },
        failure: {
          role: 'text',
          id: 't.gal-partial-failure',
          content: 'Paparan partial gagal dengan selamat.',
        },
      },
    },
    {
      id: 's.gallery-prefill',
      title: 'Borang praisi (kemaskini)',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Gallery', routeId: 'gallery' },
        { label: 'Prefilled' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.gp-intro',
            level: 2,
            content:
              'Borang kemaskini dengan nilai sedia ada daripada rekod tiket OPS-1042: medan berjenis diisi semula melalui polis nilai borang kanonik. Untuk contoh kos sifar (0 kekal 0): /ops/tickets/OPS-1057.',
          },
          {
            role: 'status',
            id: 'st.gp-state',
            field: 'state',
            tones: { baru: 'info', dalam_proses: 'info', selesai: 'success', batal: 'neutral' },
          },
          {
            role: 'detail',
            id: 'dt.gp-detail',
            viewId: 'v.ticketDetail',
            emptyMessage: 'Rekod demo tidak wujud.',
          },
          { role: 'form', id: 'fm.gp-edit', formId: 'f.ticket-edit' },
        ]),
      ],
      states: {
        validation: {
          role: 'text',
          id: 't.gp-validation',
          content: 'Pengesahan gagal; semak medan yang ditanda.',
        },
        failure: {
          role: 'text',
          id: 't.gp-failure',
          content: 'Borang praisi gagal dengan selamat.',
        },
      },
    },
  ],
  views: [
    {
      viewId: 'v.galleryMessages',
      resourceId: 'galleryMessages',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
    {
      viewId: 'v.emptyInbox',
      resourceId: 'emptyInbox',
      resourceRevision: '1',
      fields: ['id', 'text', 'author', 'participant', 'createdAt'],
    },
    {
      viewId: 'v.gchartZero',
      resourceId: 'galleryChartZero',
      resourceRevision: '1',
      fields: ['label', 'value'],
    },
    {
      viewId: 'v.gchartOne',
      resourceId: 'galleryChartOne',
      resourceRevision: '1',
      fields: ['label', 'value'],
    },
    {
      viewId: 'v.gchartWide',
      resourceId: 'galleryChartWide',
      resourceRevision: '1',
      fields: ['label', 'value'],
    },
    {
      viewId: 'v.gchartMixed',
      resourceId: 'galleryChartMixed',
      resourceRevision: '1',
      fields: ['label', 'value'],
    },
  ],
  forms: [
    {
      formId: 'f.gallery-create',
      resourceId: 'gallerySubmissions',
      resourceRevision: '1',
      inputContractId: 'showcase.gallery.input',
      fields: [
        { name: 'name', label: 'Nama', required: true, widget: 'text' },
        {
          name: 'rank',
          label: 'Kedudukan (0–100, sahkan nilai 999 untuk penolakan pelayan)',
          required: true,
          widget: 'number',
        },
        { name: 'zeroCheck', label: 'Semakan sifar', required: true, widget: 'boolean' },
        { name: 'startDate', label: 'Tarikh mula (pilihan)', required: false, widget: 'date' },
        { name: 'payload', label: 'Muatan JSON (pilihan)', required: false, widget: 'json' },
        { name: 'comment', label: 'Komen (pilihan)', required: false, widget: 'text' },
      ],
      submitActionId: 'act.galleryCreate',
    },
  ],
  actions: [
    {
      kind: 'mutation',
      id: 'act.galleryCreate',
      revision: '1',
      resourceId: 'gallerySubmissions',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.gallery.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.gallerySend',
      revision: '1',
      resourceId: 'galleryMessages',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.emptySend',
      revision: '1',
      resourceId: 'emptyInbox',
      resourceRevision: '1',
      op: 'create',
      inputContractId: 'showcase.message.input',
      inputContractRevision: '1',
    },
    {
      kind: 'mutation',
      id: 'act.demoSucceed',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'succeed',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.demoValidation',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'validate',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.demoDenied',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'deny',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.demoFailure',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'showcase.demo.input',
    },
    {
      kind: 'mutation',
      id: 'act.demoDelete',
      revision: '1',
      resourceId: 'demo',
      resourceRevision: '1',
      op: 'fail',
      inputContractId: 'showcase.demo.input',
    },
    { kind: 'local', id: 'act.demoLocal', revision: '1' },
    { kind: 'local', id: 'act.resetForm', revision: '1' },
  ],
};
