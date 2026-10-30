/** Clone-only scroll composition. This path never scrolls or restyles the source.
 * The ordinary capture path is retained for states that do not need projection. */
import { approvedCaptureBlobUrl, isStaticCaptureRaster } from './capture-resource.js';
type Box = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'>;
export interface PositionedProjection {
  left: number;
  top: number;
  width: number;
  height: number;
  visible: boolean;
  inset: readonly number[];
}
export function projectPositionedRect(
  rect: Box,
  root: Box,
  clips: readonly Box[] = [],
): PositionedProjection {
  let left = Math.max(root.left, rect.left),
    right = Math.min(root.right, rect.right),
    top = Math.max(root.top, rect.top),
    bottom = Math.min(root.bottom, rect.bottom);
  for (const clip of clips) {
    left = Math.max(left, clip.left);
    right = Math.min(right, clip.right);
    top = Math.max(top, clip.top);
    bottom = Math.min(bottom, clip.bottom);
  }
  return {
    left: rect.left - root.left,
    top: rect.top - root.top,
    width: rect.width,
    height: rect.height,
    visible: right > left && bottom > top,
    inset: [
      Math.max(0, top - rect.top),
      Math.max(0, rect.right - right),
      Math.max(0, rect.bottom - bottom),
      Math.max(0, left - rect.left),
    ],
  };
}
function fail(reason: string): never {
  throw Object.assign(new Error('STUDIO_CAPTURE_SCROLL_UNSUPPORTED'), { captureReason: reason });
}
const none = (value: string) => !value || value === 'none';
const transformed = (style: CSSStyleDeclaration) =>
  !none(style.transform) ||
  !none(style.translate) ||
  !none(style.rotate) ||
  !none(style.scale) ||
  !none(style.perspective) ||
  (!!style.zoom && !['normal', '1', '100%'].includes(style.zoom));
const box = (node: Element): Box => node.getBoundingClientRect();
const rasterData = /^data:image\/(?:png|jpeg);base64,/i;
/** Split only unquoted commas. Escaped identifiers require CSS token decoding
 * that this conservative path does not attempt; refuse instead of missing a font. */
