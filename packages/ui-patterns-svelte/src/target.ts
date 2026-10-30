import type { UiComponentPresentation } from '@victframework/ui-svelte';
/** Preserve authored part classes while retaining reusable component geometry. */
export function patternTarget(
  presentation: UiComponentPresentation | undefined,
  part: string,
  className: string,
): Record<string, unknown> {
  const target = presentation?.target(part);
  return { ...target, class: [className, target?.class].filter(Boolean).join(' ') };
}
