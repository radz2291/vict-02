/** Application-owned human-readable text for an action's outcomes (@2). */
export interface UiActionFeedbackText {
  readonly success?: string;
  readonly validation?: string;
  readonly denied?: string;
  readonly failure?: string;
}
export interface UiActionFeedback {
  readonly kind: 'success' | 'validation' | 'denied' | 'failure';
  readonly message: string;
  /**
   * The action succeeded but its data refresh failed, so the rendered
   * record may be out of date. Rendered as a DISTINCT stale-data note —
   * never as an action failure and never with a re-run invitation.
   */
  readonly dataStale?: boolean;
}
/** Closed outcome keys of the @2 action-feedback declaration. */
export const ACTION_FEEDBACK_OUTCOMES: readonly string[] = [
  'success',
  'validation',
  'denied',
  'failure',
];

export function validateActionFeedback(
  value: unknown,
  path = 'feedback',
): readonly { path: string; message: string }[] {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return [{ path, message: 'Action feedback must be an object.' }];
  return Object.keys(value)
    .sort()
    .flatMap((key) => {
      const text = (value as Record<string, unknown>)[key];
      return !ACTION_FEEDBACK_OUTCOMES.includes(key) ||
        typeof text !== 'string' ||
        text.trim().length === 0
        ? [
            {
              path: path + '.' + key,
              message: 'Action feedback must declare a supported outcome with non-empty text.',
            },
          ]
        : [];
    });
}
/** Inputs are safe application-boundary results, never raw caught exceptions. */
export function actionFeedback(
  result: { ok: boolean; code?: string; message?: string; dataStale?: boolean },
  text: UiActionFeedbackText = {},
  isSave = false,
): UiActionFeedback {
  const kind = result.ok
    ? 'success'
    : result.code === 'CONTRACT_REJECTED'
      ? 'validation'
      : result.code === 'DATA_UNAUTHORIZED'
        ? 'denied'
        : 'failure';
  const defaults = {
    success: isSave ? 'Changes saved.' : 'Action completed.',
    validation: 'Check your details and try again.',
    denied: 'You don’t have permission to do this. Ask an owner for access.',
    failure: isSave
      ? 'We couldn’t save your changes. Your draft is still here. Try again.'
      : 'The action could not be completed. Try again.',
  };
  return {
    kind,
    message: text[kind] ?? result.message ?? defaults[kind],
    ...(kind === 'success' && result.dataStale === true ? { dataStale: true } : {}),
  };
}
