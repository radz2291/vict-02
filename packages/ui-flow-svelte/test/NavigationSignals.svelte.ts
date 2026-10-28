import type { Node } from '@xyflow/svelte';
export const navigationSignals = $state({ nodes: [] as Node[], ready: false, request: undefined as object | undefined });
