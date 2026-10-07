import type { UiSvelteExtensionImplementation } from '@victframework/ui-svelte';
import Button from './extensions/ButtonExtension.svelte';
import Status from './extensions/StatusExtension.svelte';
import Feedback from './extensions/FeedbackExtension.svelte';
import Evidence from './extensions/EvidenceExtension.svelte';

/** Explicit code boundary; serialized documents carry only descriptor identities. */
export const productImplementations: readonly UiSvelteExtensionImplementation[] = [
  {
    extensionId: 'ext.evidenceViewer',
    revision: '2',
    rendererImplementationId: 'impl.evidenceViewer.placeholder.v2',
    component: Evidence,
  },
  {
    extensionId: 'ext.button',
    revision: '1',
    rendererImplementationId: 'impl.vict.button.submit',
    component: Button,
  },
  {
    extensionId: 'ext.status',
    revision: '1',
    rendererImplementationId: 'impl.vict.status',
    component: Status,
  },
  {
    extensionId: 'ext.feedback',
    revision: '1',
    rendererImplementationId: 'impl.vict.feedback',
    component: Feedback,
  },
];
