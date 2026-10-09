import { copyUiValue, isUiValueOfType, type UiLocalStateDecl, type UiValue } from '@victframework/ui';

/** Match the document host's declared initial values before runtime overrides
 * arrive. Reading preview values never writes authored source or history. */
export function previewValues(declarations: Readonly<Record<string, UiLocalStateDecl>>, overrides: Readonly<Record<string, unknown>>): Record<string, UiValue> {
  const values: Record<string, UiValue> = {};
  for (const [key, declaration] of Object.entries(declarations)) {
    const candidate = isUiValueOfType(overrides[key], declaration.type) ? overrides[key] : declaration.initial;
    if (isUiValueOfType(candidate, declaration.type)) values[key] = copyUiValue(candidate);
  }
  return values;
}
