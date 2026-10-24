import { toSvg } from 'html-to-image';

export async function captureVariants(frame: HTMLElement) {
  const rect = frame.getBoundingClientRect(), computed = getComputedStyle(frame);
  const url = await toSvg(frame, { width: Math.ceil(rect.width), height: Math.ceil(rect.height), style: { width: computed.width, height: computed.height, margin: '0' } });
  const modes = ['baseline SVG', 'exact date fonts', 'date width + 1px', 'exact fonts and width + 1px', 'date nowrap', `SVG source pixel ratio ${devicePixelRatio}`, 'SVG scale 2'] as const;
  return Promise.all(modes.map(async mode => {
    const xml = new DOMParser().parseFromString(decodeURIComponent(url.slice(url.indexOf(',') + 1)), 'image/svg+xml');
    const group = xml.querySelector<HTMLElement>('[data-date-field-input]')!;
    if (mode.includes('fonts')) {
      for (const clone of xml.querySelectorAll<HTMLElement>('[data-date-field-input], [data-date-field-segment]')) {
        const originals = [...frame.querySelectorAll<HTMLElement>('[data-date-field-input], [data-date-field-segment]')];
        const clones = [...xml.querySelectorAll<HTMLElement>('[data-date-field-input], [data-date-field-segment]')];
        clone.style.fontSize = getComputedStyle(originals[clones.indexOf(clone)]!).fontSize;
      }
    }
    if (mode.includes('width')) group.style.width = `${parseFloat(getComputedStyle(frame.querySelector('[data-date-field-input]')!).width) + 1}px`;
    if (mode.includes('nowrap')) group.style.flexWrap = 'nowrap';
    if (mode.includes('SVG source') || mode.includes('scale 2')) {
      const scale = mode.includes('scale 2') ? 2 : devicePixelRatio;
      const svgRoot = xml.documentElement;
      const root = xml.querySelector('foreignObject')!.firstElementChild as HTMLElement;
      root.style.zoom = String(scale);
      xml.querySelector('foreignObject')!.setAttribute('width', String(Math.ceil(rect.width)*scale));
      xml.querySelector('foreignObject')!.setAttribute('height', String(Math.ceil(rect.height)*scale));
      svgRoot.setAttribute('viewBox', `0 0 ${Math.ceil(rect.width)*scale} ${Math.ceil(rect.height)*scale}`);
    }
    const svg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(xml))}`;
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = svg; });
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(rect.width); canvas.height = Math.ceil(rect.height);
    canvas.getContext('2d')!.drawImage(image, 0, 0);
    return { mode, src: canvas.toDataURL('image/png') };
  }));
}
