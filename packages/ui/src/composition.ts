/** Portable composition intent. Pixel mappings and interaction belong to renderers. */
export type UiContentWidth = 'standard' | 'wide' | 'full';
export type UiDensity = 'comfortable' | 'compact';
export type UiBreakpoint = 'small' | 'medium' | 'large';
export interface UiApplicationComposition {
  /** Omit primary navigation entirely, or choose its desktop arrangement. */
  readonly navigation?: 'sidebar' | 'top' | 'none';
  readonly contentWidth?: UiContentWidth;
  readonly density?: UiDensity;
  /** Below this breakpoint primary navigation becomes a closed modal drawer. */
  readonly responsive?: { readonly navigationAt?: Exclude<UiBreakpoint, 'large'> };
}
export interface UiPageComposition {
  readonly contentWidth?: UiContentWidth;
  readonly density?: UiDensity;
  readonly supportingWidth?: 'narrow' | 'standard';
  /** Split regions stack in declaration order below this breakpoint. */
  readonly stackAt?: UiBreakpoint;
}
export type UiLayoutMode = 'stack' | 'split';
export interface UiRegionPresentation {
  readonly size?: 'full' | 'main' | 'aside';
  readonly appearance?: 'plain' | 'panel';
  readonly flow?: 'stack' | 'inline';
}
export function resolveApplicationComposition(value: UiApplicationComposition = {}) {
  return {
    navigation: value.navigation ?? 'sidebar',
    contentWidth: value.contentWidth ?? 'wide',
    density: value.density ?? 'comfortable',
    navigationAt: value.responsive?.navigationAt ?? 'small',
  } as const;
}
export function resolvePageComposition(
  app: UiApplicationComposition = {},
  page: UiPageComposition = {},
) {
  const shell = resolveApplicationComposition(app);
  return {
    contentWidth: page.contentWidth ?? shell.contentWidth,
    density: page.density ?? shell.density,
    supportingWidth: page.supportingWidth ?? 'standard',
    stackAt: page.stackAt ?? 'large',
  } as const;
}
export interface UiCompositionIssue {
  readonly path: string;
  readonly message: string;
}
const widths = ['standard', 'wide', 'full'];
const densities = ['comfortable', 'compact'];
type FieldRules = Readonly<Record<string, readonly string[]>>;
function validateObject(
  value: unknown,
  path: string,
  rules: FieldRules,
  nestedResponsive = false,
): UiCompositionIssue[] {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    return [{ path, message: 'Composition must be an object.' }];
  }
  const issues: UiCompositionIssue[] = [];
  for (const key of Object.keys(value).sort()) {
    const member = (value as Record<string, unknown>)[key];
    const memberPath = path + '.' + key;
    if (nestedResponsive && key === 'responsive') {
      issues.push(...validateObject(member, memberPath, { navigationAt: ['small', 'medium'] }));
    } else if (!Object.hasOwn(rules, key)) {
      issues.push({ path: memberPath, message: 'Unknown composition choice.' });
    } else if (typeof member !== 'string' || !rules[key]?.includes(member)) {
      issues.push({ path: memberPath, message: 'Invalid composition choice.' });
    }
  }
  return issues;
}
/** Closed, deterministic runtime validation shared by compilers and other renderers. */
export function validateApplicationComposition(
  value: unknown,
  path = 'composition',
): readonly UiCompositionIssue[] {
  return validateObject(
    value,
    path,
    {
      navigation: ['sidebar', 'top', 'none'],
      contentWidth: widths,
      density: densities,
    },
    true,
  );
}
export function validatePageComposition(
  value: unknown,
  path = 'composition',
): readonly UiCompositionIssue[] {
  return validateObject(value, path, {
    contentWidth: widths,
    density: densities,
    supportingWidth: ['narrow', 'standard'],
    stackAt: ['small', 'medium', 'large'],
  });
}

export function validateLayoutMode(
  value: unknown,
  path = 'layoutMode',
): readonly UiCompositionIssue[] {
  return value === 'stack' || value === 'split'
    ? []
    : [{ path, message: 'Invalid screen layoutMode.' }];
}
export function validateRegionPresentation(
  value: unknown,
  path = 'region',
): readonly UiCompositionIssue[] {
  return validateObject(value, path, {
    size: ['full', 'main', 'aside'],
    appearance: ['plain', 'panel'],
    flow: ['stack', 'inline'],
  });
}
