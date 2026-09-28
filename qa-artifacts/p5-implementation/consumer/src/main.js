/* Browser-context consumer entry (runs in the built page / happy-dom). */
/* global document, console */
// P5 packed-consumer proof — ONE implementation, TWO public entry points.
//
// This clean Svelte 5 consumer (installed from packed tarballs OUTSIDE the
// monorepo) imports the renderer through BOTH public paths:
//   DIRECT:  '@victframework/ui-svelte'        (+ styles.css)
//   COMPAT:  '@victframework/renderer-svelte'  (+ theme.css)
// and asserts they reach the SAME implementation with the SAME identity,
// that applications mount through both, and that reactive updates
// propagate without remounting.

import {
  createVictRenderer as directCreateVictRenderer,
  renderVictApplication as directRender,
  RENDERER_ID as directId,
  RENDERER_REVISION as directRevision,
  VitApp as directVitApp,
} from '@victframework/ui-svelte';
import '@victframework/ui-svelte/styles.css';
import {
  createVictRenderer as compatCreateVictRenderer,
  renderVictApplication as compatRender,
  RENDERER_ID as compatId,
  RENDERER_REVISION as compatRevision,
  VitApp as compatVitApp,
} from '@victframework/renderer-svelte';
import '@victframework/renderer-svelte/theme.css';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: ok === true, detail: String(detail).slice(0, 300) });
  console.log(`${ok === true ? 'PASS' : 'FAIL'}  ${name}${ok === true ? '' : ' — ' + detail}`);
};

// Runtime-built markers: the consumer source must NOT contain the renderer
// identity or host-marker literals, so the bundle-level single-implementation
// counts in the driver measure ONLY the implementation's copies.
const EXPECTED_ID = ['renderer', 'svelte-kit'].join('.');
const HOST_MARKER = ['vict', 'host'].join('-');
const hostIn = (root) => root.querySelector(`[data-testid="${HOST_MARKER}"]`);
const ensureTarget = (id) => {
  let el = document.getElementById(id);
  if (el === null) {
    el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
};

// ---- Renderer identity (frozen) -------------------------------------------
check(`direct: RENDERER_ID is ${EXPECTED_ID}`, directId === EXPECTED_ID, directId);
check('direct: RENDERER_REVISION is 5.0.0', directRevision === '5.0.0', directRevision);
check(
  'compat: identity constants equal the direct implementation',
  compatId === directId && compatRevision === directRevision,
  `${compatId}/${compatRevision}`,
);
check(
  'single implementation: createVictRenderer is the SAME binding',
  compatCreateVictRenderer === directCreateVictRenderer,
);
check('single implementation: VitApp is the SAME binding', compatVitApp === directVitApp);

const directRenderer = directCreateVictRenderer();
const compatRenderer = compatCreateVictRenderer();
check(
  'renderer factory: identical id/revision/roles through both paths',
  directRenderer.id === compatRenderer.id &&
    directRenderer.revision === compatRenderer.revision &&
    JSON.stringify(directRenderer.supportedSurfaceRoles) ===
      JSON.stringify(compatRenderer.supportedSurfaceRoles),
  `${directRenderer.id}/${directRenderer.revision}`,
);

// ---- A minimal (structural) Application Plan -------------------------------
function proofPlan() {
  const screen = (id, title, surfaces) => ({
    id,
    title,
    layout: [{ name: 'main', surfaces }],
    states: {},
    breadcrumbs: [],
  });
  const home = screen('s.home', 'Home', [
    { role: 'text', id: 'x.home', content: 'Proof home body' },
  ]);
  const about = screen('s.about', 'About', [
    { role: 'text', id: 'x.about', content: 'Proof about body' },
  ]);
  return {
    applicationId: 'app.proof',
    applicationRevision: '1',
    applicationVersion: '1.0.0',
    routes: [
      { route: { id: 'home', path: '/', screenId: 's.home', nav: { label: 'Home', order: 1 } }, screen: home },
      { route: { id: 'about', path: '/about', screenId: 's.about' }, screen: about },
    ],
    screens: { 's.home': home, 's.about': about },
    views: {},
    forms: {},
    actions: {},
    manifest: { theme: { tokens: [{ name: 'color.accent', value: '#7c3aed' }] } },
  };
}

const plan = proofPlan();
const registry = {
  resolve: () => ({ ok: false, code: 'UNKNOWN_COMPONENT', message: 'proof plan has no components' }),
};
const dispatch = async () => ({ ok: true, value: null });

const direct = directRender({
  plan,
  registry,
  dispatch,
  path: '/',
  target: ensureTarget('direct'),
});
const compat = compatRender({
  plan,
  registry,
  dispatch,
  path: '/',
  target: ensureTarget('compat'),
});

const directHost = hostIn(direct.output);
const compatHost = hostIn(compat.output);
check('direct: application mounts (generic host rendered)', directHost !== null);
check('compat: application mounts (generic host rendered)', compatHost !== null);
check(
  'direct + compat render IDENTICAL host markup',
  directHost !== null && directHost.innerHTML === compatHost?.innerHTML,
);
check(
  'direct + compat resolve the route surface',
  directHost?.textContent.includes('Proof home body') === true &&
    compatHost?.textContent.includes('Proof home body') === true,
);

check(
  'theme tokens applied through BOTH style entry points',
  (directHost?.getAttribute('style') ?? '').replace(/\s+/g, '').includes('--vict-color-accent:#7c3aed') &&
    (compatHost?.getAttribute('style') ?? '').replace(/\s+/g, '').includes('--vict-color-accent:#7c3aed'),
  directHost?.getAttribute('style') ?? 'missing',
);

// ---- Reactive update WITHOUT remount ---------------------------------------
directHost.__remountProbe = 'direct-tagged';
compatHost.__remountProbe = 'compat-tagged';
direct.update({ path: '/about' });
compat.update({ path: '/about' });

const directHostAfter = hostIn(direct.output);
const compatHostAfter = hostIn(compat.output);
check(
  'direct: reactive path update renders the new screen on the SAME host node',
  directHostAfter === directHost &&
    directHostAfter?.__remountProbe === 'direct-tagged' &&
    directHostAfter?.textContent.includes('Proof about body') === true,
);
check(
  'compat: reactive path update renders the new screen on the SAME host node',
  compatHostAfter === compatHost &&
    compatHostAfter?.__remountProbe === 'compat-tagged' &&
    compatHostAfter?.textContent.includes('Proof about body') === true,
);

// Idempotent unmount through both paths.
direct.unmount();
direct.unmount();
compat.unmount();
compat.unmount();
check('direct + compat: unmount is idempotent (no throw)', true);

console.log('P5_PROOF_RESULT ' + JSON.stringify({ checks }));
