import type { Scenario } from './types.js';
import { region } from './types.js';

/**
 * Showcase entry (`/`) and the Owner Review page (`/review`).
 *
 * The entry screen links every scenario through ordinary VICT navigation
 * actions; the review page is a plain VICT text screen that lists what the
 * owner should inspect. Neither scores nor judges — the owner does.
 */

const scenarioLinks = [
  { actionId: 'act.navOps', label: 'Scenario 1 — Operations / CRUD (khidmatan, BM)' },
  { actionId: 'act.navTrading', label: 'Scenario 2 — Trading workstation' },
  { actionId: 'act.navAgent', label: 'Scenario 3 — AI coding agent' },
  { actionId: 'act.navQuellight', label: 'Scenario 4 — Quellight / shared world' },
  { actionId: 'act.navWorkflow', label: 'Scenario 5 — Workflow / governance' },
  { actionId: 'act.navAnalytics', label: 'Scenario 6 — Executive analytics' },
  { actionId: 'act.navGallery', label: 'Scenario 7 — Component gallery' },
  { actionId: 'act.navStress', label: 'Scenario 8 — Stress Lab' },
] as const;

export const showcaseScenario: Scenario = {
  routes: [
    {
      id: 'home',
      path: '/',
      screenId: 's.home',
      nav: { label: 'Showcase', group: 'Showcase', order: 1 },
    },
    {
      id: 'review',
      path: '/review',
      screenId: 's.review',
      nav: { label: 'Owner Review', group: 'Showcase', order: 2 },
    },
  ],
  screens: [
    {
      id: 's.home',
      title: 'VICT UI Showcase',
      layout: [
        region('main', [
          {
            role: 'text',
            id: 't.home-intro',
            level: 2,
            content:
              'A product showroom and stress laboratory: every scenario below is a real VICT application surface authored through the normal VICT path (Application Definition → @victframework/application → @victframework/ui → @victframework/ui-svelte). Nothing on any screen is handcrafted per scenario.',
          },
          {
            role: 'status',
            id: 'st.home-ready',
            value: 'Showcase ready',
            tones: { 'Showcase ready': 'success', Draf: 'info' },
          },
          ...scenarioLinks.map((link, index) => ({
            role: 'action' as const,
            id: `act.home-link-${index + 1}`,
            actionId: link.actionId,
            label: link.label,
          })),
          {
            role: 'text',
            id: 't.home-records',
            level: 3,
            content:
              'Rekod dicapai melalui URL: /ops/tickets/OPS-1042, /trading/instruments/XAUUSD, /agent/sessions/AGT-2201, /quellight/world/QL-0047, /workflow/instances/WF-1042. Demo keadaan aplikasi: /gallery/states/stale dan /gallery/states/partial.',
          },
          {
            role: 'text',
            id: 't.home-determinism',
            content:
              'All sample data is deterministic (fixed constants and formulas; conversation timestamps are fixed offsets from 1 September 2026, +08:00). Restarting the server reproduces the same showcase.',
          },
        ]),
      ],
      states: {
        loading: { role: 'text', id: 't.home-loading', content: 'Memuatkan pameran…' },
        failure: { role: 'text', id: 't.home-failure', content: 'The showcase failed safely.' },
      },
    },
    {
      id: 's.review',
      title: 'Owner Review',
      breadcrumbs: [{ label: 'Home', routeId: 'home' }, { label: 'Owner Review' }],
      layout: [
        {
          name: 'main',
          surfaces: [
            {
              role: 'text',
              id: 't.review-purpose',
              level: 2,
              content:
                'This page lists the visual system AS IT EXISTS for the owner to inspect and judge. It scores nothing and asserts nothing; every section points at the route where the capability appears in real product contexts.',
            },
            {
              role: 'text',
              id: 't.review-shell',
              level: 3,
              content:
                'Shell — sidebar groups and links (Showcase/Operations/Trading/Agent/Quellight/Governance/Analytics/Reference), screen title, active navigation state, mobile hamburger menu. Inspect on every route; compare the single-column variant on /review (no group nav… actually every route shares the same nav).',
            },
            {
              role: 'text',
              id: 't.review-navigation',
              level: 3,
              content:
                'Navigation: group labels, link order, aria-current marking, and the 24+ entry stress group under /stress. Breadcrumbs on record screens (e.g. /ops/tickets/OPS-1042) and the deep trail at /stress/deep/l3/l4/l5.',
            },
            {
              role: 'text',
              id: 't.review-typography',
              level: 3,
              content:
                'Typography and spacing: heading levels 1–6, paragraphs and lists in the gallery Typography tab; dense BM paragraphs in the Stress Lab; hierarchy on the trading rotation study (/trading/rotation).',
            },
            {
              role: 'text',
              id: 't.review-forms',
              level: 3,
              content:
                'Forms: every widget (text, number, boolean, date, JSON textarea), required vs optional, local conversion errors, server contract validation (type an invalid state such as "x" in the ops create form), prefill behaviour (/gallery/forms/prefilled and the Edit tab of /ops/tickets/OPS-1042; zero stays 0 on /ops/tickets/OPS-1057), and the long server validation message (/stress, field c03 + the word "tolak").',
            },
            {
              role: 'text',
              id: 't.review-tables',
              level: 3,
              content:
                'Tables: client-side search/sort/filter/pagination (trading overview, analytics), server-side queries (ops tickets, rotation study, stress rows), empty tables (gallery Tables tab), 30-column tables and 110+ rows (/stress). Note that table cells are plain strings — no per-cell badges.',
            },
            {
              role: 'text',
              id: 't.review-status',
              level: 3,
              content:
                'Status language: the five tones (neutral, info, success, warning, danger) across the gallery Status tab and every scenario (ticket state, market state, agent status, world entry status, workflow stage). Judge whether the vocabulary reads clearly in both English and Bahasa Malaysia.',
            },
            {
              role: 'text',
              id: 't.review-overlays',
              level: 3,
              content:
                'Overlays: dialogs (ops delete, agent approval, workflow approval, Quellight decisions) and drawers (signal details, provenance, task details), including a nested dialog inside a drawer (gallery Overlays tab and the Stress Lab). Escape/overlay-click closing and focus restoration are native dialog behavior.',
            },
            {
              role: 'text',
              id: 't.review-charts',
              level: 3,
              content:
                'Charts: bar and line charts with zero datasets, a single point, 24–32 point series, long category labels, large values, zeros, and negative values (gallery Charts tab; /trading/rotation aggregates negative scores — negatives currently clamp to a zero-height bar; the owner decides whether that is acceptable).',
            },
            {
              role: 'text',
              id: 't.review-conversation',
              level: 3,
              content:
                'Conversation: real sends through a VICT capability run (agent, Quellight, gallery), 55-message stress feed (/stress), long-message wrapping (gallery Conversation tab), sending state, and failure retention (submit while a demo failure action has armed the failure state).',
            },
            {
              role: 'text',
              id: 't.review-mobile',
              level: 3,
              content:
                'Mobile and viewport range: resize across 1440/1024/768/430/380/320. The stress table and the 12-tab stress surface are intentionally uncomfortable at narrow widths — judge the truth of the layout, not a polished mobile variant.',
            },
            {
              role: 'text',
              id: 't.review-density',
              level: 3,
              content:
                'Data-dense usage: rotation study (48 signals), stress rows (110 rows × 30 columns), KPI grids (/analytics), and agent token/file counts. Judge hierarchy, whitespace, density, and readability against the same screens.',
            },
          ],
        },
      ],
      states: {
        failure: {
          role: 'text',
          id: 't.review-failure',
          content: 'The review page failed safely.',
        },
      },
    },
  ],
  views: [],
  forms: [],
  actions: [
    { kind: 'navigation', id: 'act.navOps', revision: '1', routeId: 'ops' },
    { kind: 'navigation', id: 'act.navTrading', revision: '1', routeId: 'trading' },
    { kind: 'navigation', id: 'act.navAgent', revision: '1', routeId: 'agent' },
    { kind: 'navigation', id: 'act.navQuellight', revision: '1', routeId: 'quellight' },
    { kind: 'navigation', id: 'act.navWorkflow', revision: '1', routeId: 'workflow' },
    { kind: 'navigation', id: 'act.navAnalytics', revision: '1', routeId: 'analytics' },
    { kind: 'navigation', id: 'act.navGallery', revision: '1', routeId: 'gallery' },
    { kind: 'navigation', id: 'act.navStress', revision: '1', routeId: 'stress' },
  ] as never,
};
