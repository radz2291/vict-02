<script lang="ts">
  let { type, position, ...rest }: { type: string; position: string; [key: string]: unknown } = $props();
</script>
<div data-test-handle={type} data-test-position={position} {...rest}></div>
