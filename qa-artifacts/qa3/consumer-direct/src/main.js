// QA P3 packed consumer — compat styling path.
// CONSUMER-STYLE-VARIATION: only this import differs between the two consumers.
import '@victframework/ui-svelte/styles.css';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app') });

export default app;
