/** Type shim: Svelte components are compiled by the svelte/vite pipeline;
 * TypeScript sees the default export as a generic component. */
declare module '*.svelte' {
  import type { Component } from 'svelte';
  const component: Component<Record<string, unknown>>;
  export default component;
}
