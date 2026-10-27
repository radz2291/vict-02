/// <reference types="vite/client" />
import { captureRenderedElement } from '../../../../packages/ui-ai-svelte/src/capture.js';
import imageUrl from '../../../../packages/ui-media-svelte/test/fixtures/foundation-media/synthetic-image.png?url';
const frame = document.querySelector<HTMLIFrameElement>('#frame')!,
  status = document.querySelector<HTMLElement>('#result')!,
  output = document.querySelector<HTMLImageElement>('#image')!,
  download = document.querySelector<HTMLAnchorElement>('#download')!,
  metadata = document.querySelector<HTMLAnchorElement>('#metadata')!;
let state = 'nested',
  busy = false,
  initialBody = '';
const urls: string[] = [];
function nodes() {
  const doc = frame.contentDocument!,
    viewport = doc.querySelector<HTMLElement>('#viewport')!,
    content = doc.querySelector<HTMLElement>('#content')!,
    nested = doc.querySelector<HTMLElement>('#nested')!;
  return { doc, viewport, content, nested };
}
const bounds = (node: Element) => {
  const r = node.getBoundingClientRect();
  return [r.left, r.top, r.width, r.height];
};
const snapshot = () => {
  const { viewport, content } = nodes();
  return JSON.stringify([
    viewport.outerHTML,
    ...[viewport, ...content.querySelectorAll<HTMLElement>('*')].map((node) => [
      node.tagName,
      node.scrollLeft,
      node.scrollTop,
      bounds(node),
    ]),
  ]);
};
async function choose(next: string) {
  if (busy) return;
  const existing = frame.contentDocument!;
  if (!initialBody) initialBody = existing.body.innerHTML;
  else existing.body.innerHTML = initialBody;
  const { doc, viewport, content, nested } = nodes();
  state = next;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.length = 0;
  download.hidden = metadata.hidden = true;
  output.removeAttribute('src');
  doc.querySelector('#popup')?.remove();
  doc.querySelector('#outside')?.remove();
  doc.querySelector('#font-test')?.remove();
  doc.querySelector('#assets')!.replaceChildren();
  doc.body.style.transform = '';
  content.style.display = '';
  nested.style.cssText = '';
  doc.querySelector('#inner')!.removeAttribute('style');
  content.querySelector('#absolute')?.remove();
  viewport.scrollTop = next === 'nested' ? 0 : 110;
  nested.scrollTop = 95;
  if (next === 'popup') {
    const popup = doc.createElement('div');
    popup.id = 'popup';
    popup.setAttribute('role', 'dialog');
    popup.textContent = 'Owned popup — current open state';
    content.append(popup);
  }
  if (next === 'scaled') {
    doc.body.style.transform = 'scale(.9)';
  }
  if (next === 'flex-z') {
    content.style.display = 'flex';
    nested.style.position = 'static';
    nested.style.zIndex = '2';
  }
  if (next === 'axis-clip') {
    nested.style.overflowX = 'clip';
    nested.style.overflowY = 'visible';
  }
  if (next === 'direct-text') {
    nested.replaceChildren(doc.createTextNode('Direct text '.repeat(100)));
  }
  if (next === 'absolute-cb') {
    nested.style.position = 'static';
    const wrapper = doc.createElement('div');
    wrapper.id = 'absolute';
    wrapper.style.marginLeft = '24px';
    wrapper.innerHTML =
      '<span style="position:absolute;left:20px;top:30px">External containing block</span>';
    nested.append(wrapper);
  }
  if (next === 'absolute-safe') {
    const wrapper = doc.createElement('div');
    wrapper.style.cssText = 'position:relative;height:90px;margin-left:24px';
    wrapper.innerHTML =
      '<span style="position:absolute;left:20px;top:30px;background:#fdd9b0;padding:8px">Retained containing block</span>';
    content.insertBefore(wrapper, nested);
  }
  if (next === 'assets') {
    const blob = await (await fetch(imageUrl, { credentials: 'omit' })).blob();
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const first = doc.createElement('img');
    first.alt = 'Data raster';
    first.src = data;
    const second = doc.createElement('img');
    second.alt = 'Blob raster';
    const url = URL.createObjectURL(blob);
    urls.push(url);
    second.src = url;
    doc.querySelector('#assets')!.append(first, second);
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '80');
    svg.setAttribute('height', '40');
    svg.innerHTML =
      '<rect width="40" height="40" fill="#0f766e"/><circle cx="55" cy="20" r="18" fill="#eab308"/>';
    doc.querySelector('#assets')!.append(svg);
    await Promise.all([first.decode(), second.decode()]);
    viewport.scrollTop = Math.max(0, doc.querySelector<HTMLElement>('#assets')!.offsetTop - 180);
  }
  if (next === 'missing-resource') {
    const image = doc.createElement('img');
    image.alt = 'Unavailable resource';
    image.src = '/missing-test-image.png';
    doc.querySelector('#assets')!.append(image);
    await new Promise((resolve) => {
      image.onload = image.onerror = resolve;
    });
  }
  if (next === 'font') {
    const face = new FontFace('UnsupportedCaptureFont', 'url(data:font/woff2;base64,AA==)');
    doc.fonts.add(face);
    content.style.fontFamily = 'UnsupportedCaptureFont,Arial';
    try {
      await face.load();
    } catch {
      /* Deliberate failed-font refusal fixture. */
    }
  } else content.style.fontFamily = '';
  status.textContent = JSON.stringify(
    {
      state,
      outerScroll: viewport.scrollTop,
      nestedScroll: nested.scrollTop,
      root: bounds(viewport),
      source: bounds(content),
    },
    null,
    2,
  );
}
for (const name of [
  'nested',
  'outer',
  'popup',
  'assets',
  'scaled',
  'flex-z',
  'axis-clip',
  'direct-text',
  'absolute-cb',
  'absolute-safe',
  'missing-resource',
  'font',
]) {
  const button = document.createElement('button');
  button.textContent = name;
  button.onclick = () =>
    void choose(name).catch((error) => {
      status.textContent = `Fixture setup failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    });
  document.querySelector('#states')!.append(button);
}
document.querySelector<HTMLButtonElement>('#capture')!.onclick = async () => {
  if (busy) return;
  busy = true;
  download.hidden = metadata.hidden = true;
  const { doc, viewport, content, nested } = nodes();
  let changes = 0;
  const observer = new MutationObserver((records) => {
    changes += records.length;
  });
  observer.observe(doc.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  const before = snapshot(),
    started = performance.now();
  try {
    const result = await captureRenderedElement(content, viewport);
    changes += observer.takeRecords().length;
    const unchanged = before === snapshot();
    const { blob, ...geometry } = result;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    output.src = url;
    output.alt = `Actual production capture: ${state}`;
    const report = {
      state,
      ok: true,
      sourceUnchanged: unchanged,
      mutations: changes,
      bytes: blob.size,
      elapsedMs: Math.round(performance.now() - started),
      geometry,
      outerScroll: viewport.scrollTop,
      nestedScroll: nested.scrollTop,
      root: bounds(viewport),
      source: bounds(content),
      nativeComparison:
        'Requires independent native screenshot comparison; no automatic pixel verdict',
    };
    status.textContent = JSON.stringify(report, null, 2);
    download.href = url;
    const detailUrl = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    urls.push(detailUrl);
    metadata.href = detailUrl;
    download.hidden = metadata.hidden = false;
  } catch (error) {
    changes += observer.takeRecords().length;
    status.textContent = JSON.stringify(
      {
        state,
        ok: false,
        code: error instanceof Error ? error.message : 'capture-error',
        reason: (error as { captureReason?: string })?.captureReason,
        sourceUnchanged: before === snapshot(),
        mutations: changes,
      },
      null,
      2,
    );
  } finally {
    observer.disconnect();
    busy = false;
  }
};
