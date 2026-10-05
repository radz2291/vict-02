<script lang="ts">
  /**
   * HistoryPanel — undo/redo and persistence controls over the bridge.
   * Shows the working/stored revision pair and the dirty flag so the
   * expected-revision save discipline is visible to the author.
   */
  interface Props {
    readonly revision: string;
    readonly storedRevision: string;
    readonly dirty: boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly onUndo: () => void;
    readonly onRedo: () => void;
    readonly onSave: () => void;
    readonly onReopen: () => void;
  }

  let { revision, storedRevision, dirty, canUndo, canRedo, onUndo, onRedo, onSave, onReopen }: Props = $props();
</script>

<section class="uv-history" aria-label="History">
  <h2>History</h2>
  <p>
    Working <code>{revision}</code> · stored <code>{storedRevision}</code>
    {#if dirty}<strong> (unsaved)</strong>{:else}<span> (saved)</span>{/if}
  </p>
  <div class="uv-history-actions">
    <button type="button" onclick={onUndo} disabled={!canUndo} aria-label="Undo">Undo</button>
    <button type="button" onclick={onRedo} disabled={!canRedo} aria-label="Redo">Redo</button>
    <button type="button" onclick={onSave} disabled={!dirty} aria-label="Save">Save</button>
    <button type="button" onclick={onReopen} aria-label="Reload stored document">Reload stored</button>
  </div>
</section>
