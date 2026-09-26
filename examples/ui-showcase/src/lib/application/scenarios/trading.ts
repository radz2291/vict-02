import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Scenario 2 — Trading workstation (market overview, instrument detail,
 * rotation / breakout study). A UI/product stress case: dense tables,
 * decimal and negative values, long labels, many chart points, market
 * state badges. No actual trading execution is implemented.
 *
 * KNOWN NEGATIVE-CHART SEMANTIC: bar/line geometry clamps negative values
 * to zero height. The rotation study deliberately aggregates negative
 * scores so the owner can judge that behaviour — it is NOT redesigned here.
 */

const MARKET_TONES = { open: 'success', pre: 'info', closed: 'neutral', halted: 'danger' };

export const tradingScenario: Scenario = {
  routes: [
    {
      id: 'trading',
      path: '/trading',
      screenId: 's.trading',
      nav: { label: 'Trading', group: 'Trading', order: 1 },
    },
    {
      id: 'trading-rotation',
      path: '/trading/rotation',
      screenId: 's.trading-rotation',
      nav: { label: 'Rotation study', group: 'Trading', order: 2 },
    },
    { id: 'trading-xauusd', path: '/trading/instruments/xauusd', screenId: 's.trading-instrument' },
    { id: 'trading-eurusd', path: '/trading/instruments/eurusd', screenId: 's.trading-instrument' },
    { id: 'trading-btcusd', path: '/trading/instruments/btcusd', screenId: 's.trading-instrument' },
    {
      id: 'trading-instrument',
      path: '/trading/instruments/:symbol',
      screenId: 's.trading-instrument',
    },
  ],
  screens: [
    {
      id: 's.trading',
      title: 'Market Overview',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Trading' }],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.trading-intro',
            level: 2,
            content:
              'Sekiranya aplikasi dagangan dibina di atas VICT: senarai instrumen, harga dua hala, perubahan pips/peratus, volum besar dan keadaan pasaran. Tiada pelaksanaan dagangan sebenar — ini kes tekanan UI.',
          },
          {
            role: 'status',
            id: 'st.trading-market',
            value: '4 pasaran terbuka',
            tones: {
              '4 pasaran terbuka': 'success',
              'Pasaran tertutup': 'neutral',
              Penggantungan: 'danger',
            },
          },
          {
            role: 'table',
            id: 'tb.trading-instruments',
            viewId: 'v.instruments',
            searchFields: ['id', 'name'],
            pageSize: 8,
            emptyMessage: 'Tiada instrumen.',
            columns: [
              { field: 'id', label: 'Simbol', sortable: true },
              { field: 'name', label: 'Nama', sortable: true },
              { field: 'bid', label: 'Beli', sortable: true },
              { field: 'ask', label: 'Jual', sortable: true },
              { field: 'changePips', label: 'Perubahan (pips)', sortable: true },
              { field: 'changePct', label: 'Perubahan (%)', sortable: true },
              { field: 'marketState', label: 'Keadaan', sortable: true },
              { field: 'volume', label: 'Volum', sortable: true },
            ],
          },
          {
            role: 'chart',
            id: 'ch.trading-volume',
            viewId: 'v.instrumentVolume',
            kind: 'bar',
            xField: 'id',
            yField: 'volume',
            summary: 'Volum 24 jam mengikut instrumen (nilai besar)',
            title: 'Volum 24 jam',
          },
          {
            role: 'action',
            id: 'act.trading-xau-btn',
            actionId: 'act.navXAU',
            label: 'XAUUSD detail',
          },
          {
            role: 'action',
            id: 'act.trading-eur-btn',
            actionId: 'act.navEUR',
            label: 'EURUSD detail',
          },
          {
            role: 'action',
            id: 'act.trading-btc-btn',
            actionId: 'act.navBTC',
            label: 'BTCUSD detail',
          },
          {
            role: 'text',
            id: 't.trading-hint',
            content:
              'Mana-mana simbol juga boleh dibuka melalui /trading/instruments/:simbol (contoh: /trading/instruments/USDJPY).',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.trading-loading', content: 'Memuatkan pasaran…' },
        failure: {
          role: 'text',
          id: 't.trading-failure',
          content: 'Pasaran gagal dimuatkan dengan selamat.',
        },
      },
    },
    {
      id: 's.trading-instrument',
      title: 'Instrumen',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Trading', routeId: 'trading' },
        { label: 'Instrumen' },
      ],
      layout: [
        region('main', [
          { role: 'status', id: 'st.ti-state', field: 'marketState', tones: MARKET_TONES },
          {
            role: 'detail',
            id: 'dt.ti-summary',
            viewId: 'v.instrumentDetail',
            emptyMessage: 'Instrumen ini tidak wujud.',
          },
          {
            role: 'tabs',
            id: 'ts.ti-tabs',
            tabs: [
              {
                name: 'harga',
                label: 'Harga (32 sesi)',
                surfaces: [
                  {
                    role: 'chart',
                    id: 'ch.ti-line',
                    viewId: 'v.series',
                    kind: 'line',
                    xField: 'session',
                    yField: 'price',
                    summary: 'Siri harga sesi (32 titik) untuk instrumen semasa',
                    title: 'Siri harga sesi',
                  },
                  {
                    role: 'chart',
                    id: 'ch.ti-bar',
                    viewId: 'v.series',
                    kind: 'bar',
                    xField: 'session',
                    yField: 'price',
                    summary: 'Harga sesi dalam bentuk palang (32 kategori)',
                    title: 'Harga sesi (palang)',
                  },
                ],
              },
              {
                name: 'isyarat',
                label: 'Isyarat',
                surfaces: [
                  {
                    role: 'list',
                    id: 'ls.ti-signals',
                    viewId: 'v.signalsForInstrument',
                    titleField: 'pattern',
                    secondaryField: 'score',
                    emptyMessage: 'Tiada isyarat direkodkan untuk instrumen ini.',
                  },
                  {
                    role: 'status',
                    id: 'st.ti-signal-latest',
                    value: 'breakout_candidate',
                    tones: {
                      breakout_candidate: 'warning',
                      invalidated: 'danger',
                      release: 'info',
                      rotation: 'info',
                      acceptance: 'success',
                      negotiation: 'neutral',
                    },
                  },
                  {
                    role: 'drawer',
                    id: 'dr.ti-signal',
                    title: 'Butiran isyarat',
                    triggerLabel: 'Butiran isyarat…',
                    content: [
                      {
                        role: 'text',
                        id: 't.ti-signal-text',
                        content:
                          'Isyarat teragregat mengikut corak untuk instrumen ini. Corak merangkumi penerimaan (acceptance), rundingan (negotiation), pelepasan (release), putaran (rotation), calon pecahan (breakout_candidate) dan isyarat sah batal (invalidated).',
                      },
                      {
                        role: 'list',
                        id: 'ls.ti-signal-drawer',
                        viewId: 'v.signalsForInstrument',
                        titleField: 'id',
                        secondaryField: 'state',
                        emptyMessage: 'Tiada isyarat untuk instrumen ini.',
                      },
                    ],
                  },
                ],
              },
              {
                name: 'aktiviti',
                label: 'Aktiviti',
                surfaces: [
                  {
                    role: 'detail',
                    id: 'dt.ti-extra',
                    viewId: 'v.instrumentDetail',
                    fields: ['dayHigh', 'dayLow', 'spread', 'changePct', 'volume'],
                    emptyMessage: 'Tiada aktiviti tambahan.',
                  },
                ],
              },
            ],
          },
          {
            role: 'action',
            id: 'act.ti-watch-btn',
            actionId: 'act.demoSucceed',
            label: 'Jejak simbol (demo)',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.ti-loading', content: 'Memuatkan instrumen…' },
        failure: { role: 'text', id: 't.ti-failure', content: 'Instrumen gagal dengan selamat.' },
      },
    },
    {
      id: 's.trading-rotation',
      title: 'Rotation / Breakout Study',
      breadcrumbs: [
        { label: 'Home', routeId: 'home' },
        { label: 'Trading', routeId: 'trading' },
        { label: 'Rotation study' },
      ],
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.rot-intro',
            level: 2,
            content:
              'Kajian putaran dan pecahan merentasi lapan instrumen: skor teragregat per corak termasuk nilai negatif. Carta palang di bawah sengaja mendedahkan gelagat semasa bagi nilai negatif (dilukis sebagai palang sifar) — dinilai, bukan dibaiki.',
          },
          {
            role: 'table',
            id: 'tb.rot-signals',
            viewId: 'v.signals',
            queryActionId: 'act.querySignals',
            searchFields: ['id', 'instrument', 'analyst', 'pattern'],
            filterFields: ['pattern', 'state'],
            pageSize: 10,
            emptyMessage: 'Tiada isyarat sepadan.',
            columns: [
              { field: 'id', label: 'Id', sortable: true },
              { field: 'instrument', label: 'Instrumen', sortable: true },
              { field: 'pattern', label: 'Corak', sortable: true },
              { field: 'score', label: 'Skor', sortable: true },
              { field: 'confidence', label: 'Keyakinan', sortable: true },
              { field: 'rr', label: 'R:R', sortable: true },
              { field: 'state', label: 'Keadaan', sortable: true },
              { field: 'analyst', label: 'Penganalisis', sortable: true },
            ],
          },
          {
            role: 'chart',
            id: 'ch.rot-pattern',
            viewId: 'v.signalPattern',
            kind: 'bar',
            xField: 'pattern',
            yField: 'score',
            summary: 'Jumlah skor isyarat mengikut corak (nilai negatif agregat disertakan)',
            title: 'Jumlah skor mengikut corak',
          },
          {
            role: 'status',
            id: 'st.rot-invalidated',
            value: 'invalidated signals dalam senarai',
            tones: {
              'invalidated signals dalam senarai': 'danger',
              'invalidated signals dalam senarai ': 'danger',
            },
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.rot-loading', content: 'Memuatkan kajian…' },
        failure: { role: 'text', id: 't.rot-failure', content: 'Kajian gagal dengan selamat.' },
      },
    },
  ],
  views: [
    {
      viewId: 'v.instruments',
      resourceId: 'instruments',
      resourceRevision: '1',
      fields: ['id', 'name', 'bid', 'ask', 'changePips', 'changePct', 'marketState', 'volume'],
    },
    {
      viewId: 'v.instrumentVolume',
      resourceId: 'instruments',
      resourceRevision: '1',
      fields: ['id', 'volume'],
    },
    {
      viewId: 'v.instrumentDetail',
      resourceId: 'instruments',
      resourceRevision: '1',
      fields: [
        'id',
        'name',
        'bid',
        'ask',
        'dayHigh',
        'dayLow',
        'spread',
        'changePips',
        'changePct',
        'marketState',
        'volume',
      ],
    },
    {
      viewId: 'v.signals',
      resourceId: 'signals',
      resourceRevision: '1',
      fields: [
        'id',
        'instrument',
        'pattern',
        'score',
        'confidence',
        'rr',
        'state',
        'analyst',
        'session',
      ],
    },
    {
      viewId: 'v.signalPattern',
      resourceId: 'signals',
      resourceRevision: '1',
      fields: ['pattern', 'score'],
    },
    {
      viewId: 'v.signalsForInstrument',
      resourceId: 'signals',
      resourceRevision: '1',
      fields: ['id', 'pattern', 'score', 'confidence', 'state', 'instrumentId'],
    },
    {
      viewId: 'v.series',
      resourceId: 'instrumentSeries',
      resourceRevision: '1',
      fields: ['session', 'price'],
    },
  ],
  forms: [],
  actions: [
    { kind: 'navigation', id: 'act.navXAU', revision: '1', routeId: 'trading-xauusd' },
    { kind: 'navigation', id: 'act.navEUR', revision: '1', routeId: 'trading-eurusd' },
    { kind: 'navigation', id: 'act.navBTC', revision: '1', routeId: 'trading-btcusd' },
    {
      kind: 'query',
      id: 'act.querySignals',
      revision: '1',
      resourceId: 'signals',
      resourceRevision: '1',
    },
  ],
};
