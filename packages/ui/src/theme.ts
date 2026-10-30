import type { UiApplicationTheme, UiThemeRole } from './document.js';

/** Implementation-linked semantic aliases shared by catalog controls and AI presentation. */
export const UI_THEME_VARIABLES: Readonly<Record<UiThemeRole, readonly string[]>> = {
  surface: ['--vict-theme-surface', '--vict-color-bg', '--vict-color-surface', '--background', '--card', '--popover', '--input'],
  text: ['--vict-theme-text', '--vict-color-text', '--foreground', '--card-foreground', '--popover-foreground'],
  textMuted: ['--vict-color-textMuted', '--muted-foreground'],
  border: ['--vict-color-border', '--border'],
  accent: ['--vict-theme-accent', '--vict-color-accent', '--primary'],
  accentText: ['--vict-theme-accent-text', '--vict-color-accentContrast', '--primary-foreground'],
  highlight: ['--vict-theme-highlight', '--accent', '--muted'],
  highlightText: ['--vict-theme-highlight-text', '--accent-foreground'],
  focusRing: ['--vict-color-focusRing', '--ring'],
  disabledSurface: ['--vict-theme-disabled-surface'],
  disabledText: ['--vict-theme-disabled-text'],
  elevation: ['--vict-elevation-high'],
};

export function uiThemeDeclarations(theme?: UiApplicationTheme): readonly { property: string; value: { type: 'literal'; value: string } }[] {
  return Object.entries(theme?.roles ?? {}).flatMap(([role, value]) =>
    (UI_THEME_VARIABLES[role as UiThemeRole] ?? []).map(property => ({ property, value: { type: 'literal' as const, value: value! } })));
}
