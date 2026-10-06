export interface PanelColor {
  hex: string;
  alpha: number;
  css: string;
}

/** Parse sRGB forms without changing authored bytes. Unknown forms stay unknown. */
export function parsePanelColor(raw: string): PanelColor | undefined {
  const value = raw.trim().toLowerCase();
  if (value === 'transparent') return result(0, 0, 0, 0);
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)?.[1];
  if (hex) {
    const expanded = hex.length < 5 ? [...hex].map((c) => c + c).join('') : hex;
    return result(
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1,
    );
  }
  const rgb = /^rgba?\((.*)\)$/.exec(value);
  if (rgb) {
    const parts = rgb[1]!.replace(/[,/]/g, ' ').split(/\s+/).filter(Boolean);
    if (
      (parts.length === 3 || parts.length === 4) &&
      parts.every((p) => /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/.test(p))
    ) {
      const channels = parts
        .slice(0, 3)
        .map((c) => (c.endsWith('%') ? (parseFloat(c) * 255) / 100 : Number(c)));
      const alpha = parts[3]
        ? parts[3].endsWith('%')
          ? parseFloat(parts[3]) / 100
          : Number(parts[3])
        : 1;
      if ([...channels, alpha].every(Number.isFinite))
        return result(channels[0]!, channels[1]!, channels[2]!, alpha);
    }
  }
}
function result(r: number, g: number, b: number, opacity: number): PanelColor {
  const channels = [r, g, b].map((c) => Math.round(Math.max(0, Math.min(255, c))));
  const alpha = Math.max(0, Math.min(1, opacity));
  return {
    hex: '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join(''),
    alpha,
    css: `rgba(${channels.join(', ')}, ${Number(alpha.toFixed(4))})`,
  };
}
/** Browser resolves named/HSL colors; never substitute a different effective value. */
export function resolvePanelColor(value: string): PanelColor | undefined {
  const parsed = parsePanelColor(value);
  if (parsed || !value || typeof document === 'undefined' || !document.body) return parsed;
  if (/var\(|currentcolor|inherit|initial|unset|revert|color-mix\(/i.test(value)) return;
  const probe = document.createElement('span');
  probe.style.setProperty('color', value, 'important');
  if (!probe.style.color) return;
  probe.style.position = 'fixed';
  probe.style.visibility = 'hidden';
  document.body.append(probe);
  try {
    return parsePanelColor(getComputedStyle(probe).color);
  } finally {
    probe.remove();
  }
}
export function colorWithAlpha(hex: string, alpha: number): string {
  const color = parsePanelColor(hex);
  if (!color) return hex;
  const channels = [1, 3, 5].map((start) => parseInt(color.hex.slice(start, start + 2), 16));
  return result(channels[0]!, channels[1]!, channels[2]!, alpha).css;
}
