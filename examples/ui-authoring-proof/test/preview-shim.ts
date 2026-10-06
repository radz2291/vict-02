/** Minimal structural type for measurement scenarios (avoids importing the scenario schema). */
export type UiScenarioLike = Parameters<
  typeof import('@victframework/ui-preview').createPreviewSession
>[0]['scenario'];
