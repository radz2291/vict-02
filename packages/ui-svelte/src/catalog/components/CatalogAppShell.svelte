<script lang="ts">
  /**
   * B1 catalog wrapper: the PUBLIC AppShell adapted to the IO contract
   * (frozen fixture appshell-content.json). The authored `content` slot
   * fills the shell body; navigation/active/responsive behavior comes from
   * the shell's existing composition semantics via optional props.
   */
  import AppShell from '../../AppShell.svelte';
  import type { Snippet } from 'svelte';
  import type { UiSvelteComponentIO } from '../../document/extensions.js';

  interface Props {
    readonly props: Readonly<Record<string, unknown>>;
    readonly io?: UiSvelteComponentIO;
    readonly children?: Snippet;
  }
  let { props, io, children }: Props = $props();
  const title = $derived(typeof props.title === 'string' ? props.title : '');
  const groups = $derived(
    Array.isArray(props.navigation)
      ? [
          {
            label: '',
            links: (props.navigation as readonly { label?: unknown; href?: unknown }[]).map(
              (link) => ({
                label: String(link?.label ?? ''),
                href: String(link?.href ?? '#'),
                current: props.activeHref !== undefined && String(link?.href ?? '') === String(props.activeHref),
              }),
            ),
          },
        ]
      : [],
  );
</script>

<div class="vict-app" data-testid="catalog-appshell">
  <AppShell path="/" {title} {groups}>
    {@render children?.()}
  </AppShell>
</div>