function fontFamilies(value: string): string[] {
  const families: string[] = [];
  let quote = '', current = '';
  for (const char of value) {
    if (char === '\\') fail('scroll-font-family-unverified');
    if (char === '"' || char === "'") {
      if (!quote) quote = char;
      else if (quote === char) quote = '';
      else current += char;
    } else if (char === ',' && !quote) {
      families.push(current.trim().toLowerCase());
      current = '';
    } else current += char;
  }
  if (quote) fail('scroll-font-family-unverified');
  families.push(current.trim().toLowerCase());
  return families;
}
const visible = (node: Element, view: Window) => {
  const s = view.getComputedStyle(node);
  return (
    s.display !== 'none' &&
    s.visibility !== 'hidden' &&
    node.getBoundingClientRect().width > 0 &&
    node.getBoundingClientRect().height > 0
  );
};
function isStackingAncestor(style: CSSStyleDeclaration): boolean {
  return (
    !none(style.transform) ||
    !none(style.filter) ||
    !none(style.perspective) ||
    (style.opacity !== '' && style.opacity !== '1') ||
    style.isolation === 'isolate' ||
    (style.mixBlendMode !== '' && style.mixBlendMode !== 'normal') ||
    (style.position !== 'static' && style.zIndex !== '' && style.zIndex !== 'auto') ||
    /paint|layout|strict|content/.test(style.contain) ||
    /transform|opacity|filter/.test(style.willChange)
  );
}
function localResource(value: string): boolean {
  if (!value || value.startsWith('blob:')) return true;
  if (!rasterData.test(value) || value.length > 6 * 1024 * 1024) return false;
  try {
    const binary = atob(value.slice(value.indexOf(',') + 1));
    return isStaticCaptureRaster(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
      value.slice(5, value.indexOf(';')).toLowerCase(),
    );
  } catch {
    return false;
  }
}
/** Only a proven subset is admitted. A refusal is not a fabricated top-of-content image. */
export function prepareScrollCapture(element: HTMLElement, viewport: HTMLElement = element) {
  const doc = element.ownerDocument,
    view = doc.defaultView;
  if (!view || viewport.ownerDocument !== doc || !viewport.contains(element)) fail('scroll-scope');
  for (let ancestor = viewport.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = view.getComputedStyle(ancestor);
    if (
      transformed(style) ||
      !none(style.filter) ||
      !none(style.backdropFilter) ||
      !none(style.clipPath) ||
      !none(style.maskImage) ||
      (style.opacity !== '' && style.opacity !== '1')
    )
      fail('scroll-outside-ancestor-paint');
  }
  const rootBox = box(viewport),
    targetBox = box(element);
  const rootStyle = view.getComputedStyle(viewport);
  if (
    ['border-left-width', 'border-right-width', 'border-top-width', 'border-bottom-width'].some(
      (key) => parseFloat(rootStyle.getPropertyValue(key)) > 0,
    )
  )
    fail('scroll-viewport-border');
  if (
    rootBox.width < 1 ||
    rootBox.height < 1 ||
    Math.min(rootBox.right, targetBox.right) <= Math.max(rootBox.left, targetBox.left) ||
    Math.min(rootBox.bottom, targetBox.bottom) <= Math.max(rootBox.top, targetBox.top)
  )
    fail('scroll-target-outside-viewport');
  // Capture no unrelated sibling/Studio content just because the viewport is larger.
  for (let current: Element = element; current !== viewport;) {
    const parent = current.parentElement;
    if (!parent) fail('scroll-scope');
    for (const sibling of Array.from(parent.children))
      if (
        sibling !== current &&
        !['STYLE', 'SCRIPT'].includes(sibling.tagName) &&
        visible(sibling, view)
      )
        fail('unrelated-viewport-content');
    current = parent;
  }
  const nodes = [viewport, ...viewport.querySelectorAll<HTMLElement>('*')];
  if (nodes.length > 2000) fail('scroll-node-limit');
  const positioned: { node: HTMLElement; projection: PositionedProjection }[] = [];
  const fonts = new Set<string>();
  let faces: FontFace[];
  try {
    faces = Array.from(doc.fonts);
  } catch {
    fail('scroll-font-inventory-unavailable');
  }
  for (const face of faces)
    for (const family of fontFamilies(face.family)) fonts.add(family);
  for (const node of nodes) {
    const style = view.getComputedStyle(node);
    if (
      (!rootStyle.position || rootStyle.position === 'static') &&
      style.position === 'absolute' &&
      (!node.offsetParent || !viewport.contains(node.offsetParent))
    )
      fail('scroll-root-containing-block');
    if (
      transformed(style) ||
      !none(style.filter) ||
      !none(style.backdropFilter) ||
      !none(style.clipPath) ||
      !none(style.maskImage) ||
      (style.mixBlendMode && style.mixBlendMode !== 'normal')
    )
      fail('scroll-complex-paint');
    if (style.animationName && style.animationName !== 'none') fail('scroll-animation');
    if (
      fontFamilies(style.fontFamily).some((name) => fonts.has(name))
    )
      fail('scroll-webfont-unembedded');
    if (['VIDEO', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED'].includes(node.tagName) || node.shadowRoot)
      fail('scroll-live-media');
    if (
      ['TEXTAREA', 'SELECT', 'INPUT'].includes(node.tagName) &&
      (node.scrollTop || node.scrollLeft)
    )
      fail('scroll-native-control');
    if (
      style.direction === 'rtl' &&
      (node.scrollTop || node.scrollLeft || /auto|scroll/.test(`${style.overflowX} ${style.overflowY} ${style.overflow}`))
    )
      fail('scroll-rtl-unverified');
    if (
      (node.scrollTop || node.scrollLeft) &&
      Array.from(node.childNodes).some(
        (child) => child.nodeType === 3 && !!child.textContent?.trim(),
      )
    )
      fail('scroll-direct-text');
    for (const pseudo of ['::before', '::after']) {
      const p = view.getComputedStyle(node, pseudo);
      if (p.content && p.content !== 'none' && p.content !== 'normal') {
        if (
          ['fixed', 'sticky'].includes(p.position) ||
          (p.animationName && p.animationName !== 'none') ||
          node.scrollTop ||
          node.scrollLeft
        )
          fail('scroll-pseudo-unverified');
        if (
          fontFamilies(p.fontFamily).some((name) => fonts.has(name))
        )
          fail('scroll-webfont-unembedded');
      }
    }
    if (node.tagName === 'IMG') {
      const image = node as HTMLImageElement;
      if (!image.complete || !image.naturalWidth || !localResource(image.currentSrc || image.src))
        fail('scroll-image-unverified');
    }
    if (node.namespaceURI === 'http://www.w3.org/2000/svg') {
      if (
        ['foreignObject', 'animate', 'animateTransform', 'animateMotion', 'set', 'script'].includes(
          node.localName,
        )
      )
        fail('scroll-svg-live-content');
      for (const attr of ['href', 'xlink:href']) {
        const href = node.getAttribute(attr);
        if (
          href &&
          (!href.startsWith('#') || !viewport.contains(doc.getElementById(href.slice(1))))
        )
          fail('scroll-svg-resource');
      }
      for (const attr of ['fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end'])
        for (const match of node.getAttribute(attr)?.matchAll(/url\(["']?([^"')]+)["']?\)/g) ?? [])
          if (
            !match[1]?.startsWith('#') ||
            !viewport.contains(doc.getElementById(match[1].slice(1)))
          )
            fail('scroll-svg-resource');
    }
    for (const match of style.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g))
      if (!localResource(match[1]!)) fail('scroll-resource-unverified');
    if (!['fixed', 'sticky'].includes(style.position)) continue;
    if (node === viewport || !/^\d+$/.test(style.zIndex) || Number(style.zIndex) < 1)
      fail('scroll-positioned-stacking');
    const clips: Box[] = [];
    for (
      let ancestor = node.parentElement;
      ancestor && ancestor !== viewport;
      ancestor = ancestor.parentElement
    ) {
      const a = view.getComputedStyle(ancestor),
        parentDisplay = ancestor.parentElement
          ? view.getComputedStyle(ancestor.parentElement).display
          : '';
      if (
        isStackingAncestor(a) ||
        ['fixed', 'sticky'].includes(a.position) ||
        (a.zIndex !== '' && a.zIndex !== 'auto' && /^(inline-)?(flex|grid)$/.test(parentDisplay))
      )
        fail('scroll-positioned-ancestry');
      const clipsX = /^(hidden|clip|auto|scroll)$/.test(a.overflowX || a.overflow),
        clipsY = /^(hidden|clip|auto|scroll)$/.test(a.overflowY || a.overflow);
      if (style.position === 'sticky' && (clipsX || clipsY)) {
        if (
          [
            'borderTopLeftRadius',
            'borderTopRightRadius',
            'borderBottomLeftRadius',
            'borderBottomRightRadius',
          ].some(
            (key) =>
              parseFloat(a.getPropertyValue(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`))) >
              0,
          )
        )
          fail('scroll-rounded-positioned-clip');
        const r = box(ancestor);
        clips.push({
          left: clipsX ? r.left + ancestor.clientLeft : -Infinity,
          top: clipsY ? r.top + ancestor.clientTop : -Infinity,
          right: clipsX ? r.left + ancestor.clientLeft + ancestor.clientWidth : Infinity,
          bottom: clipsY ? r.top + ancestor.clientTop + ancestor.clientHeight : Infinity,
          width: ancestor.clientWidth,
          height: ancestor.clientHeight,
        });
      }
    }
    positioned.push({ node, projection: projectPositionedRect(box(node), rootBox, clips) });
  }
  // Lifted surfaces are appended in their original order. An ordinary stacking
  // sibling at the same positive level would lose its relative tree order, so
  // do not claim that ambiguous overlap is faithfully composed.
  if (positioned.length) {
    const liftedLevels = new Set(positioned.map(({ node }) => Number(view.getComputedStyle(node).zIndex)));
    for (const node of nodes) {
      if (node === viewport || positioned.some((item) => item.node.contains(node))) continue;
      const style = view.getComputedStyle(node),
        parentDisplay = node.parentElement ? view.getComputedStyle(node.parentElement).display : '';
      if (
        style.zIndex !== '' && style.zIndex !== 'auto' &&
        (style.position !== 'static' || /^(inline-)?(flex|grid)$/.test(parentDisplay)) &&
        liftedLevels.has(Number(style.zIndex))
      )
        fail('scroll-positioned-paint-order');
    }
  }
  // preserveScroll translates direct element children. That transform must
  // not capture an absolute descendant's formerly external containing block,
  // or introduce a new z-order boundary for explicitly layered descendants.
  for (const scroller of nodes.filter((node) => !!node.scrollLeft || !!node.scrollTop))
    for (const child of Array.from(scroller.children))
      for (const node of [child, ...child.querySelectorAll<HTMLElement>('*')]) {
        const style = view.getComputedStyle(node);
        if (['fixed', 'sticky'].includes(style.position)) continue;
        if (
          style.position === 'absolute' &&
          node !== child &&
          !child.contains((node as HTMLElement).offsetParent)
        )
          fail('scroll-absolute-containing-block');
        if (
          node !== child &&
          style.zIndex !== '' &&
          style.zIndex !== 'auto' &&
          !isStackingAncestor(view.getComputedStyle(child))
        )
          fail('scroll-created-stacking-context');
      }
  return { root: viewport, rootBox, targetBox, nodes, positioned };
}
function paintSignature(node: HTMLElement): unknown {
  const view = node.ownerDocument.defaultView!;
  const properties = (style: CSSStyleDeclaration) =>
    Array.from({ length: style.length }, (_, index) => {
      const key = style.item(index);
      return [key, style.getPropertyValue(key)];
    });
  return [
    properties(view.getComputedStyle(node)),
    ...['::before', '::after'].map((pseudo) => {
      const style = view.getComputedStyle(node, pseudo);
      return style.content && !['none', 'normal'].includes(style.content)
        ? properties(style)
        : style.content;
    }),
  ];
}
function signature(nodes: readonly HTMLElement[]): string {
  return JSON.stringify(
    nodes.map((node) => ({
      tag: node.tagName,
      attributes: Array.from(node.attributes, (a) => [a.name, a.value]),
      text: node.childElementCount ? undefined : node.textContent,
      scroll: [node.scrollLeft, node.scrollTop],
      bounds: [box(node).left, box(node).top, box(node).width, box(node).height],
      value: ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
        ? (node as HTMLInputElement).value
        : undefined,
      checked: node.tagName === 'INPUT' ? (node as HTMLInputElement).checked : undefined,
      focused: node === node.ownerDocument.activeElement,
      hovered: node.matches(':hover'),
      // Stylesheet edits outside the observed root can alter text or paint
      // without changing attributes or boxes. Snapshot every computed property,
      // including active generated content, rather than an incomplete shortlist.
      styles: paintSignature(node),
    })),
  );
}
let engineOwner: symbol | undefined,
  engineStalled = false;
function deadline<T>(operation: Promise<T>, milliseconds: number, reason: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('STUDIO_CAPTURE_SCROLL_ENGINE_STALLED'), {
            captureReason: reason,
          }),
        ),
      milliseconds,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
/** Public library hooks map existing nodes to detached clones, then freeze measured
 * fixed/sticky surfaces after copied styles and scroll translations are complete. */
export async function captureScrolledViewport(
  element: HTMLElement,
  viewport: HTMLElement | undefined,
  limits: { width: number; height: number; bytes: number },
): Promise<Blob> {
  if (engineOwner)
    fail(engineStalled ? 'scroll-engine-stalled-reload-required' : 'scroll-engine-busy');
  const owner = Symbol('scroll-capture');
  engineOwner = owner;
  engineStalled = false;
  let libraryStarted = false,
    librarySettled = false;
  let observer: MutationObserver | undefined;
  try {
    const prepared = prepareScrollCapture(element, viewport ?? element),
      { root, rootBox, targetBox, nodes, positioned } = prepared;
    const token = signature(nodes);
    let changed = false,
      resourceFailure = false,
      warning = false;
    observer = new MutationObserver((records) => {
      if (records.length) changed = true;
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const clones = new Map<Node, HTMLElement>();
    const library = await deadline(import('dom-to-image-more'), 8000, 'scroll-engine-load-timeout');
    const domtoimage = library.default;
    libraryStarted = true;
    const rendering = Promise.resolve().then(() =>
      domtoimage.toSvg(root, {
        width: Math.ceil(rootBox.width),
        height: Math.ceil(rootBox.height),
        style: {
          width: root.ownerDocument.defaultView!.getComputedStyle(root).width,
          height: root.ownerDocument.defaultView!.getComputedStyle(root).height,
        },
        preserveScroll: true,
        copyDefaultStyles: false,
        disableEmbedFonts: true,
        cacheBust: false,
        ensureShown: false,
        httpTimeout: 5000,
        requestInterceptor: (url: string) => {
          // Returning a rejected promise, rather than throwing, prevents the
          // dependency's synchronous-error recovery from falling through to XHR.
          if (rasterData.test(url) && localResource(url)) return Promise.resolve(url);
          // The only fetch destination is an admitted same-origin blob URL.
          // HTTP(S), foreign blobs, opaque origins and credential URLs stop here.
          const blobUrl = approvedCaptureBlobUrl(url, root.ownerDocument.baseURI);
          if (!blobUrl) {
            resourceFailure = true;
            return Promise.reject(new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED'));
          }
          const abort = new AbortController(),
            timer = setTimeout(() => abort.abort(), 5000);
          return fetch(blobUrl, { signal: abort.signal, credentials: 'omit', redirect: 'error' })
            .then(async (response) => {
              const type =
                response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
              if (!response.ok || !/^image\/(png|jpeg)$/.test(type) || !response.body)
                throw new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED');
              const reader = response.body.getReader(),
                chunks: Uint8Array[] = [];
              let size = 0;
              while (true) {
                const part = await reader.read();
                if (part.done) break;
                size += part.value.byteLength;
                if (size > 4 * 1024 * 1024) {
                  abort.abort();
                  void reader.cancel();
                  throw new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED');
                }
                chunks.push(part.value);
              }
              const bytes = new Uint8Array(size);
              let offset = 0;
              for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
              }
              if (!isStaticCaptureRaster(bytes, type))
                throw new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED');
              return new Promise<string>((resolve, reject) => {
                const file = new FileReader();
                file.onload = () => resolve(String(file.result));
                file.onerror = () => reject(new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED'));
                file.readAsDataURL(new Blob([bytes], { type }));
              });
            })
            .catch(() => {
              resourceFailure = true;
              throw new Error('STUDIO_CAPTURE_RESOURCE_UNSUPPORTED');
            })
            .finally(() => clearTimeout(timer));
        },
        onImageError: () => {
          resourceFailure = true;
        },
        logger: {
          warn: () => {
            warning = true;
          },
          error: () => {
            warning = true;
          },
        },
        adjustClonedNode: (native: Node, clone: Node, after: boolean) => {
          if (after && clone.nodeType === 1) clones.set(native, clone as HTMLElement);
        },
        onclone: (clone: Node) => {
          const target = clone as HTMLElement;
          // Copied fixed widths plus fresh foreignObject scrollbars can create
          // a horizontal scrollbar that never existed in the source. Preserve
          // each measured scrollport's gutter as inert padding, not a second
          // interactive scrolling surface. Child widths remain source-frozen.
          for (const node of nodes) {
            const style = node.ownerDocument.defaultView!.getComputedStyle(node),
              scrollX = /^(auto|scroll)$/.test(style.overflowX || style.overflow),
              scrollY = /^(auto|scroll)$/.test(style.overflowY || style.overflow);
            if (!scrollX && !scrollY) continue;
            const copy = clones.get(node);
            if (!copy) fail('scroll-clone-correspondence');
            const metric = (key: string) => parseFloat(style.getPropertyValue(key)) || 0,
              gutterX = Math.max(0, node.offsetWidth - node.clientWidth - metric('border-left-width') - metric('border-right-width')),
              gutterY = Math.max(0, node.offsetHeight - node.clientHeight - metric('border-top-width') - metric('border-bottom-width')),
              bounds = box(node);
            Object.assign(copy.style, {
              boxSizing: 'border-box',
              width: `${bounds.width}px`,
              height: `${bounds.height}px`,
              scrollbarGutter: 'auto',
              paddingRight: `${metric('padding-right') + gutterX}px`,
              paddingBottom: `${metric('padding-bottom') + gutterY}px`,
            });
            if (scrollX) copy.style.overflowX = 'hidden';
            if (scrollY) copy.style.overflowY = 'hidden';
          }
          Object.assign(target.style, {
            position: 'relative',
            left: '0',
            top: '0',
            right: 'auto',
            bottom: 'auto',
            margin: '0',
          });
          for (const item of positioned) {
            const placeholder = clones.get(item.node);
            if (!placeholder) fail('scroll-clone-correspondence');
            const overlay = placeholder.cloneNode(true) as HTMLElement;
            placeholder.style.opacity = '0';
            placeholder.style.visibility = 'hidden';
            for (const node of [placeholder, ...placeholder.querySelectorAll('[id]')])
              node.removeAttribute('id');
            if (!item.projection.visible) continue;
            const p = item.projection;
            Object.assign(overlay.style, {
              position: 'absolute',
              left: `${p.left}px`,
              top: `${p.top}px`,
              width: `${p.width}px`,
              height: `${p.height}px`,
              right: 'auto',
              bottom: 'auto',
              margin: '0',
              transform: 'none',
              translate: 'none',
              rotate: 'none',
              scale: 'none',
              boxSizing: 'border-box',
              minWidth: '0',
              minHeight: '0',
              maxWidth: 'none',
              maxHeight: 'none',
              clipPath: `inset(${p.inset.map((n) => `${n}px`).join(' ')})`,
            });
            target.append(overlay);
          }
        },
      }),
    );
    const settled = rendering.then(
      (value) => {
        librarySettled = true;
        if (engineOwner === owner) {
          engineOwner = undefined;
          engineStalled = false;
        }
        return value;
      },
      (error) => {
        librarySettled = true;
        if (engineOwner === owner) {
          engineOwner = undefined;
          engineStalled = false;
        }
        throw error;
      },
    );
    let svg: string;
    try {
      svg = await deadline(settled, 8000, 'scroll-engine-stalled-reload-required');
    } catch (error) {
      if (!librarySettled && engineOwner === owner) engineStalled = true;
      throw error;
    }
    if (resourceFailure || warning) fail('scroll-resource-or-library-warning');
    if (svg.length > 6 * 1024 * 1024) fail('scroll-svg-limit');
    const image = new Image();
    try {
      await deadline(
        new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('STUDIO_CAPTURE_FAILED'));
          image.src = svg;
        }),
        5000,
        'scroll-image-decode-timeout',
      );
    } finally {
      image.onload = null;
      image.onerror = null;
    }
    // Match the ordinary path's exact target/viewport intersection. In
    // particular, do not mislabel a viewport scrollbar gutter as target pixels.
    const cropLeft = Math.max(0, targetBox.left - rootBox.left),
      cropTop = Math.max(0, targetBox.top - rootBox.top);
    const width = Math.min(
        Math.ceil(
          Math.min(rootBox.right, targetBox.right) - Math.max(rootBox.left, targetBox.left),
        ),
        limits.width,
      ),
      height = Math.min(
        Math.ceil(
          Math.min(rootBox.bottom, targetBox.bottom) - Math.max(rootBox.top, targetBox.top),
        ),
        limits.height,
      ),
      canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) fail('scroll-no-canvas');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, cropLeft, cropTop, width, height, 0, 0, width, height);
    for (const quality of [0.85, 0.65, 0.45]) {
      const blob = await deadline(
        new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality)),
        5000,
        'scroll-image-encode-timeout',
      );
      changed ||= !!observer.takeRecords().length;
      if (changed || signature(nodes) !== token)
        throw Object.assign(new Error('STUDIO_CAPTURE_STALE'), {
          captureReason: 'scroll-source-changed',
        });
      prepareScrollCapture(element, viewport ?? element);
      if (blob && blob.size > 0 && blob.size <= limits.bytes) return blob;
    }
    throw new Error('STUDIO_CAPTURE_IMAGE_LIMIT');
  } finally {
    observer?.disconnect();
    if ((!libraryStarted || librarySettled) && engineOwner === owner) {
      engineOwner = undefined;
      engineStalled = false;
    }
  }
}
