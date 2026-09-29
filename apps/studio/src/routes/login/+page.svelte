<script lang="ts">
  // Minimal accessible login (D-2): label + secret, native form POST.
  // No identity-provisioning UI exists (D-7) — provisioning is a
  // deployment-administrator concern.
  let { form }: { form?: { failed?: boolean } } = $props();
</script>

<svelte:head><title>Sign in — VICT Studio</title></svelte:head>

<main class="login">
  <h1>VICT Studio</h1>
  <p class="hint">Credentials are provisioned by the deployment administrator.</p>
  {#if form?.failed}
    <p class="error" role="alert">Sign-in failed. Check the label and secret.</p>
  {/if}
  <form method="POST" action="/login">
    <div>
      <label for="label">Operator label</label>
      <input id="label" name="label" type="text" autocomplete="username" required autofocus />
    </div>
    <div>
      <label for="secret">Secret</label>
      <input id="secret" name="secret" type="password" autocomplete="current-password" required />
    </div>
    <button type="submit">Sign in</button>
  </form>
</main>

<style>
  .login {
    max-width: 22rem;
    margin: 4rem auto;
    font-family: system-ui, sans-serif;
  }
  .hint {
    color: #555;
  }
  .error {
    color: #a11;
  }
  label {
    display: block;
    margin-top: 0.75rem;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    margin-top: 0.25rem;
    padding: 0.4rem;
  }
  button {
    margin-top: 1rem;
    padding: 0.45rem 1rem;
  }
</style>
