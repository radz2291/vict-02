import type { ApplicationDefinition } from '@victframework/sdk';

/** One scenario slice of the showcase Application Definition. */
export interface Scenario {
  readonly routes: ApplicationDefinition['routes'];
  readonly screens: ApplicationDefinition['screens'];
  readonly views: NonNullable<ApplicationDefinition['views']>;
  readonly forms: NonNullable<ApplicationDefinition['forms']>;
  readonly actions: ApplicationDefinition['actions'];
}

/** Convenience: one layout region. */
export function region(
  name: string,
  surfaces: readonly object[],
): ApplicationDefinition['screens'][number]['layout'][number] {
  return { name, surfaces: surfaces as never };
}
