<script>
  // A CONSUMER-SIDE custom component: the island implementation lives in the
  // host application and is registered through the component registry. The
  // renderer resolves it; ui-svelte never knows about this component.
  let { label, count, pinned } = $props();
</script>

<div class="consumer-island" data-testid="custom-island" data-label={label} data-count={count} data-pinned={pinned}>
  Consumer island: {label} · count {count} · pinned {pinned === true ? 'yes' : 'no'}
</div>

<style>
  .consumer-island {
    border: 2px solid #2f7dd1;
    border-radius: 10px;
    padding: 8px 12px;
    background: #eaf3fc;
    font: 14px system-ui;
  }
</style>
