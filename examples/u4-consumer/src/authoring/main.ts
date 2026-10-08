// Theme + catalog styling in the required order (styles first — tokens and
// vict-app scope; then catalog part styling scoped under .vict-controls).
import '@victframework/ui-svelte/styles.css';
import '@victframework/ui-svelte/catalog.css';
import { mount } from 'svelte';
import Workbench from './Workbench.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('#app missing');
mount(Workbench, { target });
