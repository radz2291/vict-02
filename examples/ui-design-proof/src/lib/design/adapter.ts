/**
 * Design-proof catalogs and the preview action adapter.
 *
 * The adapter is REAL state: `design.submitContact` validates the typed
 * fields and returns an honest outcome (ok / denied with field issues).
 * Nothing is stored; the outcome is rendered by the host next to the form
 * (aria-describedby wiring points at `design-form-feedback`).
 */
import { defaultSemanticElementCatalog, type UiCatalogs } from '@victframework/ui';

export const designCatalogs: UiCatalogs = {
  elements: defaultSemanticElementCatalog(),
  actionIds: ['design.submitContact'],
  routeIds: [],
  viewFields: {},
};

export type ContactOutcome =
  | {
      readonly status: 'ok';
      readonly heading: string;
      readonly detail: string;
    }
  | {
      readonly status: 'denied';
      readonly heading: string;
      readonly issues: readonly { readonly field: string; readonly message: string }[];
    };

export interface ContactFields {
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

export function readContactFields(container: ParentNode): ContactFields {
  const read = (id: string): string =>
    (
      container.querySelector(`#${CSS.escape(id)}`) as HTMLInputElement | HTMLTextAreaElement | null
    )?.value?.trim() ?? '';
  return {
    name: read('svc.fieldName'),
    email: read('svc.fieldEmail'),
    message: read('svc.fieldMessage'),
  };
}

export function validateContact(fields: ContactFields): ContactOutcome {
  const issues: { field: string; message: string }[] = [];
  if (fields.name === '') issues.push({ field: 'svc.fieldName', message: 'Enter your name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    issues.push({
      field: 'svc.fieldEmail',
      message: 'Enter an email address in the name@example.org form.',
    });
  }
  if (fields.message.length < 12) {
    issues.push({
      field: 'svc.fieldMessage',
      message: 'Tell us a little more — at least 12 characters.',
    });
  }
  if (issues.length > 0) {
    return {
      status: 'denied',
      heading: 'The request was not sent yet:',
      issues,
    };
  }
  return {
    status: 'ok',
    heading: 'Request sent (simulated).',
    detail: `Thanks ${fields.name} — this proof does not store anything, but a reply would reach ${fields.email} within two working days.`,
  };
}
