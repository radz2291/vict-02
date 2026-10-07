<script lang="ts">
  import { page } from '$app/state';
  import { Feedback } from '@victframework/ui-svelte';
</script>
<main style="max-width: 800px; padding: 32px; margin: auto">
  <a href="/">VICT / Inspections</a>
  <h1>We could not open this page</h1>
  <Feedback kind="error" message={page.status === 404 ? 'This inspection is unavailable. Return to the queue and select a current inspection.' : 'The workspace could not load. Reload this page to try again, or return to the queue.'} />
  <a href="/">Return to inspection queue</a>
</main>
