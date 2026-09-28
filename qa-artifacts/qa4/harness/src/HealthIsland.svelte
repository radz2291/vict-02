<script lang="ts">
  /**
   * A trusted custom component island (the application's registered code).
   * Renders its props verbatim as data attributes so the QA driver can
   * prove the props reach the component UNCHANGED through the slot path
   * (string, number, and boolean props — the declared prop value contract).
   */
  let { label, count, pinned }: { label?: string; count?: number; pinned?: boolean } = $props();
</script>

<div
  class="health-island"
  data-testid="custom-island"
  data-label={label}
  data-count={count}
  data-pinned={pinned}
>
  <strong>Island:</strong> {label} · count {count} · pinned {pinned === true ? 'yes' : 'no'}
</div>

<style>
  .health-island {
    border: 2px solid #7a9b3f;
    border-radius: 10px;
    padding: 10px 14px;
    background: #f2f7e6;
    font: 14px system-ui;
  }
</style>
